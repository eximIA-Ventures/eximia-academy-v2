import { describe, it, expect } from "vitest"
import { socratesInputSchema, socratesOutputSchema } from "../src/schemas/socrates"
import { editorInputSchema, editorOutputSchema } from "../src/schemas/editor"
import { testerInputSchema, testerOutputSchema } from "../src/schemas/tester"
import { analystInputSchema, analystOutputSchema } from "../src/schemas/analyst"

describe("Socrates Schema", () => {
  it("validates valid input", () => {
    const input = {
      session_context: {
        session_id: "sess-1",
        chapter_id: "ch-1",
        initial_question: { text: "Como você aplicaria isso?" },
        interactions_remaining: 3,
      },
      student_message: { content: "Eu acho que a sustentabilidade e importante." },
      conversation_history: [],
    }
    expect(() => socratesInputSchema.parse(input)).not.toThrow()
  })

  it("rejects invalid input — missing student_message", () => {
    const input = {
      session_context: {
        session_id: "sess-1",
        chapter_id: "ch-1",
        initial_question: { text: "Pergunta" },
        interactions_remaining: 3,
      },
    }
    expect(() => socratesInputSchema.parse(input)).toThrow()
  })

  it("validates valid output", () => {
    const output = {
      response: {
        content: "Você menciona a sustentabilidade como conceito central. De fato, esse e um dos pilares do agronegocio moderno, mas existem nuances importantes a considerar.\n\nComo você diferenciaria uma prática sustentavel de uma que apenas parece sustentavel?",
        feedback_summary: null,
        question_asked: null,
        question_type: null,
        has_question: true,
        is_final_interaction: false,
        depth_level: null,
      },
      quality_checks: null,
      analytics: null,
      session_status: null,
    }
    expect(() => socratesOutputSchema.parse(output)).not.toThrow()
  })

  it("rejects output with content too short", () => {
    const output = {
      response: {
        content: "Short",
        feedback_summary: null,
        question_asked: null,
        question_type: null,
        has_question: true,
        is_final_interaction: false,
        depth_level: null,
      },
    }
    expect(() => socratesOutputSchema.parse(output)).toThrow()
  })
})

describe("Editor Schema", () => {
  it("validates valid input", () => {
    const input = {
      orientador_response:
        "[Feedback] Você levanta um ponto interessante. [Pergunta] Como você aplicaria isso na pratica?",
    }
    expect(() => editorInputSchema.parse(input)).not.toThrow()
  })

  it("rejects input with response too short", () => {
    const input = { orientador_response: "Short" }
    expect(() => editorInputSchema.parse(input)).toThrow()
  })

  it("validates valid output", () => {
    const output = {
      edited_response: {
        content:
          "Você levanta um ponto interessante sobre a relacao entre tecnologia e produtividade. Essa conexão existe, mas nem sempre e direta ou garantida.\n\nEm que situacoes você acha que investir em tecnologia poderia NAO trazer o retorno esperado?",
        paragraph_1: null,
        paragraph_2: null,
        paragraph_count: 2 as const,
        word_count: null,
        ends_with_question: true as const,
      },
      changes_made: null,
      quality_checks: null,
    }
    expect(() => editorOutputSchema.parse(output)).not.toThrow()
  })
})

