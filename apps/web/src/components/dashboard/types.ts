/** Shared type definitions for dashboard components (FIX-06) */

export interface ManagerCourseAnalytics {
  summary: {
    totalCourses: number
    totalStudents: number
    sessionsThisWeek: number
  }
  courses: Array<{
    courseId: string
    title: string
    studentCount: number
    completionRate: number
    sessionCount: number
    status: string
  }>
  studentMetrics?: StudentMetric[]
}

export interface ManagerAnalytics {
  summary: {
    activeStudents: number
    engagementRate: number
    completionRate: number
    sessionsThisMonth: number
  }
  engagementChart: Array<{ week: string; sessions: number }>
  courseTable: CourseTableRow[]
}

export interface StudentMetric {
  studentId: string
  name: string
  progress: number
  sessionCount: number
  lastActivity: string
  aiDetectionFlags: Array<{ verdict: string; confidence: string }>
}

export interface CourseTableRow {
  courseId: string
  title: string
  studentCount: number
  completionRate: number
  avgReflectionDepth: number
  avgAiDetection: number
}

/* === Minha Jornada (design v6.1) === */

/** Weekly plan chosen by the student, persisted in users.profile.weekly_plan */
export interface WeeklyPlan {
  /** Sessions goal for the week (1-7) */
  goal: number
  /** Available days, 0 = Monday .. 6 = Sunday */
  days: number[]
  reminder: {
    enabled: boolean
    /** Preferred hour label, e.g. "08h" */
    time: string
  }
}

export type WeekDayState = "done" | "today" | "scheduled" | "rest" | "missed"

export interface WeekDayCell {
  /** Short label: Seg, Ter, ... */
  dow: string
  state: WeekDayState
  /** Task label shown under the ring (real chapter title when available) */
  task: string
}

export interface JourneyBandDistribution {
  label: string
  pct: number
  isYou: boolean
}

export interface JourneyPosition {
  /** 0 = Iniciando .. 4 = Concluido */
  bandIndex: number
  bandLabel: string
  progressPct: number
  /** Percentage points missing to reach the next band, null when at the last band */
  pctToNextBand: number | null
  nextBandLabel: string | null
  /** Class distribution by band (aggregated, never individual), null when unavailable */
  distribution: JourneyBandDistribution[] | null
}

export interface NextStepInfo {
  chapterTitle: string
  courseTitle: string
  courseId: string
  chapterId: string
}
