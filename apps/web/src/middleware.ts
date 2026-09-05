import {
  adminWorldDeniedRedirect,
  isAdminTier,
  isBlockedForInstructor,
  shouldEnterAdminWorld,
  shouldEnterSuperWorld,
} from "@/lib/admin-world"
import {
  applyCorsHeaders,
  checkApiKeyRateLimit,
  extractApiKeyContext,
  handleCorsPreflightPublicApi,
  logApiUsage,
  requireScope,
} from "@/lib/api-auth"
import type { ApiScope } from "@/lib/api-auth"
import type { RateLimiter } from "@/lib/rate-limit"
import {
  authLimiter,
  catchAllLimiter,
  chatLimiter,
  courseCreateLimiter,
  privacyLimiter,
  questionGenLimiter,
} from "@/lib/rate-limit"
import { hostDeDestinoD3 } from "@/lib/tenant/pertencimento"
import { resolverTenantDaRequisicao } from "@/lib/tenant/resolver"
import type { TenantContexto } from "@/lib/tenant/tipos"
import { accessibleWorkspaces, canEnterStudio, workspaceHomeRoute } from "@/lib/workspace-resolver"
import type { Role } from "@eximia/shared"
import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"
import { dominioBase } from "../tenant.config"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

// ---------------------------------------------------------------------------
// RUNTIME NODE, E NÃO É PREFERÊNCIA
//
// A resolução de tenant por host (D2) consulta `tenant_domains` com o service
// client e memoiza o resultado num `Map` de módulo com TTL de 60s
// (`lib/tenant/cache.ts`). No runtime Edge — o default do middleware — esse
// mapa vive dentro de um isolate efêmero e replicado: cada isolate teria a
// própria cópia, o TTL não seria observável e a taxa de acerto tenderia a
// zero. Sobraria o custo (uma consulta por requisição anônima, com a chave de
// serviço) sem o benefício. No runtime `nodejs` há um processo por instância e
// o cache é compartilhado por todas as requisições dela.
//
// Node middleware é estável a partir do Next 15.5 (o app está em 15.5.x); em
// versões anteriores exigiria `experimental.nodeMiddleware: true`.
// ---------------------------------------------------------------------------
export const runtime = "nodejs"

// ---------------------------------------------------------------------------
// Rate limiting helper
// ---------------------------------------------------------------------------

async function checkLimit(
  limiter: RateLimiter,
  identifier: string,
  limiterName: string,
  pathname: string,
): Promise<NextResponse | null> {
  try {
    const { success, reset } = await limiter.limit(identifier)
    if (!success) {
      const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
      console.warn(`[rate-limit] ${limiterName} exceeded for ${identifier} on ${pathname}`)
      return NextResponse.json(
        { error: "Too Many Requests", retryAfter },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        },
      )
    }
  } catch (err) {
    console.warn(`[rate-limit] Redis error for ${limiterName}, failing open:`, err)
  }
  return null
}

// ---------------------------------------------------------------------------
// Public API v1
// ---------------------------------------------------------------------------

const V1_SCOPE_MAP: Record<string, ApiScope> = {
  "/api/v1/courses": "courses:read",
  "/api/v1/blueprints": "blueprints:read",
  "/api/v1/enrollments": "enrollments:read",
  "/api/v1/analytics": "analytics:read",
}

// POST routes require write scopes — handled inside each route handler

function getRequiredScope(pathname: string): ApiScope | null {
  for (const [prefix, scope] of Object.entries(V1_SCOPE_MAP)) {
    if (pathname.startsWith(prefix)) return scope
  }
  if (pathname === "/api/v1/docs") return null
  return null
}

