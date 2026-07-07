import { describe, expect, it } from "vitest"

import {
  ATENCAO_DAYS,
  type PaceHighlightEntry,
  SEM_ACESSO_DAYS,
  type StudentPace,
  type StudentTriagem,
  type TriageRow,
  computeStudentAction,
  computeStudentRitmo,
  computeStudentTriagem,
  computeTriageSummary,
  daysSinceLastSession,
  isStudentConcluido,
  partitionHighlights,
} from "../student-triage"

const NOW = new Date("2026-07-07T12:00:00.000Z").getTime()
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

describe("daysSinceLastSession", () => {
  it("returns Infinity when lastSessionDate is null", () => {
    expect(daysSinceLastSession(null, NOW)).toBe(Number.POSITIVE_INFINITY)
  })

  it("returns 0 for a session today", () => {
    expect(daysSinceLastSession(daysAgo(0), NOW)).toBe(0)
  })

  it("returns 6 for a session 6 days ago", () => {
    expect(daysSinceLastSession(daysAgo(6), NOW)).toBe(6)
  })

  it("returns 15 for a session 15 days ago", () => {
    expect(daysSinceLastSession(daysAgo(15), NOW)).toBe(15)
  })
})

describe("computeStudentRitmo", () => {
  it("(0 sessions, 0%) => nao_iniciado, even with pace behind (nao_iniciado wins)", () => {
    const pace = new Map<string, StudentPace>([["s1", "behind"]])
    expect(
      computeStudentRitmo(
        { id: "s1", totalSessions: 0, lastSessionDate: null, courseProgressPct: 0 },
        pace,
      ),
    ).toBe("nao_iniciado")
  })

  it("(3 sessions, pace behind) => atrasado", () => {
    const pace = new Map<string, StudentPace>([["s2", "behind"]])
    expect(
      computeStudentRitmo({ id: "s2", totalSessions: 3, lastSessionDate: daysAgo(1) }, pace),
    ).toBe("atrasado")
  })

  it("(0 sessions, 40%, no pace) => no_ritmo (pct > 0 keeps it out of nao_iniciado)", () => {
    const pace = new Map<string, StudentPace>()
    expect(
      computeStudentRitmo(
        { id: "s3", totalSessions: 0, lastSessionDate: null, courseProgressPct: 40 },
        pace,
      ),
    ).toBe("no_ritmo")
  })

  it("(5 sessions, pace ahead) => no_ritmo", () => {
    const pace = new Map<string, StudentPace>([["s4", "ahead"]])
    expect(
      computeStudentRitmo({ id: "s4", totalSessions: 5, lastSessionDate: daysAgo(1) }, pace),
    ).toBe("no_ritmo")
  })

  it("not in pace map => no_ritmo", () => {
    const pace = new Map<string, StudentPace>()
    expect(
      computeStudentRitmo({ id: "s5", totalSessions: 5, lastSessionDate: daysAgo(1) }, pace),
    ).toBe("no_ritmo")
  })
})

describe("computeStudentTriagem", () => {
  it("totalSessions 0 => sem_acesso", () => {
    expect(
      computeStudentTriagem({ id: "s1", totalSessions: 0, lastSessionDate: null }, "no_ritmo", NOW),
    ).toBe("sem_acesso")
  })

  it("15 days since last session => sem_acesso", () => {
    expect(
      computeStudentTriagem(
        { id: "s2", totalSessions: 3, lastSessionDate: daysAgo(15) },
        "no_ritmo",
        NOW,
      ),
    ).toBe("sem_acesso")
  })

  it("6 days + no_ritmo => atencao", () => {
    expect(
      computeStudentTriagem(
        { id: "s3", totalSessions: 3, lastSessionDate: daysAgo(6) },
        "no_ritmo",
        NOW,
      ),
    ).toBe("atencao")
  })

  it("2 days + atrasado => atencao", () => {
    expect(
      computeStudentTriagem(
        { id: "s4", totalSessions: 3, lastSessionDate: daysAgo(2) },
        "atrasado",
        NOW,
      ),
    ).toBe("atencao")
  })

  it("2 days + no_ritmo => no_ritmo", () => {
    expect(
      computeStudentTriagem(
        { id: "s5", totalSessions: 3, lastSessionDate: daysAgo(2) },
        "no_ritmo",
        NOW,
      ),
    ).toBe("no_ritmo")
  })

  it("lastSessionDate null with totalSessions 3 => sem_acesso", () => {
    expect(
      computeStudentTriagem({ id: "s6", totalSessions: 3, lastSessionDate: null }, "no_ritmo", NOW),
    ).toBe("sem_acesso")
  })

  it("boundary: exactly 14 days is NOT sem_acesso (strictly greater than)", () => {
    expect(
      computeStudentTriagem(
        { id: "s7", totalSessions: 3, lastSessionDate: daysAgo(14) },
        "no_ritmo",
        NOW,
      ),
    ).not.toBe("sem_acesso")
  })

  it("boundary: exactly 5 days is NOT atencao (strictly greater than)", () => {
    expect(
      computeStudentTriagem(
        { id: "s8", totalSessions: 3, lastSessionDate: daysAgo(5) },
        "no_ritmo",
        NOW,
      ),
    ).toBe("no_ritmo")
  })

  it("regra 0: concluído (coursesEnrolled=2, coursesCompleted=2) com 20d sem acesso => no_ritmo, nunca sem_acesso", () => {
    expect(
      computeStudentTriagem(
        {
          id: "s9",
          totalSessions: 3,
          lastSessionDate: daysAgo(20),
          coursesEnrolled: 2,
          coursesCompleted: 2,
        },
        "no_ritmo",
        NOW,
      ),
    ).toBe("no_ritmo")
  })

  it("concluído PARCIAL (coursesEnrolled=2, coursesCompleted=1) com 20d sem acesso NÃO ganha o guard da regra 0 => sem_acesso", () => {
    expect(
      computeStudentTriagem(
        {
          id: "s10",
          totalSessions: 3,
          lastSessionDate: daysAgo(20),
          coursesEnrolled: 2,
          coursesCompleted: 1,
        },
        "no_ritmo",
        NOW,
      ),
    ).toBe("sem_acesso")
  })
})

