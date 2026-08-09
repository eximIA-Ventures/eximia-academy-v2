import { beforeEach, describe, expect, it, vi } from "vitest"

// =============================================================================
// CONTADORES DE USUÁRIOS — o "Ativos" que contava convite nunca aceito
// (CFG-2.2, AC6).
//
// O convite insere a pessoa em `public.users` já com `status: 'active'`
// (`api/admin/users/route.ts`), então até esta story o card "Ativos" somava
// quem nunca abriu o e-mail. `convites-desenho.md` §3.5 mediu isso. Aqui a
// correção é provada nos dois sentidos: pendente sai de "Ativos" E aparece em
// "Convites pendentes".
//
// E o AC9: quando o Auth não responde, o contador vira `null` — nunca `0`.
// "Não sei quantos" exibido como "nenhum" é pior que não exibir.
// =============================================================================

/* ---------------------------------- Mocks --------------------------------- */

type Row = Record<string, unknown>

let tables: Record<string, Row[]> = {}
/** Fatos do Auth por id, como `listUsers` devolveria. */
let authAccounts: Record<string, Record<string, unknown>> = {}
let listUsersFails = false
let listUsersCalls = 0

function makeClient() {
  return {
    from: (table: string) => {
      const filters: { col: string; val: unknown }[] = []

      const rows = () =>
        (tables[table] ?? []).filter((r) => filters.every((f) => r[f.col] === f.val))

      // biome-ignore lint/suspicious/noExplicitAny: test mock builder
      const builder: any = {}
      builder.select = () => builder
      builder.order = () => builder
      builder.limit = () => builder
      builder.or = () => builder
      builder.in = () => builder
      builder.eq = (col: string, val: unknown) => {
        filters.push({ col, val })
        return builder
      }
      builder.single = () => Promise.resolve({ data: rows()[0] ?? null, error: null })
      // biome-ignore lint/suspicious/noThenProperty: thenable mock emulates the supabase builder
      builder.then = (
        onFulfilled: (value: { data: unknown; error: null; count: number }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) =>
        Promise.resolve({ data: rows(), error: null, count: rows().length }).then(
          onFulfilled,
          onRejected,
        )
      return builder
    },
  }
}

const dbClient = makeClient()

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => dbClient) }))

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    ...makeClient(),
    auth: {
      admin: {
        listUsers: async () => {
          listUsersCalls++
          if (listUsersFails) return { data: null, error: { message: "GoTrue fora do ar" } }
          return {
            data: { users: Object.entries(authAccounts).map(([id, f]) => ({ id, ...f })) },
            error: null,
          }
        },
      },
    },
  })),
}))

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}))

vi.mock("@/lib/auth", () => ({
  resolveTenantId: async (t: string | null) => t,
  getAuthProfile: async () => ({
    user: { id: "adm-1" },
    profile: { role: "admin", tenant_id: "tenant-1" },
  }),
  getDbClient: async () => dbClient,
}))

const { loadAdminUsers } = await import("../loader")

/* -------------------------------- Fixtures -------------------------------- */

function userRow(id: string, name: string, status = "active") {
  return {
    id,
    tenant_id: "tenant-1",
    full_name: name,
    email: `${id}@empresa.com.br`,
    role: "student",
    status,
    avatar_url: null,
    created_at: "2026-01-01",
    reports_to: null,
    job_role_id: null,
  }
}

const HA_UM_DIA = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
const HA_MUITO_TEMPO = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

beforeEach(() => {
  vi.clearAllMocks()
  listUsersFails = false
  listUsersCalls = 0
  tables = {
    tenants: [{ id: "tenant-1" }],
    areas: [],
    job_roles: [],
    users: [
      userRow("u-entrou", "Quem entrou"),
      userRow("u-pendente", "Convidado ontem"),
      userRow("u-expirado", "Convidado em abril"),
      userRow("u-desativado", "Desligado", "inactive"),
    ],
  }
  authAccounts = {
    "u-entrou": { invited_at: HA_MUITO_TEMPO, confirmed_at: HA_MUITO_TEMPO },
    "u-pendente": { invited_at: HA_UM_DIA },
    "u-expirado": { invited_at: HA_MUITO_TEMPO },
    "u-desativado": { invited_at: HA_MUITO_TEMPO, confirmed_at: HA_MUITO_TEMPO },
  }
})

/* ---------------------------------- Testes -------------------------------- */

describe("AC6 — o card 'Ativos' para de contar convite nunca aceito", () => {
  it("conta só quem realmente entrou (4 linhas, 1 ativo)", async () => {
    const loaded = await loadAdminUsers({})

    expect(loaded.kind).toBe("ok")
    if (loaded.kind !== "ok") return
    // Antes desta story este número seria 3: pendente e expirado nascem
    // `status: 'active'` no banco.
    expect(loaded.data.stats?.active).toBe(1)
    expect(loaded.data.stats?.total).toBe(4)
  })

  it("expõe 'Convites pendentes' somando pendentes + expirados", async () => {
    const loaded = await loadAdminUsers({})

    if (loaded.kind !== "ok") throw new Error("esperava ok")
    expect(loaded.data.stats?.pendingInvites).toBe(2)
  })

  it("os fatos do convite chegam nas linhas da lista", async () => {
    const loaded = await loadAdminUsers({})

    if (loaded.kind !== "ok") throw new Error("esperava ok")
    const pendente = loaded.data.users.find((u) => u.id === "u-pendente")
    expect(pendente?.invited_at).toBe(HA_UM_DIA)
    expect(pendente?.confirmed_at).toBeNull()
  })

  it("uma única chamada ao Auth serve lista e contadores (AC1)", async () => {
    await loadAdminUsers({})

    expect(listUsersCalls).toBe(1)
  })
})

describe("AC9 — o Auth cai: a tela continua de pé e o contador vira `null`", () => {
  beforeEach(() => {
    listUsersFails = true
  })

  it("não derruba a página e devolve a lista completa", async () => {
    const loaded = await loadAdminUsers({})

    expect(loaded.kind).toBe("ok")
    if (loaded.kind !== "ok") return
    expect(loaded.data.users).toHaveLength(4)
  })

  it("'Convites pendentes' é `null`, e nunca `0`", async () => {
    const loaded = await loadAdminUsers({})

    if (loaded.kind !== "ok") throw new Error("esperava ok")
    expect(loaded.data.stats?.pendingInvites).toBeNull()
  })

  it("'Ativos' volta ao par binário de antes (3 de 4)", async () => {
    const loaded = await loadAdminUsers({})

    if (loaded.kind !== "ok") throw new Error("esperava ok")
    expect(loaded.data.stats?.active).toBe(3)
  })

  it("nenhuma linha vem com fato de convite inventado", async () => {
    const loaded = await loadAdminUsers({})

    if (loaded.kind !== "ok") throw new Error("esperava ok")
    for (const user of loaded.data.users) {
      expect(user.invited_at).toBeNull()
      expect(user.confirmed_at).toBeNull()
    }
  })
})
