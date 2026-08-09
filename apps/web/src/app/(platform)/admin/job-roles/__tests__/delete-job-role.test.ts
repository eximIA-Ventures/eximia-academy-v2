import { beforeEach, describe, expect, it, vi } from "vitest"

// =============================================================================
// EXCLUIR CARGO COM REATRIBUIÇÃO (CFG-3.1, AC8).
//
// Esta é a única mudança de REGRA DE ESCRITA da story, e ela aparece nas DUAS
// rotas que renderizam a seção (o hub admin-tier e `/admin/job-roles`, viva para
// `manager` e `instructor` por D3). O que estes testes travam:
//
//   1. trilha ATIVA vinculada continua BLOQUEANDO a exclusão, com a mensagem de
//      antes — a regra de trilha não é objeto desta story;
//   2. o bloqueio por trilha acontece ANTES de mover uma única pessoa: um
//      delete que vai ser recusado não pode deixar gente reatribuída no caminho;
//   3. pessoa vinculada exige destino EXPLÍCITO. O `ON DELETE SET NULL` do FK
//      (`20260229000000_trails_job_roles.sql:137`) zerava `users.job_role_id` de
//      N pessoas em silêncio; agora, sem decisão, não há exclusão;
//   4. "fica sem cargo" é uma ESCOLHA: zera `job_role_id` e não apaga ninguém.
//
// O mock é um banco em memória com as operações que o fluxo usa (select/update/
// delete). Ele existe para que os asserts falem de LINHAS, não de chamadas: o
// que interessa provar é onde as pessoas foram parar.
// =============================================================================

/* ---------------------------------- Mocks --------------------------------- */

type Row = Record<string, unknown>
type Tables = Record<string, Row[]>

let tables: Tables = {}
let currentUserId: string | null = "actor-admin"

interface Filter {
  op: "eq" | "in"
  col: string
  val: unknown
}

function matchesAll(row: Row, filters: Filter[]) {
  return filters.every((f) =>
    f.op === "eq" ? row[f.col] === f.val : (f.val as unknown[]).includes(row[f.col]),
  )
}

function makeClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: currentUserId ? { id: currentUserId } : null } }),
    },
    from(table: string) {
      const filters: Filter[] = []
      let mode: "select" | "update" | "delete" | "insert" = "select"
      let payload: Row = {}

      const target = () => (tables[table] ?? []).filter((r) => matchesAll(r, filters))

      function execute(): { data: unknown; error: null } {
        if (mode === "update") {
          for (const row of target()) Object.assign(row, payload)
          return { data: null, error: null }
        }
        if (mode === "delete") {
          const doomed = new Set(target())
          tables[table] = (tables[table] ?? []).filter((r) => !doomed.has(r))
          return { data: null, error: null }
        }
        if (mode === "insert") {
          const row = { id: `new-${(tables[table] ?? []).length + 1}`, ...payload }
          tables[table] = [...(tables[table] ?? []), row]
          return { data: row, error: null }
        }
        return { data: target(), error: null }
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
      builder.update = (values: Row) => {
        mode = "update"
        payload = values
        return builder
      }
      builder.delete = () => {
        mode = "delete"
        return builder
      }
      builder.insert = (values: Row) => {
        mode = "insert"
        payload = values
        return builder
      }
      builder.single = async () => {
        const result = execute()
        const data = Array.isArray(result.data) ? (result.data[0] ?? null) : result.data
        return { data, error: null }
      }
      // biome-ignore lint/suspicious/noThenProperty: thenable mock emulates the supabase builder
      builder.then = (
        onFulfilled: (value: { data: unknown; error: null }) => unknown,
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

/** Cookie do seletor de empresa (`api/admin/switch-tenant/route.ts`). */
let cookieValue: string | undefined
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "x-sa-active-tenant" && cookieValue ? { value: cookieValue } : undefined,
  }),
}))

/**
 * O ator: perfil + UNIÃO DE CHAPÉUS. `roles` é o campo que o guard novo lê;
 * `profile.role` (coluna singular) fica aqui de propósito, para que os testes
 * possam divergir os dois eixos e provar qual deles decide.
 */
let actor: {
  user: { id: string } | null
  profile: { role: string; tenant_id: string | null } | null
  roles: string[]
}

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>()
  return {
    // O REAL: é ele quem executa a cascata tenant próprio -> cookie do seletor
    // -> primeira empresa. Metade 2 da correção depende deste caminho de verdade.
    resolveTenantId: actual.resolveTenantId,
    getAuthProfile: vi.fn(async () => actor),
    getDbClient: vi.fn(async () => client),
  }
})

const {
  createJobRole,
  deleteJobRole,
  deleteJobRoleWithReassignment,
  duplicateJobRole,
  reassignJobRolePeople,
} = await import("../actions")

