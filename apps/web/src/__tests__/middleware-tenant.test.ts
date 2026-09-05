import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { TenantContexto } from "../lib/tenant/tipos"

// ===========================================================================
// O MIDDLEWARE E A EMPRESA DA REQUISIÇÃO.
//
// Três coisas são testadas aqui, e todas as três são de segurança ou de
// isolamento entre empresas:
//
//   1. `x-tenant-*` vindo do CLIENTE é DESCARTADO. Sem isso, um
//      `curl -H "x-tenant-id: <uuid da empresa B>"` faria o Server Component
//      pintar a marca da B — a mesma higiene que a API pública já faz com
//      `x-api-*`.
//   2. O identificador do rate limit carrega o slug (D16). Sem ele, o NAT
//      corporativo da empresa A (um IP para centenas de pessoas) estoura a
//      cota e derruba o login da empresa B.
//   3. D3: host × usuário divergem -> redireciona para o host canônico do
//      tenant primário da pessoa; `super_admin` passa em qualquer host.
//
// O resolvedor é stubado: quem prova a ORDEM da D2 é `lib/tenant/__tests__/
// resolver.test.ts`. Aqui a pergunta é o que o middleware FAZ com a resposta.
// ===========================================================================

const BASE = "academy.eximiaventures.com.br"

let tenantResolvido: TenantContexto
let usuario: { id: string } | null
let papelDoPerfil: string | null
let chapeus: string[]
let tenantDoUsuario: string | null
let slugDoUsuario: string | null
let membershipDoHost: boolean
const identificadores: Array<{ limitador: string; id: string }> = []

// Só a RESOLUÇÃO é stubada. `hostCanonico` continua o real: ele é a regra de
// destino da D3 e stubá-lo esvaziaria o caso do redirecionamento.
vi.mock("@/lib/tenant/resolver", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tenant/resolver")>()),
  resolverTenantDaRequisicao: async () => tenantResolvido,
}))

function limitador(nome: string) {
  return {
    limit: async (id: string) => {
      identificadores.push({ limitador: nome, id })
      return { success: true, reset: Date.now() + 1000 }
    },
  }
}

vi.mock("@/lib/rate-limit", () => ({
  authLimiter: limitador("auth"),
  catchAllLimiter: limitador("catchAll"),
  chatLimiter: limitador("chat"),
  courseCreateLimiter: limitador("courseCreate"),
  privacyLimiter: limitador("privacy"),
  questionGenLimiter: limitador("questionGen"),
}))

vi.mock("@/lib/api-auth", () => ({
  applyCorsHeaders: vi.fn(),
  checkApiKeyRateLimit: async () => null,
  extractApiKeyContext: async () => null,
  handleCorsPreflightPublicApi: () => null,
  logApiUsage: vi.fn(),
  requireScope: () => true,
}))

/** Fake mínimo do PostgREST: responde por tabela, honrando `.eq()` encadeado. */
function construtor(tabela: string) {
  const alvo = {
    users: () => ({
      role: papelDoPerfil,
      tenant_id: tenantDoUsuario,
      tenants: { slug: slugDoUsuario },
    }),
    user_roles: () => chapeus.map((role) => ({ role })),
    user_tenant_memberships: () => (membershipDoHost ? { id: "vinculo" } : null),
  }[tabela]

  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: alvo?.() ?? null, error: null }),
    single: async () => ({ data: alvo?.() ?? null, error: null }),
    // biome-ignore lint/suspicious/noThenProperty: thenable emula o builder do supabase
    then: (ok: (v: { data: unknown; error: null }) => unknown) =>
      Promise.resolve(ok({ data: alvo?.() ?? null, error: null })),
  }
  return builder
}

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: usuario } }) },
    from: (tabela: string) => construtor(tabela),
  }),
}))

const { middleware } = await import("../middleware")

function contexto(over: Partial<TenantContexto> = {}): TenantContexto {
  return {
    tenantId: "id-cory",
    slug: "cory-alimentos",
    isNeutro: false,
    host: `cory-alimentos.${BASE}`,
    origem: "subdominio",
    ...over,
  }
}

function requisicao(caminho: string, cabecalhos: Record<string, string> = {}) {
  return new NextRequest(
    new Request(`https://cory-alimentos.${BASE}${caminho}`, { headers: cabecalhos }),
  )
}

/** O que `NextResponse.next({request:{headers}})` promete ao handler. */
function cabecalhoEncaminhado(resposta: Response, nome: string) {
  return resposta.headers.get(`x-middleware-request-${nome}`)
}

beforeEach(() => {
  vi.unstubAllEnvs()
  vi.stubEnv("NEXT_PUBLIC_APP_BASE_DOMAIN", BASE)
  tenantResolvido = contexto()
  usuario = null
  papelDoPerfil = null
  chapeus = []
  tenantDoUsuario = null
  slugDoUsuario = null
  membershipDoHost = false
  identificadores.length = 0
})

