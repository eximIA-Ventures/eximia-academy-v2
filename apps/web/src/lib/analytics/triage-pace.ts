// Pace do Plano de Ensino — PARTE PURA, extraída byte-a-byte de
// manager-dashboard-page.tsx (2026-08-12) para que /dashboard e /analytics
// compartilhem UM cálculo, não dois.
//
// POR QUE EXISTE: os 3 cards de triagem (No ritmo / Sem acesso / Atenção)
// precisam de `paceByStudent`, que nascia de um loop enterrado no corpo de
// `ManagerDashboardPage`. Replicar aquele loop na página de /analytics criaria
// um SEGUNDO pipeline de triagem, livre para divergir em número do primeiro —
// exatamente o defeito que o card compartilhado existe para não ter. Aqui a
// aritmética vive uma vez só, pura, e é o que o teste de caracterização mede.
//
// Este módulo NÃO faz I/O de propósito: quem consulta o banco é
// `triage-context.ts`. A separação é o que permite provar equivalência sem
// mock de Supabase.

import type { PaceHighlightEntry, StudentPace } from "@/lib/student-triage"

/** Linha de `courses` com prazo (o `.not("deadline_days","is",null)` da query
 * garante o não-nulo; o cast reproduz o do código original). */
export interface PaceDeadlineCourse {
  id: string
  title: string
  deadline_days: number | null
}

/** Linha de `enrollments` ativa, com o join `users!inner(full_name, report_name)`
 * já normalizado pelo chamador (o join do PostgREST chega frouxamente tipado). */
export interface PaceEnrollmentRow {
  student_id: string
  course_id: string
  created_at: string
  progress: { percentage?: number } | null
  users: { full_name?: string; report_name?: string | null } | null
}

export interface PaceContext {
  /** Entries por MATRÍCULA, já ordenadas (behind primeiro, depois daysAhead
   * decrescente) — consumidas por `partitionHighlights`/TeachingPlanHighlights. */
  paceHighlights: PaceHighlightEntry[]
  /** Pior status de pace POR ALUNO (behind > on_track > ahead) — a entrada que
   * `computeStudentRitmo` exige e que faltava em /analytics. */
  paceByStudent: Map<string, StudentPace>
}

const PACE_RANK: Record<StudentPace, number> = { ahead: 0, on_track: 1, behind: 2 }

/**
 * Cálculo de pace por matrícula + redução para o pior status por aluno.
 *
 * Cópia fiel do loop original (S7/S8, Onda 2): mesma fórmula de `expectedPct`,
 * mesmo limiar de +10pp para "ahead", mesma ordenação. Qualquer mudança aqui
 * move os números das DUAS telas ao mesmo tempo — que é o ponto.
 */
export function computePaceFromEnrollments(
  activeEnrollments: PaceEnrollmentRow[],
  deadlineCourses: PaceDeadlineCourse[],
  now: number = Date.now(),
): PaceContext {
  const paceHighlights: PaceHighlightEntry[] = []
  const paceByStudent = new Map<string, StudentPace>()

  // Guarda do original: sem curso com prazo não há pace algum a computar (e o
  // chamador nem chega a consultar enrollments).
  if (deadlineCourses.length === 0) return { paceHighlights, paceByStudent }

  const deadlineMap = new Map(
    deadlineCourses.map((c) => [c.id, { title: c.title, days: c.deadline_days as number }]),
  )

  for (const e of activeEnrollments) {
    const courseInfo = deadlineMap.get(e.course_id)
    if (!courseInfo) continue
    const enrolled = new Date(e.created_at).getTime()
    const deadlineMs = enrolled + courseInfo.days * 86400000
    const elapsed = Math.max(0, (now - enrolled) / 86400000)
    const expectedPct = Math.min(100, Math.round((elapsed / courseInfo.days) * 100))
    const pct = e.progress?.percentage ?? 0
    const daysLeft = Math.max(0, Math.ceil((deadlineMs - now) / 86400000))
    const daysAhead = Math.round(((pct - expectedPct) / 100) * courseInfo.days)
    const studentName = e.users?.report_name ?? e.users?.full_name ?? "—"
    const status: StudentPace =
      pct >= expectedPct ? (pct > expectedPct + 10 ? "ahead" : "on_track") : "behind"

    paceHighlights.push({
      studentId: e.student_id,
      studentName,
      courseTitle: courseInfo.title,
      status,
      progressPct: pct,
      daysLeft,
      daysAhead,
    })

    const prevPace = paceByStudent.get(e.student_id)
    if (!prevPace || PACE_RANK[status] > PACE_RANK[prevPace])
      paceByStudent.set(e.student_id, status)
  }

  // Sort: behind first, then ahead
  paceHighlights.sort((a, b) => {
    if (a.status === "behind" && b.status !== "behind") return -1
    if (a.status !== "behind" && b.status === "behind") return 1
    return b.daysAhead - a.daysAhead
  })

  return { paceHighlights, paceByStudent }
}