describe("Tester Schema", () => {
  it("validates valid input", () => {
    const input = {
      edited_response:
        "Você menciona corretamente a conexão. Mas existem nuances.\n\nComo você avaliaria um caso concreto?",
    }
    expect(() => testerInputSchema.parse(input)).not.toThrow()
  })

  it("validates APPROVED output", () => {
    const output = {
      verdict: "APPROVED" as const,
      score: 1.0,
      criteria_results: {
        C1_no_direct_answer: { passed: true, severity: "CRITICAL" as const, notes: "Ok" },
        C2_open_question: { passed: true, severity: "CRITICAL" as const, notes: "Ok" },
        C3_constructive_feedback: { passed: true, severity: "MAJOR" as const, notes: "Ok" },
        C4_no_labels: { passed: true, severity: "MAJOR" as const, notes: "Ok" },
        C5_natural_flow: { passed: true, severity: "MINOR" as const, notes: "Ok" },
        C6_topic_connection: { passed: true, severity: "MINOR" as const, notes: "Ok" },
      },
      summary: {
        passed_count: 6,
        failed_count: 0,
        critical_failures: [],
        major_failures: [],
        minor_issues: [],
      },
      recommendation: "Pronto para envio ao aluno",
      observations: [],
    }
    expect(() => testerOutputSchema.parse(output)).not.toThrow()
  })

  it("validates REJECTED output", () => {
    const output = {
      verdict: "REJECTED" as const,
      score: 0,
      criteria_results: {
        C1_no_direct_answer: {
          passed: false,
          severity: "CRITICAL" as const,
          notes: "Resposta direta detectada",
        },
        C2_open_question: { passed: true, severity: "CRITICAL" as const, notes: "Ok" },
        C3_constructive_feedback: { passed: true, severity: "MAJOR" as const, notes: "Ok" },
        C4_no_labels: { passed: true, severity: "MAJOR" as const, notes: "Ok" },
        C5_natural_flow: { passed: true, severity: "MINOR" as const, notes: "Ok" },
        C6_topic_connection: { passed: true, severity: "MINOR" as const, notes: "Ok" },
      },
      summary: {
        passed_count: 5,
        failed_count: 1,
        critical_failures: ["C1: Resposta direta"],
        major_failures: [],
        minor_issues: [],
      },
      recommendation: "Reprocessar via ORIENTADOR",
      observations: [],
    }
    expect(() => testerOutputSchema.parse(output)).not.toThrow()
  })
})

describe("Analyst Schema", () => {
  it("validates valid input", () => {
    const input = {
      student_message: "Eu acho que sustentabilidade e importante ne.",
      context: {
        chapter_id: "ch-1",
        turn_number: 1,
      },
      interaction_metadata: {
        session_id: "sess-1",
        timestamp: "2026-02-08T10:00:00Z",
      },
    }
    expect(() => analystInputSchema.parse(input)).not.toThrow()
  })

  it("rejects empty student_message", () => {
    const input = { student_message: "" }
    expect(() => analystInputSchema.parse(input)).toThrow()
  })

  it("validates valid output", () => {
    const output = {
      analysis_id: "analysis_20260208_100000_abc",
      timestamp: "2026-02-08T10:00:00Z",
      ai_detection: {
        probability: 0.15,
        confidence: "high" as const,
        verdict: "likely_human" as const,
        indicators: [],
        flag: null,
      },
      metrics: {
        text: {
          message_length_chars: 47,
          message_length_words: 8,
          sentence_count: 1,
          avg_words_per_sentence: 8,
          has_question: false,
        },
        time: null,
        context: null,
        quality: null,
      },
      flags: [],
      observations: ["Texto apresenta caracteristicas humanas"],
      recommendation: "Nenhuma acao necessaria.",
    }
    expect(() => analystOutputSchema.parse(output)).not.toThrow()
  })

  it("validates output with alta_probabilidade flag", () => {
    const output = {
      analysis_id: "analysis_20260208_100000_def",
      timestamp: "2026-02-08T10:00:00Z",
      ai_detection: {
        probability: 0.85,
        confidence: "high" as const,
        verdict: "likely_ai" as const,
        indicators: [
          {
            type: "artificial_connectors",
            description: "Detectado: 'E importante ressaltar'",
            weight: 0.3,
          },
        ],
        flag: "alta_probabilidade_texto_IA" as const,
      },
      metrics: {
        text: null,
        time: null,
        context: null,
        quality: null,
      },
      flags: ["alta_probabilidade_texto_IA"],
      observations: ["Texto com caracteristicas de LLM"],
      recommendation: "Revisar manualmente.",
    }
    expect(() => analystOutputSchema.parse(output)).not.toThrow()
  })
})
