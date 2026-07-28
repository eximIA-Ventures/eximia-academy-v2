import { beforeEach, describe, expect, it, vi } from "vitest"

// =============================================================================
// A EMPRESA EXIBIDA TEM QUE SER A EMPRESA EDITADA (auditoria, rodada 5).
//
// O cabeçalho do painel escolhe o tenant default como `allTenants[0]` de uma
// query ordenada (`(platform)/layout.tsx`), enquanto o fallback de
// `resolveTenantId` fazia `select("id").limit(1)` SEM `order` — ordem indefinida
// no Postgres. Para o admin global que ainda não tocou no seletor (sem cookie
// `x-sa-active-tenant`), os dois podiam apontar para empresas DIFERENTES: ele
// LIA "Empresa A" no topo e EDITAVA a empresa B nas seções do hub.
//
// Estes testes exercitam o `resolveTenantId` REAL contra um fake de PostgREST
// que honra `order()`/`limit()` de verdade e devolve as linhas em ordem de
// inserção (o pior caso, e o que o Postgres pode devolver sem `ORDER BY`).
// Se alguém remover a ordenação, o caso "não é a primeira linha do banco" fica
// vermelho.
// =============================================================================

/** Linhas de `tenants` na ordem "física" — deliberadamente FORA de ordem. */
const TENANT_ROWS = [
  { id: "id-z", name: "Zebra Corp", slug: "zebra" },
  { id: "id-b", name: "Alfa Holding", slug: "alfa-2" }, // homônimo, id maior
  { id: "id-a", name: "Alfa Holding", slug: "alfa-1" }, // homônimo, id menor
  { id: "id-m", name: "Meridiano", slug: "meridiano" },
]

type Row = (typeof TENANT_ROWS)[number]

let cookieValue: string | undefined
/** Colunas de `order()` que a última query registrou, na ordem em que vieram. */
let lastOrderColumns: string[] = []

function compare(a: unknown, b: unknown): number {
  const sa = String(a)
  const sb = String(b)
  return sa < sb ? -1 : sa > sb ? 1 : 0
}

/** Fake do query builder do PostgREST: `order()` e `limit()` valem de verdade. */
function makeServiceClient(rows: Row[]) {
  return {
    from: vi.fn((_table: string) => {
      const orders: string[] = []
      let limitTo: number | null = null
      // biome-ignore lint/suspicious/noExplicitAny: test double do query builder
      const builder: any = {
        select: vi.fn(() => builder),
        order: vi.fn((column: string) => {
          orders.push(column)
          return builder
        }),
        limit: vi.fn((n: number) => {
          limitTo = n
          return builder
        }),
        // biome-ignore lint/suspicious/noThenProperty: thenable emula o builder do supabase
        then: (
          onFulfilled: (value: { data: Row[]; error: null }) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) => {
          lastOrderColumns = [...orders]
          const out = [...rows].sort((a, b) => {
            for (const column of orders) {
              const d = compare(a[column as keyof Row], b[column as keyof Row])
              if (d !== 0) return d
            }
            return 0 // sem `order`: mantém a ordem de inserção (pior caso real)
          })
          const data = limitTo === null ? out : out.slice(0, limitTo)
          return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected)
        },
      }
      return builder
    }),
  }
}

const serviceClient = makeServiceClient(TENANT_ROWS)

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => serviceClient),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => serviceClient),
}))

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "x-sa-active-tenant" && cookieValue ? { value: cookieValue } : undefined,
  }),
}))

const { orderedTenantQuery, resolveTenantId } = await import("@/lib/auth")

/**
 * Reprodução FIEL do que `(platform)/layout.tsx` faz para montar o cabeçalho:
 * a mesma query, pelo mesmo helper de ordenação, e o mesmo default
 * (`cookie ?? allTenants[0]`).
 */
async function headerActiveTenant(): Promise<{ id: string | null; list: Row[] }> {
  const query = serviceClient.from("tenants").select("id, name, slug")
  const { data } = await orderedTenantQuery(query)
  const list = (data ?? []) as Row[]
  return { id: cookieValue ?? list[0]?.id ?? null, list }
}

beforeEach(() => {
  cookieValue = undefined
  lastOrderColumns = []
})

