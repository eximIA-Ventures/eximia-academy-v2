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
