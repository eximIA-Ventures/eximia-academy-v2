import { describe, expect, it } from "vitest"
import {
  type DepartmentsSnapshot,
  type PresencePlan,
  alsoInLabel,
  archivedDepartments,
  corporateDepartmentsOf,
  deriveDepartments,
  localDepartmentsOf,
  matchesFilter,
  matchesSearch,
  planDeleteUnit,
  planPresence,
} from "../departments-model"

// =============================================================================
// AC6 — MOVER ≠ EXPANDIR.
//
// Este é o gate bloqueante da story, e o motivo dele é que o erro aqui é MUDO:
// mover um departamento de uma unidade para outra e torná-lo corporativo
// (presente nas duas) produzem telas parecidas e bancos diferentes. Se as duas
// operações compartilhassem caminho, ninguém veria o estrago — não há exceção,
// não há erro de tipo, só um departamento que sumiu de onde as pessoas dele
// ainda trabalham.
//
// Por isso os dois caminhos são provados SEPARADAMENTE, um assert de cada vez,
// e existe um teste explícito afirmando a assimetria: expandir NUNCA remove.
// =============================================================================

/* -------------------------------- Fixtures -------------------------------- */

const RP = { id: "rp", name: "Ribeirão Preto", slug: "rp", description: "Unidade de SP" }
const MG = { id: "mg", name: "Minas Gerais", slug: "mg", description: "Unidade de MG" }

/**
 * Cenário-base: 2 unidades, 3 departamentos.
 *   • financeiro — local em RP, 2 pessoas (uma delas gestora)
 *   • logistica  — local em MG
 *   • rh         — corporativo (RP + MG)
 */
function snapshot(): DepartmentsSnapshot {
  return {
    unidades: [RP, MG],
    departments: [
      { id: "financeiro", name: "Finanças", slug: "financas", description: null },
      { id: "logistica", name: "Logística", slug: "logistica", description: null },
      { id: "rh", name: "Recursos Humanos", slug: "rh", description: null },
    ],
    presences: [
      { departmentId: "financeiro", areaId: "rp" },
      { departmentId: "logistica", areaId: "mg" },
      { departmentId: "rh", areaId: "rp" },
      { departmentId: "rh", areaId: "mg" },
    ],
    memberships: [
      { userId: "ana", departmentId: "financeiro" },
      { userId: "bruno", departmentId: "financeiro" },
      { userId: "carla", departmentId: "rh" },
    ],
    people: [
      { id: "ana", name: "Ana Lima", email: "ana@cory.com", isManager: true, areaId: "rp" },
      { id: "bruno", name: "Bruno Sá", email: "bruno@cory.com", isManager: false, areaId: "rp" },
      { id: "carla", name: "Carla Reis", email: "carla@cory.com", isManager: true, areaId: "mg" },
    ],
  }
}

function plan(result: ReturnType<typeof planPresence>): PresencePlan {
  if (!result.ok) throw new Error(`plano recusado: ${result.error}`)
  return result.plan
}

/* ------------------------- Derivação por cardinalidade -------------------- */

describe("cardinalidade é a semântica", () => {
  it("1 presença = local, 2+ = corporativo, 0 = arquivado", () => {
    const views = deriveDepartments({
      ...snapshot(),
      presences: [
        { departmentId: "financeiro", areaId: "rp" },
        { departmentId: "rh", areaId: "rp" },
        { departmentId: "rh", areaId: "mg" },
        // `logistica` sem nenhuma presença → arquivado
      ],
    })

    expect(views.find((d) => d.id === "financeiro")?.placement).toBe("local")
    expect(views.find((d) => d.id === "rh")?.placement).toBe("corporate")
    expect(views.find((d) => d.id === "logistica")?.placement).toBe("archived")
  })

  it("o Mapa separa cartões locais da barra corporativa que atravessa as colunas", () => {
    const views = deriveDepartments(snapshot())

    expect(localDepartmentsOf(views, "rp").map((d) => d.id)).toEqual(["financeiro"])
    expect(localDepartmentsOf(views, "mg").map((d) => d.id)).toEqual(["logistica"])
    // A MESMA barra aparece nas duas colunas que ela cobre — não numa faixa à parte.
    expect(corporateDepartmentsOf(views, "rp").map((d) => d.id)).toEqual(["rh"])
    expect(corporateDepartmentsOf(views, "mg").map((d) => d.id)).toEqual(["rh"])
  })

  it("presença apontando para unidade fora do snapshot é ignorada (nunca inventa coluna)", () => {
    const s = snapshot()
    s.presences.push({ departmentId: "financeiro", areaId: "unidade-de-outra-empresa" })

    const financeiro = deriveDepartments(s).find((d) => d.id === "financeiro")

    expect(financeiro?.areaIds).toEqual(["rp"])
    expect(financeiro?.placement).toBe("local")
  })

  it("gestor do departamento sai dos membros com chapéu de manager", () => {
    const financeiro = deriveDepartments(snapshot()).find((d) => d.id === "financeiro")

    expect(financeiro?.memberCount).toBe(2)
    expect(financeiro?.managers.map((m) => m.id)).toEqual(["ana"])
  })
})

