import { beforeEach, describe, expect, it, vi } from "vitest"

// =============================================================================
// CLICAR NUM CARD FILTRA A LISTA DE VERDADE (CFG-6.1, AC8).
//
// O card "Convites pendentes" mostra um número que NÃO existe como coluna: ele é
// derivado de `invited_at`/`confirmed_at` do Auth. Filtrar por ele, portanto,
// também precisa ser derivado — não há `WHERE status = 'pendente'` possível, e
// nunca vai haver (a `users_status_check` só aceita `active|inactive`).
//
// O que estes testes amarram:
//   1. o conjunto filtrado é o MESMO que o card conta (senão o número mente);
//   2. os contadores CONTINUAM vindo quando o filtro esvazia a lista — são eles
//      que permitem desfazer o filtro;
//   3. continua sendo UMA chamada ao Auth por carregamento (CFG-2.2, AC1).
// =============================================================================

/* ---------------------------------- Mocks --------------------------------- */

type Row = Record<string, unknown>

let tables: Record<string, Row[]> = {}
let authAccounts: Record<string, Record<string, unknown>> = {}
let listUsersFails = false
let listUsersCalls = 0

/** Mock que HONRA `.in()` — é o mecanismo que o filtro derivado usa. */
function makeClient() {
  return {
    from: (table: string) => {
      const eqs: { col: string; val: unknown }[] = []
      const ins: { col: string; val: unknown[] }[] = []

      const rows = () =>
        (tables[table] ?? [])
          .filter((r) => eqs.every((f) => r[f.col] === f.val))
          .filter((r) => ins.every((f) => f.val.includes(r[f.col])))

      // biome-ignore lint/suspicious/noExplicitAny: test mock builder
      const builder: any = {}
      builder.select = () => builder
      builder.order = () => builder
      builder.limit = () => builder
      builder.or = () => builder
      builder.eq = (col: string, val: unknown) => {
        eqs.push({ col, val })
        return builder
      }
      builder.in = (col: string, val: unknown[]) => {
        ins.push({ col, val })
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

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }))

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

function userRow(id: string, name: string, status = "active", jobRoleId: string | null = null) {
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
    job_role_id: jobRoleId,
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
    areas: [{ id: "area-1", tenant_id: "tenant-1", name: "Ribeirão Preto", slug: "rp" }],
    job_roles: [{ id: "jr-1", tenant_id: "tenant-1", name: "Analista de Campo" }],
    users: [
      userRow("u-entrou", "Quem entrou", "active", "jr-1"),
      userRow("u-pendente", "Convidado ontem"),
      userRow("u-expirado", "Convidado em abril"),
      userRow("u-desativado", "Desligado", "inactive"),
    ],
    user_areas: [{ user_id: "u-entrou", area_id: "area-1" }],
  }
  authAccounts = {
    "u-entrou": { invited_at: HA_MUITO_TEMPO, confirmed_at: HA_MUITO_TEMPO },
    "u-pendente": { invited_at: HA_UM_DIA },
    "u-expirado": { invited_at: HA_MUITO_TEMPO },
    "u-desativado": { invited_at: HA_MUITO_TEMPO, confirmed_at: HA_MUITO_TEMPO },
  }
})

/* ---------------------------------- Testes -------------------------------- */

describe("AC8 — o clique no card filtra a lista", () => {
  it("sem filtro, a lista vem inteira", async () => {
    const loaded = await loadAdminUsers({})

    if (loaded.kind !== "ok") throw new Error("esperava ok")
    expect(loaded.data.users).toHaveLength(4)
    expect(loaded.data.statusFilter).toBeNull()
  })

  it("'Convites pendentes' devolve exatamente quem o card conta", async () => {
    const loaded = await loadAdminUsers({ status: "invite_pending" })

    if (loaded.kind !== "ok") throw new Error("esperava ok")
    expect(loaded.data.users.map((u) => u.id).sort()).toEqual(["u-expirado", "u-pendente"])
    expect(loaded.data.stats?.pendingInvites).toBe(loaded.data.users.length)
    expect(loaded.data.statusFilter).toBe("invite_pending")
  })

  it("'Ativos' exclui quem nunca aceitou o convite", async () => {
    const loaded = await loadAdminUsers({ status: "active" })

    if (loaded.kind !== "ok") throw new Error("esperava ok")
    expect(loaded.data.users.map((u) => u.id)).toEqual(["u-entrou"])
  })

  it("filtro inválido na URL é ignorado, não quebra a tela", async () => {
    const loaded = await loadAdminUsers({ status: "chutei" })

    if (loaded.kind !== "ok") throw new Error("esperava ok")
    expect(loaded.data.users).toHaveLength(4)
    expect(loaded.data.statusFilter).toBeNull()
  })

  it("filtro que não casa ninguém mantém os CONTADORES — é por eles que se desfaz", async () => {
    tables.users = [userRow("u-so-ativo", "Único")]
    authAccounts = { "u-so-ativo": { invited_at: HA_MUITO_TEMPO, confirmed_at: HA_MUITO_TEMPO } }

    const loaded = await loadAdminUsers({ status: "invite_pending" })

    if (loaded.kind !== "ok") throw new Error("esperava ok")
    expect(loaded.data.users).toHaveLength(0)
    expect(loaded.data.stats).not.toBeNull()
    expect(loaded.data.stats?.total).toBe(1)
  })

  it("Auth fora do ar: avisa que não filtrou, em vez de devolver lista vazia", async () => {
    listUsersFails = true

    const loaded = await loadAdminUsers({ status: "invite_pending" })

    if (loaded.kind !== "ok") throw new Error("esperava ok")
    expect(loaded.data.statusFilterUnavailable).toBe(true)
    expect(loaded.data.users).toHaveLength(4)
  })

  it("com filtro, ainda é UMA chamada ao Auth (CFG-2.2, AC1)", async () => {
    await loadAdminUsers({ status: "invite_pending" })

    expect(listUsersCalls).toBe(1)
  })
})

describe("AC2 — Cargo e Área chegam resolvidos na linha", () => {
  it("o nome do cargo e o da área vêm junto da linha, sem query por usuário", async () => {
    const loaded = await loadAdminUsers({})

    if (loaded.kind !== "ok") throw new Error("esperava ok")
    const entrou = loaded.data.users.find((u) => u.id === "u-entrou")
    expect(entrou?.job_role_name).toBe("Analista de Campo")
    expect(entrou?.area_names).toEqual(["Ribeirão Preto"])
    expect(entrou?.area_ids).toEqual(["area-1"])
  })

  it("quem não tem cargo nem área vem com nulo e lista vazia, nunca com id cru", async () => {
    const loaded = await loadAdminUsers({})

    if (loaded.kind !== "ok") throw new Error("esperava ok")
    const pendente = loaded.data.users.find((u) => u.id === "u-pendente")
    expect(pendente?.job_role_name).toBeNull()
    expect(pendente?.area_names).toEqual([])
  })
})
