// ---------------------------------------------------------------------------
// EPIC-JORNADA — Contrato compartilhado (types). Fonte única entre as 3 trilhas.
// Espelha docs/stories/epic-jornada/contrato.md §1–2 e §5. Ver esse doc para a
// racional de cada campo. Terminologia: "jornada" na UI, "study_plan" no banco.
// ---------------------------------------------------------------------------

export type JourneyStatus = "draft" | "active" | "completed" | "paused"
// draft   = construindo, ainda não confirmou (demo: "proposto")
// active  = jornada valendo (demo: "ativo")
// completed / paused = ciclo de vida futuro (soft, nunca DELETE)

/** Unidade de ajuste do stepper/drag (SPEC round 12): semanas | dias. */
export type JourneyUnit = "w" | "d"

export interface JourneyPreferences {
  /** Auto-ajuste: cascata do drag liga/desliga (SPEC round 6). Default true. */
  cascade: boolean
  /** Unidade de ajuste (SPEC round 12). Default "w". */
  unit: JourneyUnit
}

/** Uma jornada ativa por enrollment (1 curso = 1 jornada). Espelha o estado
 *  persistido da demo, menos os campos efêmeros (weeks/hintDone). */
export interface JourneyPlan {
  id: string
  enrollmentId: string
  studentId: string
  courseId: string
  tenantId: string
  status: JourneyStatus
  /** Dias por módulo, ordenados por chapter.order. Min 4/módulo. Soma clampada
   *  ao teto duro (finalDeadline) por fitToDeadline. */
  moduleDurations: number[]
  /** Modelo do "Sugerir jornada" aceso: 1.3 (Tranquilo) | 1 (Moderado) |
   *  0.75 (Intenso) | null (neutro/personalizado). */
  preset: number | null
  preferences: JourneyPreferences
  /** T0 — âncora do relógio da jornada (ISO date). */
  startDate: string
  /** "Disponível até" (teto duro, nível curso). null quando o curso não tem
   *  deadline computável. */
  finalDeadlineDate: string | null
  /** "Meta do gestor" (recomendação, nível curso). null quando não definida. */
  managerDeadlineDate: string | null
  recalculatedAt: string | null
  createdAt: string
  updatedAt: string
}

// --- Contexto de curso (read-only) -----------------------------------------

export interface JourneyModuleMeta {
  chapterId: string
  title: string
  order: number
  /** Convenção das SH-3.x: 1 interação por capítulo. */
  interactionsExpected: number
  /** COUNT(chapter_slides com bloco de reflexão). */
  reflectionsExpected: number
}

export interface JourneyCourseContext {
  courseId: string
  courseTitle: string
  /** ISO date do início (T0). Com jornada = plan.startDate; sem jornada = hoje. */
  startDate: string
  /** courses.deadline_days — teto duro "Disponível até" (demo: 126). */
  finalDeadlineDays: number
  /** courses.manager_deadline_days — "Meta do gestor" (demo: 105). null = sem meta. */
  managerDeadlineDays: number | null
  modules: JourneyModuleMeta[]
}

// --- Server action I/O (contrato §5) ---------------------------------------

export interface SaveJourneyInput {
  enrollmentId: string
  moduleDurations: number[]
  preset: number | null
  preferences: JourneyPreferences
}

export type JourneyActionResult = { ok: true; plan: JourneyPlan } | { ok: false; error: string }