/* ---------------------------------- MOVER --------------------------------- */

describe("MOVER — o departamento troca de lugar", () => {
  it("some da unidade de origem E aparece na de destino", () => {
    const p = plan(
      planPresence(snapshot(), {
        kind: "move",
        departmentId: "financeiro",
        fromAreaId: "rp",
        toAreaId: "mg",
      }),
    )

    expect(p.removePresences).toEqual([{ departmentId: "financeiro", areaId: "rp" }])
    expect(p.addPresences).toEqual([{ departmentId: "financeiro", areaId: "mg" }])
    // Continua LOCAL: trocou de lugar, não passou a estar em dois lugares.
    expect(p.placementBefore).toBe("local")
    expect(p.placementAfter).toBe("local")
    expect(p.archivesDepartment).toBe(false)
  })

  it("as pessoas do departamento acompanham a unidade nova (user_areas.area_id)", () => {
    const p = plan(
      planPresence(snapshot(), {
        kind: "move",
        departmentId: "financeiro",
        fromAreaId: "rp",
        toAreaId: "mg",
      }),
    )

    expect(p.reassignUsers).toEqual([
      { userId: "ana", fromAreaId: "rp", toAreaId: "mg" },
      { userId: "bruno", fromAreaId: "rp", toAreaId: "mg" },
    ])
    expect(p.heldBackUserIds).toEqual([])
  })

  it("quem também pertence a departamento que FICA na origem não é arrastado junto", () => {
    const s = snapshot()
    // Bruno passa a ser também de RH, que continua presente em RP.
    s.memberships.push({ userId: "bruno", departmentId: "rh" })

    const p = plan(
      planPresence(s, {
        kind: "move",
        departmentId: "financeiro",
        fromAreaId: "rp",
        toAreaId: "mg",
      }),
    )

    expect(p.reassignUsers).toEqual([{ userId: "ana", fromAreaId: "rp", toAreaId: "mg" }])
    expect(p.heldBackUserIds).toEqual(["bruno"])
    expect(p.warnings.join(" ")).toContain("continuam na unidade de origem")
  })

  it("mover uma corporativa para uma unidade onde ela JÁ está é recusado, não adivinhado", () => {
    const result = planPresence(snapshot(), {
      kind: "move",
      departmentId: "rh",
      fromAreaId: "rp",
      toAreaId: "mg",
    })

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toContain("Encolher")
  })

  it("origem igual ao destino é recusado", () => {
    const result = planPresence(snapshot(), {
      kind: "move",
      departmentId: "financeiro",
      fromAreaId: "rp",
      toAreaId: "rp",
    })

    expect(result.ok).toBe(false)
  })
})

/* --------------------------------- EXPANDIR ------------------------------- */

