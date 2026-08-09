import { beforeEach, describe, expect, it, vi } from "vitest"

// =============================================================================
// CICLO DE VIDA DO CONVITE — reenviar e revogar (CFG-2.2, AC4/AC5/AC8).
//
// Revogar é a única operação irreversível desta story: apaga a conta do Auth e,
// por cascata (`public.users.id REFERENCES auth.users(id) ON DELETE CASCADE`),
// a linha do produto. O que estes testes existem para provar não é que a
// revogação funciona — é que ela se RECUSA a acontecer quando não deveria:
// sobre quem já aceitou, sobre quem tem dado vinculado, e quando não foi
// possível verificar se tem.
// =============================================================================

/* ---------------------------------- Mocks --------------------------------- */

type Row = Record<string, unknown> | null

let authUser: { id: string } | null = null
let profileRow: Row = null
let targetRow: Row = null
/** Fatos do Auth por id — o que `listUsers` devolveria. */
let authAccounts: Record<string, Record<string, unknown>> = {}
/** Contagem por tabela dependente (revoke-safety). */
let dependencyCounts: Record<string, number> = {}
/** Erro por tabela dependente (revoke-safety). */
let dependencyErrors: Record<string, { code?: string; message?: string }> = {}
let deletedRows: string[] = []
let deletedAuthUsers: string[] = []

// --- client autenticado (server) -------------------------------------------
function serverBuilder(table: string) {
  let selectArg = ""
  // biome-ignore lint/suspicious/noExplicitAny: test mock builder
  const builder: any = {}
  builder.select = (arg: string) => {
    selectArg = arg
    return builder
  }
  builder.eq = () => builder
  builder.single = async () => {
    if (table !== "users") return { data: null }
    // `requireAdmin` é a única leitura que pede o embed de chapéus; a outra é o
    // alvo da ação.
    return { data: selectArg.includes("user_roles") ? profileRow : targetRow }
  }
  return builder
}

const mockServerClient = {
  auth: { getUser: async () => ({ data: { user: authUser } }) },
  from: (table: string) => serverBuilder(table),
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockServerClient),
}))

// --- service client ---------------------------------------------------------
const mockGenerateLink = vi.fn()

function serviceBuilder(table: string) {
  // biome-ignore lint/suspicious/noExplicitAny: test mock builder
  const builder: any = {}
  let isDelete = false
  builder.select = () => builder
  builder.delete = () => {
    isDelete = true
    return builder
  }
  builder.eq = () => builder
  // biome-ignore lint/suspicious/noThenProperty: thenable mock emulates the supabase builder
  builder.then = (
    onFulfilled: (value: { count: number; error: unknown }) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => {
    if (isDelete) {
      deletedRows.push(table)
      return Promise.resolve({ count: 0, error: null }).then(onFulfilled, onRejected)
    }
    return Promise.resolve({
      count: dependencyCounts[table] ?? 0,
      error: dependencyErrors[table] ?? null,
    }).then(onFulfilled, onRejected)
  }
  return builder
}

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    auth: {
      admin: {
        listUsers: async () => ({
          data: {
            users: Object.entries(authAccounts).map(([id, facts]) => ({ id, ...facts })),
          },
          error: null,
        }),
        generateLink: (...args: unknown[]) => mockGenerateLink(...args),
        deleteUser: async (id: string) => {
          deletedAuthUsers.push(id)
          return { data: {}, error: null }
        },
      },
    },
    from: (table: string) => serviceBuilder(table),
  }),
}))

const mockLogAdminAction = vi.fn()
vi.mock("@/lib/audit", () => ({
  logAdminAction: (...args: unknown[]) => mockLogAdminAction(...args),
  logSuperAdminAction: vi.fn(),
}))

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}))

const { POST: RESEND } = await import("../[userId]/resend-invite/route")
const { POST: REVOKE } = await import("../[userId]/revoke-invite/route")

/* -------------------------------- Fixtures -------------------------------- */

const ADMIN_ID = "11111111-1111-4111-8111-111111111111"
const TARGET_ID = "22222222-2222-4222-8222-222222222222"

const adminProfile = { id: ADMIN_ID, role: "admin", tenant_id: "tenant-1" }

function target(overrides: Record<string, unknown> = {}) {
  return {
    id: TARGET_ID,
    email: "convidado@empresa.com.br",
    status: "active",
    tenant_id: "tenant-1",
    role: "student",
    full_name: "Convidado da Silva",
    report_name: "C. SILVA",
    ...overrides,
  }
}

function routeParams(userId: string) {
  return { params: Promise.resolve({ userId }) }
}

function request() {
  return new Request("http://localhost")
}

