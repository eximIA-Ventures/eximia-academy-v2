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

  it("tracks csv_exported with row_count", () => {
    analytics.csvExported(42)
    expect(posthog.capture).toHaveBeenCalledWith("csv_exported", { row_count: 42 })
  })

  it("tracks user_invited with role", () => {
    analytics.userInvited("student")
    expect(posthog.capture).toHaveBeenCalledWith("user_invited", { invited_role: "student" })
  })
})