async function handlePublicApiRequest(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname
  const startTime = Date.now()

  const ctx = await extractApiKeyContext(request)
  const corsOrigins = ctx?.apiKey.corsOrigins ?? []
  const preflight = handleCorsPreflightPublicApi(request, corsOrigins)
  if (preflight) return preflight

  if (!ctx && pathname !== "/api/v1/docs") {
    return NextResponse.json(
      { error: "API key required. Use Authorization: Bearer exa_live_..." },
      { status: 401 },
    )
  }

  if (ctx) {
    const requiredScope = getRequiredScope(pathname)
    if (requiredScope && !requireScope(ctx.scopes, requiredScope)) {
      return NextResponse.json(
        { error: `Missing required scope: ${requiredScope}` },
        { status: 403 },
      )
    }

    const rateLimited = await checkApiKeyRateLimit(
      ctx.apiKey.id,
      ctx.apiKey.rateLimitRpm,
      ctx.apiKey.rateLimitRpd,
    )
    if (rateLimited) return rateLimited
  }

  // Build the headers forwarded to the route handler. Strip ANY x-api-* header
  // coming from the client so a caller cannot spoof tenant/key/scopes, then
  // re-set them from the validated context so the handler reads trusted values.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete("x-api-key-id")
  requestHeaders.delete("x-api-tenant-id")
  requestHeaders.delete("x-api-scopes")

  if (ctx) {
    requestHeaders.set("x-api-key-id", ctx.apiKey.id)
    requestHeaders.set("x-api-tenant-id", ctx.tenantId)
    requestHeaders.set("x-api-scopes", ctx.scopes.join(","))
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  applyCorsHeaders(response, request, corsOrigins)

  if (ctx) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown"
    logApiUsage({
      apiKeyId: ctx.apiKey.id,
      tenantId: ctx.tenantId,
      method: request.method,
      path: pathname,
      statusCode: 200,
      responseTimeMs: Date.now() - startTime,
      ipAddress: ip,
      userAgent: request.headers.get("user-agent") ?? "",
    })
  }

  return response
}

