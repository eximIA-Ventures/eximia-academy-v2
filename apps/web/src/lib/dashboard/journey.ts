import type { WeekDayCell, WeeklyPlan } from "@/components/dashboard/types"

/** All journey/week computations use the platform timezone. */
const TIMEZONE = "America/Sao_Paulo"

export const BAND_LABELS = ["Iniciando", "Em movimento", "No ritmo", "Adiantado", "Concluído"]

/** Lower bound (inclusive) of each band, in progress percentage points. */
const BAND_THRESHOLDS = [0, 10, 40, 70, 100]

export const WEEK_DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]

/** Normalizes the enrollments.progress column (number or { percentage }) to 0-100. */
export function progressToPct(raw: unknown): number {
  if (typeof raw === "number") return Math.max(0, Math.min(100, raw))
  if (typeof raw === "object" && raw !== null && "percentage" in raw) {
    const pct = (raw as { percentage: unknown }).percentage
    if (typeof pct === "number") return Math.max(0, Math.min(100, pct))
  }
  return 0
}

/** Band index (0-4) for a progress percentage. */
export function bandIndexForProgress(pct: number): number {
  if (pct >= 100) return 4
  if (pct >= 70) return 3
  if (pct >= 40) return 2
  if (pct >= 10) return 1
  return 0
}

/** Percentage points missing to reach the next band, null when at the last band. */
export function pctToNextBand(pct: number): number | null {
  const band = bandIndexForProgress(pct)
  if (band >= BAND_THRESHOLDS.length - 1) return null
  return Math.max(1, Math.ceil(BAND_THRESHOLDS[band + 1] - pct))
}

/** YYYY-MM-DD key of a date in the platform timezone. */
export function dayKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: TIMEZONE })
}

/** Weekday index in the platform timezone, 0 = Monday .. 6 = Sunday. */
export function weekdayIndex(date: Date): number {
  const short = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, weekday: "short" }).format(
    date,
  )
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
  return map[short] ?? 0
}

/** Day keys (YYYY-MM-DD) of the current week, Monday to Sunday, in the platform timezone. */
export function currentWeekDayKeys(now: Date): string[] {
  const todayIdx = weekdayIndex(now)
  const keys: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getTime() + (i - todayIdx) * 86400000)
    keys.push(dayKey(d))
  }
  return keys
}

/**
 * Consecutive days with at least one session, counting back from today
 * (or from yesterday when today has no activity yet).
 */
export function computeStreakDays(sessionCreatedAts: string[], now: Date): number {
  const activeDays = new Set(sessionCreatedAts.map((iso) => dayKey(new Date(iso))))
  let cursor = new Date(now)
  if (!activeDays.has(dayKey(cursor))) {
    cursor = new Date(cursor.getTime() - 86400000)
    if (!activeDays.has(dayKey(cursor))) return 0
  }
  let streak = 0
  while (activeDays.has(dayKey(cursor))) {
    streak++
    cursor = new Date(cursor.getTime() - 86400000)
  }
  return streak
}

interface WeekCellsInput {
  plan: WeeklyPlan
  /** Sessions of the current week: created_at ISO + chapter title when known */
  weekSessions: Array<{ createdAt: string; chapterTitle: string | null }>
  /** Title of the next chapter to continue, when known */
  nextChapterTitle: string | null
  now: Date
}

/** Builds the 7 Seg-Dom cells of the weekly plan grid from real session activity. */
export function computeWeekCells({
  plan,
  weekSessions,
  nextChapterTitle,
  now,
}: WeekCellsInput): WeekDayCell[] {
  const todayIdx = weekdayIndex(now)
  const weekKeys = currentWeekDayKeys(now)

  // Last session title per weekday of the current week
  const doneByDay = new Map<number, string | null>()
  for (const session of weekSessions) {
    const key = dayKey(new Date(session.createdAt))
    const idx = weekKeys.indexOf(key)
    if (idx >= 0) doneByDay.set(idx, session.chapterTitle ?? doneByDay.get(idx) ?? null)
  }

  return WEEK_DAY_LABELS.map((dow, index) => {
    const planned = plan.days.includes(index)
    const doneTitle = doneByDay.get(index)

    if (doneByDay.has(index)) {
      return { dow, state: "done" as const, task: doneTitle ?? "Sessão realizada" }
    }
    if (index === todayIdx && planned) {
      return { dow, state: "today" as const, task: nextChapterTitle ?? "Sessão da trilha" }
    }
    if (planned && index > todayIdx) {
      return { dow, state: "scheduled" as const, task: "Sessão planejada" }
    }
    if (planned && index < todayIdx) {
      return { dow, state: "missed" as const, task: "Em aberto" }
    }
    return { dow, state: "rest" as const, task: "Descanso" }
  })
}

/** Relative label in pt-BR for recent activity timestamps. */
export function relativeDayLabel(iso: string, now: Date): string {
  const target = dayKey(new Date(iso))
  const today = dayKey(now)
  const yesterday = dayKey(new Date(now.getTime() - 86400000))
  if (target === today) return "hoje"
  if (target === yesterday) return "ontem"
  const diffDays = Math.round(
    (new Date(`${today}T00:00:00Z`).getTime() - new Date(`${target}T00:00:00Z`).getTime()) /
      86400000,
  )
  return `há ${diffDays} dias`
}

/** Safe parse of the weekly plan stored in users.profile.weekly_plan. */
export function parseWeeklyPlan(raw: unknown): WeeklyPlan | null {
  if (typeof raw !== "object" || raw === null) return null
  const plan = raw as Record<string, unknown>
  const goal = plan.goal
  const days = plan.days
  const reminder = plan.reminder as Record<string, unknown> | undefined
  if (typeof goal !== "number" || goal < 1 || goal > 7) return null
  if (!Array.isArray(days) || days.some((d) => typeof d !== "number" || d < 0 || d > 6)) return null
  return {
    goal: Math.trunc(goal),
    days: days.map((d) => Math.trunc(d as number)),
    reminder: {
      enabled: Boolean(reminder?.enabled),
      time: typeof reminder?.time === "string" ? reminder.time : "08h",
    },
  }
}
