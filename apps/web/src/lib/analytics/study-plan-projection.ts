// ---------------------------------------------------------------------------
// study-plan-projection — pure calculation engine for "Meu plano de estudo"
// (SH-3.1, Hugo 2026-07-20)
// ---------------------------------------------------------------------------
// Ports the interactive projection logic from the validated mockup
// (JARVIS/apps/hub-discovery/meu-plano-tela-configuracao.html, function
// `compute()`) into a generic, testable module. The mockup used a single
// hardcoded student (Rinaldo); this module takes a real StudyPlanDiagnostic
// (built server-side from `computeStudentComparison`/`buildStudentHomeIndicators`
// — see meu-plano/page.tsx) and a `StudyPlanChoice` (the student's live picks),
// and returns the SAME shape of projection the mockup rendered live.
//
// SCOPE BOUNDARY (SH-3.1): this module is PURE — it never fetches, persists,
// or calls any API. The "confirmar meu plano" action in the UI is local
// React state only; wiring a real weekly-plan persistence is explicitly a
// FUTURE story (see SH-3.1 story, Dev Notes §Fronteira de escopo).
// ---------------------------------------------------------------------------

/**
 * ILLUSTRATIVE constant, carried over VERBATIM from the mockup (same value,
 * same warning). It converts a progress-percentage-point gap into "sessions
 * needed" — a placeholder until the product defines the real gap→sessions
 * formula. NEVER treat this as the final algorithm; it only exists so the
 * projection has *something* concrete to show the student while the real
 * formula is still undefined product-side.
 */
export const PT_PER_SESSION = 1.5

/** Default weekly pattern the screen opens with (mirrors the mockup: Seg/Qua/Sex). */
export const DEFAULT_STUDY_PLAN_CHOICE: StudyPlanChoice = {
  days: [true, false, true, false, true, false, false],
  sessionsPerDay: 2,
  reflFocus: true,
}

export const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const

/**
 * Real diagnostic pulled from the student's own "Meu ritmo" data
 * (`StudentHomeSubject`, SH-2.7's `expectedProgressPct`). All fields are
 * `null` when the underlying real data is unavailable (no deadline, no trail
 * denominator, etc.) — the projection degrades gracefully field-by-field,
 * it never fabricates a number that isn't backed by real data.
 */
export interface StudyPlanDiagnostic {
  /** `subject.progressPct` — real, always present when indicators exist. */
  progressNow: number
  /**
   * `subject.expectedProgressPct` (SH-2.7 own-pace signal, elapsedDays/deadlineDays
   * of the student's leading enrollment). Reused as-is for BOTH the progress and
   * reflection "esperado" axis — the same uniform treatment SH-2.7 already gives
   * these two fractional metrics. `null` when no deadline is computable.
   */
  progressTarget: number | null
  /** Reflections done so far (`subject.reflections`), always a real count. */
  reflDoneCount: number
  /** Reflection universe (`subject.reflectionsMax`); `null` when not computable. */
  reflTotal: number | null
  /** `reflDoneCount / reflTotal * 100`, or `null` when `reflTotal` is unavailable. */
  reflNow: number | null
  /** Same value as `progressTarget` — see field doc above. */
  reflTarget: number | null
  /** Days left until the leading enrollment's deadline; `null` when not computable. */
  daysLeft: number | null
  /** `daysLeft / 7`, at least 1 when `daysLeft` is known; `null` otherwise. */
  weeksLeft: number | null
}

/** The student's live picks in the "Montar meu plano" screen. */
export interface StudyPlanChoice {
  /** 7 booleans, Monday-first (index 0 = Segunda), mirrors `WEEKDAY_LABELS`. */
  days: boolean[]
  /** Sessions of content per chosen study day (stepper, 1-5). */
  sessionsPerDay: number
  /** Whether each chosen study day also carries 1 reflection. */
  reflFocus: boolean
}

/** Live projection produced by a given diagnostic + choice pair. */
export interface StudyPlanProjection {
  chosenDays: number
  sessionsPerWeek: number
  reflPerWeek: number
  /** Projected progress % by the deadline, capped at 100; `null` when `weeksLeft` is unknown. */
  progressProj: number | null
  /** Projected reflection % by the deadline; `null` when `weeksLeft` or `reflTotal` is unknown. */
  reflProj: number | null
  /** `progressProj >= progressTarget`; `null` when either side is unknown (unknown, not failing). */
  progressOk: boolean | null
  /** `reflProj >= reflTarget`; `null` when either side is unknown. */
  reflOk: boolean | null
  /** Weeks needed, at this pace, to close the progress gap; `Infinity` if the pace is zero. */
  weeksToProgress: number
  /** Weeks needed, at this pace, to close the reflection gap; `Infinity` if the pace is zero. */
  weeksToRefl: number
  /** `max(weeksToProgress, weeksToRefl)`. */
  weeksToClose: number
  /**
   * Overall verdict for the projection panel. "unknown" replaces the mockup's
   * "bad" state when there isn't enough real data (missing deadline/denominator)
   * to judge sufficiency at all — SH-3.1's graceful-degradation requirement.
   */
  verdict: "empty" | "ok" | "warn-progress" | "warn-refl" | "bad" | "unknown"
}

