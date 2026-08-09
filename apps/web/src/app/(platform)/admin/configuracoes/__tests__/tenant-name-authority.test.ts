import { beforeEach, describe, expect, it, vi } from "vitest"

// =============================================================================
// CFG-5.1 (AC2) — A FRONTEIRA DE AUTORIDADE SOBRE `tenants.name`.
//
// A decisão do dono (2026-07-28) foi manter o admin da empresa podendo editar o
// nome da PRÓPRIA empresa, sobre uma premissa técnica explícita:
// `saveTenantSettings` resolve o tenant a partir do PERFIL de quem chama, e o
// payload não tem nenhum campo que aponte para outra empresa — logo o admin não
// alcança empresa alheia por nenhum caminho.
//
// Uma decisão tomada sobre uma premissa merece a premissa PROVADA, não assumida.
// É o que este arquivo faz: exercita o `resolveTenantId` REAL (o mesmo que lê o
// cookie `x-sa-active-tenant` do seletor de empresa) e observa qual `id` chega
// de fato no `UPDATE`. O caso 2 é o adversarial: um admin de tenant próprio com
// o cookie apontando para OUTRA empresa. Se a linha
// `if (profileTenantId) return profileTenantId` (`lib/auth.ts`) um dia sair, é
// aqui que fica vermelho — e a decisão do dono precisará ser revista.
//
// Só I/O é dublado (client Supabase, cookies, audit, revalidate). O gate de
// chapéu (`hasAnyRole`), o schema Zod e a resolução de tenant são os REAIS.
// =============================================================================

/* ---------------------------------- Mocks --------------------------------- */

interface Write {
  table: string
  data: Record<string, unknown>
  /** O `id` do `.eq("id", …)` que escopou o UPDATE — a fronteira em si. */
  scopedTo: string | null
}

let cookieValue: string | undefined
let writes: Write[] = []
/** Linhas devolvidas pelo UPDATE: vazio emula o RLS recusando em silêncio. */
let updatedRows: { id: string }[] = []
let tenantsInDb: { id: string }[] = []
let auditCalls: Record<string, unknown>[] = []

function makeClient() {
  return {
    from: vi.fn((table: string) => {
      // biome-ignore lint/suspicious/noExplicitAny: test mock builder
      const builder: any = {}
      let updateData: Record<string, unknown> | null = null
      let idFilter: string | null = null

      builder.select = vi.fn(() => builder)
      builder.order = vi.fn(() => builder)
      builder.limit = vi.fn(() => builder)
      builder.update = vi.fn((data: Record<string, unknown>) => {
        updateData = data
        return builder
      })
      builder.eq = vi.fn((column: string, value: unknown) => {
        if (column === "id" && typeof value === "string") idFilter = value
        return builder
      })
      builder.single = vi.fn(() =>
        Promise.resolve({
          data: { branding: { primary_color: "#2a6ab0" }, settings: { ai_model: "gpt-4o" } },
          error: null,
        }),
      )
      // biome-ignore lint/suspicious/noThenProperty: thenable mock emulates the supabase builder
      builder.then = (
        onFulfilled: (value: { data: unknown; error: null }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => {
        if (updateData) {
          writes.push({ table, data: updateData, scopedTo: idFilter })
          return Promise.resolve({ data: updatedRows, error: null }).then(onFulfilled, onRejected)
        }
        return Promise.resolve({ data: tenantsInDb, error: null }).then(onFulfilled, onRejected)
      }
      return builder
    }),
  }
}

const client = makeClient()

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => client) }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn(() => client) }))

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "x-sa-active-tenant" && cookieValue ? { value: cookieValue } : undefined,
  }),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

vi.mock("@/lib/audit", () => ({
  logAdminAction: vi.fn(async (entry: Record<string, unknown>) => {
    auditCalls.push(entry)
  }),
}))

let authProfile: {
  user: { id: string } | null
  profile: { role: string; tenant_id: string | null } | null
  roles: string[]
  supabase: unknown
}

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>()
  return {
    // O REAL — é ele quem decide QUAL empresa a gravação alcança.
    resolveTenantId: actual.resolveTenantId,
    getAuthProfile: vi.fn(async () => authProfile),
    getDbClient: vi.fn(async () => client),
  }
})

const { saveTenantSettings } = await import("@/app/(platform)/admin/settings/actions")

/* -------------------------------- Fixtures -------------------------------- */

/** Admin da Cory (tenant-7). O ator central desta decisão. */
const ADMIN_DA_CORY = {
  user: { id: "adm-1" },
  profile: { role: "admin", tenant_id: "tenant-7" },
  roles: ["admin"],
  supabase: client,
}

const OUTRA_EMPRESA = "tenant-42"

beforeEach(() => {
  vi.clearAllMocks()
  cookieValue = undefined
  writes = []
  auditCalls = []
  tenantsInDb = []
  updatedRows = [{ id: "tenant-7" }]
  authProfile = ADMIN_DA_CORY
})

/* ---------------------------------- Testes -------------------------------- */