/* -------------------------------- Fixtures -------------------------------- */

function jobRole(id: string, name: string, tenant = "tenant-1"): Row {
  return { id, tenant_id: tenant, name, slug: name.toLowerCase(), seniority_level: "mid" }
}

function person(id: string, name: string, roleId: string | null): Row {
  return {
    id,
    tenant_id: "tenant-1",
    full_name: name,
    email: `${id}@cory.com.br`,
    role: "student",
    job_role_id: roleId,
  }
}

function usersWithRole(roleId: string) {
  return (tables.users ?? []).filter((u) => u.job_role_id === roleId)
}

beforeEach(() => {
  currentUserId = "actor-admin"
  cookieValue = undefined
  actor = {
    user: { id: "actor-admin" },
    profile: { role: "admin", tenant_id: "tenant-1" },
    roles: ["admin"],
  }
  tables = {
    tenants: [{ id: "tenant-1" }, { id: "tenant-9" }],
    job_roles: [
      jobRole("jr-conferente", "Conferente"),
      jobRole("jr-analista", "Analista de Logística"),
      jobRole("jr-outra-empresa", "Cargo de outra empresa", "tenant-9"),
    ],
    learning_trails: [],
    users: [
      { ...person("actor-admin", "Dona da conta", null), role: "admin" },
      person("u-1", "Carlos Eduardo Silva", "jr-conferente"),
      person("u-2", "Bruno Saldanha", "jr-conferente"),
      person("u-3", "Juliana Oliveira", "jr-analista"),
    ],
  }
})

/* ---------------------------------- Testes -------------------------------- */

describe("AC8 — exclusão com pessoas vinculadas", () => {
  it("reatribui as N pessoas para o cargo escolhido e conclui a exclusão", async () => {
    const result = await deleteJobRoleWithReassignment("jr-conferente", [
      { userId: "u-1", targetJobRoleId: "jr-analista" },
      { userId: "u-2", targetJobRoleId: "jr-analista" },
    ])

    expect(result).toMatchObject({ success: true, reassigned: 2 })
    // As DUAS pessoas foram parar no destino — nenhuma ficou órfã pelo caminho.
    expect(
      usersWithRole("jr-analista")
        .map((u) => u.id)
        .sort(),
    ).toEqual(["u-1", "u-2", "u-3"])
    expect(usersWithRole("jr-conferente")).toHaveLength(0)
    expect(tables.job_roles.map((r) => r.id)).not.toContain("jr-conferente")
    // Ninguém foi apagado: reatribuir é mover, não remover.
    expect(tables.users).toHaveLength(4)
  })

  it('"fica sem cargo" zera `job_role_id` sem apagar o usuário', async () => {
    const result = await deleteJobRoleWithReassignment("jr-conferente", [
      { userId: "u-1", targetJobRoleId: null },
      { userId: "u-2", targetJobRoleId: null },
    ])

    expect(result).toMatchObject({ success: true })
    const moved = (tables.users ?? []).filter((u) => ["u-1", "u-2"].includes(u.id as string))
    expect(moved).toHaveLength(2)
    expect(moved.every((u) => u.job_role_id === null)).toBe(true)
  })

  it("sem destino escolhido, RECUSA a exclusão e não move ninguém", async () => {
    const result = await deleteJobRoleWithReassignment("jr-conferente", [
      { userId: "u-1", targetJobRoleId: "jr-analista" },
    ])

    expect(result).toMatchObject({ undecided: ["u-2"] })
    expect("error" in result && result.error).toContain("Escolha o destino de 1 pessoa")
    // O invariante: o cargo continua de pé e as duas pessoas continuam nele.
    expect(tables.job_roles.map((r) => r.id)).toContain("jr-conferente")
    expect(
      usersWithRole("jr-conferente")
        .map((u) => u.id)
        .sort(),
    ).toEqual(["u-1", "u-2"])
  })

  it("a assinatura antiga `deleteJobRole` deixa de apagar vínculo por omissão", async () => {
    const result = await deleteJobRole("jr-conferente")

    expect("error" in result && result.error).toContain("Escolha o destino de 2 pessoa(s)")
    expect(usersWithRole("jr-conferente")).toHaveLength(2)
  })

  it("recusa destino de outra empresa, sem mover ninguém", async () => {
    const result = await deleteJobRoleWithReassignment("jr-conferente", [
      { userId: "u-1", targetJobRoleId: "jr-outra-empresa" },
      { userId: "u-2", targetJobRoleId: "jr-outra-empresa" },
    ])

    expect(result).toEqual({ error: "Cargo de destino inválido" })
    expect(usersWithRole("jr-conferente")).toHaveLength(2)
  })

  it("cargo sem ninguém vinculado exclui direto, como antes", async () => {
    tables.users = (tables.users ?? []).filter((u) => u.job_role_id !== "jr-conferente")

    const result = await deleteJobRoleWithReassignment("jr-conferente")

    expect(result).toMatchObject({ success: true, reassigned: 0 })
    expect(tables.job_roles.map((r) => r.id)).not.toContain("jr-conferente")
  })
})