describe("os cabeçalhos de tenant que seguem para o handler", () => {
  it("escreve `x-tenant-id`, `x-tenant-slug` e `x-tenant-origem` a partir do HOST", async () => {
    const r = await middleware(requisicao("/qualquer"))
    expect(cabecalhoEncaminhado(r, "x-tenant-id")).toBe("id-cory")
    expect(cabecalhoEncaminhado(r, "x-tenant-slug")).toBe("cory-alimentos")
    expect(cabecalhoEncaminhado(r, "x-tenant-origem")).toBe("subdominio")
  })

  it("DESCARTA `x-tenant-*` forjado pelo cliente e reescreve com o valor resolvido", async () => {
    const r = await middleware(
      requisicao("/qualquer", {
        "x-tenant-id": "id-da-empresa-alheia",
        "x-tenant-slug": "empresa-alheia",
        "x-tenant-origem": "dominio-proprio",
      }),
    )
    expect(cabecalhoEncaminhado(r, "x-tenant-id")).toBe("id-cory")
    expect(cabecalhoEncaminhado(r, "x-tenant-slug")).toBe("cory-alimentos")
    expect(cabecalhoEncaminhado(r, "x-tenant-origem")).toBe("subdominio")
  })

  it("host neutro NÃO manda `x-tenant-id` nenhum — id vazio seria pior que ausente", async () => {
    tenantResolvido = contexto({
      tenantId: null,
      slug: "__neutro__",
      isNeutro: true,
      origem: "neutro",
    })
    const r = await middleware(requisicao("/qualquer", { "x-tenant-id": "forjado" }))
    expect(cabecalhoEncaminhado(r, "x-tenant-id")).toBeNull()
    expect(cabecalhoEncaminhado(r, "x-tenant-slug")).toBe("__neutro__")
  })

  it("assets públicos saem antes de tudo — não pagam consulta nem ganham cabeçalho", async () => {
    const r = await middleware(requisicao("/brand/logo.png"))
    expect(cabecalhoEncaminhado(r, "x-tenant-slug")).toBeNull()
  })
})

describe("D16 — o rate limit por IP passa a ser por empresa", () => {
  it("o identificador é `{slug}:{ip}`", async () => {
    await middleware(requisicao("/api/courses", { "x-forwarded-for": "1.2.3.4" }))
    expect(identificadores).toContainEqual({ limitador: "catchAll", id: "cory-alimentos:1.2.3.4" })
  })

  it("o limitador de auth segue a mesma chave", async () => {
    await middleware(requisicao("/api/auth/validate-tenant", { "x-real-ip": "9.9.9.9" }))
    expect(identificadores).toContainEqual({ limitador: "auth", id: "cory-alimentos:9.9.9.9" })
  })

  it("empresas diferentes no MESMO IP não compartilham cota", async () => {
    await middleware(requisicao("/api/courses", { "x-forwarded-for": "1.2.3.4" }))
    tenantResolvido = contexto({ tenantId: "id-harven", slug: "harven-finance" })
    await middleware(requisicao("/api/courses", { "x-forwarded-for": "1.2.3.4" }))
    expect(identificadores.map((i) => i.id)).toEqual([
      "cory-alimentos:1.2.3.4",
      "harven-finance:1.2.3.4",
    ])
  })

  it("host neutro cai num balde só, e é o correto: quem não tem empresa não tem cota própria", async () => {
    tenantResolvido = contexto({
      tenantId: null,
      slug: "__neutro__",
      isNeutro: true,
      origem: "neutro",
    })
    await middleware(requisicao("/api/courses", { "x-forwarded-for": "1.2.3.4" }))
    expect(identificadores).toContainEqual({ limitador: "catchAll", id: "__neutro__:1.2.3.4" })
  })
})

describe("D3 — host × usuário divergem", () => {
  beforeEach(() => {
    usuario = { id: "u1" }
    papelDoPerfil = "student"
    chapeus = ["student"]
  })

  it("quem não alcança o tenant do host vai para o host canônico do próprio", async () => {
    tenantDoUsuario = "id-harven"
    slugDoUsuario = "harven-finance"
    const r = await middleware(requisicao("/dashboard"))
    expect(r.status).toBe(307)
    expect(new URL(r.headers.get("location") ?? "").host).toBe(`harven-finance.${BASE}`)
  })

  it("o caminho e a query são preservados no redirecionamento", async () => {
    tenantDoUsuario = "id-harven"
    slugDoUsuario = "harven-finance"
    const r = await middleware(
      new NextRequest(new Request(`https://cory-alimentos.${BASE}/courses/abc?x=1`)),
    )
    const destino = new URL(r.headers.get("location") ?? "")
    expect(destino.pathname).toBe("/courses/abc")
    expect(destino.search).toBe("?x=1")
  })

  it("quem tem `users.tenant_id` do host segue servido", async () => {
    tenantDoUsuario = "id-cory"
    slugDoUsuario = "cory-alimentos"
    const r = await middleware(requisicao("/dashboard"))
    expect(r.status).not.toBe(307)
  })

  it("quem alcança por `user_tenant_memberships` segue servido", async () => {
    tenantDoUsuario = "id-harven"
    slugDoUsuario = "harven-finance"
    membershipDoHost = true
    const r = await middleware(requisicao("/dashboard"))
    expect(r.status).not.toBe(307)
  })

  it("super_admin passa em QUALQUER host, sem sequer consultar o vínculo", async () => {
    chapeus = ["super_admin"]
    papelDoPerfil = "super_admin"
    tenantDoUsuario = null
    slugDoUsuario = null
    const r = await middleware(requisicao("/dashboard"))
    expect(r.status).not.toBe(307)
  })

  it("modo legado não redireciona: ali o host não carrega identidade de empresa", async () => {
    tenantResolvido = contexto({ origem: "env-legado" })
    tenantDoUsuario = "id-harven"
    slugDoUsuario = "harven-finance"
    const r = await middleware(requisicao("/dashboard"))
    expect(r.status).not.toBe(307)
  })

  it("visitante deslogado nunca é redirecionado por D3 (não há tenant primário a consultar)", async () => {
    usuario = null
    const r = await middleware(requisicao("/entrar"))
    expect(r.status).not.toBe(307)
  })
})

