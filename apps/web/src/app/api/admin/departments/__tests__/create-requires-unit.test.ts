// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

// =============================================================================
// "TODA ÁREA NASCE EM UMA UNIDADE" — decisão do dono, 2026-07-28.
//
// Este teste não protege uma validação, protege um RÓTULO. Como `departments`
// não tem `archived_at`, o estado arquivado é modelado por ZERO presenças em
// `department_areas`. Se a criação pudesse omitir a unidade, uma área
// recém-criada nasceria com a mesma cardinalidade de uma arquivada — e a tela
// afirmaria um arquivamento que nunca aconteceu.
//
// A UI já preenchia a unidade sozinha (botão desabilitado sem unidades, select
// sem opção vazia). O buraco era a SUPERFÍCIE DA API: `areaId` opcional convidava
// o próximo chamador — import em massa, integrador, outra tela — a criar a órfã.
// O teste existe para que esse próximo chamador esbarre num erro, não num
// comportamento estranho descoberto meses depois em produção.
//
// O assert que carrega o peso é o SEGUNDO de cada caso: nenhuma linha inserida.
// Recusar com 400 e mesmo assim gravar a área seria o pior dos mundos.
// =============================================================================

/* ---------------------------------- Mocks --------------------------------- */

interface Insert {
  table: string
  payload: Record<string, unknown>
}

let inserts: Insert[] = []
let unidades: { id: string; name: string; slug: string; description: string | null }[] = []

const client = {
  from: (table: string) => {
    // biome-ignore lint/suspicious/noExplicitAny: mock builder do supabase
    const builder: any = {}
    builder.select = () => builder
    builder.eq = () => builder
    builder.order = () => builder
    builder.single = async () => ({
      data: { id: "dept-novo", name: "Finanças", slug: "financas", description: null },
      error: null,
    })
    builder.insert = (payload: Record<string, unknown>) => {
      inserts.push({ table, payload })
      const after = {
        select: () => after,
        single: async () => ({
          data: { id: "dept-novo", name: "Finanças", slug: "financas", description: null },
          error: null,
        }),
        // biome-ignore lint/suspicious/noThenProperty: thenable emula o builder do supabase
        then: (
          onFulfilled: (v: { data: unknown; error: null }) => unknown,
          onRejected?: (r: unknown) => unknown,
        ) => Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected),
      }
      return after
    }
    // biome-ignore lint/suspicious/noThenProperty: thenable emula o builder do supabase
    builder.then = (
      onFulfilled: (v: { data: unknown; error: null }) => unknown,
      onRejected?: (r: unknown) => unknown,
    ) =>
      Promise.resolve({ data: table === "areas" ? unidades : [], error: null }).then(
        onFulfilled,
        onRejected,
      )
    return builder
  },
}

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => client) }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn(() => client) }))
vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn(async () => ({
    user: { id: "adm-1" },
    profile: { id: "adm-1", role: "admin", tenant_id: "cory" },
  })),
}))
vi.mock("@/lib/auth", () => ({ resolveTenantId: vi.fn(async () => "cory") }))
vi.mock("@/lib/audit", () => ({ logAdminAction: vi.fn(async () => {}) }))

const { POST } = await import("../route")

const UNIDADE_RP = "11111111-1111-4111-8111-111111111111"

function req(body: unknown): Request {
  return { json: async () => body } as unknown as Request
}

beforeEach(() => {
  inserts = []
  unidades = [{ id: UNIDADE_RP, name: "Ribeirão Preto", slug: "rp", description: null }]
})

/* ---------------------------------- Testes -------------------------------- */

describe("criar área SEM unidade é recusado na fonte", () => {
  it("payload sem `areaId` devolve 400 com erro claro e NÃO cria a área", async () => {
    const res = await POST(req({ name: "Finanças", slug: "financas" }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("Escolha a unidade onde a área vai nascer")
    // O que realmente importa: nada foi gravado.
    expect(inserts).toEqual([])
  })

  it("`areaId` nulo ou vazio também é recusado, sem gravar nada", async () => {
    for (const areaId of [null, "", "   "]) {
      inserts = []
      const res = await POST(req({ name: "Finanças", slug: "financas", areaId }))

      expect(res.status).toBe(400)
      expect(inserts).toEqual([])
    }
  })

  it("unidade de OUTRA empresa é recusada antes de qualquer insert", async () => {
    const res = await POST(
      req({
        name: "Finanças",
        slug: "financas",
        areaId: "99999999-9999-4999-8999-999999999999",
      }),
    )

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("Unidade não encontrada nesta empresa")
    // A ordem importa: a checagem roda ANTES do insert, então a recusa não
    // deixa uma área órfã para trás.
    expect(inserts).toEqual([])
  })
})

describe("criar área COM unidade continua funcionando", () => {
  it("grava a área E a presença na unidade, devolvendo 201", async () => {
    const res = await POST(req({ name: "Finanças", slug: "financas", areaId: UNIDADE_RP }))

    expect(res.status).toBe(201)
    expect(inserts.map((i) => i.table)).toEqual(["departments", "department_areas"])
    expect(inserts[0]?.payload).toMatchObject({ tenant_id: "cory", name: "Finanças" })
    expect(inserts[1]?.payload).toMatchObject({
      department_id: "dept-novo",
      area_id: UNIDADE_RP,
      tenant_id: "cory",
    })
  })

  it("a área nasce LOCAL, nunca com zero presenças", async () => {
    await POST(req({ name: "Finanças", slug: "financas", areaId: UNIDADE_RP }))

    const presencas = inserts.filter((i) => i.table === "department_areas")
    // 1 presença = local (`placementOf`). Zero seria "arquivada" — o estado que
    // esta decisão de produto tornou inalcançável na criação.
    expect(presencas).toHaveLength(1)
  })
})
