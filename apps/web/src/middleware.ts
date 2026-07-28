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
import { accessibleWorkspaces, canEnterStudio, workspaceHomeRoute } from "@/lib/workspace-resolver"
import type { Role } from "@eximia/shared"
import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

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
  if (pathname.startsWith("/api/v1/")) {
    return handlePublicApiRequest(request)
  }

  // --- Rate limiting for API routes (IP-based, before auth) ---
  if (pathname.startsWith("/api/")) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown"

    if (pathname.startsWith("/api/auth")) {
      const blocked = await checkLimit(authLimiter, ip, "authLimiter", pathname)
      if (blocked) return blocked
    }

    if (!pathname.startsWith("/api/auth")) {
      const blocked = await checkLimit(catchAllLimiter, ip, "catchAllLimiter", pathname)
      if (blocked) return blocked
    }
  }

  // --- Supabase auth ---
  let response = NextResponse.next({ request })

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
        response = NextResponse.next({ request })
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
