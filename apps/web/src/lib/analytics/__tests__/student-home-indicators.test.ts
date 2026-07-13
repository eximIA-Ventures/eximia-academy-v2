import type { EnrollmentRow } from "@/lib/notifications/engagement-triage"
import { describe, expect, it } from "vitest"
import {
  type HomeReflectionRow,
  type HomeSessionRow,
  buildStudentHomeIndicators,
  computeEngagementMax,
  countReflectionPossibleSlides,
  trailChapterIdsOf,
} from "../student-home-indicators"

const NOW = Date.parse("2026-06-01T00:00:00Z")
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

function session(studentId: string, createdAt: string, status = "completed"): HomeSessionRow {
  return { student_id: studentId, status, created_at: createdAt }
}
function enrollment(over: Partial<EnrollmentRow> & { student_id: string }): EnrollmentRow {
  return {
    student_id: over.student_id,
    status: over.status ?? "active",
    created_at: over.created_at ?? daysAgo(10),
    progress: over.progress ?? { percentage: 0 },
    course_id: over.course_id ?? "c1",
  }
}

// s1 (Você): accessed 1 day ago, 2 completed sessions, 3 reflections, progress 80.
// s2: accessed 5 days ago, 1 completed session, 1 reflection, progress 40.
// s3: NEVER accessed (no session), no enrollment.
const ORG = ["s1", "s2", "s3"]
const SESSIONS: HomeSessionRow[] = [
  session("s1", daysAgo(1)),
  session("s1", daysAgo(3)),
  session("s2", daysAgo(5)),
]
const REFLECTIONS: HomeReflectionRow[] = [
  { student_id: "s1" },
  { student_id: "s1" },
  { student_id: "s1" },
  { student_id: "s2" },
]
const ENROLLMENTS: EnrollmentRow[] = [
  enrollment({ student_id: "s1", progress: { percentage: 80 }, course_id: "c1" }),
  enrollment({ student_id: "s2", progress: { percentage: 40 }, course_id: "c1" }),
]
// No deadline (deadline_days null) → nobody is "behind" → ritmo "no_ritmo" for
// students with activity; s3 (no sessions, no progress) → "nao_iniciado".
const DEADLINES = new Map<string, number | null>([["c1", null]])