describe("isStudentConcluido", () => {
  it("coursesEnrolled=2, coursesCompleted=2 => true", () => {
    expect(
      isStudentConcluido({
        id: "s1",
        totalSessions: 1,
        lastSessionDate: null,
        coursesEnrolled: 2,
        coursesCompleted: 2,
      }),
    ).toBe(true)
  })

  it("coursesEnrolled=0 (sem matrícula) => false", () => {
    expect(
      isStudentConcluido({
        id: "s2",
        totalSessions: 1,
        lastSessionDate: null,
        coursesEnrolled: 0,
        coursesCompleted: 0,
      }),
    ).toBe(false)
  })

  it("coursesEnrolled=2, coursesCompleted=1 (parcial) => false", () => {
    expect(
      isStudentConcluido({
        id: "s3",
        totalSessions: 1,
        lastSessionDate: null,
        coursesEnrolled: 2,
        coursesCompleted: 1,
      }),
    ).toBe(false)
  })

  it("campos ausentes (undefined) => false", () => {
    expect(isStudentConcluido({ id: "s4", totalSessions: 1, lastSessionDate: null })).toBe(false)
  })
})

describe("partitionHighlights (S12-fix, partição exclusiva)", () => {
  const paceEntry = (
    studentId: string,
    status: PaceHighlightEntry["status"],
    overrides: Partial<PaceHighlightEntry> = {},
  ): PaceHighlightEntry => ({
    studentId,
    studentName: studentId,
    courseTitle: "Curso X",
    status,
    progressPct: 50,
    daysLeft: 10,
    daysAhead: status === "behind" ? -5 : 5,
    ...overrides,
  })

  const triageRow = (
    id: string,
    triagem: StudentTriagem,
    overrides: Partial<TriageRow> = {},
  ): TriageRow => ({
    id,
    full_name: id,
    triagem,
    totalSessions: 3,
    lastSessionDate: daysAgo(1),
    ...overrides,
  })

  it("aluno atrasado (pace behind) E sem_acesso (triagem) aparece SÓ na coluna 3, nunca na 1/2", () => {
    const { paceHighlights, noAccess } = partitionHighlights(
      [paceEntry("venilton", "behind", { studentName: "Venilton", daysAhead: -58 })],
      [
        triageRow("venilton", "sem_acesso", {
          full_name: "Venilton",
          totalSessions: 0,
          lastSessionDate: null,
        }),
      ],
      NOW,
    )

    expect(paceHighlights.find((h) => h.studentId === "venilton")).toBeUndefined()
    const entry = noAccess.find((n) => n.studentName === "Venilton")
    expect(entry).toBeDefined()
    expect(entry?.detail).toBe("Nunca acessou · 58d atrasado")
  })

  it("aluno no_ritmo (pace ahead) E sem_acesso (triagem) aparece SÓ na coluna 3 com % de conclusão na sublinha", () => {
    const { paceHighlights, noAccess } = partitionHighlights(
      [paceEntry("artur", "ahead", { studentName: "Artur", progressPct: 63 })],
      [
        triageRow("artur", "sem_acesso", {
          full_name: "Artur",
          totalSessions: 5,
          lastSessionDate: daysAgo(54),
        }),
      ],
      NOW,
    )

    expect(paceHighlights.find((h) => h.studentId === "artur")).toBeUndefined()
    const entry = noAccess.find((n) => n.studentName === "Artur")
    expect(entry?.detail).toBe("54d sem acesso · 63% concluído")
  })

  it("aluno concluído (regra 0) sem enrollment ativo ganha entry sintética na coluna 1 com concluido: true", () => {
    const { paceHighlights, noAccess } = partitionHighlights(
      [],
      [
        triageRow("neusa", "no_ritmo", {
          full_name: "Neusa",
          coursesEnrolled: 2,
          coursesCompleted: 2,
        }),
      ],
      NOW,
    )

    expect(noAccess).toHaveLength(0)
    const entry = paceHighlights.find((h) => h.studentId === "neusa")
    expect(entry).toMatchObject({ studentName: "Neusa", concluido: true })
  })

  it("aluno no_ritmo comum (não concluído, com pace) segue normal na coluna 1/2, sem duplicar", () => {
    const { paceHighlights, noAccess } = partitionHighlights(
      [paceEntry("caio", "ahead", { studentName: "Caio" })],
      [triageRow("caio", "no_ritmo", { full_name: "Caio" })],
      NOW,
    )

    expect(paceHighlights).toHaveLength(1)
    expect(paceHighlights[0]).toMatchObject({ studentName: "Caio" })
    expect(paceHighlights[0].concluido).toBeUndefined()
    expect(noAccess).toHaveLength(0)
  })

  it("nenhum aluno aparece em duas colunas ao mesmo tempo (invariante da partição)", () => {
    const { paceHighlights, noAccess } = partitionHighlights(
      [
        paceEntry("venilton", "behind", { studentName: "Venilton" }),
        paceEntry("caio", "ahead", { studentName: "Caio" }),
      ],
      [
        triageRow("venilton", "sem_acesso", { full_name: "Venilton" }),
        triageRow("caio", "no_ritmo", { full_name: "Caio" }),
      ],
      NOW,
    )

    const paceIds = new Set(paceHighlights.map((h) => h.studentId))
    const noAccessNames = new Set(noAccess.map((n) => n.studentName))
    expect(paceIds.has("venilton")).toBe(false)
    expect(noAccessNames.has("Caio")).toBe(false)
  })
})