// ===========================================================================
// D3 NO HOST NEUTRO.
//
// O ápice do domínio base, `www.{base}` e todo typo de subdomínio resolvem
// para NEUTRO (`tenantId = null`) e, num wildcard DNS `*.{base}`, os três são
// endereços que qualquer pessoa alcança. Enquanto o middleware exigia
// `tenant.tenantId` para sequer chamar a D3, o admin de uma empresa real que
// abrisse `https://{base}/dashboard` fazia login normalmente, a RLS entregava
// os dados DELE (correto) e a tela vinha com a marca eximIA e os 6 módulos do
// NEUTRO destravados na navegação.
// ===========================================================================
describe("D3 — host NEUTRO dentro do domínio da plataforma", () => {
  function neutro(host: string) {
    return contexto({ tenantId: null, slug: "__neutro__", isNeutro: true, origem: "neutro", host })
  }

  function pedido(host: string, caminho: string) {
    return new NextRequest(new Request(`https://${host}${caminho}`))
  }

  beforeEach(() => {
    usuario = { id: "u1" }
    papelDoPerfil = "admin"
    chapeus = ["admin"]
    tenantDoUsuario = "id-cory"
    slugDoUsuario = "cory-alimentos"
  })

  it("o ápice do domínio base manda a pessoa para o host canônico dela", async () => {
    tenantResolvido = neutro(BASE)
    const r = await middleware(pedido(BASE, "/dashboard"))
    expect(r.status).toBe(307)
    expect(new URL(r.headers.get("location") ?? "").host).toBe(`cory-alimentos.${BASE}`)
  })

  it("`www.{base}` sai do neutro pelo mesmo caminho", async () => {
    tenantResolvido = neutro(`www.${BASE}`)
    const r = await middleware(pedido(`www.${BASE}`, "/dashboard"))
    expect(r.status).toBe(307)
    expect(new URL(r.headers.get("location") ?? "").host).toBe(`cory-alimentos.${BASE}`)
  })

  it("`/api/*` NÃO é redirecionado: 307 cross-origin chega sem cookie de sessão", async () => {
    tenantResolvido = neutro(BASE)
    const r = await middleware(pedido(BASE, "/api/courses"))
    expect(r.status).not.toBe(307)
  })

  it("super_admin continua servido no host neutro", async () => {
    papelDoPerfil = "super_admin"
    chapeus = ["super_admin"]
    tenantDoUsuario = null
    slugDoUsuario = null
    tenantResolvido = neutro(BASE)
    const r = await middleware(pedido(BASE, "/dashboard"))
    expect(r.status).not.toBe(307)
  })

  it("host neutro FORA do domínio base fica onde está", async () => {
    tenantResolvido = neutro("localhost")
    const r = await middleware(pedido("localhost", "/dashboard"))
    expect(r.status).not.toBe(307)
  })
})

describe("D8 — /gauntlet-preview exige o chapéu super_admin", () => {
  it("deslogado vai para o login", async () => {
    usuario = null
    const r = await middleware(requisicao("/gauntlet-preview/visao-geral"))
    expect(r.status).toBe(307)
    expect(new URL(r.headers.get("location") ?? "").pathname).toBe("/login")
  })

  it("logado sem o chapéu é barrado", async () => {
    usuario = { id: "u1" }
    papelDoPerfil = "admin"
    chapeus = ["admin"]
    tenantDoUsuario = "id-cory"
    slugDoUsuario = "cory-alimentos"
    const r = await middleware(requisicao("/gauntlet-preview/visao-geral"))
    expect(r.status).toBe(307)
    expect(new URL(r.headers.get("location") ?? "").pathname).not.toBe("/gauntlet-preview")
  })

  it("super_admin passa", async () => {
    usuario = { id: "u1" }
    papelDoPerfil = "super_admin"
    chapeus = ["super_admin"]
    const r = await middleware(requisicao("/gauntlet-preview/visao-geral"))
    expect(r.status).not.toBe(307)
  })
})