describe("resolveTenantId — o fallback é determinístico", () => {
  it("não devolve a primeira linha do banco, e sim a primeira da ordem canônica", async () => {
    // A primeira linha "física" é `id-z` (Zebra). A ordem canônica manda `id-a`.
    expect(TENANT_ROWS[0].id).toBe("id-z")
    await expect(resolveTenantId(null)).resolves.toBe("id-a")
  })

  it("desempata homônimos pelo id — `name` sozinho deixaria a escolha ao banco", async () => {
    // "Alfa Holding" aparece duas vezes, e `id-b` vem ANTES de `id-a` no banco.
    await expect(resolveTenantId(null)).resolves.toBe("id-a")
    expect(lastOrderColumns).toEqual(["name", "id"])
  })

  it("tenant próprio e cookie do seletor continuam vencendo, nesta ordem", async () => {
    await expect(resolveTenantId("meu-tenant")).resolves.toBe("meu-tenant")
    cookieValue = "id-m"
    await expect(resolveTenantId(null)).resolves.toBe("id-m")
    // e o tenant próprio nem consulta o banco/cookie
    cookieValue = "id-z"
    await expect(resolveTenantId("meu-tenant")).resolves.toBe("meu-tenant")
  })
})

describe("cabeçalho e dado apontam para a MESMA empresa", () => {
  it("sem seleção explícita: o que o topo exibe é o que o hub edita", async () => {
    const header = await headerActiveTenant()
    const data = await resolveTenantId(null)

    expect(header.id).toBe(data)
    expect(header.list[0]?.name).toBe("Alfa Holding")
    expect(data).toBe("id-a")
  })

  it("com empresa escolhida no seletor: os dois seguem o cookie", async () => {
    cookieValue = "id-z"
    const header = await headerActiveTenant()
    const data = await resolveTenantId(null)

    expect(header.id).toBe("id-z")
    expect(data).toBe("id-z")
  })

  it("as duas queries usam a MESMA ordenação (uma regra, não duas cópias)", async () => {
    await headerActiveTenant()
    const headerOrder = [...lastOrderColumns]
    lastOrderColumns = []
    await resolveTenantId(null)

    expect(headerOrder).toEqual(lastOrderColumns)
    expect(headerOrder).toEqual(["name", "id"])
  })
})

// =============================================================================
// RODADA 10 (A1) — O EFEITO COLATERAL QUE NÃO PODE ACONTECER
// -----------------------------------------------------------------------------
// A1 tirou o seletor de EMPRESA do mundo Padrão (e do Estúdio): escolher sobre
// qual empresa se opera é ato administrativo, e o mundo de aprender não contém
// administração. O risco óbvio de uma remoção assim é levar junto o ESTADO: se
// a empresa ativa deixasse de resolver, TODA tela do Padrão que lê tenant
// (cursos, trilhas, materiais) passaria a ler nada.
//
// A separação é: some o CONTROLE (a pílula no cabeçalho), permanece o ESTADO (o
// cookie `x-sa-active-tenant` continua gravado e continua sendo lido pelo MESMO
// `resolveTenantId` de sempre). Estes casos guardam essa distinção — nenhum
// deles depende do cabeçalho existir, que é exatamente o ponto.
// =============================================================================
describe("A1 — sai o CONTROLE, permanece o ESTADO", () => {
  it("sem seletor na tela, a empresa escolhida antes continua valendo para os dados", async () => {
    // Cenário literal: o super_admin escolheu "Zebra Corp" no mundo admin e
    // atravessou para o Padrão, onde a pílula não existe mais.
    cookieValue = "id-z"
    expect(await resolveTenantId(null)).toBe("id-z")
  })

  it("o usuário com empresa própria nunca dependeu do seletor — segue no tenant dele", async () => {
    // O caso da esmagadora maioria no Padrão: aluno de um tenant só. O seletor
    // jamais aparecia para ele (`needsTenantSelector` é false), então a remoção
    // é literalmente um no-op — inclusive se houver cookie de outra empresa.
    cookieValue = "id-z"
    expect(await resolveTenantId("id-m")).toBe("id-m")
  })

  it("sem cookie nenhum, o fallback determinístico ainda entrega uma empresa", async () => {
    // Nunca `null` por falta do controle: sem seleção, a MESMA ordem canônica
    // de sempre decide. Uma tela do Padrão nunca fica sem tenant por causa de A1.
    expect(await resolveTenantId(null)).toBe("id-a")
  })
})