describe("saveTenantSettings — o admin edita o nome da PRÓPRIA empresa", () => {
  it("grava o novo nome, escopado na empresa do próprio perfil", async () => {
    const result = await saveTenantSettings({ name: "Cory Agronegócios" })

    expect(result).toEqual({ success: true })
    expect(writes).toHaveLength(1)
    expect(writes[0].table).toBe("tenants")
    expect(writes[0].scopedTo).toBe("tenant-7")
    expect(writes[0].data.name).toBe("Cory Agronegócios")
  })

  it("registra a edição no audit log, com o nome entre os campos alterados", async () => {
    await saveTenantSettings({ name: "Cory Agronegócios" })

    expect(auditCalls).toHaveLength(1)
    expect(auditCalls[0]).toMatchObject({
      actorId: "adm-1",
      tenantId: "tenant-7",
      action: "settings.updated",
    })
    expect((auditCalls[0].details as { campos_alterados: string[] }).campos_alterados).toContain(
      "name",
    )
  })
})

describe("saveTenantSettings — nenhum caminho alcança empresa alheia", () => {
  it("cookie de OUTRA empresa é ignorado: a gravação continua na empresa do perfil", async () => {
    // O cenário adversarial: o seletor de empresa (super-admin) gravou o cookie,
    // e um admin de tenant próprio tenta salvar. `resolveTenantId` devolve o
    // tenant do PERFIL antes de sequer olhar o cookie.
    cookieValue = OUTRA_EMPRESA

    await saveTenantSettings({ name: "Sequestro" })

    expect(writes).toHaveLength(1)
    expect(writes[0].scopedTo).toBe("tenant-7")
    expect(writes.some((w) => w.scopedTo === OUTRA_EMPRESA)).toBe(false)
    expect(auditCalls[0].tenantId).toBe("tenant-7")
  })

  it("CONTRAPROVA: o cookie NÃO é decorativo — quem não tem tenant próprio é levado por ele", async () => {
    // Sem este caso, o teste acima poderia estar verde por um mock de cookie
    // quebrado, e não por a fronteira existir. Aqui o MESMO cookie decide de
    // verdade o destino da gravação — só que para o super_admin, que é
    // justamente quem tem autoridade sobre qualquer empresa (o seletor do topo).
    authProfile = {
      user: { id: "sa-1" },
      profile: { role: "super_admin", tenant_id: null },
      roles: ["super_admin"],
      supabase: client,
    }
    cookieValue = OUTRA_EMPRESA
    updatedRows = [{ id: OUTRA_EMPRESA }]

    await saveTenantSettings({ name: "Outra Empresa S.A." })

    expect(writes[0].scopedTo).toBe(OUTRA_EMPRESA)
  })

  it("o payload não tem porta para outra empresa: `id`/`tenant_id` injetados são descartados", async () => {
    // O contrato é o `tenantSettingsSchema` (Zod `object`, que STRIPA chaves
    // desconhecidas). Se alguém um dia trocar por `.passthrough()`, estes campos
    // vazariam para dentro do `UPDATE` e este teste fica vermelho.
    await saveTenantSettings({
      name: "Cory",
      id: OUTRA_EMPRESA,
      tenant_id: OUTRA_EMPRESA,
      tenantId: OUTRA_EMPRESA,
    } as never)

    expect(writes[0].scopedTo).toBe("tenant-7")
    expect(writes[0].data).not.toHaveProperty("id")
    expect(writes[0].data).not.toHaveProperty("tenant_id")
    expect(writes[0].data).not.toHaveProperty("tenantId")
    expect(Object.keys(writes[0].data).sort()).toEqual(["name", "updated_at"])
  })

  it("quem não é admin nem super_admin não grava nada", async () => {
    authProfile = {
      user: { id: "stu-1" },
      profile: { role: "student", tenant_id: "tenant-7" },
      roles: ["student"],
      supabase: client,
    }

    const result = await saveTenantSettings({ name: "Tentativa" })

    expect(result).toEqual({ error: "Acesso negado" })
    expect(writes).toHaveLength(0)
    expect(auditCalls).toHaveLength(0)
  })

  it("sem sessão, não grava nada", async () => {
    authProfile = { user: null, profile: null, roles: [], supabase: client }

    const result = await saveTenantSettings({ name: "Tentativa" })

    expect(result).toEqual({ error: "Não autenticado" })
    expect(writes).toHaveLength(0)
  })

  it("gerente com o chapéu de manager não passa pelo gate (conjunto permitido é admin-tier)", async () => {
    authProfile = {
      user: { id: "mgr-1" },
      profile: { role: "manager", tenant_id: "tenant-7" },
      roles: ["manager", "student"],
      supabase: client,
    }

    const result = await saveTenantSettings({ name: "Tentativa" })

    expect(result).toEqual({ error: "Acesso negado" })
    expect(writes).toHaveLength(0)
  })
})

describe("saveTenantSettings — a recusa do banco não vira 'salvo'", () => {
  it("UPDATE que não casa nenhuma linha (RLS) devolve erro honesto e não audita", async () => {
    updatedRows = []

    const result = await saveTenantSettings({ name: "Cory" })

    expect(result.error).toBe(
      "Não foi possível salvar: esta conta não tem permissão de escrita nesta empresa.",
    )
    expect(auditCalls).toHaveLength(0)
  })

  it("nome vazio é barrado pelo schema antes de qualquer escrita", async () => {
    const result = await saveTenantSettings({ name: "" })

    expect(result.error).toBeDefined()
    expect(writes).toHaveLength(0)
  })
})
