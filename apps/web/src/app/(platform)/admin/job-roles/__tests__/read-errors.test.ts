import { beforeEach, describe, expect, it, vi } from "vitest"

// =============================================================================
// ERRO DE BANCO NÃO PODE VIRAR LISTA VAZIA.
//
// Origem concreta: `users.avatar_url` é DECLARADA em
// `packages/database/src/schema/users.ts` e NUNCA foi criada por migration.
// Pedi-la faz o PostgREST recusar a consulta INTEIRA com
// `42703 column users.avatar_url does not exist`; o supabase-js devolve
// `data: null` com o motivo em `error`. Como o código só desestruturava `data`,
// o resultado era `[]` — indistinguível de "este cargo não tem ninguém". O
// defeito ficou invisível por meses em Usuários pela MESMA razão.
//
// A coluna saiu do select (decisão do dono: remover do código, não criar a
// coluna). Estes testes travam a CLASSE do defeito, não só a instância: qualquer
// leitura desta tela que falhe precisa aparecer como erro, e nenhuma decisão
// destrutiva pode ser tomada sobre uma leitura que falhou.
//
// Os testes de escrita (`delete-job-role.test.ts`) usam um mock que SEMPRE
// devolve sucesso — por construção, ele nunca pegaria isto. Daí este arquivo.
// =============================================================================

/* ---------------------------------- Mocks --------------------------------- */

type Row = Record<string, unknown>

let tables: Record<string, Row[]> = {}
/** Tabelas que o "banco" recusa nesta rodada, com o código do Postgres. */
let failingTables: Record<string, string> = {}

interface Filter {
  op: "eq" | "in"
  col: string
  val: unknown
}

function makeClient() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: "actor-admin" } } }) },
    from(table: string) {
      const filters: Filter[] = []
      let mode: "select" | "update" | "delete" = "select"

      const rows = () =>
        (tables[table] ?? []).filter((r) =>
          filters.every((f) =>
            f.op === "eq" ? r[f.col] === f.val : (f.val as unknown[]).includes(r[f.col]),
          ),
        )

      function execute() {
        const code = failingTables[table]
        if (code) {
          // Fiel ao supabase-js: em erro, `data` vem NULL e o motivo vem em
          // `error`. É essa forma que faz o erro engolido virar lista vazia.
          return { data: null, error: { code, message: `column ${table}.x does not exist` } }
        }
        if (mode === "delete") {
          const doomed = new Set(rows())
          tables[table] = (tables[table] ?? []).filter((r) => !doomed.has(r))
          return { data: null, error: null }
        }
        return { data: rows(), error: null }
      }

      // biome-ignore lint/suspicious/noExplicitAny: test mock builder
      const builder: any = {}
      builder.select = () => builder
      builder.order = () => builder
      builder.limit = () => builder
      builder.eq = (col: string, val: unknown) => {
        filters.push({ op: "eq", col, val })
        return builder
      }
      builder.in = (col: string, val: unknown) => {
        filters.push({ op: "in", col, val })
        return builder
      }
      builder.update = () => builder
      builder.delete = () => {
        mode = "delete"
        return builder
      }
      builder.single = async () => {
        const result = execute()
        const data = Array.isArray(result.data) ? (result.data[0] ?? null) : result.data
        return { data, error: result.error }
      }
      // biome-ignore lint/suspicious/noThenProperty: thenable mock emulates the supabase builder
      builder.then = (
        onFulfilled: (value: { data: unknown; error: unknown }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve(execute()).then(onFulfilled, onRejected)

      return builder
    },
  }
}

const client = makeClient()

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => client) }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn(() => client) }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }))
vi.mock("@/lib/auth", () => ({
  getAuthProfile: vi.fn(async () => ({
    user: { id: "actor-admin" },
    profile: { role: "admin", tenant_id: "tenant-1" },
    roles: ["admin"],
  })),
  getDbClient: vi.fn(async () => client),
  resolveTenantId: vi.fn(async (t: string | null) => t ?? "tenant-1"),
}))

const { deleteJobRoleWithReassignment, listAreas, listJobRolesWithStats, listTenantTrails } =
  await import("../actions")

/* -------------------------------- Fixtures -------------------------------- */

