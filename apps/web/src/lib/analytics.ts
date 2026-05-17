import posthog from "posthog-js"

function safeCapture(event: string, props?: Record<string, unknown>) {
  if (typeof window !== "undefined" && posthog.__loaded) {
    posthog.capture(event, props)
  }
}

export const analytics = {
  // Auth
  loggedIn: (role: string, tenantId: string) =>
    safeCapture("logged_in", { role, tenant_id: tenantId }),

  loggedOut: () => safeCapture("logged_out"),

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

  // Video engagement
  videoStarted: (chapterId: string, videoUrl: string) =>
    safeCapture("video_started", { chapter_id: chapterId, video_url: videoUrl }),

  videoCompleted: (chapterId: string, durationMs: number) =>
    safeCapture("video_completed", { chapter_id: chapterId, duration_ms: durationMs }),

  // Feature usage (adoption tracking)
  featureViewed: (feature: string) => safeCapture("feature_viewed", { feature }),

  // Quiz
  quizStarted: (quizId: string, courseId: string) =>
    safeCapture("quiz_started", { quiz_id: quizId, course_id: courseId }),

  quizSubmitted: (quizId: string, score: number, totalQuestions: number) =>
    safeCapture("quiz_submitted", { quiz_id: quizId, score, total_questions: totalQuestions }),

  // Assessment lifecycle
  assessmentStarted: (type: string) => safeCapture("assessment_started", { assessment_type: type }),

  assessmentCompleted: (type: string) => safeCapture("assessment_completed", { assessment_type: type }),

  // Library
  bookOpened: (bookId: string, title: string) =>
    safeCapture("book_opened", { book_id: bookId, title }),

  // Trails
  trailStarted: (trailId: string) => safeCapture("trail_started", { trail_id: trailId }),

  trailCompleted: (trailId: string) => safeCapture("trail_completed", { trail_id: trailId }),

  // Admin actions
  csvExported: (rowCount: number) => safeCapture("csv_exported", { row_count: rowCount }),
  userInvited: (role: string) => safeCapture("user_invited", { invited_role: role }),
  notificationSent: (recipientCount: number) =>
    safeCapture("notification_sent", { recipient_count: recipientCount }),

  // Errors
  clientError: (error: string, context: string) =>
    safeCapture("client_error", { error, context }),
}
