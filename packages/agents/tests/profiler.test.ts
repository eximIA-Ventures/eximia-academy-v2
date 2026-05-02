import { describe, it, expect, vi, beforeEach } from "vitest"
import { profilerInputSchema, profilerOutputSchema } from "../src/schemas/profiler"
import { buildProfilerPrompt } from "../src/profiler"
import { withTimeout } from "../src/utils"
import { AgentTimeoutError } from "../src/errors"
import type { ProfilerInput } from "../src/schemas/profiler"

// Mock the AI SDK
vi.mock("ai", () => ({
	generateObject: vi.fn(),
}))

vi.mock("@ai-sdk/openai", () => ({
	openai: vi.fn(() => "mock-openai-model"),
}))

// Mock model-router (profiler uses openai directly when no tenantPlan)
vi.mock("../src/model-router", () => ({
	getModelWithFallback: vi.fn(() => "mock-router-model"),
}))

import { generateObject } from "ai"

const mockGenerateObject = vi.mocked(generateObject)

const validInput: ProfilerInput = {
	messages: [
		{ role: "user", content: "Eu acho que sustentabilidade e importante.", turn_number: 1 },
		{
			role: "assistant",
			content: "Interessante. O que você entende por sustentabilidade nesse contexto?",
			turn_number: 1,
		},
		{
			role: "user",
			content:
				"Sustentabilidade e equilibrar producao com preservacao ambiental, considerando impactos a longo prazo.",
			turn_number: 2,
		},
		{
			role: "assistant",
			content: "Você mencionou impactos a longo prazo. Como mediria esses impactos na pratica?",
			turn_number: 2,
		},
	],
	question: {
		text: "Como você avaliaria praticas sustentaveis no agronegocio?",
		skill: "analise",
		intention: "Avaliar capacidade de análise critica",
	},
	qaScores: [
		{ score: 0.85, verdict: "APPROVED" },
		{ score: 0.92, verdict: "APPROVED" },
	],
	existingProfile: null,
	sessionCount: 0,
}

const validOutput = {
	preferred_question_types: ["clarificacao", "aplicacao"] as const,
	engagement_style: "reflective" as const,
	detail_orientation: "balanced" as const,
	reasoning_style: "analytical" as const,
	avg_depth_achieved: 3.5,
	comprehension_trend: "stable" as const,
	avg_qa_score: 0.885,
	strengths: ["Boa capacidade de elaboracao", "Conecta conceitos"],
	growth_areas: ["Explorar mais perspectivas alternativas"],
	adaptation_hints: ["Usar perguntas de aplicação pratica"],
	summary: "Aluno demonstra perfil analitico com boa capacidade de elaboracao.",
	confidence: 0.12,
}

beforeEach(() => {
	vi.clearAllMocks()
})

// --- Input Schema Tests ---

describe("profilerInputSchema", () => {
	it("validates correct input", () => {
		const result = profilerInputSchema.safeParse(validInput)
		expect(result.success).toBe(true)
	})

	it("rejects messages with fewer than 2 entries", () => {
		const input = {
			...validInput,
			messages: [{ role: "user", content: "Oi", turn_number: 1 }],
		}
		const result = profilerInputSchema.safeParse(input)
		expect(result.success).toBe(false)
	})

	it("rejects QA scores outside 0-1 range", () => {
		const input = {
			...validInput,
			qaScores: [{ score: 1.5, verdict: "APPROVED" }],
		}
		const result = profilerInputSchema.safeParse(input)
		expect(result.success).toBe(false)
	})

	it("rejects negative QA scores", () => {
		const input = {
			...validInput,
			qaScores: [{ score: -0.1, verdict: "APPROVED" }],
		}
		const result = profilerInputSchema.safeParse(input)
		expect(result.success).toBe(false)
	})

	it("accepts null existingProfile", () => {
		const result = profilerInputSchema.safeParse(validInput)
		expect(result.success).toBe(true)
	})

	it("accepts valid existingProfile", () => {
		const input = {
			...validInput,
			existingProfile: {
				preferred_question_types: ["clarificacao"],
				engagement_style: "reflective",
				detail_orientation: "balanced",
				reasoning_style: "analytical",
				avg_depth_achieved: 3.0,
				comprehension_trend: "stable",
				avg_qa_score: 0.8,
				strengths: ["Boa elaboracao"],
				growth_areas: ["Mais perspectivas"],
				adaptation_hints: ["Usar exemplos praticos"],
				summary: "Perfil inicial",
				sessions_analyzed: 1,
				last_updated: "2026-02-10T00:00:00Z",
				confidence: 0.1,
				version: 1,
			},
			sessionCount: 1,
		}
		const result = profilerInputSchema.safeParse(input)
		expect(result.success).toBe(true)
	})
})

// --- Output Schema Tests ---

