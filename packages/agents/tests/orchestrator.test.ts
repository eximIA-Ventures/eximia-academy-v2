import { describe, it, expect, vi, beforeEach } from "vitest"
import { orchestrateSocraticDialogue } from "../src/orchestrator"
import { AgentTimeoutError } from "../src/errors"
import type { OrchestratorInput } from "../src/types"

// Mock the AI SDK
vi.mock("ai", () => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
}))

vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn(() => "mock-openai-model"),
}))

// Mock model-router so getModelWithFallback returns a mock model
vi.mock("../src/model-router", () => ({
  getModelWithFallback: vi.fn(() => "mock-router-model"),
}))

import { generateObject } from "ai"

const mockGenerateObject = vi.mocked(generateObject)

const baseInput: OrchestratorInput = {
  sessionId: "sess-1",
  studentMessage: "Eu acho que a sustentabilidade e importante para o agronegocio.",
  chapterContent: "Capítulo sobre sustentabilidade no agronegocio...",
  question: { text: "Como você avaliaria praticas sustentaveis?" },
  conversationHistory: [],
  turnNumber: 1,
  interactionsRemaining: 3,
}

const makeSocratesResponse = () => ({
  response: {
    content:
      "Você menciona a sustentabilidade como algo importante, e de fato ela e um dos pilares centrais do agronegocio moderno. Porem, existem nuances importantes a considerar quando falamos de equilibrio entre producao e preservacao.\n\nComo você diferenciaria uma prática que e genuinamente sustentavel de uma que apenas parece ser sustentavel na superficie?",
    has_question: true,
    is_final_interaction: false,
  },
})

const makeEditorResponse = () => ({
  edited_response: {
    content:
      "Você menciona a sustentabilidade como algo importante, e de fato ela e central no agronegocio moderno. Existem nuances importantes quando falamos de equilibrio entre producao e preservacao.\n\nComo você diferenciaria uma prática genuinamente sustentavel de uma que apenas parece ser sustentavel?",
    paragraph_count: 2,
    ends_with_question: true,
  },
})

const makeApprovedTesterResponse = () => ({
  verdict: "APPROVED",
  score: 1.0,
  criteria_results: {
    C1_no_direct_answer: { passed: true, severity: "CRITICAL", notes: "Ok" },
    C2_open_question: { passed: true, severity: "CRITICAL", notes: "Ok" },
    C3_constructive_feedback: { passed: true, severity: "MAJOR", notes: "Ok" },
    C4_no_labels: { passed: true, severity: "MAJOR", notes: "Ok" },
    C5_natural_flow: { passed: true, severity: "MINOR", notes: "Ok" },
    C6_topic_connection: { passed: true, severity: "MINOR", notes: "Ok" },
  },
  summary: {
    passed_count: 6,
    failed_count: 0,
    critical_failures: [],
    major_failures: [],
    minor_issues: [],
  },
  recommendation: "Pronto para envio",
  observations: [],
})

const makeRejectedTesterResponse = () => ({
  verdict: "REJECTED",
  score: 0.3,
  criteria_results: {
    C1_no_direct_answer: { passed: false, severity: "CRITICAL", notes: "Resposta direta" },
    C2_open_question: { passed: true, severity: "CRITICAL", notes: "Ok" },
    C3_constructive_feedback: { passed: true, severity: "MAJOR", notes: "Ok" },
    C4_no_labels: { passed: true, severity: "MAJOR", notes: "Ok" },
    C5_natural_flow: { passed: true, severity: "MINOR", notes: "Ok" },
    C6_topic_connection: { passed: true, severity: "MINOR", notes: "Ok" },
  },
  summary: {
    passed_count: 5,
    failed_count: 1,
    critical_failures: ["C1"],
    major_failures: [],
    minor_issues: [],
  },
  recommendation: "Reprocessar sem dar resposta direta",
  observations: [],
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe("orchestrateSocraticDialogue", () => {
  it("returns APPROVED on first attempt (happy path)", async () => {
    mockGenerateObject
      .mockResolvedValueOnce({ object: makeSocratesResponse() } as never)
      .mockResolvedValueOnce({ object: makeEditorResponse() } as never)
      .mockResolvedValueOnce({ object: makeApprovedTesterResponse() } as never)

    const result = await orchestrateSocraticDialogue(baseInput)

    expect(result.qaReport.verdict).toBe("APPROVED")
    expect(result.retryCount).toBe(0)
    expect(result.warning).toBe(false)
    expect(result.response).toContain("sustentavel")
    expect(mockGenerateObject).toHaveBeenCalledTimes(3)
  })

  it("retries once when Tester rejects then approves", async () => {
    mockGenerateObject
      // First attempt
      .mockResolvedValueOnce({ object: makeSocratesResponse() } as never)
      .mockResolvedValueOnce({ object: makeEditorResponse() } as never)
      .mockResolvedValueOnce({ object: makeRejectedTesterResponse() } as never)
      // Second attempt (retry)
      .mockResolvedValueOnce({ object: makeSocratesResponse() } as never)
      .mockResolvedValueOnce({ object: makeEditorResponse() } as never)
      .mockResolvedValueOnce({ object: makeApprovedTesterResponse() } as never)

    const result = await orchestrateSocraticDialogue(baseInput)

    expect(result.qaReport.verdict).toBe("APPROVED")
    expect(result.retryCount).toBe(1)
    expect(result.warning).toBe(false)
    expect(mockGenerateObject).toHaveBeenCalledTimes(6)
  })

  it("returns best response with warning after max retries", async () => {
    // All 3 attempts REJECTED
    for (let i = 0; i < 3; i++) {
      mockGenerateObject
        .mockResolvedValueOnce({ object: makeSocratesResponse() } as never)
        .mockResolvedValueOnce({ object: makeEditorResponse() } as never)
        .mockResolvedValueOnce({ object: makeRejectedTesterResponse() } as never)
    }

    const result = await orchestrateSocraticDialogue(baseInput)

    expect(result.qaReport.verdict).toBe("REJECTED")
    expect(result.retryCount).toBe(3)
    expect(result.warning).toBe(true)
    expect(result.response).toBeTruthy()
    expect(mockGenerateObject).toHaveBeenCalledTimes(9) // 3 attempts x 3 agents
  })

  it("throws AgentTimeoutError when agent exceeds timeout", async () => {
    mockGenerateObject.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ object: makeSocratesResponse() } as never), 5000)
        })
    )

    await expect(
      orchestrateSocraticDialogue(baseInput, { timeoutMs: 50 })
    ).rejects.toThrow(AgentTimeoutError)
  })
})