// ---------------------------------------------------------------------------
// Main middleware — auth + rate limiting + role-based redirects
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // --- Static public assets — skip all processing ---
  if (
    pathname.startsWith("/logos/") ||
    pathname.startsWith("/brand/") ||
    pathname === "/manifest.json" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return NextResponse.next()
  }

  // --- Public API v1 — API key auth (no Supabase session) ---
  // ANTES da resolução por host de propósito: aqui o tenant vem da CHAVE de
  // API (`x-api-tenant-id`), não do endereço. Resolver por host antes seria
  // pagar uma consulta para produzir um cabeçalho que ninguém lê — e, pior,
  // sugerir que existem dois eixos de tenant na mesma requisição.
  if (pathname.startsWith("/api/v1/")) {
    return handlePublicApiRequest(request)
  }

  // --- Qual empresa é esta? (D1/D2) ---------------------------------------
  // POSIÇÃO: depois do early-return de assets (um `/brand/logo.png` não precisa
  // saber de empresa nenhuma e não deve pagar consulta) e ANTES do bloco de
  // auth — porque o limitador por IP, que vem antes da sessão, já precisa do
  // slug para separar as cotas (D16), e porque a tela de login, anônima, já
  // tem que sair com a marca certa.
  //
  // O HOST NÃO AUTORIZA NADA. Ele decide QUAL MARCA e QUAL EMPRESA a tela
  // exibe; o que cada pessoa lê continua sendo decidido pela RLS com o JWT
  // dela. Ver `AGENTS.md` e `lib/tenant/resolver.ts`.
  const tenant = await resolverTenantDaRequisicao(
    request.headers,
    request.nextUrl.searchParams.get("tenant"),
  )

  /**
   * Os cabeçalhos que seguem para o handler.
   *
   * `x-tenant-*` vindos do CLIENTE são apagados antes de serem reescritos —
   * a mesma higiene que `handlePublicApiRequest` já faz com `x-api-*`. Sem
   * isso, um `curl -H "x-tenant-id: <uuid da empresa B>"` faria o Server
   * Component pintar a marca da B.
   *
   * É uma função e não uma constante porque o `setAll` do Supabase pode
   * REESCREVER os cookies da requisição ao renovar a sessão: um clone tirado
   * antes disso viajaria com o cookie velho.
   */
  const montarCabecalhos = (): Headers => {
    const h = new Headers(request.headers)
    h.delete("x-tenant-id")
    h.delete("x-tenant-slug")
    h.delete("x-tenant-origem")
    if (tenant.tenantId) h.set("x-tenant-id", tenant.tenantId)
    h.set("x-tenant-slug", tenant.slug)
    h.set("x-tenant-origem", tenant.origem)
    return h
  }

  // --- Rate limiting for API routes (IP-based, before auth) ---
  if (pathname.startsWith("/api/")) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown"

    // D16 — o identificador é `{slug}:{ip}`, não `{ip}`. Sem o slug, um NAT
    // corporativo da empresa A (um IP para centenas de pessoas) estoura a cota
    // e derruba o login da empresa B, que nada tem com isso. Host neutro entra
    // como `__neutro__`, que é um balde só — e é o correto: quem não tem
    // empresa não tem cota própria.
    const identificador = `${tenant.slug}:${ip}`

    if (pathname.startsWith("/api/auth")) {
      const blocked = await checkLimit(authLimiter, identificador, "authLimiter", pathname)
      if (blocked) return blocked
    }

    if (!pathname.startsWith("/api/auth")) {
      const blocked = await checkLimit(catchAllLimiter, identificador, "catchAllLimiter", pathname)
      if (blocked) return blocked
    }
  }

  // --- Supabase auth ---
  let response = NextResponse.next({ request: { headers: montarCabecalhos() } })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(
        cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>,
      ) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request: { headers: montarCabecalhos() } })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options as Record<string, string>)
        }
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // --- Rate limiting for API routes (user-based, after auth) ---
  if (pathname.startsWith("/api/") && user) {
    const userId = user.id

    if (/^\/api\/sessions\/[^/]+\/messages/.test(pathname)) {
      const blocked = await checkLimit(chatLimiter, userId, "chatLimiter", pathname)
      if (blocked) return blocked
    }

    if (/^\/api\/chapters\/[^/]+\/generate-questions/.test(pathname)) {
      const blocked = await checkLimit(questionGenLimiter, userId, "questionGenLimiter", pathname)
      if (blocked) return blocked
    }

    if (pathname === "/api/courses" && request.method === "POST") {
      const blocked = await checkLimit(courseCreateLimiter, userId, "courseCreateLimiter", pathname)
      if (blocked) return blocked
    }

    if (pathname.startsWith("/api/privacy")) {
      const blocked = await checkLimit(privacyLimiter, userId, "privacyLimiter", pathname)
      if (blocked) return blocked
    }
  }

  // --- Role check (cached in cookie for 5 min — UI optimization only) ---
  let userRole: string | null = null
  // Real hats (union from user_roles) — the authoritative axis for the new
  // workspace guards below. Scope reaches the protected-route checks.
  let effectiveHats: string[] = []
  if (!user) {
    // No active session (logged out / never authenticated): the cached role is
    // stale and must not survive a session change. Clear it as a UI hint only;
    // the authoritative role is always re-read from the DB while authenticated.
    if (request.cookies.get("x-user-role") || request.cookies.get("x-user-role-exp")) {
      response.cookies.delete("x-user-role")
      response.cookies.delete("x-user-role-exp")
    }
    // Same hygiene for the context hint: logged out => clear the elevated-context
    // cookie and any view-as-student cookie (UI hints only; never authoritative).
    if (request.cookies.get("x-active-context")) {
      response.cookies.delete("x-active-context")
      response.cookies.delete("x-view-as-student")
    }
    // Ephemeral workspace state dies with the session — clear it on logout too.
    if (request.cookies.get("x-active-workspace")) {
      response.cookies.delete("x-active-workspace")
    }
    // Role-lens is being retired (WP5); clearing on logout is basic hygiene.
    if (request.cookies.get("x-role-lens")) {
      response.cookies.delete("x-role-lens")
    }
  }
  if (user) {
    const roleCookie = request.cookies.get("x-user-role")
    const roleCookieExpiry = request.cookies.get("x-user-role-exp")
    const now = Date.now()

    if (roleCookie?.value && roleCookieExpiry?.value && Number(roleCookieExpiry.value) > now) {
      userRole = roleCookie.value
    } else {
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle()
      userRole = profile?.role ?? null

      if (userRole) {
        const cookieOpts = {
          path: "/",
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax" as const,
          maxAge: 300,
        }
        response.cookies.set("x-user-role", userRole, cookieOpts)
        response.cookies.set("x-user-role-exp", String(now + 5 * 60 * 1000), cookieOpts)
      }
    }

    // --- Real hats (E1) — union of roles from user_roles, the authoritative
    // axis for the /instructor guard and post-login workspace routing. Read
    // directly here (middleware has no getAuthProfile). Defensive fallback to
    // the singular role only if user_roles is empty. ---
    const { data: hatRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
    const hats = (hatRows ?? []).map((r) => r.role as string)
    effectiveHats = hats.length > 0 ? hats : userRole ? [userRole] : []

    // --- Context hint hygiene (E7) — UI hint only; never authoritative. ---
    // Validate only the FORM of x-active-context. A corrupted form is discarded
    // and view-as-student is reset for coherence. Reach is server-side
    // (authorizeContextAccess) and ultimately RLS. NO new capability redirects.
    const rawCtx = request.cookies.get("x-active-context")?.value
    if (rawCtx) {
      let valid = false
      try {
        const p = JSON.parse(rawCtx)
        // `personal` is the explicit "Minha Trilha" sentinel (E7 §107); it is a
        // valid form alongside team/organization. It grants nothing — it only
        // narrows the screen to the student trail.
        valid = p?.type === "personal" || p?.type === "team" || p?.type === "organization"
      } catch {}
      if (!valid) {
        response.cookies.delete("x-active-context")
        if (request.cookies.get("x-view-as-student")) response.cookies.delete("x-view-as-student")
      }
    }
  }

  // --- D3: host × usuário divergem -----------------------------------------
  // A pessoa alcança o tenant do host (por `users.tenant_id` OU por
  // `user_tenant_memberships`)? Então serve. Senão, vai para o host canônico do
  // PRÓPRIO tenant primário. `super_admin` serve em qualquer host.
  //
  // NÃO É AUTORIZAÇÃO: a RLS já entrega a cada pessoa os dados DELA, digite
  // ela o endereço que digitar. O que o redirecionamento conserta é a
  // COERÊNCIA — ler os próprios dados vestido com a marca de outra empresa.
  //
  // A decisão em si é `hostDeDestinoD3` (função pura, testada); aqui só se
  // fazem as leituras, e só quando elas podem mudar a resposta: pessoa logada,
  // host do domínio da plataforma, e ela ainda não confirmada como do tenant do
  // host.
  //
  // O HOST NEUTRO ENTRA, e não é detalhe: o ápice do domínio base, `www.{base}`
  // e qualquer typo de subdomínio resolvem para NEUTRO com `tenantId = null`.
  // Exigir `tenant.tenantId` aqui deixava justamente esses três endereços —
  // todos alcançáveis por wildcard DNS — servindo o app logado inteiro com a
  // marca eximIA e os 6 módulos do NEUTRO para o admin de uma empresa real.
  // Quem decide se há destino continua sendo `hostDeDestinoD3`.
  //
  // `/api/*` fica de fora do ramo neutro de propósito: um 307 cruzando de
  // origem chega sem cookie de sessão (os cookies são host-only), então
  // redirecionar uma chamada de API trocaria uma marca incoerente por um 401.
  // Rota de API não pinta marca nenhuma — não há incoerência a consertar ali.
  const hostCarregaIdentidade =
    tenant.origem === "dominio-proprio" || tenant.origem === "subdominio"
  const hostNeutroDaPlataforma = tenant.origem === "neutro" && !pathname.startsWith("/api/")

  if (
    user &&
    (hostCarregaIdentidade || hostNeutroDaPlataforma) &&
    !effectiveHats.includes("super_admin")
  ) {
    const { data: dono } = await supabase
      .from("users")
      .select("tenant_id, tenants(slug)")
      .eq("id", user.id)
      .maybeSingle()

    const tenantDoUsuario = dono?.tenant_id ?? null
    const juncao = dono?.tenants as { slug?: string } | { slug?: string }[] | null | undefined
    const slugDoUsuario = Array.isArray(juncao) ? (juncao[0]?.slug ?? null) : (juncao?.slug ?? null)

    // A consulta de membership só roda quando a coluna já NÃO resolveu — é o
    // caso raro (acesso multiempresa), e não se paga por ele em todo request.
    let temMembership = false
    if (tenant.tenantId && tenantDoUsuario !== tenant.tenantId) {
      const { data: vinculo } = await supabase
        .from("user_tenant_memberships")
        .select("id")
        .eq("user_id", user.id)
        .eq("tenant_id", tenant.tenantId)
        .maybeSingle()
      temMembership = Boolean(vinculo)
    }

    const destino = hostDeDestinoD3({
      tenantDoHost: tenant.tenantId,
      origem: tenant.origem,
      chapeus: effectiveHats,
      tenantDoUsuario,
      slugDoUsuario,
      temMembership,
      hostAtual: tenant.host,
      base: dominioBase(),
    })

    if (destino) {
      const url = new URL(request.url)
      url.host = destino
      url.port = ""
      return NextResponse.redirect(url)
    }
  }

  // --- Protected routes ---
  const protectedPaths = [
    "/dashboard",
    "/courses",
    "/admin",
    "/analytics",
    "/instructor",
    // 4º mundo (rodada 9): a home do super admin é uma rota de topo própria, e
    // por isso precisa entrar aqui explicitamente — `/admin` não a cobre.
    "/super-admin",
    // D8 — defesa em profundidade, não correção de falha viva: as 9 rotas de
    // `/gauntlet-preview` já fazem `notFound()` em produção. Elas leem banco
    // REAL com o service client; deixá-las fora da lista dependeria de esse
    // `notFound()` nunca ser removido por descuido.
    "/gauntlet-preview",
  ]
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p))

  if (isProtected && !user) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Workspace boundary guard for /instructor — fail-closed by REAL hat, not the
  // legacy singular column. Sem um chapéu que alcança o Estúdio, /instructor é
  // barrado. Rodada 7: o predicado é `canEnterStudio` (instructor OU
  // super_admin), o MESMO que abre a porta em `accessibleWorkspaces` e que
  // guarda o layout do Estúdio — três camadas, uma regra só.
  if (pathname.startsWith("/instructor") && user && !canEnterStudio(effectiveHats)) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  // Fronteira do 4º MUNDO (rodada 9) — `/super-admin` é a home do super admin e
  // abre SÓ para o chapéu real `super_admin`, fail-closed, na mesma disciplina
  // do `/instructor` acima. Quem é admin-tier sem ser super_admin volta para a
  // home do PRÓPRIO mundo (`/admin`), nunca para `/dashboard` — mandá-lo ao
  // Padrão reescreveria o cookie de workspace e o expulsaria do mundo em que
  // está (o mesmo raciocínio de `adminWorldDeniedRedirect`).
  if (pathname.startsWith("/super-admin") && user && !effectiveHats.includes("super_admin")) {
    return NextResponse.redirect(new URL(adminWorldDeniedRedirect(effectiveHats), request.url))
  }

  // D8 — `/gauntlet-preview` exige o chapéu `super_admin`, pela MESMA regra do
  // `/super-admin` acima. São telas de medição que leem o banco de produção com
  // o service client; a trava de hoje é um `notFound()` dentro de cada página,
  // e uma trava que mora em 9 arquivos é uma trava que um dia falta em um.
  if (pathname.startsWith("/gauntlet-preview") && user && !effectiveHats.includes("super_admin")) {
    return NextResponse.redirect(new URL(adminWorldDeniedRedirect(effectiveHats), request.url))
  }

  // Hub de Configurações: admin-tier por CHAPÉU real (nunca profile.role).
  // `/admin` já está em `protectedPaths`, então o deslogado cai no /login acima;
  // o que falta é barrar quem TEM sessão mas não tem chapéu admin (manager,
  // instrutor). As rotas antigas (/admin/areas, /admin/job-roles) NÃO são
  // tocadas — elas seguem liberando manager/instructor pelos guards de página.
  // A home do mundo admin (`/admin`, W2) entra no MESMO guard — e só ela. NÃO
  // ampliar para toda a allowlist administrativa: rotas como `/admin/settings`
  // têm guards de página que hoje podem liberar `manager`, e barrá-las aqui
  // seria regressão silenciosa (auditoria guard-a-guard é trabalho separado).
  if (
    (pathname === "/admin" || pathname.startsWith("/admin/configuracoes")) &&
    user &&
    !isAdminTier(effectiveHats)
  ) {
    // O barrado volta para a PORTA DO PRÓPRIO MUNDO, não para o mundo padrão:
    // o instrutor barrado aqui segue a mesma regra das demais rotas admin
    // bloqueadas para ele (`blockedForInstructor` abaixo), que devolvem para
    // `/instructor`. Mandá-lo para `/dashboard` reescreveria o cookie
    // `x-active-workspace` para `standard` (bloco logo abaixo), expulsando-o do
    // Estúdio por ter clicado numa rota que ele nem podia abrir.
    const fallback = effectiveHats.includes("instructor") ? "/instructor" : "/dashboard"
    return NextResponse.redirect(new URL(fallback, request.url))
  }

  // Deep-link cross-world: someone WITH reach entering a workspace route directly
  // sets the ephemeral workspace state (§3.1 "entra direto setando o estado"),
  // without passing through the picker. Only write when the value differs, so we
  // don't rewrite the cookie on every request.
  if (user) {
    const wsCookieOpts = {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
    }
    const currentWs = request.cookies.get("x-active-workspace")?.value
    if (pathname.startsWith("/instructor") && currentWs !== "studio") {
      response.cookies.set("x-active-workspace", "studio", wsCookieOpts)
    } else if (shouldEnterSuperWorld(pathname, effectiveHats) && currentWs !== "super") {
      // 4º workspace (rodada 9): ANTES do ramo do admin de propósito —
      // `/admin/tenants` casa os dois prefixos textualmente, mas pertence ao
      // mundo do super admin (ela saiu de `ADMIN_WORLD_PATHS`). Sem esta ordem,
      // "Empresas" jogaria o dono no mundo errado.
      response.cookies.set("x-active-workspace", "super", wsCookieOpts)
    } else if (shouldEnterAdminWorld(pathname, effectiveHats) && currentWs !== "admin") {
      // 3º workspace: só entra no mundo admin quem TEM o chapéu admin-tier E
      // está numa rota que pertence ao mundo (allowlist em `admin-world.ts`).
      response.cookies.set("x-active-workspace", "admin", wsCookieOpts)
    } else if (pathname.startsWith("/dashboard") && currentWs !== "standard") {
      response.cookies.set("x-active-workspace", "standard", wsCookieOpts)
    }
  }

  // Instructor role restrictions — pelo eixo de CHAPÉUS reais (regra dura 3),
  // não mais pela coluna singular `users.role` cacheada por 5 min. Ver
  // `isInstructorOnly` em `admin-world.ts` para o porquê de `manager` entrar na
  // exclusão (sem isso, `instructor + manager` viraria regressão).
  if (user && isBlockedForInstructor(pathname, effectiveHats)) {
    return NextResponse.redirect(new URL("/instructor", request.url))
  }

  // Auth routes: redirect logged-in users by ACCESS derived from real hats.
  // Multi-access => the workspace picker (D1, always ask, no remembered default).
  // Single-access => straight into the sole world's home, no friction.
  // Both login surfaces count: `/entrar` is the canonical production login page
  // (real form) and `/login` is the legacy alias; a logged-in user revisiting
  // EITHER must hit the workspace door, never linger on a login screen.
  if ((pathname === "/entrar" || pathname === "/login" || pathname === "/") && user) {
    const ws = accessibleWorkspaces(effectiveHats as Role[])
    if (ws.length > 1) {
      return NextResponse.redirect(new URL("/workspace", request.url))
    }
    return NextResponse.redirect(new URL(workspaceHomeRoute(ws[0]), request.url))
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
