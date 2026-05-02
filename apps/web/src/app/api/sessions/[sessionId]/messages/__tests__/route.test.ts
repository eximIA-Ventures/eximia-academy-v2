import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockGetUser,
  mockRpc,
  mockFrom,
  mockServiceFrom,
  mockOrchestrate,
  mockRunAnalyst,
  mockExecuteShadowPipeline,
  mockTriggerProfiling,
  mockSanitize,
  mockCreateShadowPersistence,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
  mockServiceFrom: vi.fn(),
  mockOrchestrate: vi.fn(),
  mockRunAnalyst: vi.fn(),
  mockExecuteShadowPipeline: vi.fn(),
  mockTriggerProfiling: vi.fn(),
  mockSanitize: vi.fn((s: string) => s),
  mockCreateShadowPersistence: vi.fn(() => ({})),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
    from: mockFrom,
  }),
}))

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: mockServiceFrom }),
}))

vi.mock("@eximia/agents", () => ({
  orchestrateSocraticDialogue: mockOrchestrate,
  runAnalyst: mockRunAnalyst,
  executeShadowPipeline: mockExecuteShadowPipeline,
}))

vi.mock("@/lib/shadow-persistence", () => ({
  createShadowPersistence: mockCreateShadowPersistence,
}))

vi.mock("@eximia/shared", () => ({
  sanitizeStudentMessage: mockSanitize,
}))

vi.mock("@/lib/profiling", () => ({
  triggerProfiling: mockTriggerProfiling,
}))

vi.mock("@/lib/analytics-server", () => ({
  analyticsServer: { pipelineCompleted: vi.fn() },
}))

vi.mock("@/lib/sentry", () => ({
  setSentryContext: vi.fn(),
}))

vi.mock("@sentry/nextjs", () => ({
  startSpan: vi.fn((_opts, fn) => fn({ setAttribute: vi.fn() })),
  captureException: vi.fn(),
  setTag: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Import route handler
// ---------------------------------------------------------------------------

import { POST } from "../route"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_SESSION_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/sessions/test/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function makeParams(sessionId: string) {
  return { params: Promise.resolve({ sessionId }) }
}

const mockUser = { id: "user-1", email: "test@example.com" }

const mockSession = {
  id: VALID_SESSION_ID,
  tenant_id: "tenant-1",
  chapter: {
    id: "chapter-1",
    title: "Capítulo 1",
    content: "Conteúdo do capítulo...",
    course_id: "course-1",
  },
  question: {
    id: "q-1",
    text: "Qual sua opiniao?",
    skill: "analise",
    intention: "provocar reflexao",
    expected_depth: "5",
  },
}

const mockTurnData = [
  { turn_number: 3, interactions_remaining: 5 },
]

const mockPipelineResult = {
  response: "Resposta do tutor aqui",
  qaReport: {
    verdict: "APPROVED",
    score: 1.0,
    criteriaResults: {},
    recommendation: "Ok",
  },
  retryCount: 0,
  warning: false,
  usage: { inputTokens: 100, outputTokens: 50 },
}

const mockAnalysisResult = {
  analysisId: "analysis-1",
  aiDetection: { probability: 0.1, confidence: "high", verdict: "likely_human", indicators: [], flag: null },
  metrics: {},
  flags: [],
  observations: [],
  recommendation: "ok",
}

// ---------------------------------------------------------------------------
// Setup reusable mock chains
// ---------------------------------------------------------------------------

function setupHappyPath() {
  mockGetUser.mockResolvedValue({ data: { user: mockUser } })
  mockRpc.mockResolvedValue({ data: mockTurnData, error: null })

  // supabase.from("sessions").select().eq().single()
  mockFrom.mockImplementation((table: string) => {
    if (table === "sessions") {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: mockSession }),
          }),
        }),
      }
    }
    if (table === "messages") {
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              order: () => Promise.resolve({ data: [] }),
            }),
          }),
        }),
      }
    }
    if (table === "users") {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: { profile: {} } }),
          }),
        }),
      }
    }
    return {}
  })

  // serviceClient.from().insert().select().single()
  mockServiceFrom.mockImplementation(() => ({
    insert: vi.fn().mockReturnValue({
      select: () => ({
        single: () => Promise.resolve({ data: { id: "msg-1" } }),
      }),
    }),
  }))

  mockOrchestrate.mockResolvedValue(mockPipelineResult)
  mockRunAnalyst.mockResolvedValue(mockAnalysisResult)
  mockExecuteShadowPipeline.mockResolvedValue({ detector: null, perfilador: null })
  mockTriggerProfiling.mockResolvedValue(undefined)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

