import { describe, expect, it, vi } from "vitest"

const captureMock = vi.fn()
vi.mock("posthog-node", () => ({
  PostHog: vi.fn().mockImplementation(() => ({
    capture: captureMock,
  })),
}))

// Set env var before importing the module
vi.stubEnv("POSTHOG_API_KEY", "test-key")

import { analyticsServer } from "../analytics-server"

describe("analyticsServer (server-side)", () => {
  it("tracks question_generated with chapter_id and question_count", () => {
    analyticsServer.questionGenerated("user-1", "chapter-1", 3)
    expect(captureMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: "question_generated",
      properties: { chapter_id: "chapter-1", question_count: 3 },
    })
  })

  it("tracks pipeline_completed with token usage and cost", () => {
    analyticsServer.pipelineCompleted("user-1", {
      total_input_tokens: 500,
      total_output_tokens: 200,
      model: "claude-sonnet-4-5-20250929",
      retry_count: 1,
      estimated_cost_usd: 0.0045,
    })
    expect(captureMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: "pipeline_completed",
      properties: {
        total_input_tokens: 500,
        total_output_tokens: 200,
        model: "claude-sonnet-4-5-20250929",
        retry_count: 1,
        estimated_cost_usd: 0.0045,
      },
    })
  })

  it("does NOT include PII in event properties", () => {
    analyticsServer.questionGenerated("user-1", "ch1", 3)
    analyticsServer.pipelineCompleted("user-1", {
      total_input_tokens: 100,
      total_output_tokens: 50,
      model: "test",
      retry_count: 0,
      estimated_cost_usd: 0.001,
    })

    for (const call of captureMock.mock.calls) {
      const payload = call[0] as Record<string, unknown>
      const props = payload.properties as Record<string, unknown>
      expect(props).not.toHaveProperty("email")
      expect(props).not.toHaveProperty("name")
    }
  })
})
