import { beforeEach, describe, expect, it, vi } from "vitest"

// =============================================================================
// "O CONTADOR DIZ 51 E A LISTA DIZ NENHUM" — o defeito de 2026-07-28.
//
// O que o dono viu: quatro cards com TOTAL 51 / ATIVOS 50 / ADMIN 1 / PENDENTES
// 0, e a tabela dizendo "Nenhum usuário encontrado". O mesmo carregamento soube
// CONTAR 51 e não soube LISTAR ninguém.
//
// A causa: a query da página pedia `users.avatar_url`, coluna que NÃO EXISTE no
// banco de produção. O PostgREST devolve `42703`, o supabase-js põe isso em
// `error` e deixa `data: null` — e o loader desestruturava só `data`, engolindo
// o `error`. Os contadores sobreviviam porque só pedem `id` e `id, status`:
// nunca tocam a coluna fantasma.
//
// Duas invariantes nascem daqui, e são elas que matam a CLASSE do defeito:
//
//   1. NENHUMA query desta tela pode pedir coluna que o banco não tem. O mock
//      abaixo é FIEL AO SCHEMA REAL (introspecção de produção em 2026-07-28) e
//      falha com o mesmo `42703` — uma coluna inventada reprova aqui, não em
//      produção.
//   2. Se o censo tem gente, a lista NÃO pode voltar vazia em silêncio. Ou vêm
//      as pessoas, ou vem um erro declarado. "Nenhum usuário encontrado" só
//      pode aparecer quando realmente não há ninguém.
// =============================================================================

/* ---------------------------------- Mocks --------------------------------- */

/**
 * Colunas REAIS de `public.users` em produção (`vaguswivhqnlbgqvnjch`), lidas
 * por introspecção em 2026-07-28. `avatar_url` NÃO está aqui — e é justamente
 * essa ausência que o teste existe para defender.
 */
const COLUNAS_REAIS_USERS = new Set([
  "created_at",
  "deleted_at",
  "email",
  "full_name",
  "id",
  "is_test",
  "job_role_id",
  "last_seen_at",
  "learning_mode",
  "onboarding_completed",
  "profile",
  "report_name",
  "reports_to",
  "role",
  "status",
  "tenant_id",
  "updated_at",
])

type Row = Record<string, unknown>

let tables: Record<string, Row[]> = {}
let authAccounts: Record<string, Record<string, unknown>> = {}
/** Todo select feito em `users`, para o teste de contrato de colunas. */
let selectsEmUsers: string[] = []
/**
 * Faz APENAS a leitura da página falhar, deixando a do censo intacta. É a
 * assimetria exata do defeito real: a página ordena por `created_at`, o censo
 * não — e era só a página que pedia a coluna fantasma.
 */
let falharLeituraDaPagina = false

function colunasDe(selectArg: string): string[] {
  return selectArg
    .split(",")
    .map((c) => c.trim())
    .filter((c) => c && !c.includes("(") && !c.includes(")"))
}

/** Cliente fiel ao schema: pedir coluna inexistente falha como o PostgREST falha. */
function makeClient() {
  return {
    from: (table: string) => {
      const eqs: { col: string; val: unknown }[] = []
      const ins: { col: string; val: unknown[] }[] = []
      let colunaFantasma: string | null = null
      let ordenou = false

      const rows = () =>
        (tables[table] ?? [])
          .filter((r) => eqs.every((f) => r[f.col] === f.val))
          .filter((r) => ins.every((f) => f.val.includes(r[f.col])))

      const resultado = () => {
        if (colunaFantasma) {
          return {
            data: null,
            error: {
              code: "42703",
              message: `column ${table}.${colunaFantasma} does not exist`,
            },
            count: null,
          }
        }
        if (falharLeituraDaPagina && table === "users" && ordenou) {
          return {
            data: null,
            error: { code: "42703", message: "column users.coluna_fantasma does not exist" },
            count: null,
          }
        }
        return { data: rows(), error: null, count: rows().length }
      }

      // biome-ignore lint/suspicious/noExplicitAny: test mock builder
      const builder: any = {}
      builder.select = (arg?: string) => {
        if (table === "users" && typeof arg === "string") {
          selectsEmUsers.push(arg)
          colunaFantasma = colunasDe(arg).find((c) => !COLUNAS_REAIS_USERS.has(c)) ?? null
        }
        return builder
      }
      builder.order = () => {
        ordenou = true
        return builder
      }
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
        onFulfilled: (value: ReturnType<typeof resultado>) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve(resultado()).then(onFulfilled, onRejected)
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
        listUsers: async () => ({
          data: { users: Object.entries(authAccounts).map(([id, f]) => ({ id, ...f })) },
          error: null,
        }),
      },
    },
  })),
}))

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }))

