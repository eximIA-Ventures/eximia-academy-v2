import posthog from "posthog-js"

function safeCapture(event: string, props: Record<string, unknown>) {
  if (typeof window !== "undefined" && posthog.__loaded) {
    posthog.capture(event, props)
  }
}

export const analytics = {
  courseEnrolled: (courseId: string) => safeCapture("course_enrolled", { course_id: courseId }),

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

  csvExported: (rowCount: number) => safeCapture("csv_exported", { row_count: rowCount }),

  userInvited: (role: string) => safeCapture("user_invited", { invited_role: role }),
}