describe("EXPANDIR — o departamento passa a estar TAMBÉM em outra unidade", () => {
  it("continua na origem E aparece na nova unidade, virando corporativo", () => {
    const p = plan(
      planPresence(snapshot(), {
        kind: "expand",
        departmentId: "financeiro",
        toAreaId: "mg",
      }),
    )

    expect(p.addPresences).toEqual([{ departmentId: "financeiro", areaId: "mg" }])
    expect(p.placementBefore).toBe("local")
    expect(p.placementAfter).toBe("corporate")
    expect(p.warnings.join(" ")).toContain("corporativo")
  })

  it("NUNCA remove presença — é isto que o separa de mover", () => {
    const p = plan(
      planPresence(snapshot(), {
        kind: "expand",
        departmentId: "financeiro",
        toAreaId: "mg",
      }),
    )

    expect(p.removePresences).toEqual([])
  })

  it("não mexe na unidade de nenhuma pessoa", () => {
    const p = plan(
      planPresence(snapshot(), {
        kind: "expand",
        departmentId: "financeiro",
        toAreaId: "mg",
      }),
    )

    expect(p.reassignUsers).toEqual([])
    expect(p.heldBackUserIds).toEqual([])
  })

  it("expandir para unidade já coberta é recusado", () => {
    const result = planPresence(snapshot(), { kind: "expand", departmentId: "rh", toAreaId: "mg" })

    expect(result.ok).toBe(false)
  })

  it("departamento arquivado não expande — precisa ser restaurado antes", () => {
    const s = snapshot()
    s.presences = s.presences.filter((p) => p.departmentId !== "financeiro")

    const result = planPresence(s, { kind: "expand", departmentId: "financeiro", toAreaId: "mg" })

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toContain("Restaure")
  })
})

/* ------------------------- A ASSIMETRIA, lado a lado ---------------------- */

describe("mover e expandir a partir do MESMO estado produzem bancos diferentes", () => {
  it("mover conserva a contagem de presenças; expandir aumenta", () => {
    const s = snapshot()
    const moved = plan(
      planPresence(s, {
        kind: "move",
        departmentId: "financeiro",
        fromAreaId: "rp",
        toAreaId: "mg",
      }),
    )
    const expanded = plan(
      planPresence(s, { kind: "expand", departmentId: "financeiro", toAreaId: "mg" }),
    )

    const delta = (p: PresencePlan) => p.addPresences.length - p.removePresences.length
    expect(delta(moved)).toBe(0)
    expect(delta(expanded)).toBe(1)

    // Os dois inserem exatamente a MESMA linha em `department_areas`. A diferença
    // inteira está no que é REMOVIDO — que é justamente o que some da tela sem
    // avisar quando as duas operações são confundidas.
    expect(moved.addPresences).toEqual(expanded.addPresences)
    expect(moved.removePresences).not.toEqual(expanded.removePresences)
  })

  it("só mover reatribui pessoas", () => {
    const s = snapshot()
    const moved = plan(
      planPresence(s, {
        kind: "move",
        departmentId: "financeiro",
        fromAreaId: "rp",
        toAreaId: "mg",
      }),
    )
    const expanded = plan(
      planPresence(s, { kind: "expand", departmentId: "financeiro", toAreaId: "mg" }),
    )

    expect(moved.reassignUsers.length).toBeGreaterThan(0)
    expect(expanded.reassignUsers).toEqual([])
  })
})

/* --------------------------------- ENCOLHER ------------------------------- */

describe("ENCOLHER — perde uma presença, a entidade sobrevive", () => {
  it("corporativa que perde uma presença vira local", () => {
    const p = plan(
      planPresence(snapshot(), { kind: "shrink", departmentId: "rh", fromAreaId: "mg" }),
    )

    expect(p.removePresences).toEqual([{ departmentId: "rh", areaId: "mg" }])
    expect(p.addPresences).toEqual([])
    expect(p.placementBefore).toBe("corporate")
    expect(p.placementAfter).toBe("local")
    expect(p.archivesDepartment).toBe(false)
  })

  it("encolher a ÚLTIMA presença NÃO apaga o departamento — arquiva", () => {
    const p = plan(
      planPresence(snapshot(), { kind: "shrink", departmentId: "financeiro", fromAreaId: "rp" }),
    )

    expect(p.placementAfter).toBe("archived")
    expect(p.archivesDepartment).toBe(true)
    // Nenhuma exclusão de entidade no plano: só a linha da junção sai.
    expect(p.removePresences).toEqual([{ departmentId: "financeiro", areaId: "rp" }])
    expect(p.warnings.join(" ")).toContain("NÃO é excluído")
  })

  it("o departamento arquivado continua no estado, visível no filtro Arquivadas", () => {
    const s = snapshot()
    s.presences = s.presences.filter((p) => !(p.departmentId === "financeiro" && p.areaId === "rp"))

    const views = deriveDepartments(s)

    expect(archivedDepartments(views).map((d) => d.id)).toEqual(["financeiro"])
    expect(views.find((d) => d.id === "financeiro")?.memberCount).toBe(2)
  })
})

/* --------------------------- ARQUIVAR / RESTAURAR ------------------------- */

