import { beforeEach, describe, expect, it, vi } from "vitest"

// ===========================================================================
// POST /api/admin/tenants/[tenantId]/convidar-admin — o botão "reenviar convite"
//
// O defeito que estes testes travam: a rota só sabia chamar
// `inviteUserByEmail`, que RECUSA e-mail já registrado. Os dois modos de falha
// mais prováveis do cadastro deixam justamente uma conta de Auth existente —
// `stage: "profile"` (o convite saiu, o INSERT em `public.users` falhou) e
// `stage: "invite"` por "already been registered". Nos dois, reenviar devolvia
// 502 para sempre e a empresa ficava criada e SEM ADMIN, que é exatamente o
// estado que este endpoint existe para consertar.
// ===========================================================================

/* ---------------------------------- Mocks --------------------------------- */

const TENANT_ID = "22222222-2222-4222-8222-222222222222"
const AUTH_USER_ID = "33333333-3333-4333-8333-333333333333"
const ATOR_ID = "11111111-1111-4111-8111-111111111111"

let perfil: { role: string } | null = { role: "super_admin" }

vi.mock("@/lib/auth", () => ({
  getAuthProfile: vi.fn(async () => ({
    user: perfil ? { id: ATOR_ID } : null,
    profile: perfil,
    roles: perfil ? [perfil.role] : [],
    error: null,
  })),
}))

vi.mock("@/lib/api-auth/perfil-de-sessao", () => ({
  recusaSePerfilIlegivel: () => null,
}))

vi.mock("@/lib/audit", () => ({ logAdminAction: vi.fn(async () => {}) }))

vi.mock("@/lib/get-base-url", () => ({
  getBaseUrlForTenant: async () => "https://cory-alimentos.academy.eximiaventures.com.br",
}))

const mockInviteTenantUser = vi.fn()
vi.mock("@/app/api/admin/users/invite-user", () => ({
  inviteTenantUser: (...args: unknown[]) => mockInviteTenantUser(...args),
}))

const mockGenerateLink = vi.fn()
const upserts: Array<Record<string, unknown>> = []

function construtor() {
  // biome-ignore lint/suspicious/noExplicitAny: mock de teste
  const b: any = {}
  for (const metodo of ["select", "eq"]) b[metodo] = vi.fn(() => b)
  b.upsert = vi.fn((linha: Record<string, unknown>) => {
    upserts.push(linha)
    return Promise.resolve({ error: null })
  })
  b.single = vi.fn(() => Promise.resolve({ data: { id: TENANT_ID }, error: null }))
  return b
}

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: vi.fn(() => construtor()),
    auth: { admin: { generateLink: (...a: unknown[]) => mockGenerateLink(...a) } },
  }),
}))

const { POST } = await import("../[tenantId]/convidar-admin/route")

function pedido() {
  return new Request(`http://localhost/api/admin/tenants/${TENANT_ID}/convidar-admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "maria@cory.com.br", fullName: "Maria Silva" }),
  })
}

function params() {
  return { params: Promise.resolve({ tenantId: TENANT_ID }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  upserts.length = 0
  perfil = { role: "super_admin" }
  mockInviteTenantUser.mockResolvedValue({ ok: true, userId: AUTH_USER_ID })
  mockGenerateLink.mockResolvedValue({ data: { user: { id: AUTH_USER_ID } }, error: null })
})

/* --------------------------------- Testes --------------------------------- */

describe("convidar-admin — guarda", () => {
  it("recusa quem não é super_admin", async () => {
    perfil = { role: "admin" }
    const r = await POST(pedido(), params())
    expect(r.status).toBe(403)
  })
})

describe("convidar-admin — o caminho feliz continua sendo o convite normal", () => {
  it("e-mail novo passa por `inviteTenantUser` e NÃO cai no `generateLink`", async () => {
    const r = await POST(pedido(), params())
    expect(r.status).toBe(200)
    expect(mockInviteTenantUser).toHaveBeenCalledTimes(1)
    expect(mockGenerateLink).not.toHaveBeenCalled()
  })
})

describe("convidar-admin — recupera o e-mail que JÁ TEM conta de Auth", () => {
  beforeEach(() => {
    // O estado deixado por um `stage: "profile"` anterior: `auth.users` existe,
    // então `inviteUserByEmail` recusa para sempre.
    mockInviteTenantUser.mockResolvedValue({
      ok: false,
      stage: "invite",
      message: "A user with this email address has already been registered",
    })
  })

  it("cai para `generateLink({type:'invite'})` e devolve 200, não 502", async () => {
    const r = await POST(pedido(), params())
    expect(r.status).toBe(200)
    expect(mockGenerateLink).toHaveBeenCalledTimes(1)
    expect(mockGenerateLink.mock.calls[0][0]).toMatchObject({
      type: "invite",
      email: "maria@cory.com.br",
    })
  })

  it("o `redirectTo` do reenvio é `/accept-invite` — a rota que existe em app/", () => {
    return POST(pedido(), params()).then(() => {
      expect(mockGenerateLink.mock.calls[0][0].options.redirectTo).toBe(
        "https://cory-alimentos.academy.eximiaventures.com.br/accept-invite",
      )
    })
  })

  it("materializa o perfil que faltou: upsert em `users` com o tenant e o papel admin", async () => {
    await POST(pedido(), params())
    expect(upserts).toHaveLength(1)
    expect(upserts[0]).toMatchObject({
      id: AUTH_USER_ID,
      tenant_id: TENANT_ID,
      email: "maria@cory.com.br",
      role: "admin",
    })
  })

  it("se o reenvio também falhar, a mensagem devolvida é a ORIGINAL, não o sintoma", async () => {
    mockGenerateLink.mockResolvedValue({
      data: null,
      error: { message: "Email link is invalid or has expired" },
    })
    const r = await POST(pedido(), params())
    expect(r.status).toBe(502)
    const corpo = (await r.json()) as { error: string; stage: string }
    expect(corpo.error).toContain("already been registered")
    expect(corpo.stage).toBe("invite")
  })
})

describe("convidar-admin — falha de perfil não é mascarada", () => {
  it("`stage: 'profile'` do convite original sobe como 502 sem tentar o `generateLink`", async () => {
    mockInviteTenantUser.mockResolvedValue({
      ok: false,
      stage: "profile",
      message: "duplicate key value violates unique constraint",
    })
    const r = await POST(pedido(), params())
    expect(r.status).toBe(502)
    expect(mockGenerateLink).not.toHaveBeenCalled()
    const corpo = (await r.json()) as { stage: string }
    expect(corpo.stage).toBe("profile")
  })
})
