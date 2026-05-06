import posthog from "posthog-js"

function safeCapture(event: string, props: Record<string, unknown>) {
  if (typeof window !== "undefined" && posthog.__loaded) {
    posthog.capture(event, props)
  }
}

export const analytics = {
  // Course lifecycle
  courseEnrolled: (courseId: string) => safeCapture("course_enrolled", { course_id: courseId }),

  courseCompleted: (courseId: string, durationDays: number) =>
    safeCapture("course_completed", { course_id: courseId, duration_days: durationDays }),

  courseRestarted: (courseId: string) => safeCapture("course_restarted", { course_id: courseId }),

  // Chapter engagement
  chapterViewed: (courseId: string, chapterId: string, chapterOrder: number) =>
    safeCapture("chapter_viewed", {
      course_id: courseId,
      chapter_id: chapterId,
      chapter_order: chapterOrder,
    }),

  chapterCompleted: (courseId: string, chapterId: string) =>
    safeCapture("chapter_completed", { course_id: courseId, chapter_id: chapterId }),

  // AI session
  sessionStarted: (sessionId: string, courseId: string, chapterId: string) =>
    safeCapture("session_started", {
      session_id: sessionId,
      course_id: courseId,
      chapter_id: chapterId,
    }),

  sessionCompleted: (sessionId: string, interactionsCount: number, durationMs: number) =>
    safeCapture("session_completed", {
      session_id: sessionId,
      interactions_count: interactionsCount,
      duration_ms: durationMs,
    }),

  // Admin actions
  csvExported: (rowCount: number) => safeCapture("csv_exported", { row_count: rowCount }),
  userInvited: (role: string) => safeCapture("user_invited", { invited_role: role }),
  notificationSent: (recipientCount: number) =>
    safeCapture("notification_sent", { recipient_count: recipientCount }),

  // Assessment
  assessmentCompleted: (type: string) => safeCapture("assessment_completed", { assessment_type: type }),
}