beforeEach(() => {
  failingTables = {}
  tables = {
    tenants: [{ id: "tenant-1" }],
    job_roles: [
      {
        id: "jr-conferente",
        tenant_id: "tenant-1",
        name: "Conferente",
        slug: "conferente",
        description: null,
        seniority_level: "mid",
        area_id: "area-1",
        created_at: "2026-01-01",
      },
    ],
    learning_trails: [
      {
        id: "lt-1",
        tenant_id: "tenant-1",
        title: "Segurança do Trabalho",
        status: "active",
        target_job_role_id: "jr-conferente",
      },
    ],
    areas: [{ id: "area-1", tenant_id: "tenant-1", name: "Logística" }],
    user_areas: [{ user_id: "u-1", area_id: "area-1" }],
    users: [
      {
        id: "u-1",
        tenant_id: "tenant-1",
        full_name: "Felipe Santana",
        email: "felipe@cory.com.br",
        role: "student",
        job_role_id: "jr-conferente",
      },
    ],
  }
})

/* ---------------------------------- Testes -------------------------------- */

describe("A leitura da tela: erro aparece como erro, nunca como lista vazia", () => {
  it("caminho feliz: a pessoa vinculada é encontrada (o select não pede coluna inexistente)", async () => {
    const { data, error } = await listJobRolesWithStats()

    expect(error).toBeUndefined()
    expect(data[0]?.people.map((p) => p.full_name)).toEqual(["Felipe Santana"])
    expect(data[0]?.people[0]?.area_names).toEqual(["Logística"])
  })

  it("banco recusa a leitura de pessoas -> ERRO, e não 'cargo sem ninguém'", async () => {
    // Este é o cenário literal de `avatar_url`: a consulta inteira é recusada.
    failingTables.users = "42703"

    const { data, error } = await listJobRolesWithStats()

    expect(error).toBe("Erro ao carregar pessoas dos cargos")
    // O que NÃO pode acontecer: devolver o cargo com `people: []`, porque a tela
    // acenderia o dot de "sem pessoas" e o drawer diria "Ninguém tem este cargo".
    expect(data).toEqual([])
  })

  it("banco recusa a leitura de trilhas -> ERRO, e não 'cargo sem trilha'", async () => {
    failingTables.learning_trails = "42703"

    const { data, error } = await listJobRolesWithStats()

    expect(error).toBe("Erro ao carregar trilhas dos cargos")
    expect(data).toEqual([])
  })

  it("banco recusa as áreas -> ERRO, e não 'empresa sem área'", async () => {
    failingTables.areas = "42703"

    expect((await listJobRolesWithStats()).error).toBe("Erro ao carregar áreas")
    expect((await listAreas()).error).toBe("Erro ao carregar áreas")
  })

  it("catálogo de trilhas: falha vira erro, e não 'não há trilha para vincular'", async () => {
    failingTables.learning_trails = "42703"

    const { data, error } = await listTenantTrails()

    expect(error).toBe("Erro ao carregar trilhas")
    expect(data).toEqual([])
  })
})

describe("O caminho DESTRUTIVO não decide sobre leitura que falhou", () => {
  it("não consegue verificar trilhas -> cancela, não exclui", async () => {
    failingTables.learning_trails = "42703"

    const result = await deleteJobRoleWithReassignment("jr-conferente", [
      { userId: "u-1", targetJobRoleId: null },
    ])

    // Sem a checagem de `error`, a contagem de trilhas cairia para 0 e o
    // bloqueio seria PULADO: a leitura quebrada autorizaria a exclusão.
    expect(result).toEqual({
      error: "Não foi possível verificar as trilhas do cargo. Exclusão cancelada.",
    })
    expect(tables.job_roles.map((r) => r.id)).toContain("jr-conferente")
  })

  it("não consegue verificar pessoas -> cancela, não deixa ninguém órfão", async () => {
    tables.learning_trails = [] // nada bloqueia por trilha
    failingTables.users = "42703"

    const result = await deleteJobRoleWithReassignment("jr-conferente")

    // Sem a checagem, a lista de pendentes viria vazia, ninguém precisaria de
    // destino e o `ON DELETE SET NULL` do FK zeraria o vínculo em silêncio.
    expect(result).toEqual({
      error: "Não foi possível verificar as pessoas do cargo. Exclusão cancelada.",
    })
    expect(tables.job_roles.map((r) => r.id)).toContain("jr-conferente")
    expect((tables.users ?? [])[0]?.job_role_id).toBe("jr-conferente")
  })
})