describe("ARQUIVAR e RESTAURAR", () => {
  it("arquivar tira de todas as unidades de uma vez, sem excluir nada", () => {
    const p = plan(planPresence(snapshot(), { kind: "archive", departmentId: "rh" }))

    expect(p.removePresences).toEqual([
      { departmentId: "rh", areaId: "rp" },
      { departmentId: "rh", areaId: "mg" },
    ])
    expect(p.placementAfter).toBe("archived")
    expect(p.archivesDepartment).toBe(true)
  })

  it("restaurar devolve o departamento a uma unidade, como local", () => {
    const s = snapshot()
    s.presences = s.presences.filter((p) => p.departmentId !== "financeiro")

    const p = plan(planPresence(s, { kind: "restore", departmentId: "financeiro", toAreaId: "mg" }))

    expect(p.addPresences).toEqual([{ departmentId: "financeiro", areaId: "mg" }])
    expect(p.placementAfter).toBe("local")
  })

  it("restaurar quem não está arquivado é recusado", () => {
    const result = planPresence(snapshot(), {
      kind: "restore",
      departmentId: "financeiro",
      toAreaId: "mg",
    })

    expect(result.ok).toBe(false)
  })
})

/* ------------------------- EXCLUIR UNIDADE (AC7) -------------------------- */

describe("excluir unidade", () => {
  it("recusa enquanto houver departamento local sem destino escolhido", () => {
    const result = planDeleteUnit(snapshot(), "rp", [])

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.pending).toEqual(["financeiro"])
  })

  it("local vai para a unidade escolhida (com as pessoas) e corporativa só perde a presença", () => {
    const result = planDeleteUnit(snapshot(), "rp", [
      { departmentId: "financeiro", action: "move", toAreaId: "mg" },
    ])

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.localPlans[0]?.addPresences).toEqual([
      { departmentId: "financeiro", areaId: "mg" },
    ])
    expect(result.plan.reassignUsers.map((u) => u.userId)).toEqual(["ana", "bruno"])
    // RH cobria RP e MG: perde só RP e vira local.
    expect(result.plan.corporatePlans[0]?.removePresences).toEqual([
      { departmentId: "rh", areaId: "rp" },
    ])
    expect(result.plan.corporatePlans[0]?.placementAfter).toBe("local")
  })

  it("local pode ser arquivado em vez de movido", () => {
    const result = planDeleteUnit(snapshot(), "rp", [
      { departmentId: "financeiro", action: "archive" },
    ])

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.localPlans[0]?.archivesDepartment).toBe(true)
    expect(result.plan.reassignUsers).toEqual([])
  })
})

/* ------------------------------ Busca e filtro ---------------------------- */

describe("busca e filtro da Lista", () => {
  it("filtro segmentado separa locais, corporativas e arquivadas", () => {
    const s = snapshot()
    s.presences = s.presences.filter((p) => p.departmentId !== "logistica")
    const views = deriveDepartments(s)

    const ids = (f: Parameters<typeof matchesFilter>[1]) =>
      views.filter((d) => matchesFilter(d, f)).map((d) => d.id)

    expect(ids("locais")).toEqual(["financeiro"])
    expect(ids("corporativas")).toEqual(["rh"])
    expect(ids("arquivadas")).toEqual(["logistica"])
    expect(ids("todas")).toHaveLength(3)
  })

  it("busca encontra por nome do departamento e por nome do gestor", () => {
    const views = deriveDepartments(snapshot())
    const financeiro = views.find((d) => d.id === "financeiro")
    if (!financeiro) throw new Error("fixture")

    expect(matchesSearch(financeiro, "finan")).toBe(true)
    expect(matchesSearch(financeiro, "Ana")).toBe(true)
    expect(matchesSearch(financeiro, "carla")).toBe(false)
  })

  it("corporativa exibe 'também em {outras}' dentro de cada unidade que cobre", () => {
    const views = deriveDepartments(snapshot())
    const rh = views.find((d) => d.id === "rh")
    const financeiro = views.find((d) => d.id === "financeiro")
    if (!rh || !financeiro) throw new Error("fixture")

    expect(alsoInLabel(rh, "rp", [RP, MG])).toBe("também em Minas Gerais")
    expect(alsoInLabel(rh, "mg", [RP, MG])).toBe("também em Ribeirão Preto")
    expect(alsoInLabel(financeiro, "rp", [RP, MG])).toBeNull()
  })
})