describe("exhaustive partition (AC3)", () => {
  it("noRitmo + atencao + semAcesso === analisados for a synthetic matrix", () => {
    const totalSessionsOptions = [0, 1, 5]
    const lastSessionOptions = [
      null,
      daysAgo(0),
      daysAgo(3),
      daysAgo(5),
      daysAgo(6),
      daysAgo(14),
      daysAgo(15),
    ]
    const ritmoOptions: Array<"no_ritmo" | "atrasado" | "nao_iniciado"> = [
      "no_ritmo",
      "atrasado",
      "nao_iniciado",
    ]

    const triagens: StudentTriagem[] = []
    for (const totalSessions of totalSessionsOptions) {
      for (const lastSessionDate of lastSessionOptions) {
        for (const ritmo of ritmoOptions) {
          triagens.push(
            computeStudentTriagem({ id: "x", totalSessions, lastSessionDate }, ritmo, NOW),
          )
        }
      }
    }

    const summary = computeTriageSummary(triagens)
    expect(summary.noRitmo + summary.atencao + summary.semAcesso).toBe(summary.analisados)
    expect(summary.analisados).toBe(triagens.length)
  })
})

describe("computeTriageSummary", () => {
  it("[] => tudo 0 (AC8)", () => {
    expect(computeTriageSummary([])).toEqual({
      analisados: 0,
      noRitmo: 0,
      atencao: 0,
      semAcesso: 0,
      noRitmoPct: 0,
      atencaoPct: 0,
      semAcessoPct: 0,
    })
  })

  it("matches mockup R3: 6 analisados, 3 no_ritmo (50%), 1 atencao (17%), 2 sem_acesso (33%)", () => {
    const triagens: StudentTriagem[] = [
      "no_ritmo",
      "no_ritmo",
      "no_ritmo",
      "atencao",
      "sem_acesso",
      "sem_acesso",
    ]
    expect(computeTriageSummary(triagens)).toEqual({
      analisados: 6,
      noRitmo: 3,
      atencao: 1,
      semAcesso: 2,
      noRitmoPct: 50,
      atencaoPct: 17,
      semAcessoPct: 33,
    })
  })
})

describe("threshold anti-drift lock", () => {
  it("SEM_ACESSO_DAYS === 14", () => {
    expect(SEM_ACESSO_DAYS).toBe(14)
  })

  it("ATENCAO_DAYS === 5", () => {
    expect(ATENCAO_DAYS).toBe(5)
  })
})

describe("computeStudentAction (S10, T3)", () => {
  it('("no_ritmo", 5) => { kind: "none" }', () => {
    expect(computeStudentAction("no_ritmo", 5)).toEqual({ kind: "none" })
  })

  it('("atencao", 3) => { kind: "lembrar", nudgeType: "inactive" }', () => {
    expect(computeStudentAction("atencao", 3)).toEqual({
      kind: "lembrar",
      nudgeType: "inactive",
    })
  })

  it('("sem_acesso", 0) => { kind: "acionar", nudgeType: "never_accessed" }', () => {
    expect(computeStudentAction("sem_acesso", 0)).toEqual({
      kind: "acionar",
      nudgeType: "never_accessed",
    })
  })

  it('("sem_acesso", 7) => { kind: "acionar", nudgeType: "inactive" }', () => {
    expect(computeStudentAction("sem_acesso", 7)).toEqual({
      kind: "acionar",
      nudgeType: "inactive",
    })
  })

  it("(undefined, 0) => null (chamador não enriqueceu)", () => {
    expect(computeStudentAction(undefined, 0)).toBeNull()
  })
})
