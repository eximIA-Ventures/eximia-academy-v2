import { beforeEach, describe, expect, it } from "vitest"
import {
  COLLAPSE_STORAGE_KEY,
  EMPTY_FILTERS,
  NO_AREA_KEY,
  activeFilterLabel,
  buildJobRoleSuggestions,
  computeStats,
  filterRoles,
  governanceWarning,
  groupRolesByArea,
  groupSummary,
  matchesSearch,
  readCollapsedGroups,
  writeCollapsedGroups,
} from "../job-roles-view-model"
import type { JobRolePerson, JobRoleTrail, JobRoleWithStats } from "../types"

// =============================================================================
// Os comportamentos dos ACs 1 a 5 provados onde eles moram: em função pura.
// Nenhum destes asserts depende de pixel, motion ou classe CSS — a paridade
// visual com o mockup é gate humano do dono, e não é isto que se prova aqui.
// =============================================================================

function trail(id: string, title: string, status = "active"): JobRoleTrail {
  return { id, title, status }
}

function personOf(id: string, name: string, areas: string[] = []): JobRolePerson {
  return { id, full_name: name, email: `${id}@cory.com.br`, area_names: areas }
}

function role(partial: Partial<JobRoleWithStats> & { id: string; name: string }): JobRoleWithStats {
  const trails = partial.trails ?? []
  return {
    slug: partial.id,
    description: null,
    seniority_level: "mid",
    area_id: null,
    area_name: null,
    created_at: "2026-01-01",
    active_trails_count: trails.filter((t) => t.status === "active").length,
    people: [],
    ...partial,
    trails,
  }
}

const VENDEDOR = role({
  id: "jr-vend",
  name: "Vendedor Interno",
  description: "Atende o balcão e fecha pedidos",
  area_id: "area-com",
  area_name: "Comercial",
  seniority_level: "junior",
  trails: [trail("t-1", "Onboarding Comercial"), trail("t-2", "Técnicas de Venda")],
  people: [personOf("u-1", "Carlos Eduardo Silva", ["Ribeirão Preto"])],
})

const CONFERENTE = role({
  id: "jr-conf",
  name: "Conferente",
  description: "Confere carga na expedição",
  area_id: "area-log",
  area_name: "Logística",
  seniority_level: "mid",
  trails: [trail("t-3", "Segurança do Trabalho")],
  people: [personOf("u-2", "Felipe Santana")],
})

const ANALISTA_RH = role({
  id: "jr-rh",
  name: "Analista de RH",
  seniority_level: "senior",
  // Sem área, sem trilha e sem gente: o caso que o dot de governança existe para
  // apontar.
})

const ROLES = [VENDEDOR, CONFERENTE, ANALISTA_RH]

describe("AC2 — busca casa nome, descrição E nome de trilha", () => {
  it('"venda" acha Vendedor Interno pela TRILHA, não pelo nome do cargo', () => {
    // A palavra não está em "Vendedor Interno" nem na descrição: está em
    // "Técnicas de Venda". Era exatamente isto que a tela anterior não fazia,
    // porque só tinha a CONTAGEM de trilhas.
    expect(matchesSearch(VENDEDOR, "venda")).toBe(true)
    expect(matchesSearch(CONFERENTE, "venda")).toBe(false)
  })

  it("casa descrição e ignora acento e caixa", () => {
    expect(matchesSearch(CONFERENTE, "EXPEDIÇÃO")).toBe(true)
    expect(matchesSearch(CONFERENTE, "expedicao")).toBe(true)
  })

  it("busca vazia não filtra nada", () => {
    expect(filterRoles(ROLES, EMPTY_FILTERS)).toHaveLength(3)
  })
})

