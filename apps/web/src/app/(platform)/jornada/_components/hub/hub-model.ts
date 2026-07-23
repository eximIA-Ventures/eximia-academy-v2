// ---------------------------------------------------------------------------
// EPIC-JORNADA (JRN-C.1, Trilha C) — Hub "Minhas jornadas": derivação PURA dos
// cards a partir das matrículas reais do aluno (SPEC round 15). Sem I/O.
// ---------------------------------------------------------------------------

/** Matrícula real do aluno, já lida no page.tsx (SSR). */
export interface HubEnrollment {
  enrollmentId: string
  courseId: string
  courseTitle: string
  /** progresso 0–100 (enrollments.progress). */
  progressPct: number
  /** esta matrícula é a da jornada ativa persistida? */
  hasActiveJourney: boolean
}

export type HubCardStatus = "active" | "no-journey" | "completed"

export interface HubCard {
  enrollmentId: string
  courseId: string
  courseTitle: string
  progressPct: number
  status: HubCardStatus
  chipLabel: string
  /** só o card 'active' abre o dashboard; os demais dão feedback honesto. */
  openable: boolean
}

/**
 * Mapeia matrículas → cards do hub. Concluída (100%) celebra; com jornada ativa
 * abre o dashboard; sem jornada convida a montar. A ativa fica em primeiro.
 */
export function buildHubCards(enrollments: HubEnrollment[]): HubCard[] {
  const cards = enrollments.map((e): HubCard => {
    const completed = e.progressPct >= 100
    const status: HubCardStatus = completed
      ? "completed"
      : e.hasActiveJourney
        ? "active"
        : "no-journey"
    const chipLabel =
      status === "completed"
        ? "concluída ✓"
        : status === "active"
          ? "Jornada ativa"
          : "sem jornada · monte a sua"
    return {
      enrollmentId: e.enrollmentId,
      courseId: e.courseId,
      courseTitle: e.courseTitle,
      progressPct: Math.min(100, Math.max(0, Math.round(e.progressPct))),
      status,
      chipLabel,
      openable: status === "active",
    }
  })
  // ativa primeiro, depois em andamento, depois concluídas.
  const rank: Record<HubCardStatus, number> = { active: 0, "no-journey": 1, completed: 2 }
  return cards.sort((a, b) => rank[a.status] - rank[b.status])
}