const HOJE = new Date().toISOString()
const HA_UM_DIA = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
const HA_MUITO_TEMPO = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

beforeEach(() => {
  vi.clearAllMocks()
  authUser = { id: ADMIN_ID }
  profileRow = adminProfile
  targetRow = target()
  // Estado default: convidado ontem, nunca aceitou.
  authAccounts = { [TARGET_ID]: { invited_at: HA_UM_DIA } }
  dependencyCounts = {}
  dependencyErrors = {}
  deletedRows = []
  deletedAuthUsers = []
  mockGenerateLink.mockResolvedValue({ data: {}, error: null })
})

/* ----------------------- AC8 — guards das duas rotas ---------------------- */

describe.each([
  ["resend-invite", RESEND],
  ["revoke-invite", REVOKE],
])("AC8 — POST .../%s: guard tenant-scoped", (_name, handler) => {
  it("401 quando não autenticado", async () => {
    authUser = null

    const res = await handler(request(), routeParams(TARGET_ID))

    expect(res.status).toBe(401)
    expect(mockGenerateLink).not.toHaveBeenCalled()
    expect(deletedAuthUsers).toEqual([])
  })

  it("403 quando quem chama não é admin-tier", async () => {
    profileRow = { id: ADMIN_ID, role: "student", tenant_id: "tenant-1" }

    const res = await handler(request(), routeParams(TARGET_ID))

    expect(res.status).toBe(403)
    expect(deletedAuthUsers).toEqual([])
  })

  it("404 quando o alvo é de outro tenant (antes de qualquer leitura do Auth)", async () => {
    targetRow = target({ tenant_id: "tenant-OUTRO" })

    const res = await handler(request(), routeParams(TARGET_ID))

    expect(res.status).toBe(404)
    expect(mockGenerateLink).not.toHaveBeenCalled()
    expect(deletedAuthUsers).toEqual([])
  })

  it("404 quando o alvo não existe", async () => {
    targetRow = null

    const res = await handler(request(), routeParams(TARGET_ID))

    expect(res.status).toBe(404)
  })

  it("409 quando a pessoa já aceitou o convite", async () => {
    authAccounts = { [TARGET_ID]: { invited_at: HA_MUITO_TEMPO, confirmed_at: HA_UM_DIA } }

    const res = await handler(request(), routeParams(TARGET_ID))

    expect(res.status).toBe(409)
    expect(mockGenerateLink).not.toHaveBeenCalled()
    expect(deletedAuthUsers).toEqual([])
  })

  it("409 quando o usuário está desativado", async () => {
    targetRow = target({ status: "inactive" })

    const res = await handler(request(), routeParams(TARGET_ID))

    expect(res.status).toBe(409)
    expect(deletedAuthUsers).toEqual([])
  })

  it("409 quando o Auth não respondeu — não age no escuro (AC9)", async () => {
    authAccounts = {}

    const res = await handler(request(), routeParams(TARGET_ID))

    expect(res.status).toBe(409)
    expect(mockGenerateLink).not.toHaveBeenCalled()
    expect(deletedAuthUsers).toEqual([])
  })
})

/* --------------------------- AC4 — reenviar convite ----------------------- */

describe("AC4 — POST .../resend-invite", () => {
  it("reenvia para quem está pendente, sem devolver o link, e audita", async () => {
    mockGenerateLink.mockResolvedValue({
      data: { properties: { action_link: "https://link-secreto" } },
      error: null,
    })

    const res = await RESEND(request(), routeParams(TARGET_ID))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ ok: true })
    expect(JSON.stringify(json)).not.toContain("link-secreto")
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ADMIN_ID,
        action: "user.invite_resent",
        targetType: "user",
        targetId: TARGET_ID,
      }),
    )
  })

  it("usa `type: invite` e RECONSTITUI o metadata do convite original", async () => {
    await RESEND(request(), routeParams(TARGET_ID))

    expect(mockGenerateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "invite",
        email: "convidado@empresa.com.br",
        options: expect.objectContaining({
          // Metadata a menos aqui apagaria `role`/`tenant_id` do convite —
          // exatamente o que `accept-invite/actions.ts` lê como fallback.
          data: {
            tenant_id: "tenant-1",
            role: "student",
            full_name: "Convidado da Silva",
            report_name: "C. SILVA",
          },
        }),
      }),
    )
  })

  it("reenvia também para convite expirado", async () => {
    authAccounts = { [TARGET_ID]: { invited_at: HA_MUITO_TEMPO } }

    const res = await RESEND(request(), routeParams(TARGET_ID))

    expect(res.status).toBe(200)
    expect(mockGenerateLink).toHaveBeenCalled()
  })

  it("não apaga nem cria nada: reenviar não toca em `users`", async () => {
    await RESEND(request(), routeParams(TARGET_ID))

    expect(deletedRows).toEqual([])
    expect(deletedAuthUsers).toEqual([])
  })

  it("erro do Auth vira 400 e não audita sucesso", async () => {
    mockGenerateLink.mockResolvedValue({ data: null, error: { message: "rate limit" } })

    const res = await RESEND(request(), routeParams(TARGET_ID))

    expect(res.status).toBe(400)
    expect(mockLogAdminAction).not.toHaveBeenCalled()
  })
})