/** Sessions still needed to close the progress gap, given the illustrative constant. */
function sessionsNeededForProgressGap(diagnostic: StudyPlanDiagnostic): number | null {
  if (diagnostic.progressTarget == null) return null
  const gapPts = Math.max(0, diagnostic.progressTarget - diagnostic.progressNow)
  return Math.ceil(gapPts / PT_PER_SESSION)
}

/** Reflections still needed to close the reflection gap (mirrors the mockup's `reflNeeded`). */
function reflectionsNeededForGap(diagnostic: StudyPlanDiagnostic): number | null {
  if (diagnostic.reflTarget == null || diagnostic.reflTotal == null) return null
  const targetCount = Math.round((diagnostic.reflTarget / 100) * diagnostic.reflTotal)
  return Math.max(0, targetCount - diagnostic.reflDoneCount)
}

/**
 * Recomputes the whole live projection from a diagnostic + choice pair. Pure,
 * deterministic, side-effect-free — safe to call on every keystroke/click.
 */
export function computeStudyPlanProjection(
  diagnostic: StudyPlanDiagnostic,
  choice: StudyPlanChoice,
): StudyPlanProjection {
  const chosenDays = choice.days.filter(Boolean).length
  const sessionsPerWeek = chosenDays * choice.sessionsPerDay
  const reflPerWeek = choice.reflFocus ? chosenDays : 0

  const weeksLeft = diagnostic.weeksLeft
  const sessionsNeeded = sessionsNeededForProgressGap(diagnostic)
  const reflNeeded = reflectionsNeededForGap(diagnostic)

  let progressProj: number | null = null
  if (weeksLeft != null) {
    const totalSessions = sessionsPerWeek * weeksLeft
    const gain = Math.min(totalSessions * PT_PER_SESSION, 100 - diagnostic.progressNow)
    progressProj = Math.min(100, Math.round(diagnostic.progressNow + gain))
  }

  let reflProj: number | null = null
  if (weeksLeft != null && diagnostic.reflTotal != null && diagnostic.reflNow != null) {
    const totalRefl = reflPerWeek * weeksLeft
    const newPossible = Math.min(totalRefl, diagnostic.reflTotal - diagnostic.reflDoneCount)
    const doneProj = diagnostic.reflDoneCount + newPossible
    reflProj = Math.min(100, Number(((doneProj / diagnostic.reflTotal) * 100).toFixed(1)))
  }

  const progressOk =
    progressProj == null || diagnostic.progressTarget == null
      ? null
      : progressProj >= diagnostic.progressTarget
  const reflOk =
    reflProj == null || diagnostic.reflTarget == null ? null : reflProj >= diagnostic.reflTarget

  const weeksToProgress =
    sessionsNeeded == null
      ? Number.POSITIVE_INFINITY
      : sessionsPerWeek > 0
        ? Math.ceil(sessionsNeeded / sessionsPerWeek)
        : Number.POSITIVE_INFINITY
  const weeksToRefl =
    reflNeeded == null
      ? Number.POSITIVE_INFINITY
      : reflPerWeek > 0
        ? Math.ceil(reflNeeded / reflPerWeek)
        : Number.POSITIVE_INFINITY
  const weeksToClose = Math.max(weeksToProgress, weeksToRefl)

  let verdict: StudyPlanProjection["verdict"]
  if (chosenDays === 0) {
    verdict = "empty"
  } else if (progressOk == null && reflOk == null) {
    verdict = "unknown"
  } else if (progressOk !== false && reflOk !== false) {
    verdict = "ok"
  } else if (reflOk === false && progressOk !== false) {
    verdict = "warn-refl"
  } else if (progressOk === false && reflOk !== false) {
    verdict = "warn-progress"
  } else {
    verdict = "bad"
  }

  return {
    chosenDays,
    sessionsPerWeek,
    reflPerWeek,
    progressProj,
    reflProj,
    progressOk,
    reflOk,
    weeksToProgress,
    weeksToRefl,
    weeksToClose,
    verdict,
  }
}
