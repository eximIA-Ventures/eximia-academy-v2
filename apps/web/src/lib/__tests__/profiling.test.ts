import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Mocks ──────────────────────────────────────────────────────────

const mockFrom = vi.fn()
const mockRpc = vi.fn()
const mockServiceClient = { from: mockFrom, rpc: mockRpc }

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => mockServiceClient,
}))

vi.mock("@eximia/agents", () => ({
  runProfiler: vi.fn(),
}))

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}))

import { runProfiler } from "@eximia/agents"
import { triggerProfiling } from "../profiling"

const mockRunProfiler = vi.mocked(runProfiler)

// ── Helpers ────────────────────────────────────────────────────────

function makeChainMock(data: unknown, extra?: { count?: number }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.neq = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue({ data })

  // For count queries that don't call .single()
  if (extra?.count !== undefined) {
    chain.eq = vi.fn().mockReturnValue(chain)
    chain.neq = vi.fn().mockResolvedValue({ count: extra.count })
  }

  // Make the chain thenable for non-single queries
  chain.then = vi.fn((resolve: (v: unknown) => void) => resolve({ data }))

  return chain
}

const sampleMessages = [
  { role: "user", content: "Resposta 1", turn_number: 1 },
  { role: "assistant", content: "Pergunta 1", turn_number: 1 },
  { role: "user", content: "Resposta 2", turn_number: 2 },
  { role: "assistant", content: "Pergunta 2", turn_number: 2 },
]

const sampleQuestion = {
  text: "O que é sustentabilidade?",
  skill: "analise",
  intention: "Avaliar análise crítica",
  expected_depth: "intermediario",
}

const sampleSession = {
  id: "session-1",
  question: sampleQuestion,
  tenant_id: "tenant-1",
}

const sampleProfilerOutput = {
  preferred_question_types: ["clarificacao", "aplicacao"],
  engagement_style: "reflective",
  detail_orientation: "balanced",
  reasoning_style: "analytical",
  avg_depth_achieved: 3.5,
  comprehension_trend: "stable",
  avg_qa_score: 0.88,
  strengths: ["raciocínio lógico"],
  growth_areas: ["exemplos concretos"],
  adaptation_hints: ["Use analogias estruturadas"],
  summary: "Aluno reflexivo com boa capacidade analítica.",
  confidence: 0.7,
}

// ── Tests ──────────────────────────────────────────────────────────

