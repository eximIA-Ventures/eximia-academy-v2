import type { EnrollmentRow } from "@/lib/notifications/engagement-triage"
import { describe, expect, it } from "vitest"
import {
  type HomeReflectionRow,
  type HomeSessionRow,
  buildStudentHomeIndicators,
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
