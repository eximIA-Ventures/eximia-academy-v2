import { describe, expect, it } from "vitest"
import {
  areaIdsByUser,
  areaNamesByUser,
  idsMatchingDisplayStatus,
  jobRoleIdsMatching,
  parseDisplayStatusFilter,
} from "../filters"

// =============================================================================
// FILTROS DA TELA DE USUÁRIOS (CFG-6.1, AC1/AC2/AC8).
//
// A regra que estas funções protegem: o filtro por estado é DERIVADO, e quando
// não dá para derivar (Auth fora do ar) a resposta é "não sei" (`null`) — nunca
// uma lista vazia com cara de resposta.
// =============================================================================

const HA_UM_DIA = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
const HA_MUITO_TEMPO = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

const ROSTER = [
  { id: "u-entrou", status: "active" },
  { id: "u-pendente", status: "active" },
  { id: "u-expirado", status: "active" },
  { id: "u-desativado", status: "inactive" },
]

const FACTS = {
  "u-entrou": { invited_at: HA_MUITO_TEMPO, confirmed_at: HA_MUITO_TEMPO },
  "u-pendente": { invited_at: HA_UM_DIA, confirmed_at: null },
  "u-expirado": { invited_at: HA_MUITO_TEMPO, confirmed_at: null },
  "u-desativado": { invited_at: HA_MUITO_TEMPO, confirmed_at: HA_MUITO_TEMPO },
}

describe("busca por cargo (AC1)", () => {
  const cargos = [
    { id: "jr-1", name: "Analista de Campo" },
    { id: "jr-2", name: "Coordenador" },
  ]

  it("casa por pedaço do nome, sem caixa", () => {
    expect(jobRoleIdsMatching(cargos, "campo")).toEqual(["jr-1"])
    expect(jobRoleIdsMatching(cargos, "COORD")).toEqual(["jr-2"])
  })

  it("busca vazia não casa nada (senão o filtro traria o tenant inteiro)", () => {
    expect(jobRoleIdsMatching(cargos, "   ")).toEqual([])
  })

  it("nada casando devolve lista vazia — o chamador NÃO monta a cláusula", () => {
    expect(jobRoleIdsMatching(cargos, "veterinário")).toEqual([])
  })
})

describe("filtro por estado exibido (AC8)", () => {
  it("aceita só os três estados filtráveis", () => {
    expect(parseDisplayStatusFilter("active")).toBe("active")
    expect(parseDisplayStatusFilter("invite_pending")).toBe("invite_pending")
    expect(parseDisplayStatusFilter("inactive")).toBe("inactive")
    expect(parseDisplayStatusFilter("qualquer-coisa")).toBeNull()
    expect(parseDisplayStatusFilter(undefined)).toBeNull()
  })

  it("'Ativos' exclui quem nunca aceitou o convite", () => {
    expect(idsMatchingDisplayStatus(ROSTER, FACTS, "active")).toEqual(["u-entrou"])
  })

  it("'Convites pendentes' inclui pendente E expirado, igual ao card", () => {
    expect(idsMatchingDisplayStatus(ROSTER, FACTS, "invite_pending")).toEqual([
      "u-pendente",
      "u-expirado",
    ])
  })

  it("'Desativados' vence o estado derivado, como manda a precedência", () => {
    expect(idsMatchingDisplayStatus(ROSTER, FACTS, "inactive")).toEqual(["u-desativado"])
  })

  it("sem os fatos do Auth, 'pendentes' devolve `null` (não sei), nunca `[]`", () => {
    expect(idsMatchingDisplayStatus(ROSTER, {}, "invite_pending")).toBeNull()
  })

  it("sem censo, qualquer filtro devolve `null`", () => {
    expect(idsMatchingDisplayStatus(null, FACTS, "active")).toBeNull()
  })
})

describe("coluna Área (AC2)", () => {
  const areas = [
    { id: "a-1", name: "Ribeirão Preto" },
    { id: "a-2", name: "Minas Gerais" },
  ]

  it("resolve nomes e ordena", () => {
    const map = areaNamesByUser(
      [
        { user_id: "u1", area_id: "a-2" },
        { user_id: "u1", area_id: "a-1" },
      ],
      areas,
    )

    expect(map.u1).toEqual(["Minas Gerais", "Ribeirão Preto"])
  })

  it("vínculo para área de OUTRO tenant é descartado, não vira nome na tela", () => {
    const map = areaNamesByUser([{ user_id: "u1", area_id: "a-de-outro-tenant" }], areas)

    expect(map.u1).toBeUndefined()
  })

  it("os ids acompanham os nomes (o 'Mover de área' depende deles)", () => {
    const ids = areaIdsByUser([{ user_id: "u1", area_id: "a-1" }], areas)

    expect(ids.u1).toEqual(["a-1"])
  })

  it("sem vínculos, mapa vazio em vez de explodir", () => {
    expect(areaNamesByUser(null, areas)).toEqual({})
  })
})
