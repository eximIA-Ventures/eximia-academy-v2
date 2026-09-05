import { beforeEach, describe, expect, it, vi } from "vitest"

// ===========================================================================
// POST /api/admin/tenants/[tenantId]/importar-marca-do-ambiente (D20)
//
// O teste que importa de verdade é o do slug divergente: sem essa trava, um
// clique na tela da empresa B, feito de dentro do serviço da empresa A, gravaria
// a marca de A em B — e ninguém descobriria antes de um cliente ver o logo de
// outra companhia na própria tela.
// ===========================================================================

interface RespostaDeConsulta {
  data?: unknown
  error?: { message: string; code?: string } | null
}

let filaDeConsultas: RespostaDeConsulta[] = []
let ultimoUpdate: Record<string, unknown> | null = null

function construtor() {
  // biome-ignore lint/suspicious/noExplicitAny: mock de teste
  const b: any = {}
  for (const metodo of ["select", "eq", "order", "in"]) {
    b[metodo] = vi.fn(() => b)
  }
  b.update = vi.fn((valores: Record<string, unknown>) => {
    ultimoUpdate = valores
    return b
  })
  b.single = vi.fn(() => Promise.resolve(filaDeConsultas.shift() ?? { data: null }))
  return b
}

const mockFrom = vi.fn(() => construtor())
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))

let perfil: { role: string } | null = { role: "super_admin" }
const ATOR_ID = "11111111-1111-4111-8111-111111111111"

vi.mock("@/lib/auth", () => ({
  getAuthProfile: vi.fn(async () => ({
    user: perfil ? { id: ATOR_ID } : null,
    profile: perfil,
    roles: perfil ? [perfil.role] : [],
    error: null,
  })),
}))

const mockLogAdminAction = vi.fn()
vi.mock("@/lib/audit", () => ({
  logAdminAction: (...args: unknown[]) => mockLogAdminAction(...args),
  logSuperAdminAction: vi.fn(),
}))

const { POST } = await import("../[tenantId]/importar-marca-do-ambiente/route")

const TENANT_ID = "22222222-2222-4222-8222-222222222222"

function parametros(tenantId = TENANT_ID) {
  return { params: Promise.resolve({ tenantId }) }
}

function pedido() {
  return new Request("http://localhost/api/admin/tenants/x/importar-marca-do-ambiente", {
    method: "POST",
  })
}

function tenantGravado(slug = "cory-alimentos") {
  return {
    data: {
      id: TENANT_ID,
      name: "Cory Alimentos",
      slug,
      brand: { name: "Cory Alimentos", slug, logo: "/brand/logo.png" },
      modules: [],
      settings: {},
      whitelabel_config: {},
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  filaDeConsultas = []
  ultimoUpdate = null
  perfil = { role: "super_admin" }
})

describe("importar marca do ambiente — quando ela RECUSA", () => {
  it("recusa quem não é super_admin com 403", async () => {
    perfil = { role: "admin" }
    vi.stubEnv("NEXT_PUBLIC_TENANT_SLUG", "cory-alimentos")

    const res = await POST(pedido(), parametros())

    expect(res.status).toBe(403)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("recusa com 400 quando o serviço não tem NEXT_PUBLIC_TENANT_SLUG", async () => {
    vi.stubEnv("NEXT_PUBLIC_TENANT_SLUG", "")

    const res = await POST(pedido(), parametros())

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/NEXT_PUBLIC_TENANT_SLUG/)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("recusa com 400 quando o slug do ambiente é de OUTRA empresa, sem gravar nada", async () => {
    vi.stubEnv("NEXT_PUBLIC_TENANT_SLUG", "harven-finance")
    filaDeConsultas = [tenantGravado("cory-alimentos")]

    const res = await POST(pedido(), parametros())

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/harven-finance/)
    expect(json.error).toMatch(/cory-alimentos/)
    expect(ultimoUpdate).toBeNull()
    expect(mockLogAdminAction).not.toHaveBeenCalled()
  })

  it("responde 404 quando a empresa não existe", async () => {
    vi.stubEnv("NEXT_PUBLIC_TENANT_SLUG", "cory-alimentos")
    filaDeConsultas = [{ data: null }]

    const res = await POST(pedido(), parametros())

    expect(res.status).toBe(404)
  })
})

describe("importar marca do ambiente — quando ela GRAVA", () => {
  it("copia marca, módulos e configurações das env vars do serviço", async () => {
    vi.stubEnv("NEXT_PUBLIC_TENANT_SLUG", "cory-alimentos")
    vi.stubEnv("NEXT_PUBLIC_TENANT_NAME", "Cory Alimentos")
    vi.stubEnv("NEXT_PUBLIC_TENANT_LOGO", "/brand/cory.png")
    vi.stubEnv("NEXT_PUBLIC_TENANT_PRIMARY_COLOR", "#123456")
    vi.stubEnv("NEXT_PUBLIC_TENANT_ACCENT_COLOR", "nao-e-cor")
    vi.stubEnv("NEXT_PUBLIC_TENANT_MODULES", "biblioteca, units, modulo-que-nao-existe")
    vi.stubEnv("NEXT_PUBLIC_TENANT_FOOTER_TEXT", "© 2026 Cory")
    vi.stubEnv("NEXT_PUBLIC_TENANT_SUPPORT_EMAIL", "suporte@cory.com.br")
    vi.stubEnv("NEXT_PUBLIC_TENANT_MAX_INTERACTIONS", "15")
    vi.stubEnv("NEXT_PUBLIC_TENANT_ORG_TREE", "true")
    filaDeConsultas = [tenantGravado(), tenantGravado()]

    const res = await POST(pedido(), parametros())

    expect(res.status).toBe(200)
    expect(ultimoUpdate).not.toBeNull()
    const gravado = ultimoUpdate as Record<string, unknown>
    const brand = gravado.brand as Record<string, unknown>
    expect(brand.logo).toBe("/brand/cory.png")
    expect(brand.primaryColor).toBe("#123456")
    // Cor inválida é DESCARTADA, não gravada: uma string que não é hex viraria
    // um `background-color` morto na tela do cliente.
    expect(brand.accentColor).toBeUndefined()
    // Token desconhecido cai fora; os 3 core entram sempre.
    expect(gravado.modules).toEqual(["academy", "biblioteca", "analytics", "admin", "units"])
    expect(gravado.settings).toEqual({
      max_interactions_per_session: 15,
      features: { org_tree: true },
    })
    expect(gravado.whitelabel_config).toEqual({
      footer_text: "© 2026 Cory",
      support_email: "suporte@cory.com.br",
    })
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "tenant.brand_imported_from_env" }),
    )
  })

  it("não apaga o que já estava gravado quando a env correspondente não existe", async () => {
    vi.stubEnv("NEXT_PUBLIC_TENANT_SLUG", "cory-alimentos")
    filaDeConsultas = [tenantGravado(), tenantGravado()]

    await POST(pedido(), parametros())

    const brand = (ultimoUpdate as Record<string, unknown>).brand as Record<string, unknown>
    expect(brand.logo).toBe("/brand/logo.png")
    expect(brand.slug).toBe("cory-alimentos")
  })
})
