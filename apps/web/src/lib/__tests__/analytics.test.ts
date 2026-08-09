import { describe, expect, it, vi } from "vitest"

vi.mock("posthog-js", () => ({
  default: {
    capture: vi.fn(),
    __loaded: true,
  },
  __esModule: true,
}))

import posthog from "posthog-js"
import { analytics } from "../analytics"

describe("analytics (client-side)", () => {
  it("tracks logged_in with role and tenant", () => {
    analytics.loggedIn("student", "tenant-abc")
    expect(posthog.capture).toHaveBeenCalledWith("logged_in", {
      role: "student",
      tenant_id: "tenant-abc",
    })
  })

  it("tracks course_enrolled with course_id", () => {
    analytics.courseEnrolled("course-123")
    expect(posthog.capture).toHaveBeenCalledWith("course_enrolled", { course_id: "course-123" })
  })

  it("tracks session_started with session_id, course_id, chapter_id", () => {
    analytics.sessionStarted("session-1", "course-1", "chapter-1")
    expect(posthog.capture).toHaveBeenCalledWith("session_started", {
      session_id: "session-1",
      course_id: "course-1",
      chapter_id: "chapter-1",
    })
  })

  it("tracks session_completed with interactions and duration", () => {
    analytics.sessionCompleted("session-1", 5, 120000)
    expect(posthog.capture).toHaveBeenCalledWith("session_completed", {
      session_id: "session-1",
      interactions_count: 5,
      duration_ms: 120000,
    })
  })

  it("tracks feature_viewed with feature name", () => {
    analytics.featureViewed("biblioteca")
    expect(posthog.capture).toHaveBeenCalledWith("feature_viewed", { feature: "biblioteca" })
  })

  it("tracks quiz_submitted with score", () => {
    analytics.quizSubmitted("quiz-1", 8, 10)
    expect(posthog.capture).toHaveBeenCalledWith("quiz_submitted", {
      quiz_id: "quiz-1",
      score: 8,
      total_questions: 10,
    })
  })

  it("tracks csv_exported with row_count", () => {
    analytics.csvExported(42)
    expect(posthog.capture).toHaveBeenCalledWith("csv_exported", { row_count: 42 })
  })

  it("tracks user_invited with role", () => {
    analytics.userInvited("student")
    expect(posthog.capture).toHaveBeenCalledWith("user_invited", { invited_role: "student" })
  })

  it("tracks client_error with context", () => {
    analytics.clientError("TypeError", "dashboard-load")
    expect(posthog.capture).toHaveBeenCalledWith("client_error", {
      error: "TypeError",
      context: "dashboard-load",
    })
  })
})