describe("AC8 — a regra de trilha ativa NÃO muda", () => {
  beforeEach(() => {
    tables.learning_trails = [
      {
        id: "lt-1",
        tenant_id: "tenant-1",
        title: "Segurança do Trabalho",
        status: "active",
        target_job_role_id: "jr-conferente",
      },
      {
        id: "lt-2",
        tenant_id: "tenant-1",
        title: "Rascunho",
        status: "draft",
        target_job_role_id: "jr-conferente",
      },
    ]
  })

  it("bloqueia a exclusão com a mesma mensagem de antes", async () => {
    const result = await deleteJobRoleWithReassignment("jr-conferente", [
      { userId: "u-1", targetJobRoleId: "jr-analista" },
      { userId: "u-2", targetJobRoleId: "jr-analista" },
    ])

    // Contagem considera SÓ a trilha ativa: o rascunho não bloqueia.
    expect(result).toEqual({ error: "Nao e possivel excluir: 1 trilha(s) ativa(s) vinculada(s)" })
    expect(tables.job_roles.map((r) => r.id)).toContain("jr-conferente")
  })

  it("bloqueia ANTES de mover qualquer pessoa (nada de meio-estado)", async () => {
    await deleteJobRoleWithReassignment("jr-conferente", [
      { userId: "u-1", targetJobRoleId: "jr-analista" },
      { userId: "u-2", targetJobRoleId: "jr-analista" },
    ])

    expect(
      usersWithRole("jr-conferente")
        .map((u) => u.id)
        .sort(),
    ).toEqual(["u-1", "u-2"])
    expect(usersWithRole("jr-analista").map((u) => u.id)).toEqual(["u-3"])
  })
})

describe("AC6 — mover pessoas de cargo sem excluir nada", () => {
  it("move quem foi escolhido e deixa o cargo de origem de pé", async () => {
    const result = await reassignJobRolePeople([
      { userId: "u-1", targetJobRoleId: "jr-analista" },
      { userId: "u-2", targetJobRoleId: null },
    ])

    expect(result).toMatchObject({ success: true, reassigned: 2 })
    expect(tables.job_roles.map((r) => r.id)).toContain("jr-conferente")
    expect((tables.users ?? []).find((u) => u.id === "u-1")?.job_role_id).toBe("jr-analista")
    expect((tables.users ?? []).find((u) => u.id === "u-2")?.job_role_id).toBeNull()
  })
})

// =============================================================================
// GUARD DE ESCRITA — INVERSÃO DELIBERADA (GO do dono, 2026-07-28).
//
// A versão anterior deste bloco travava o DEFEITO: `requireContentRole` decidia
// pela coluna singular `users.role` com `["manager","admin","instructor"]`, e o
// dono do produto (`super_admin`, `tenant_id` nulo) via os cargos e levava
// "Permissão negada" em toda escrita. O teste existia para que a correção fosse
// deliberada, e não acidental. O dono autorizou a correção; então o teste muda
// de lado, com as duas metades:
//
//   Metade 1 (eixo): a decisão é sobre a UNIÃO DE CHAPÉUS (`user_roles`), com
//   `super_admin` incluído — a MESMA lista que a rota já usava para LER.
//   Metade 2 (empresa): a escrita usa a empresa RESOLVIDA (`resolveTenantId`),
//   nunca `profile.tenant_id` cru, e é RECUSADA se não houver empresa.
//
// As três fronteiras que a correção não pode derrubar estão logo abaixo.
// =============================================================================