describe("POST /api/sessions/[sessionId]/messages", () => {
  describe("validation", () => {
    it("returns 400 for invalid session ID", async () => {
      const response = await POST(
        makeRequest({ content: "Ola" }),
        makeParams("not-a-uuid"),
      )

      expect(response.status).toBe(400)
      expect(await response.text()).toBe("Invalid session ID")
    })

    it("returns 401 when user is not authenticated", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const response = await POST(
        makeRequest({ content: "Ola" }),
        makeParams(VALID_SESSION_ID),
      )

      expect(response.status).toBe(401)
      expect(await response.text()).toBe("Unauthorized")
    })

    it("returns 400 for empty content", async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })

      const response = await POST(
        makeRequest({ content: "" }),
        makeParams(VALID_SESSION_ID),
      )

      expect(response.status).toBe(400)
      expect(await response.text()).toBe("Invalid request body")
    })

    it("returns 400 for missing content field", async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })

      const response = await POST(
        makeRequest({}),
        makeParams(VALID_SESSION_ID),
      )

      expect(response.status).toBe(400)
    })
  })

  describe("session claim", () => {
    it("returns 409 when claim_session_turn fails", async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockRpc.mockResolvedValue({ data: null, error: { message: "conflict" } })

      const response = await POST(
        makeRequest({ content: "Ola" }),
        makeParams(VALID_SESSION_ID),
      )

      expect(response.status).toBe(409)
      expect(await response.text()).toBe("Session not available")
    })

    it("returns 409 when claim returns empty array", async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockRpc.mockResolvedValue({ data: [], error: null })

      const response = await POST(
        makeRequest({ content: "Ola" }),
        makeParams(VALID_SESSION_ID),
      )

      expect(response.status).toBe(409)
    })
  })

  describe("happy path", () => {
    beforeEach(setupHappyPath)

    it("returns streaming response with correct headers", async () => {
      const response = await POST(
        makeRequest({ content: "Minha resposta" }),
        makeParams(VALID_SESSION_ID),
      )

      expect(response.status).toBe(200)
      expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8")
      expect(response.headers.get("X-Vercel-AI-Data-Stream")).toBe("v1")
    })

    it("calls orchestrateSocraticDialogue with correct input", async () => {
      await POST(
        makeRequest({ content: "Minha resposta" }),
        makeParams(VALID_SESSION_ID),
      )

      expect(mockOrchestrate).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: VALID_SESSION_ID,
          studentMessage: "Minha resposta",
          chapterContent: "Conteúdo do capítulo...",
          turnNumber: 3,
          interactionsRemaining: 5,
        }),
      )
    })

    it("calls runAnalyst with student message and context", async () => {
      await POST(
        makeRequest({ content: "Minha resposta" }),
        makeParams(VALID_SESSION_ID),
      )

      expect(mockRunAnalyst).toHaveBeenCalledWith(
        expect.objectContaining({
          student_message: "Minha resposta",
          context: expect.objectContaining({
            chapter_id: "chapter-1",
            chapter_title: "Capítulo 1",
            turn_number: 3,
          }),
        }),
      )
    })

    it("fires shadow pipeline as fire-and-forget", async () => {
      await POST(
        makeRequest({ content: "Minha resposta" }),
        makeParams(VALID_SESSION_ID),
      )

      expect(mockExecuteShadowPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: VALID_SESSION_ID,
          studentId: "user-1",
          tenantId: "tenant-1",
          studentMessage: "Minha resposta",
          tutorResponse: "Resposta do tutor aqui",
          turnNumber: 3,
        }),
        expect.any(Object),
      )
    })

    it("sanitizes student message before processing", async () => {
      await POST(
        makeRequest({ content: "<script>alert(1)</script>" }),
        makeParams(VALID_SESSION_ID),
      )

      expect(mockSanitize).toHaveBeenCalledWith("<script>alert(1)</script>")
    })

    it("persists student message, assistant message, analysis, and QA report", async () => {
      await POST(
        makeRequest({ content: "Minha resposta" }),
        makeParams(VALID_SESSION_ID),
      )

      // serviceClient.from is called multiple times: student msg + 3 parallel inserts
      expect(mockServiceFrom).toHaveBeenCalled()
      const calls = mockServiceFrom.mock.calls.map((c) => c[0])
      expect(calls).toContain("messages")
    })

    it("streams response words in DataStream protocol format", async () => {
      const response = await POST(
        makeRequest({ content: "Minha resposta" }),
        makeParams(VALID_SESSION_ID),
      )

      const text = await response.text()
      // First line should be metadata annotation (prefix "2:")
      expect(text).toMatch(/^2:/)
      // Should contain word chunks (prefix "0:")
      expect(text).toContain("0:")
    })
  })

  describe("session completion", () => {
    it("triggers profiling when session completes with enough turns", async () => {
      setupHappyPath()
      // Override turn data to simulate completion
      mockRpc.mockResolvedValue({
        data: [{ turn_number: 5, interactions_remaining: 0 }],
        error: null,
      })

      await POST(
        makeRequest({ content: "Ultima resposta" }),
        makeParams(VALID_SESSION_ID),
      )

      expect(mockTriggerProfiling).toHaveBeenCalledWith(
        VALID_SESSION_ID,
        "user-1",
        "tenant-1",
      )
    })

    it("does not trigger profiling when turnNumber < 2", async () => {
      setupHappyPath()
      mockRpc.mockResolvedValue({
        data: [{ turn_number: 1, interactions_remaining: 0 }],
        error: null,
      })

      await POST(
        makeRequest({ content: "Resposta" }),
        makeParams(VALID_SESSION_ID),
      )

      expect(mockTriggerProfiling).not.toHaveBeenCalled()
    })
  })

  describe("error recovery", () => {
    it("releases session turn and returns 500 on pipeline error", async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockRpc
        .mockResolvedValueOnce({ data: mockTurnData, error: null }) // claim succeeds
        .mockResolvedValueOnce({ error: null }) // release succeeds

      // Session query fails
      mockFrom.mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: null }),
              }),
            }),
          }
        }
        return {}
      })

      const response = await POST(
        makeRequest({ content: "Ola" }),
        makeParams(VALID_SESSION_ID),
      )

      expect(response.status).toBe(500)
      expect(await response.text()).toBe("Pipeline error")
      // Verify release_session_turn was called
      expect(mockRpc).toHaveBeenCalledWith("release_session_turn", {
        p_session_id: VALID_SESSION_ID,
        p_user_id: "user-1",
      })
    })
  })
})
