import {
  DIRECT_TEAM_KEY,
  effectiveTeamSelection,
  parseTeamsParam,
} from "@/app/(platform)/dashboard/_components/team-filter-dropdown"
import { describe, expect, it } from "vitest"
import { buildRosterTeamOptions, filterRosterByTeams } from "../analytics-dashboard"
import type { StudentRosterEntry } from "../student-roster"

// ===========================================================================
// 2026-08-12 — em /analytics o dropdown de sub-times RENDERIZAVA e não filtrava
// nada: o `?teams=` que ele escreve só tinha consumidor em
// `student-insights-table.tsx` (dashboard do gestor), e as rows do roster desta
// página nem sequer carregavam `subteam`. Estes testes pinam o consumidor novo:
// vocabulário válido (opções derivadas do roster) + o corte propriamente dito.
// ===========================================================================

const TEAM_A = "5a4d0000-0000-0000-0000-0000000000a1"
const TEAM_B = "5a4d0000-0000-0000-0000-0000000000b2"

function makeStudent(overrides: Partial<StudentRosterEntry>): StudentRosterEntry {
  return {
    id: overrides.id ?? "s0",
    name: overrides.name ?? "Aluno",
    email: overrides.email ?? "aluno@example.com",
    areaName: null,
    totalSessions: 0,
    completedSessions: 0,
    reflectionsCount: 0,
    lastActivityDate: null,
    daysSinceLastActivity: null,
    completedChapters: 0,
    totalChapters: 0,
    risk: "never_accessed",
    ...overrides,
  }
}

const ROSTER: StudentRosterEntry[] = [
  makeStudent({
    id: "s1",
    name: "Aluna Time A",
    subteam: { id: TEAM_A, name: "Time A", colorIndex: 0 },
  }),
  makeStudent({
    id: "s2",
    name: "Aluno Time B",
    subteam: { id: TEAM_B, name: "Time B", colorIndex: 1, path: ["Venilton", "Oderso"] },
  }),
  makeStudent({ id: "s3", name: "Aluno Direto" }),
  makeStudent({
    id: "s4",
    name: "Outra do Time A",
    subteam: { id: TEAM_A, name: "Time A", colorIndex: 0 },
  }),
]

describe("buildRosterTeamOptions", () => {
  it("uma opção por sub-time presente + Direto, com headcount", () => {
    const options = buildRosterTeamOptions(ROSTER)

    expect(options.map((o) => o.key)).toEqual([TEAM_A, TEAM_B, DIRECT_TEAM_KEY])
    expect(options.find((o) => o.key === TEAM_A)?.count).toBe(2)
    expect(options.find((o) => o.key === DIRECT_TEAM_KEY)?.count).toBe(1)
  })

  it("rotula pelo caminho de nesting quando existe, senão pelo nome", () => {
    const options = buildRosterTeamOptions(ROSTER)

    expect(options.find((o) => o.key === TEAM_B)?.label).toBe("Venilton › Oderso")
    expect(options.find((o) => o.key === TEAM_A)?.label).toBe("Time A")
  })

  it("path vazio não vira rótulo vazio (cai para o nome)", () => {
    const options = buildRosterTeamOptions([
      makeStudent({ id: "s9", subteam: { id: TEAM_A, name: "Time A", path: [] } }),
    ])

    expect(options[0]?.label).toBe("Time A")
  })

  it("roster sem sub-time nenhum produz só a opção Direto (dropdown se auto-oculta)", () => {
    const options = buildRosterTeamOptions([makeStudent({ id: "s3" })])

    expect(options.map((o) => o.key)).toEqual([DIRECT_TEAM_KEY])
  })
})

describe("filterRosterByTeams", () => {
  it("seleção vazia = todos os times, nunca lista vazia", () => {
    expect(filterRosterByTeams(ROSTER, new Set())).toHaveLength(4)
  })

  it("um sub-time selecionado reduz o roster àquele sub-time", () => {
    const rows = filterRosterByTeams(ROSTER, new Set([TEAM_A]))

    expect(rows.map((s) => s.id)).toEqual(["s1", "s4"])
  })

  it("Direto seleciona quem não tem sub-time", () => {
    const rows = filterRosterByTeams(ROSTER, new Set([DIRECT_TEAM_KEY]))

    expect(rows.map((s) => s.id)).toEqual(["s3"])
  })

  it("multi-seleção soma os sub-times", () => {
    const rows = filterRosterByTeams(ROSTER, new Set([TEAM_B, DIRECT_TEAM_KEY]))

    expect(rows.map((s) => s.id)).toEqual(["s2", "s3"])
  })
})

describe("?teams= herdado de outra tela", () => {
  it("id desconhecido no param não esvazia a lista (interseção com o roster)", () => {
    const selected = parseTeamsParam("nao-existe-neste-roster")
    const effective = effectiveTeamSelection(selected, buildRosterTeamOptions(ROSTER))

    expect(effective.size).toBe(0)
    expect(filterRosterByTeams(ROSTER, effective)).toHaveLength(4)
  })

  it("um id válido entre ids obsoletos ainda filtra pelo válido", () => {
    const selected = parseTeamsParam(`obsoleto,${TEAM_A}`)
    const effective = effectiveTeamSelection(selected, buildRosterTeamOptions(ROSTER))

    expect(filterRosterByTeams(ROSTER, effective).map((s) => s.id)).toEqual(["s1", "s4"])
  })

  it("roster SEM subteam (visão admin/área) ignora um ?teams= de sub-time", () => {
    const adminRoster = [makeStudent({ id: "a1" }), makeStudent({ id: "a2" })]
    const effective = effectiveTeamSelection(
      parseTeamsParam(TEAM_A),
      buildRosterTeamOptions(adminRoster),
    )

    expect(filterRosterByTeams(adminRoster, effective)).toHaveLength(2)
  })
})