describe("triggerProfiling", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRunProfiler.mockResolvedValue(sampleProfilerOutput as never)
    mockRpc.mockResolvedValue({ error: null })
  })

  function setupFromMock(options?: {
    messages?: unknown[] | null
    session?: unknown | null
    qaReports?: unknown[] | null
    userProfile?: unknown | null
    sessionCount?: number
  }) {
    const opts = {
      messages: "messages" in (options ?? {}) ? options!.messages : sampleMessages,
      session: "session" in (options ?? {}) ? options!.session : sampleSession,
      qaReports:
        "qaReports" in (options ?? {})
          ? options!.qaReports
          : [
              { score: 0.85, verdict: "APPROVED" },
              { score: 0.92, verdict: "APPROVED" },
            ],
      userProfile: "userProfile" in (options ?? {}) ? options!.userProfile : { profile: {} },
      sessionCount: options?.sessionCount ?? 3,
    }

    let callIdx = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === "messages") {
        const chain: Record<string, unknown> = {}
        chain.select = vi.fn().mockReturnValue(chain)
        chain.eq = vi.fn().mockReturnValue(chain)
        chain.order = vi.fn().mockImplementation(() => {
          // Second .order() call resolves
          return {
            ...chain,
            order: vi.fn().mockResolvedValue({ data: opts.messages }),
          }
        })
        return chain
      }
      if (table === "sessions") {
        callIdx++
        if (callIdx <= 1) {
          // First sessions call: load session context
          const chain: Record<string, unknown> = {}
          chain.select = vi.fn().mockReturnValue(chain)
          chain.eq = vi.fn().mockReturnValue(chain)
          chain.single = vi.fn().mockResolvedValue({ data: opts.session })
          return chain
        }
        // Second sessions call: count query
        const chain: Record<string, unknown> = {}
        chain.select = vi.fn().mockReturnValue(chain)
        chain.eq = vi.fn().mockReturnValue(chain)
        chain.neq = vi.fn().mockResolvedValue({ count: opts.sessionCount })
        return chain
      }
      if (table === "qa_reports") {
        const chain: Record<string, unknown> = {}
        chain.select = vi.fn().mockReturnValue(chain)
        chain.eq = vi.fn().mockResolvedValue({ data: opts.qaReports })
        return chain
      }
      if (table === "users") {
        const chain: Record<string, unknown> = {}
        chain.select = vi.fn().mockReturnValue(chain)
        chain.eq = vi.fn().mockReturnValue(chain)
        chain.single = vi.fn().mockResolvedValue({ data: opts.userProfile })
        return chain
      }
      return makeChainMock(null)
    })
  }

  it("loads messages and runs profiler on valid session", async () => {
    setupFromMock()

    await triggerProfiling("session-1", "student-1", "tenant-1")

    expect(mockRunProfiler).toHaveBeenCalledOnce()
    expect(mockRunProfiler).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "user", content: "Resposta 1" }),
        ]),
        question: sampleQuestion,
        sessionCount: 3,
      }),
    )
  })

  it("skips profiling when fewer than 4 messages", async () => {
    setupFromMock({
      messages: [
        { role: "user", content: "Resposta 1", turn_number: 1 },
        { role: "assistant", content: "Pergunta 1", turn_number: 1 },
      ],
    })

    await triggerProfiling("session-1", "student-1", "tenant-1")

    expect(mockRunProfiler).not.toHaveBeenCalled()
  })

  it("skips profiling when messages is null", async () => {
    setupFromMock({ messages: null })

    await triggerProfiling("session-1", "student-1", "tenant-1")

    expect(mockRunProfiler).not.toHaveBeenCalled()
  })

  it("skips profiling when session is not found", async () => {
    setupFromMock({ session: null })

    await triggerProfiling("session-1", "student-1", "tenant-1")

    expect(mockRunProfiler).not.toHaveBeenCalled()
  })

  it("calls jsonb_profile_merge with correct parameters", async () => {
    setupFromMock()

    await triggerProfiling("session-1", "student-1", "tenant-1")

    expect(mockRpc).toHaveBeenCalledWith("jsonb_profile_merge", {
      p_user_id: "student-1",
      p_set_key: "ai_learning_profile",
      p_set_value: expect.stringContaining('"engagement_style":"reflective"'),
    })
  })

  it("includes sessions_analyzed metadata in merged profile", async () => {
    setupFromMock()

    await triggerProfiling("session-1", "student-1", "tenant-1")

    const rpcCall = mockRpc.mock.calls[0]
    const mergedValue = JSON.parse(rpcCall[1].p_set_value)
    expect(mergedValue.sessions_analyzed).toBe(1)
    expect(mergedValue.version).toBe(1)
    expect(mergedValue.last_updated).toBeDefined()
  })

  it("increments sessions_analyzed for existing profile", async () => {
    setupFromMock({
      userProfile: {
        profile: {
          ai_learning_profile: {
            ...sampleProfilerOutput,
            sessions_analyzed: 5,
            last_updated: "2026-01-01T00:00:00.000Z",
            version: 1,
          },
        },
      },
    })

    await triggerProfiling("session-1", "student-1", "tenant-1")

    const rpcCall = mockRpc.mock.calls[0]
    const mergedValue = JSON.parse(rpcCall[1].p_set_value)
    expect(mergedValue.sessions_analyzed).toBe(6)
  })

  it("throws when jsonb_profile_merge returns an error", async () => {
    setupFromMock()
    mockRpc.mockResolvedValue({ error: new Error("RPC failed") })

    await expect(triggerProfiling("session-1", "student-1", "tenant-1")).rejects.toThrow(
      "RPC failed",
    )
  })

  it("passes existing profile as null for new students", async () => {
    setupFromMock({ userProfile: { profile: {} } })

    await triggerProfiling("session-1", "student-1", "tenant-1")

    expect(mockRunProfiler).toHaveBeenCalledWith(
      expect.objectContaining({
        existingProfile: null,
      }),
    )
  })

  it("passes qaScores from qa_reports table", async () => {
    setupFromMock({
      qaReports: [
        { score: 0.75, verdict: "APPROVED" },
        { score: 0.6, verdict: "REJECTED" },
      ],
    })

    await triggerProfiling("session-1", "student-1", "tenant-1")

    expect(mockRunProfiler).toHaveBeenCalledWith(
      expect.objectContaining({
        qaScores: [
          { score: 0.75, verdict: "APPROVED" },
          { score: 0.6, verdict: "REJECTED" },
        ],
      }),
    )
  })

  it("handles null qaReports gracefully", async () => {
    setupFromMock({ qaReports: null })

    await triggerProfiling("session-1", "student-1", "tenant-1")

    expect(mockRunProfiler).toHaveBeenCalledWith(
      expect.objectContaining({
        qaScores: [],
      }),
    )
  })
})