describe("Guard de escrita — comportamento NOVO (dono do produto escreve)", () => {
  /**
   * O dono: `super_admin`, sem empresa própria, com empresa escolhida no
   * seletor. `cookie: null` significa "não escolheu empresa nenhuma" — e é
   * `null`, não `undefined`, porque `undefined` explícito reativaria o valor
   * default do parâmetro e o teste (b) provaria o contrário do que pretende.
   */
  function beOwner(cookie: string | null = "tenant-1") {
    actor = {
      user: { id: "actor-sa" },
      profile: { role: "super_admin", tenant_id: null },
      roles: ["super_admin"],
    }
    currentUserId = "actor-sa"
    cookieValue = cookie ?? undefined
  }

  it("o dono do produto EXCLUI cargo com reatribuição (era 'Permissão negada')", async () => {
    beOwner()

    const result = await deleteJobRoleWithReassignment("jr-conferente", [
      { userId: "u-1", targetJobRoleId: "jr-analista" },
      { userId: "u-2", targetJobRoleId: "jr-analista" },
    ])

    expect(result).toMatchObject({ success: true, reassigned: 2 })
    expect(tables.job_roles.map((r) => r.id)).not.toContain("jr-conferente")
  })

  it("o dono do produto move pessoas de cargo", async () => {
    beOwner()

    const result = await reassignJobRolePeople([{ userId: "u-1", targetJobRoleId: "jr-analista" }])

    expect(result).toMatchObject({ success: true, reassigned: 1 })
    expect((tables.users ?? []).find((u) => u.id === "u-1")?.job_role_id).toBe("jr-analista")
  })

  it("decide pelo CHAPÉU, não pela coluna singular", async () => {
    // O caso que prova o eixo: coluna singular diz "student" (não escreveria
    // nem antes nem agora), mas a união de chapéus tem `admin`. Quem decide é a
    // união — se este teste passar a falhar, alguém devolveu o eixo singular.
    actor = {
      user: { id: "actor-hibrido" },
      profile: { role: "student", tenant_id: "tenant-1" },
      roles: ["student", "admin"],
    }

    const result = await deleteJobRoleWithReassignment("jr-analista", [
      { userId: "u-3", targetJobRoleId: null },
    ])

    expect(result).toMatchObject({ success: true })
  })

  it("chapéu sem direito de escrita continua recusado", async () => {
    actor = {
      user: { id: "actor-aluno" },
      profile: { role: "student", tenant_id: "tenant-1" },
      roles: ["student"],
    }

    const result = await deleteJobRoleWithReassignment("jr-conferente", [
      { userId: "u-1", targetJobRoleId: "jr-analista" },
      { userId: "u-2", targetJobRoleId: "jr-analista" },
    ])

    expect(result).toEqual({ error: "Permissão negada" })
    expect(usersWithRole("jr-conferente")).toHaveLength(2)
  })

  /* ------------------------- As três fronteiras ------------------------- */

  it("(a) cargo criado pelo dono nasce com a empresa do seletor, NUNCA nula", async () => {
    beOwner("tenant-9")

    const result = await createJobRole({
      name: "Analista de Dados",
      seniority_level: "mid",
      description: null,
      area_id: null,
    })

    expect("error" in result && result.error).toBeFalsy()
    const created = tables.job_roles.find((r) => r.name === "Analista de Dados")
    expect(created?.tenant_id).toBe("tenant-9")
    // O defeito da metade 2 em uma linha: `profile.tenant_id` era null, e a
    // versão anterior gravava esse null direto.
    expect(created?.tenant_id).not.toBeNull()
    expect(tables.job_roles.every((r) => r.tenant_id !== null)).toBe(true)
  })

  it("(a2) duplicar também nasce com empresa, nunca nula", async () => {
    beOwner()

    await duplicateJobRole("jr-conferente")

    const copy = tables.job_roles.find((r) => r.name === "Conferente (cópia)")
    expect(copy?.tenant_id).toBe("tenant-1")
  })

  it("(b) sem NENHUMA empresa resolvível, a operação é recusada e nada é gravado", async () => {
    beOwner(null)
    tables.tenants = [] // nem tenant próprio, nem cookie, nem primeira empresa

    const before = tables.job_roles.length
    const result = await createJobRole({
      name: "Cargo fantasma",
      seniority_level: "mid",
      description: null,
      area_id: null,
    })

    expect(result).toEqual({
      error: "Nenhuma empresa ativa: selecione uma empresa antes de gravar",
    })
    expect(tables.job_roles).toHaveLength(before)
    expect(tables.job_roles.some((r) => r.name === "Cargo fantasma")).toBe(false)
  })

  it("(c) ninguém alcança cargo de empresa ALHEIA", async () => {
    // O buraco que alargar o guard abriria sozinho: `jr_super_admin` é bypass
    // FOR ALL, então sem escopo explícito o dono alcançaria qualquer empresa
    // por id, ignorando a que escolheu no seletor.
    beOwner("tenant-1")

    const result = await deleteJobRoleWithReassignment("jr-outra-empresa")

    expect(result).toEqual({ error: "Cargo não encontrado" })
    expect(tables.job_roles.map((r) => r.id)).toContain("jr-outra-empresa")
  })

  it("(c2) o destino da reatribuição não pode ser cargo de outra empresa", async () => {
    beOwner("tenant-1")

    const result = await deleteJobRoleWithReassignment("jr-conferente", [
      { userId: "u-1", targetJobRoleId: "jr-outra-empresa" },
      { userId: "u-2", targetJobRoleId: "jr-outra-empresa" },
    ])

    expect(result).toEqual({ error: "Cargo de destino inválido" })
    expect(usersWithRole("jr-conferente")).toHaveLength(2)
  })
})