describe("buildStudentHomeIndicators — 4 indicadores operacionais org-wide", () => {
  const result = buildStudentHomeIndicators(
    "s1",
    ORG,
    SESSIONS,
    REFLECTIONS,
    ENROLLMENTS,
    DEADLINES,
    NOW,
  )

  it("Você (s1): último acesso 1 dia, engajamento = 2*2+3 = 7, progresso 80, ritmo no_ritmo", () => {
    expect(result?.subject.lastAccessDays).toBe(1)
    expect(result?.subject.engagement).toBe(7) // 2 completed *2 + 3 reflections
    expect(result?.subject.progressPct).toBe(80)
    expect(result?.subject.ritmoDisplay).toBe("no_ritmo")
    // FRENTE 2 — the engagement breakdown behind the score.
    expect(result?.subject.interactions).toBe(2)
    expect(result?.subject.reflections).toBe(3)
  })

  it("FRENTE 2 — breakdown médio da org: interações méd. (2+1+0)/3=1, reflexões méd. (3+1+0)/3=1", () => {
    expect(result?.reference.interactionsAvg).toBe(1)
    expect(result?.reference.reflectionsAvg).toBe(1)
  })

  it("D1 — recência média SÓ de quem acessou (s3 nunca acessou fica FORA): (1+5)/2 = 3", () => {
    // s1 last access 1d, s2 5d, s3 excluded → mean = 3.
    expect(result?.reference.lastAccessAvgDays).toBe(3)
  })

  it("D2 — '% em dia' = (no_ritmo + concluído) / TOTAL (3): s1+s2 no_ritmo, s3 nao_iniciado → 2/3 = 67%", () => {
    expect(result?.reference.ritmoEmDiaPct).toBe(67)
  })

  it("D3 — progresso médio baseado em curso sobre TODOS (3): (80+40+0)/3 = 40", () => {
    expect(result?.reference.progressAvgPct).toBe(40)
  })

  it("engajamento médio sobre TODOS (3): s1=7, s2=2*1+1=3, s3=0 → (7+3+0)/3 = 3", () => {
    expect(result?.reference.engagementAvg).toBe(3)
  })

  it("org vazia → null", () => {
    expect(buildStudentHomeIndicators("x", [], [], [], [], new Map(), NOW)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// FRENTE 2, achado da Lupa — a IDENTIDADE da manchete tem que fechar na linha da
// MÉDIA: engagementAvg exibido === 2*interactionsAvg + reflectionsAvg. Dataset
// DIVERGENTE (o repro da Lupa) em que arredondar as 3 médias independentemente
// daria número inconsistente com a sublinha. Trava a escolha (a) contra refactor.
// ---------------------------------------------------------------------------

describe("engagementAvg fecha com a sublinha (identidade da manchete)", () => {
  it("interações [1,1,2] · reflexões [1,1,2] → avgs 1/1 → engajamento médio 3 (=2*1+1), NÃO 4", () => {
    // 3 alunos, todos com acesso. interações = sessões concluídas.
    const org = ["a", "b", "c"]
    const sessions: HomeSessionRow[] = [
      session("a", daysAgo(1)),
      session("b", daysAgo(1)),
      session("c", daysAgo(1)),
      session("c", daysAgo(2)),
    ]
    const reflections: HomeReflectionRow[] = [
      { student_id: "a" },
      { student_id: "b" },
      { student_id: "c" },
      { student_id: "c" },
    ]
    const res = buildStudentHomeIndicators("a", org, sessions, reflections, [], new Map(), NOW)
    const ref = res?.reference
    // Arredondar independente daria round((2*4+4)/3)=round(4)=4; a identidade força 3.
    expect(ref?.interactionsAvg).toBe(1)
    expect(ref?.reflectionsAvg).toBe(1)
    expect(ref?.engagementAvg).toBe(3)
    // A INVARIANTE que a manchete precisa: número = 2*interações + reflexões.
    expect(ref?.engagementAvg).toBe(2 * (ref?.interactionsAvg ?? 0) + (ref?.reflectionsAvg ?? 0))
  })
})

// ---------------------------------------------------------------------------
// SH-F.5 — engagementMax N (teto da trilha do Você). AC8 (N correto) + AC3
// (buildStudentHomeIndicators expõe engagementMax, numerador intocado).
// ---------------------------------------------------------------------------

describe("SH-F.5 — trilha do aluno e teto N", () => {
  it("trailChapterIdsOf: capítulos dos cursos matriculados (active/completed) não-arquivados", () => {
    const enrollments = [
      { student_id: "s1", status: "active", course_id: "c1" },
      { student_id: "s1", status: "completed", course_id: "c2" },
      { student_id: "s1", status: "active", course_id: "cArq" }, // curso arquivado → fora
      { student_id: "s1", status: "cancelled", course_id: "c1" }, // status fora
      { student_id: "s2", status: "active", course_id: "c1" }, // outro aluno
    ]
    const chapters = [
      { id: "ch1", course_id: "c1" },
      { id: "ch2", course_id: "c1" },
      { id: "ch3", course_id: "c2" },
      { id: "chArq", course_id: "cArq" },
      { id: "chOutro", course_id: "c9" },
    ]
    const active = new Set(["c1", "c2"]) // cArq NÃO está entre os ativos
    expect(trailChapterIdsOf("s1", enrollments, chapters, active).sort()).toEqual([
      "ch1",
      "ch2",
      "ch3",
    ])
  })

  it("countReflectionPossibleSlides: conta slides com >=1 prompt (max 1 por slide)", () => {
    const slides = [
      { text_content: "> Reflexão: o que você aprendeu?" },
      { text_content: "> Agora reflita por um momento sobre o caso" },
      { text_content: "conteúdo normal sem prompt" },
      { text_content: null },
    ]
    expect(countReflectionPossibleSlides(slides)).toBe(2)
  })

  it("AC8: engagementMax = capítulosTrilha*2 + slides-reflexão (3 cap + 4 slides → 10)", () => {
    expect(computeEngagementMax(3, 4)).toBe(10)
    expect(computeEngagementMax(0, 0)).toBe(0)
  })

  it("AC3: buildStudentHomeIndicators expõe engagementMax; numerador (engagement) intocado", () => {
    const res = buildStudentHomeIndicators(
      "s1",
      ORG,
      SESSIONS,
      REFLECTIONS,
      ENROLLMENTS,
      DEADLINES,
      NOW,
      10,
    )
    expect(res?.subject.engagementMax).toBe(10)
    expect(res?.subject.engagement).toBe(7) // 2*2 + 3, inalterado
  })

  it("AC3: sem engagementMax → subject.engagementMax undefined (degradação)", () => {
    const res = buildStudentHomeIndicators(
      "s1",
      ORG,
      SESSIONS,
      REFLECTIONS,
      ENROLLMENTS,
      DEADLINES,
      NOW,
    )
    expect(res?.subject.engagementMax).toBeUndefined()
  })
})