/* --------------------------- AC5 — revogar convite ------------------------ */

describe("AC5 — POST .../revoke-invite: o caminho feliz", () => {
  it("apaga a conta do Auth E a linha de `users`, e audita", async () => {
    const res = await REVOKE(request(), routeParams(TARGET_ID))

    expect(res.status).toBe(200)
    expect(deletedAuthUsers).toEqual([TARGET_ID])
    expect(deletedRows).toContain("users")
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ADMIN_ID,
        action: "user.invite_revoked",
        targetType: "user",
        targetId: TARGET_ID,
      }),
    )
  })

  it("revoga convite expirado também", async () => {
    authAccounts = { [TARGET_ID]: { invited_at: HA_MUITO_TEMPO } }

    const res = await REVOKE(request(), routeParams(TARGET_ID))

    expect(res.status).toBe(200)
    expect(deletedAuthUsers).toEqual([TARGET_ID])
  })

  it("tabela dependente inexistente (drift de schema) não impede a revogação", async () => {
    dependencyErrors = {
      certificates: { code: "42P01", message: 'relation "certificates" does not exist' },
    }

    const res = await REVOKE(request(), routeParams(TARGET_ID))

    // Tabela que não existe não guarda dado que se possa perder.
    expect(res.status).toBe(200)
    expect(deletedAuthUsers).toEqual([TARGET_ID])
  })

  it("ninguém revoga o próprio acesso", async () => {
    targetRow = target({ id: ADMIN_ID })
    authAccounts = { [ADMIN_ID]: { invited_at: HA_UM_DIA } }

    const res = await REVOKE(request(), routeParams(ADMIN_ID))

    expect(res.status).toBe(400)
    expect(deletedAuthUsers).toEqual([])
  })
})

describe("AC5 — POST .../revoke-invite: a recusa (o que protege produção)", () => {
  it("RECUSA quando o usuário já tem matrícula — e não chama o deleteUser", async () => {
    dependencyCounts = { enrollments: 1 }

    const res = await REVOKE(request(), routeParams(TARGET_ID))

    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.blockers).toContain("matrículas")
    expect(json.error).toMatch(/dados vinculados/i)
    // O ponto inteiro do teste: a conta continua de pé.
    expect(deletedAuthUsers).toEqual([])
    expect(deletedRows).toEqual([])
  })

  it("RECUSA quando há progresso/atividade de outro tipo", async () => {
    dependencyCounts = { sessions: 3, quiz_attempts: 2, slide_reflections: 1 }

    const res = await REVOKE(request(), routeParams(TARGET_ID))

    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.blockers).toEqual(
      expect.arrayContaining(["sessões de estudo", "tentativas de quiz", "reflexões"]),
    )
    expect(deletedAuthUsers).toEqual([])
  })

  it("RECUSA quando a pessoa criou conteúdo (autoria que sumiria em cascata)", async () => {
    dependencyCounts = { courses: 1 }

    const res = await REVOKE(request(), routeParams(TARGET_ID))

    expect(res.status).toBe(409)
    expect(deletedAuthUsers).toEqual([])
  })

  it("RECUSA quando não foi possível VERIFICAR (fail-closed)", async () => {
    dependencyErrors = { enrollments: { code: "PGRST301", message: "JWT expired" } }

    const res = await REVOKE(request(), routeParams(TARGET_ID))

    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.unverifiable).toContain("matrículas")
    expect(json.error).toMatch(/não foi possível verificar/i)
    expect(deletedAuthUsers).toEqual([])
  })

  it("a verificação acontece ANTES do deleteUser, nunca depois", async () => {
    // Se a ordem se inverter, este teste passa a ver a conta apagada mesmo com
    // bloqueio — que é exatamente o incidente que a ordem previne.
    dependencyCounts = { certificates: 1 }

    await REVOKE(request(), routeParams(TARGET_ID))

    expect(deletedAuthUsers).toEqual([])
    expect(mockLogAdminAction).not.toHaveBeenCalled()
  })
})