describe("AC3/AC4 — filtros de área, senioridade e recortes rápidos", () => {
  it("filtra por área e pelo recorte explícito Sem área", () => {
    expect(filterRoles(ROLES, { ...EMPTY_FILTERS, areaId: "area-log" })).toEqual([CONFERENTE])
    expect(filterRoles(ROLES, { ...EMPTY_FILTERS, areaId: NO_AREA_KEY })).toEqual([ANALISTA_RH])
  })

  it("filtra por senioridade", () => {
    expect(filterRoles(ROLES, { ...EMPTY_FILTERS, seniority: "junior" })).toEqual([VENDEDOR])
  })

  it('o recorte "sem trilha" devolve só quem não tem trilha ATIVA', () => {
    expect(filterRoles(ROLES, { ...EMPTY_FILTERS, quick: "no-trail" })).toEqual([ANALISTA_RH])
  })

  it('o recorte "sem pessoas" devolve só quem não tem ninguém', () => {
    expect(filterRoles(ROLES, { ...EMPTY_FILTERS, quick: "no-people" })).toEqual([ANALISTA_RH])
  })

  it("o chip de filtro ativo nomeia o recorte em vigor", () => {
    expect(activeFilterLabel({ ...EMPTY_FILTERS, quick: "no-trail" })).toBe("Cargos sem trilha")
    expect(activeFilterLabel({ ...EMPTY_FILTERS, seniority: "senior" })).toBe("Senioridade: Senior")
    expect(activeFilterLabel(EMPTY_FILTERS)).toBeNull()
  })

  it("os stats derivam da lista completa", () => {
    expect(computeStats(ROLES)).toEqual({
      total: 3,
      trails: 3,
      withoutTrail: 1,
      withoutPeople: 1,
    })
  })
})

describe("AC1 — agrupamento por área", () => {
  it('"Sem área" fica SEMPRE por último', () => {
    const groups = groupRolesByArea(ROLES)
    expect(groups.map((g) => g.label)).toEqual(["Comercial", "Logística", "Sem área"])
  })

  it("grupo sem nenhum cargo correspondente ao filtro SOME da lista", () => {
    const filtered = filterRoles(ROLES, { ...EMPTY_FILTERS, search: "venda" })
    const groups = groupRolesByArea(filtered)

    expect(groups.map((g) => g.label)).toEqual(["Comercial"])
    // Não é "grupo vazio renderizado": Logística e Sem área não existem no
    // resultado, porque agrupar acontece DEPOIS de filtrar.
    expect(groups.some((g) => g.roles.length === 0)).toBe(false)
  })

  it('o cabeçalho traz a contagem real "N cargos · N pessoas"', () => {
    const [comercial, , semArea] = groupRolesByArea(ROLES)
    expect(groupSummary(comercial)).toBe("1 cargo · 1 pessoa")
    expect(groupSummary(semArea)).toBe("1 cargo · 0 pessoas")
  })
})

describe("AC5 — dot de governança", () => {
  it("acende sem trilha ativa OU sem pessoas, e explica o porquê", () => {
    expect(governanceWarning(ANALISTA_RH)).toBe("Sem trilha ativa e sem pessoas vinculadas")
    expect(governanceWarning(role({ id: "x", name: "X", people: [personOf("u", "U")] }))).toBe(
      "Sem trilha ativa vinculada",
    )
    expect(governanceWarning(role({ id: "y", name: "Y", trails: [trail("t", "T")] }))).toBe(
      "Sem pessoas com este cargo",
    )
    expect(governanceWarning(VENDEDOR)).toBeNull()
  })
})

describe("AC6 — sugestões derivam do estado", () => {
  it("cargo sem trilha recebe a trilha viva da MESMA área como pergunta", () => {
    const semTrilha = role({
      id: "jr-anlog",
      name: "Analista de Logística",
      area_id: "area-log",
      area_name: "Logística",
      description: "Planeja rotas",
      people: [personOf("u-9", "Ana")],
    })

    const suggestions = buildJobRoleSuggestions(semTrilha, [...ROLES, semTrilha])

    expect(suggestions[0]).toContain("Segurança do Trabalho")
  })

  it("cargo completo não recebe sugestão fabricada", () => {
    expect(buildJobRoleSuggestions(VENDEDOR, ROLES)).toEqual([])
  })
})

describe("AC1 — o colapso persiste entre navegações", () => {
  // Storage injetado em vez do global do jsdom: o que se prova aqui é o
  // CONTRATO de ler/gravar a preferência, não a implementação do ambiente.
  let store: Record<string, string>
  let storage: Storage

  beforeEach(() => {
    store = {}
    storage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v
      },
      removeItem: (k: string) => {
        delete store[k]
      },
      clear: () => {
        store = {}
      },
      key: () => null,
      length: 0,
    } as Storage
  })

  it("o que foi gravado é o que volta na próxima montagem", () => {
    writeCollapsedGroups(["area-log", NO_AREA_KEY], storage)
    expect(readCollapsedGroups(storage)).toEqual(["area-log", NO_AREA_KEY])
    expect(store[COLLAPSE_STORAGE_KEY]).toBeDefined()
  })

  it("preferência corrompida não derruba a tela", () => {
    store[COLLAPSE_STORAGE_KEY] = "{isto não é json}"
    expect(readCollapsedGroups(storage)).toEqual([])
  })
})
