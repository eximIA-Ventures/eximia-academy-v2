import { requireAdmin, requireAdminOrManager } from "@/lib/api-auth/require-admin"
import { beforeEach, describe, expect, it, vi } from "vitest"

// =============================================================================
// EIXO DE AUTORIZAÇÃO das rotas de API (auditoria, rodada 3).
//
// `requireAdmin` decidia por `users.role`, a coluna SINGULAR, enquanto a página
// `/admin/audit` — alimentada pela rota `api/admin/audit-log`, criada na mesma
// rodada — já decidia por CHAPÉUS (`canOpenAdminRoute`). Os dois lados da mesma
// tela em eixos opostos.
//
// Estes testes fixam o contrato novo: manda o chapéu de `user_roles`; o conjunto
// permitido é o MESMO de antes; e um perfil sem nenhum chapéu registrado ainda
// vale pela coluna singular (fallback pré-backfill, W4).
// =============================================================================

interface UserRow {
  id: string
  role: string
  tenant_id: string | null
  user_roles?: { role: string }[]
}

let authUser: { id: string } | null = null
let userRow: UserRow | null = null
let lastSelect: string | null = null

function makeSupabase() {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: authUser } })) },
    from: vi.fn(() => {
      // biome-ignore lint/suspicious/noExplicitAny: test mock builder
      const builder: any = {}
      builder.select = vi.fn((cols: string) => {
        lastSelect = cols
        return builder
      })
      builder.eq = vi.fn(() => builder)
      builder.single = vi.fn(async () => ({ data: userRow, error: null }))
      return builder
    }),
    // biome-ignore lint/suspicious/noExplicitAny: shape only needs what the guard uses
  } as any
}

const ID = "11111111-1111-4111-8111-111111111111"

beforeEach(() => {
  vi.clearAllMocks()
  authUser = { id: ID }
  userRow = null
  lastSelect = null
})

describe("requireAdmin — decide pelo CHAPÉU real, não pela coluna singular", () => {
  it("lê os chapéus na mesma query (embed de user_roles pela FK user_id)", async () => {
    userRow = { id: ID, role: "admin", tenant_id: "t1", user_roles: [{ role: "admin" }] }

    await requireAdmin(makeSupabase())

    expect(lastSelect).toBe("id, role, tenant_id, user_roles!user_roles_user_id_fkey(role)")
  })

  it("chapéu admin com users.role='instructor' É ADMITIDO (o perfil divergente)", async () => {
    // É o caso que a página `/admin/audit` já admitia e a rota que a alimenta
    // recusava. Hipotético em produção hoje (os dois eixos concordam), mas é o
    // contrato: o chapéu manda.
    userRow = { id: ID, role: "instructor", tenant_id: "t1", user_roles: [{ role: "admin" }] }

    const { user, profile } = await requireAdmin(makeSupabase())

    expect(user).not.toBeNull()
    expect(profile).not.toBeNull()
    expect(profile?.tenant_id).toBe("t1")
  })

  it("super_admin pelo chapéu é admitido, e o tenant_id nulo trafega intacto", async () => {
    userRow = {
      id: ID,
      role: "super_admin",
      tenant_id: null,
      user_roles: [{ role: "super_admin" }],
    }

    const { profile } = await requireAdmin(makeSupabase())

    expect(profile).not.toBeNull()
    expect(profile?.tenant_id).toBeNull()
  })

  it("sem chapéu admin-tier é RECUSADO, mesmo com users.role='admin' (chapéu manda)", async () => {
    userRow = { id: ID, role: "admin", tenant_id: "t1", user_roles: [{ role: "student" }] }

    const { user, profile } = await requireAdmin(makeSupabase())

    expect(user).not.toBeNull()
    expect(profile).toBeNull()
  })

  it("gestor e instrutor continuam RECUSADOS (conjunto permitido inalterado)", async () => {
    for (const hat of ["manager", "instructor", "student", "leader"]) {
      userRow = { id: ID, role: hat, tenant_id: "t1", user_roles: [{ role: hat }] }
      const { profile } = await requireAdmin(makeSupabase())
      expect(profile).toBeNull()
    }
  })

  it("perfil SEM linha em user_roles cai na coluna singular (fallback pré-backfill, W4)", async () => {
    userRow = { id: ID, role: "admin", tenant_id: "t1" } // user_roles ausente
    expect((await requireAdmin(makeSupabase())).profile).not.toBeNull()

    userRow = { id: ID, role: "student", tenant_id: "t1", user_roles: [] } // vazio
    expect((await requireAdmin(makeSupabase())).profile).toBeNull()
  })

  it("sem sessão devolve user nulo e nem consulta o perfil", async () => {
    authUser = null

    const { user, profile } = await requireAdmin(makeSupabase())

    expect(user).toBeNull()
    expect(profile).toBeNull()
    expect(lastSelect).toBeNull()
  })

  it("usuário autenticado sem linha em `users` é recusado (fail-closed)", async () => {
    userRow = null

    const { user, profile } = await requireAdmin(makeSupabase())

    expect(user).not.toBeNull()
    expect(profile).toBeNull()
  })
})

describe("requireAdminOrManager — mesmo eixo, conjunto INALTERADO (+ manager)", () => {
  it("admite admin, super_admin e manager pelo chapéu", async () => {
    for (const hat of ["admin", "super_admin", "manager"]) {
      userRow = { id: ID, role: hat, tenant_id: "t1", user_roles: [{ role: hat }] }
      expect((await requireAdminOrManager(makeSupabase())).profile).not.toBeNull()
    }
  })

  it("recusa instrutor e aluno", async () => {
    for (const hat of ["instructor", "student"]) {
      userRow = { id: ID, role: hat, tenant_id: "t1", user_roles: [{ role: hat }] }
      expect((await requireAdminOrManager(makeSupabase())).profile).toBeNull()
    }
  })

  it("chapéu manager com users.role='student' é admitido", async () => {
    userRow = { id: ID, role: "student", tenant_id: "t1", user_roles: [{ role: "manager" }] }

    expect((await requireAdminOrManager(makeSupabase())).profile).not.toBeNull()
  })
})