vi.mock("@/lib/auth", () => ({
  resolveTenantId: async (t: string | null) => t,
  getAuthProfile: async () => ({
    user: { id: "adm-1" },
    profile: { role: "admin", tenant_id: "tenant-cory" },
  }),
  getDbClient: async () => dbClient,
}))

const { loadAdminUsers } = await import("../loader")

/* -------------------------------- Fixtures -------------------------------- */

/** Espelha a produção do tenant Cory: 51 pessoas, 50 ativas, 1 desativada. */
function censoCory() {
  return Array.from({ length: 51 }, (_, i) => ({
    id: `u-${i}`,
    tenant_id: "tenant-cory",
    full_name: `Pessoa ${i}`,
    email: `p${i}@cory.com.br`,
    role: i === 0 ? "admin" : "student",
    status: i === 50 ? "inactive" : "active",
    created_at: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
    reports_to: null,
    job_role_id: null,
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
  selectsEmUsers = []
  falharLeituraDaPagina = false
  tables = {
    tenants: [{ id: "tenant-cory" }],
    areas: [{ id: "area-1", tenant_id: "tenant-cory", name: "Matriz", slug: "matriz" }],
    job_roles: [{ id: "jr-1", tenant_id: "tenant-cory", name: "Analista" }],
    users: censoCory(),
    user_areas: [],
  }
  authAccounts = Object.fromEntries(
    censoCory().map((u) => [u.id, { invited_at: "2026-01-01", confirmed_at: "2026-01-02" }]),
  )
})

/* ---------------------------------- Testes -------------------------------- */

describe("invariante 1 — nenhuma query pede coluna que o banco não tem", () => {
  it("todo select em `users` usa só colunas reais (o `avatar_url` fantasma reprova aqui)", async () => {
    await loadAdminUsers({})

    expect(selectsEmUsers.length).toBeGreaterThan(0)
    const inventadas = selectsEmUsers
      .flatMap(colunasDe)
      .filter((col) => !COLUNAS_REAIS_USERS.has(col))

    expect(inventadas).toEqual([])
  })
})

describe("invariante 2 — se o contador diz N, a lista não volta zero em silêncio", () => {
  it("carrega as pessoas do tenant, e não 'Nenhum usuário encontrado'", async () => {
    const loaded = await loadAdminUsers({})

    if (loaded.kind !== "ok") throw new Error("esperava ok")
    expect(loaded.data.stats?.total).toBe(51)
    // A página é de 20; o que não pode acontecer é vir zero com 51 no contador.
    expect(loaded.data.users.length).toBe(20)
    expect(loaded.data.cursor).not.toBeNull()
  })

  it("contador e lista concordam quando o tenant cabe numa página", async () => {
    tables.users = censoCory().slice(0, 7)
    const loaded = await loadAdminUsers({})

    if (loaded.kind !== "ok") throw new Error("esperava ok")
    expect(loaded.data.users).toHaveLength(loaded.data.stats?.total ?? -1)
  })

  it("página falhando com censo cheio vira ERRO DECLARADO, nunca lista vazia muda", async () => {
    // Simula exatamente o defeito: a leitura da página falha, a do censo não.
    // Antes da correção o loader devolvia `users: []` sem dizer nada, e a tela
    // afirmava "Nenhum usuário encontrado" sobre 51 pessoas reais.
    falharLeituraDaPagina = true

    const loaded = await loadAdminUsers({})

    if (loaded.kind !== "ok") throw new Error("esperava ok")
    expect(loaded.data.users).toHaveLength(0)
    expect(loaded.data.stats?.total).toBe(51)
    // O contrato: lista vazia COM censo cheio obriga o loader a declarar a falha.
    expect(loaded.data.listError).not.toBeNull()
    expect(loaded.data.listError).toContain("does not exist")
  })
})
