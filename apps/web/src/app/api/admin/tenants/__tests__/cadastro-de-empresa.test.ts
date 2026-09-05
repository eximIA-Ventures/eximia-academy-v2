import { beforeEach, describe, expect, it, vi } from "vitest"

// ===========================================================================
// POST /api/admin/tenants — o cadastro de empresa (D10)
//
// O que estes testes protegem, em uma frase cada:
//   - quem não é super_admin não cadastra empresa;
//   - slug reservado não vira subdomínio de cliente (D5);
//   - o SQLSTATE da RPC vira o HTTP certo (`22023`→400, `23505`→409);
//   - convite falho NÃO desfaz a empresa — 201 com o estado do convite no corpo;
//   - `auditado: false` da RPC é compensado por auditoria no app.
// ===========================================================================

/* ---------------------------------- Mocks --------------------------------- */

interface RespostaDeConsulta {
  data?: unknown
  error?: { message: string; code?: string } | null
}

let filaDeConsultas: RespostaDeConsulta[] = []

function construtor() {
  // biome-ignore lint/suspicious/noExplicitAny: mock de teste
  const b: any = {}
  for (const metodo of ["select", "eq", "update", "insert", "order", "limit", "in"]) {
    b[metodo] = vi.fn(() => b)
  }
  b.single = vi.fn(() => Promise.resolve(filaDeConsultas.shift() ?? { data: null }))
  return b
}

const mockRpc = vi.fn()
const mockFrom = vi.fn(() => construtor())

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ rpc: mockRpc, from: mockFrom }),
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

const mockInviteTenantUser = vi.fn()
vi.mock("@/app/api/admin/users/invite-user", () => ({
  inviteTenantUser: (...args: unknown[]) => mockInviteTenantUser(...args),
}))

const { POST } = await import("../route")

/* -------------------------------- Fixtures -------------------------------- */

const TENANT_ID = "22222222-2222-4222-8222-222222222222"

function corpoValido(sobrescreve: Record<string, unknown> = {}) {
  return {
    id: TENANT_ID,
    name: "Cory Alimentos",
    slug: "cory-alimentos",
    plan: "standard",
    brand: { primaryColor: "#2a6ab0", accentColor: "#C4A882" },
    modules: ["biblioteca"],
    settings: { footerText: "© 2026 Cory", supportEmail: "suporte@cory.com.br" },
    admin: { email: "maria@cory.com.br", fullName: "Maria Silva" },
    ...sobrescreve,
  }
}

function pedido(corpo: unknown) {
  return new Request("http://localhost/api/admin/tenants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  })
}

function linhaDoTenant() {
  return {
    data: {
      id: TENANT_ID,
      name: "Cory Alimentos",
      slug: "cory-alimentos",
      plan: "standard",
      brand: { name: "Cory Alimentos", slug: "cory-alimentos" },
      modules: ["academy", "analytics", "admin", "biblioteca"],
      settings: {},
      whitelabel_config: {},
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("NEXT_PUBLIC_APP_BASE_DOMAIN", "academy.eximiaventures.com.br")
  filaDeConsultas = []
  perfil = { role: "super_admin" }
  mockRpc.mockResolvedValue({ data: { tenant_id: TENANT_ID, auditado: true }, error: null })
  mockInviteTenantUser.mockResolvedValue({ ok: true, userId: "user-1" })
})

/* --------------------------------- Testes --------------------------------- */

describe("POST /api/admin/tenants — guarda e validação", () => {
  it("recusa quem não é super_admin com 403", async () => {
    perfil = { role: "admin" }

    const res = await POST(pedido(corpoValido()))

    expect(res.status).toBe(403)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("recusa corpo sem o primeiro admin com 400 e não chama a RPC", async () => {
    const { admin: _semAdmin, ...semAdmin } = corpoValido()

    const res = await POST(pedido(semAdmin))

    expect(res.status).toBe(400)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("recusa slug reservado com 400 antes de tocar o banco", async () => {
    const res = await POST(pedido(corpoValido({ slug: "admin" })))

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/reservado/i)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("aceita o corpo legado com initial_manager no lugar de admin", async () => {
    const { admin: _trocado, ...corpo } = corpoValido()
    filaDeConsultas = [linhaDoTenant(), linhaDoTenant()]

    const res = await POST(
      pedido({
        ...corpo,
        initial_manager: { email: "maria@cory.com.br", full_name: "Maria Silva", role: "admin" },
      }),
    )

    expect(res.status).toBe(201)
    expect(mockInviteTenantUser).toHaveBeenCalledWith(
      expect.anything(),
      TENANT_ID,
      expect.objectContaining({ email: "maria@cory.com.br", role: "admin" }),
    )
  })
})

describe("POST /api/admin/tenants — o que a RPC devolve vira HTTP", () => {
  it("mapeia 23505 (slug duplicado) para 409", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    })

    const res = await POST(pedido(corpoValido()))

    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toMatch(/já está em uso/i)
    expect(mockInviteTenantUser).not.toHaveBeenCalled()
  })

  it("mapeia 22023 (dado inválido no banco) para 400", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: "22023", message: "slug reservado" },
    })

    const res = await POST(pedido(corpoValido()))

    expect(res.status).toBe(400)
  })

  it("passa p_id, p_actor_id e os módulos core somados para a RPC", async () => {
    filaDeConsultas = [linhaDoTenant(), linhaDoTenant()]

    await POST(pedido(corpoValido()))

    expect(mockRpc).toHaveBeenCalledWith(
      "provisionar_tenant",
      expect.objectContaining({
        p_id: TENANT_ID,
        p_actor_id: ATOR_ID,
        p_slug: "cory-alimentos",
        p_plan: "standard",
        p_modules: ["academy", "biblioteca", "analytics", "admin"],
        p_custom_host: null,
      }),
    )
  })
})

describe("POST /api/admin/tenants — o que acontece DEPOIS do commit", () => {
  it("responde 201 com adminInvite failed quando o convite falha, sem apagar a empresa", async () => {
    filaDeConsultas = [linhaDoTenant(), linhaDoTenant()]
    mockInviteTenantUser.mockResolvedValue({
      ok: false,
      stage: "invite",
      message: "SMTP fora do ar",
    })

    const res = await POST(pedido(corpoValido()))

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.adminInvite).toEqual({
      status: "failed",
      stage: "invite",
      error: "SMTP fora do ar",
    })
    expect(json.tenant.id).toBe(TENANT_ID)
    // A empresa existe: nenhuma exclusão foi tentada.
    expect(mockFrom).not.toHaveBeenCalledWith("tenants_deleted")
  })

  it("devolve o host canônico derivado do slug", async () => {
    filaDeConsultas = [linhaDoTenant(), linhaDoTenant()]

    const res = await POST(pedido(corpoValido()))
    const json = await res.json()

    expect(json.tenant.host).toBe("cory-alimentos.academy.eximiaventures.com.br")
  })

  it("audita por fora quando a RPC devolve auditado: false", async () => {
    mockRpc.mockResolvedValue({ data: { tenant_id: TENANT_ID, auditado: false }, error: null })
    filaDeConsultas = [linhaDoTenant(), linhaDoTenant()]

    await POST(pedido(corpoValido()))

    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ATOR_ID,
        action: "tenant.provisioned",
        targetType: "tenant",
        targetId: TENANT_ID,
      }),
    )
  })

  it("não duplica auditoria quando a RPC já auditou", async () => {
    filaDeConsultas = [linhaDoTenant(), linhaDoTenant()]

    await POST(pedido(corpoValido()))

    expect(mockLogAdminAction).not.toHaveBeenCalled()
  })
})
