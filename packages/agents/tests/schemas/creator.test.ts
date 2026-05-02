import { describe, expect, it } from "vitest"
import { creatorInputSchema, creatorOutputSchema } from "../../src/schemas/creator"

describe("creatorInputSchema", () => {
  it("accepts valid input with required fields only", () => {
    const result = creatorInputSchema.safeParse({
      chapter_content: "A".repeat(100),
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.max_questions).toBe(3)
      expect(result.data.difficulty).toBe("intermediario")
    }
  })

  it("accepts valid input with all fields", () => {
    const result = creatorInputSchema.safeParse({
      chapter_content: "A".repeat(200),
      chapter_title: "Título do capítulo",
      learning_objective: "Entender conceitos",
      max_questions: 2,
      difficulty: "avancado",
    })
    expect(result.success).toBe(true)
  })

  it("rejects content shorter than 100 chars", () => {
    const result = creatorInputSchema.safeParse({
      chapter_content: "Curto",
    })
    expect(result.success).toBe(false)
  })

  it("rejects content longer than 50000 chars", () => {
    const result = creatorInputSchema.safeParse({
      chapter_content: "A".repeat(50001),
    })
    expect(result.success).toBe(false)
  })

  it("rejects max_questions > 3", () => {
    const result = creatorInputSchema.safeParse({
      chapter_content: "A".repeat(100),
      max_questions: 5,
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid difficulty", () => {
    const result = creatorInputSchema.safeParse({
      chapter_content: "A".repeat(100),
      difficulty: "expert",
    })
    expect(result.success).toBe(false)
  })
})

describe("creatorOutputSchema", () => {
  const validOutput = {
    analysis: {
      main_concepts: ["conceito1", "conceito2", "conceito3"],
      key_relationships: ["relacao1"],
      potential_angles: ["angulo1"],
      content_complexity: "media" as const,
    },
    questions: [
      {
        text: "Pergunta socratica de teste que tem pelo menos cinquenta caracteres para validar?",
        skill: "analise" as const,
        intention: "Testar a capacidade de análise do aluno neste contexto",
        expected_depth: "O aluno deve mencionar os conceitos principais e suas relacoes com profundidade",
        common_shallow_answer: "Resposta superficial tipica do aluno",
        followup_prompts: ["Pergunta de acompanhamento 1?", "Pergunta de acompanhamento 2?"],
        citations: ["paragrafo 1"],
        has_practical_scenario: true,
      },
    ],
    quality_checks: {
      all_questions_non_generic: true,
      skills_diversity: true,
      has_practical_scenario: true,
      all_metadata_complete: true,
      unique_angles: true,
    },
    metadata: {
      chapter_title: "Título do capítulo",
      questions_generated: 1,
      skills_covered: ["analise"],
      has_practical_scenario: true,
    },
    warnings: null,
  }

  it("accepts valid output", () => {
    const result = creatorOutputSchema.safeParse(validOutput)
    expect(result.success).toBe(true)
  })

  it("rejects output without questions", () => {
    const { questions, ...rest } = validOutput
    const result = creatorOutputSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it("rejects output without metadata", () => {
    const { metadata, ...rest } = validOutput
    const result = creatorOutputSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it("accepts output with warnings", () => {
    const result = creatorOutputSchema.safeParse({
      ...validOutput,
      warnings: ["Conteúdo muito curto"],
    })
    expect(result.success).toBe(true)
  })

  it("rejects more than 3 questions", () => {
    const result = creatorOutputSchema.safeParse({
      ...validOutput,
      questions: Array(4).fill(validOutput.questions[0]),
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid skill", () => {
    const result = creatorOutputSchema.safeParse({
      ...validOutput,
      questions: [{ ...validOutput.questions[0], skill: "invalid" }],
    })
    expect(result.success).toBe(false)
  })
})
