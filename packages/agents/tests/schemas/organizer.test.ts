import { describe, expect, it } from "vitest"
import { organizerInputSchema, organizerOutputSchema } from "../../src/schemas/organizer"

describe("organizerInputSchema", () => {
  it("accepts valid input with required fields only", () => {
    const result = organizerInputSchema.safeParse({
      raw_text: "A".repeat(200),
      source_type: "pdf",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.max_chapters).toBe(15)
      expect(result.data.language).toBe("pt-br")
    }
  })

  it("accepts valid input with all fields", () => {
    const result = organizerInputSchema.safeParse({
      raw_text: "A".repeat(500),
      source_filename: "aula.pdf",
      source_type: "pdf",
      language: "pt-br",
      max_chapters: 10,
      instructions: "Divida em 5 capítulos focados na parte pratica",
    })
    expect(result.success).toBe(true)
  })

  it("rejects text shorter than 200 chars", () => {
    const result = organizerInputSchema.safeParse({
      raw_text: "Curto",
      source_type: "txt",
    })
    expect(result.success).toBe(false)
  })

  it("rejects text longer than 500000 chars", () => {
    const result = organizerInputSchema.safeParse({
      raw_text: "A".repeat(500001),
      source_type: "txt",
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid source_type", () => {
    const result = organizerInputSchema.safeParse({
      raw_text: "A".repeat(200),
      source_type: "xlsx",
    })
    expect(result.success).toBe(false)
  })

  it("rejects max_chapters > 50", () => {
    const result = organizerInputSchema.safeParse({
      raw_text: "A".repeat(200),
      source_type: "pdf",
      max_chapters: 51,
    })
    expect(result.success).toBe(false)
  })

  it("accepts all valid source types", () => {
    for (const type of ["pdf", "docx", "pptx", "txt", "audio", "video_url", "paste"]) {
      const result = organizerInputSchema.safeParse({
        raw_text: "A".repeat(200),
        source_type: type,
      })
      expect(result.success).toBe(true)
    }
  })
})

describe("organizerOutputSchema", () => {
  const validOutput = {
    suggested_title: "Introducao ao Machine Learning",
    suggested_description: "Curso completo sobre fundamentos de Machine Learning com aplicacoes praticas",
    chapters: [
      {
        title: "Fundamentos de Machine Learning",
        content:
          "Machine Learning e uma área da inteligencia artificial que permite que sistemas aprendam com dados sem serem explicitamente programados. Essa disciplina combina estatistica, ciencia da computacao e otimizacao para criar modelos preditivos capazes de generalizar.",
        learning_objective:
          "Ao final deste capítulo, o aluno será capaz de definir Machine Learning e seus principais paradigmas",
        order: 0,
        key_concepts: ["aprendizado supervisionado", "aprendizado nao-supervisionado"],
        estimated_reading_time_min: 5,
      },
      {
        title: "Algoritmos de Classificacao",
        content:
          "Algoritmos de classificacao são usados para categorizar dados em classes predefinidas. Os mais comuns incluem arvores de decisao, SVM, redes neurais e metodos de ensemble como Random Forest e Gradient Boosting que combinam multiplos modelos.",
        learning_objective:
          "Ao final deste capítulo, o aluno será capaz de comparar diferentes algoritmos de classificacao",
        order: 1,
        key_concepts: ["classificacao", "arvore de decisao", "SVM"],
        estimated_reading_time_min: 8,
      },
    ],
    metadata: {
      total_chapters: 2,
      content_complexity: "media" as const,
      main_topics: ["Machine Learning", "Classificacao"],
      suggested_area: "Inteligencia Artificial",
    },
    warnings: null,
  }

  it("accepts valid output", () => {
    const result = organizerOutputSchema.safeParse(validOutput)
    expect(result.success).toBe(true)
  })

  it("accepts output with warnings", () => {
    const result = organizerOutputSchema.safeParse({
      ...validOutput,
      warnings: ["Conteúdo curto — poucos capítulos gerados"],
    })
    expect(result.success).toBe(true)
  })

  it("rejects output without chapters", () => {
    const { chapters, ...rest } = validOutput
    const result = organizerOutputSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it("rejects output with empty chapters array", () => {
    const result = organizerOutputSchema.safeParse({
      ...validOutput,
      chapters: [],
    })
    expect(result.success).toBe(false)
  })

  it("rejects output without metadata", () => {
    const { metadata, ...rest } = validOutput
    const result = organizerOutputSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it("rejects chapter with short title", () => {
    const result = organizerOutputSchema.safeParse({
      ...validOutput,
      chapters: [{ ...validOutput.chapters[0], title: "AB" }],
    })
    expect(result.success).toBe(false)
  })

  it("rejects chapter with short content", () => {
    const result = organizerOutputSchema.safeParse({
      ...validOutput,
      chapters: [{ ...validOutput.chapters[0], content: "Curto" }],
    })
    expect(result.success).toBe(false)
  })

  it("rejects chapter without key_concepts", () => {
    const result = organizerOutputSchema.safeParse({
      ...validOutput,
      chapters: [{ ...validOutput.chapters[0], key_concepts: [] }],
    })
    expect(result.success).toBe(false)
  })

  it("rejects more than 50 chapters", () => {
    const result = organizerOutputSchema.safeParse({
      ...validOutput,
      chapters: Array(51).fill(validOutput.chapters[0]),
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid content_complexity", () => {
    const result = organizerOutputSchema.safeParse({
      ...validOutput,
      metadata: { ...validOutput.metadata, content_complexity: "extreme" },
    })
    expect(result.success).toBe(false)
  })

  it("rejects short suggested_title", () => {
    const result = organizerOutputSchema.safeParse({
      ...validOutput,
      suggested_title: "AB",
    })
    expect(result.success).toBe(false)
  })
})