describe("profilerOutputSchema", () => {
	it("validates correct output", () => {
		const result = profilerOutputSchema.safeParse(validOutput)
		expect(result.success).toBe(true)
	})

	it("rejects strengths with more than 5 items", () => {
		const output = {
			...validOutput,
			strengths: ["a", "b", "c", "d", "e", "f"],
		}
		const result = profilerOutputSchema.safeParse(output)
		expect(result.success).toBe(false)
	})

	it("rejects growth_areas with more than 3 items", () => {
		const output = {
			...validOutput,
			growth_areas: ["a", "b", "c", "d"],
		}
		const result = profilerOutputSchema.safeParse(output)
		expect(result.success).toBe(false)
	})

	it("rejects confidence greater than 1", () => {
		const output = {
			...validOutput,
			confidence: 1.1,
		}
		const result = profilerOutputSchema.safeParse(output)
		expect(result.success).toBe(false)
	})

	it("rejects confidence less than 0", () => {
		const output = {
			...validOutput,
			confidence: -0.1,
		}
		const result = profilerOutputSchema.safeParse(output)
		expect(result.success).toBe(false)
	})

	it("rejects avg_depth_achieved outside 1-6 range", () => {
		const output = {
			...validOutput,
			avg_depth_achieved: 7,
		}
		const result = profilerOutputSchema.safeParse(output)
		expect(result.success).toBe(false)
	})

	it("rejects invalid engagement_style", () => {
		const output = {
			...validOutput,
			engagement_style: "unknown",
		}
		const result = profilerOutputSchema.safeParse(output)
		expect(result.success).toBe(false)
	})

	it("rejects preferred_question_types with more than 4 items", () => {
		const output = {
			...validOutput,
			preferred_question_types: [
				"clarificacao",
				"suposicoes",
				"evidencias",
				"perspectivas",
				"consequencias",
			],
		}
		const result = profilerOutputSchema.safeParse(output)
		expect(result.success).toBe(false)
	})

	it("rejects summary longer than 500 characters", () => {
		const output = {
			...validOutput,
			summary: "a".repeat(501),
		}
		const result = profilerOutputSchema.safeParse(output)
		expect(result.success).toBe(false)
	})
})

// --- buildProfilerPrompt Tests ---

describe("buildProfilerPrompt", () => {
	it("includes messages, question, scores, and session count", () => {
		const prompt = buildProfilerPrompt(validInput)

		expect(prompt).toContain("## Conversa Socratica")
		expect(prompt).toContain("Aluno (turno 1)")
		expect(prompt).toContain("Tutor (turno 1)")
		expect(prompt).toContain("## Pergunta Inicial")
		expect(prompt).toContain("Como você avaliaria praticas sustentaveis")
		expect(prompt).toContain("Skill: analise")
		expect(prompt).toContain("## Scores de Qualidade")
		expect(prompt).toContain("score=0.85")
		expect(prompt).toContain("verdict=APPROVED")
		expect(prompt).toContain("## Sessões Completadas")
		expect(prompt).toContain("Total de sessões anteriores: 0")
	})

	it('formats "Nenhum perfil existente" when existingProfile is null', () => {
		const prompt = buildProfilerPrompt(validInput)

		expect(prompt).toContain("Nenhum perfil existente (primeira sessao)")
	})

	it("includes existing profile as JSON when present", () => {
		const input: ProfilerInput = {
			...validInput,
			existingProfile: {
				preferred_question_types: ["clarificacao"],
				engagement_style: "reflective",
				detail_orientation: "balanced",
				reasoning_style: "analytical",
				avg_depth_achieved: 3.0,
				comprehension_trend: "stable",
				avg_qa_score: 0.8,
				strengths: ["Boa elaboracao"],
				growth_areas: ["Mais perspectivas"],
				adaptation_hints: ["Usar exemplos praticos"],
				summary: "Perfil inicial",
				sessions_analyzed: 1,
				last_updated: "2026-02-10T00:00:00Z",
				confidence: 0.1,
				version: 1,
			},
			sessionCount: 1,
		}
		const prompt = buildProfilerPrompt(input)

		expect(prompt).toContain('"engagement_style": "reflective"')
		expect(prompt).toContain('"sessions_analyzed": 1')
		expect(prompt).not.toContain("Nenhum perfil existente")
	})
})

// --- withTimeout Tests ---

describe("withTimeout", () => {
	it("resolves normally before timeout", async () => {
		const result = await withTimeout(() => Promise.resolve("ok"), 1000, "Test")
		expect(result).toBe("ok")
	})

	it("rejects with AgentTimeoutError after timeout", async () => {
		const slowFn = () => new Promise((resolve) => {
			setTimeout(() => resolve("late"), 5000)
		})

		await expect(withTimeout(slowFn, 50, "TestAgent")).rejects.toThrow(AgentTimeoutError)
		await expect(withTimeout(slowFn, 50, "TestAgent")).rejects.toThrow(
			'Agent "TestAgent" exceeded timeout limit',
		)
	})

	it("passes AbortSignal to the function", async () => {
		let receivedSignal: AbortSignal | undefined
		await withTimeout(
			(signal) => {
				receivedSignal = signal
				return Promise.resolve("ok")
			},
			1000,
			"Test",
		)
		expect(receivedSignal).toBeInstanceOf(AbortSignal)
		expect(receivedSignal!.aborted).toBe(false)
	})
})

// --- runProfiler Tests ---

describe("runProfiler", () => {
	it("calls generateObject with OpenAI model and returns result.object", async () => {
		mockGenerateObject.mockResolvedValueOnce({
			object: validOutput,
		} as never)

		const { runProfiler } = await import("../src/profiler")
		const result = await runProfiler(validInput)

		expect(result).toEqual(validOutput)
		expect(mockGenerateObject).toHaveBeenCalledTimes(1)
		expect(mockGenerateObject).toHaveBeenCalledWith(
			expect.objectContaining({
				model: "mock-openai-model",
				schema: expect.any(Object),
			}),
		)
	})
})
