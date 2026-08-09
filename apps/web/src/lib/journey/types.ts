// ---------------------------------------------------------------------------
// EPIC-JORNADA — Contrato compartilhado (types). Fonte única entre as 3 trilhas.
// Espelha docs/stories/epic-jornada/contrato.md §1–2 e §5. Ver esse doc para a
// racional de cada campo. Terminologia: "jornada" na UI, "study_plan" no banco.
// ---------------------------------------------------------------------------

import type { ModuleStatus } from "@/lib/analytics/study-plan-dashboard"

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

// --- JRN-E — progresso real por módulo (contrato-progresso §2) --------------

/**
 * Progresso REAL de um módulo no instante de montar/revisar a jornada.
 * `status` é o MESMO ModuleStatus de computeModuleJourney (study-plan-dashboard.ts:31/60),
 * IMPORTADO, nunca redefinido (Constitution, Artigo IV — No Invention). Os
 * contadores são leituras reais; nada é estimado.
 */
export interface JourneyModuleProgress {
  /** Reusa ModuleJourneyItem["status"] — "done" | "doing" | "planned". */
  status: ModuleStatus
  /** Sessões concluídas neste capítulo (mesmo predicado status='completed' que
   *  computeChapterCompletion aplica — plan-dashboard-data.ts o consome também). */
  sessionsDone: number
  /** Reflexões respondidas neste capítulo (slide_reflections do aluno). */
  reflectionsDone: number
  /** Fração [0,1] do trabalho do módulo já feito:
   *  min(1, (sessionsDone + reflectionsDone) / (interactionsExpected + reflectionsExpected)).
   *  `status === "done"` força 1. Denominador 0 → 0. */
  completedRatio: number
  /** true ⟺ status === "done". Módulo frozen NÃO consome janela futura. */
  frozen: boolean
}

/** Duração ancorada no capítulo — a VERDADE PERSISTIDA a partir do JRN-E.
 *  Substitui o array posicional puro (study-plans.ts), que desliza quando um
 *  capítulo é publicado/despublicado/reordenado. Janela de custo zero:
 *  study_plans tinha 0 linhas em produção quando o JRN-E foi escrito. */
export interface JourneyModuleDuration {
  chapterId: string
  days: number
}

/** Fotografia do progresso no instante da montagem — o "ponto de partida".
 *  Base do delta "combinado × realizado" (decisão D3 do Hugo, 2026-07-25):
 *  o que veio ANTES da jornada nunca é creditado como mérito dela. */
export interface JourneyBaseline {
  /** ISO datetime da 1ª confirmação da jornada. */
  capturedAt: string
  /** diagnostic.progressNow na montagem (study-plan-projection.ts:47). */
  progressPct: number
  /** diagnostic.sessionsDoneCount na montagem (study-plan-projection.ts:56-59). */
  sessionsDone: number
  /** diagnostic.reflDoneCount na montagem. */
  reflectionsDone: number
  /** Capítulos concluídos na montagem — o conjunto congelado, para o dashboard
   *  distinguir "veio de antes" de "fiz na jornada" mesmo com progresso esparso. */
  completedChapterIds: string[]
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

  // --- JRN-E, aditivo -------------------------------------------------------
  /** VERDADE PERSISTIDA (coluna study_plans.module_durations, forma nova).
   *  `moduleDurations` acima continua `number[]` DE PROPÓSITO: é a PROJEÇÃO
   *  derivada por alignDurationsToChapters contra os capítulos publicados HOJE,
   *  e é o que dashboard-model.ts, page.tsx e a API já consomem. */
  moduleDurationsByChapter: JourneyModuleDuration[]
  /** Âncora do replanejamento do que resta (ISO date). Persistida na coluna JÁ
   *  EXISTENTE study_plans.recalculated_at — zero coluna nova para isto.
   *  Jornadas gravadas antes do JRN-E (recalculated_at null) degradam para
   *  `startDate`, que era a única âncora que existia então. */
  planningAnchorDate: string
  /** null só em jornadas gravadas antes do JRN-E, ou quando a coluna `baseline`
   *  ainda não existe no banco (migration não aplicada — degradação graciosa). */
  baseline: JourneyBaseline | null
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
  /** JRN-E — sempre populado por fetchJourneyCourseContext. Obrigatório de
   *  propósito: um consumidor que ignore progresso não deve compilar. */
  progress: JourneyModuleProgress
}

export interface JourneyCourseContext {
  courseId: string
  courseTitle: string
  /** ISO date do início (T0) — a MATRÍCULA. NÃO é a âncora de planejamento do
   *  que resta: para isso existe `planningAnchorDate`. */
  startDate: string
  /** courses.deadline_days — teto duro "Disponível até" (demo: 126). */
  finalDeadlineDays: number
  /** courses.manager_deadline_days — "Meta do gestor" (demo: 105). null = sem meta. */
  managerDeadlineDays: number | null
  modules: JourneyModuleMeta[]

  // --- JRN-E, aditivo -------------------------------------------------------
  /** Teto duro de COORTE em data absoluta: startDate + finalDeadlineDays, pela
   *  MESMA aritmética de `cohortDeadlineDate` que a escrita usa. Imune ao
   *  momento do clique (D1, Hugo 2026-07-25). null sem deadline computável. */
  cohortDeadlineDate: string | null
  /** Meta do gestor em data absoluta: startDate + managerDeadlineDays.
   *  null quando managerDeadlineDays é null (o caso REAL nos dois tenants hoje). */
  cohortManagerDeadlineDate: string | null
  /** Âncora do planejamento do que RESTA (ISO date). Sempre HOJE — montar ou
   *  revisar replaneja a partir de agora, nunca do passado (D2). */
  planningAnchorDate: string
  /** Dias entre planningAnchorDate e cohortDeadlineDate, clampado em 0.
   *  0 ⟺ o teto de coorte já venceu (ou não há teto computável). */
  remainingWindowDays: number
}

// --- Server action I/O (contrato §5) ---------------------------------------

export interface SaveJourneyInput {
  enrollmentId: string
  moduleDurations: number[]
  preset: number | null
  preferences: JourneyPreferences
}

export type JourneyActionResult = { ok: true; plan: JourneyPlan } | { ok: false; error: string }
