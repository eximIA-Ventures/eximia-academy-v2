import type { SocratesOutput } from "@eximia/agents"

export const socratesFixture: SocratesOutput = {
  response: {
    content:
      "Você levantou um ponto interessante sobre a aplicacao prática desse conceito. " +
      "Percebo que você esta conectando a teoria com situacoes reais, o que e otimo para consolidar o aprendizado. " +
      "Mas me diga: como você diferenciaria esse cenario de uma situacao onde o resultado esperado fosse oposto?",
    feedback_summary: "O aluno demonstrou boa compreensão inicial e capacidade de conectar teoria a pratica.",
    question_asked:
      "Como você diferenciaria esse cenario de uma situacao onde o resultado esperado fosse oposto?",
    question_type: "perspectivas",
    has_question: true,
    is_final_interaction: false,
    depth_level: 3,
  },
  quality_checks: {
    no_direct_answer: true,
    no_artificial_labels: true,
    ends_with_question: true,
    connected_to_chapter: true,
    references_student_input: true,
    within_length_limit: true,
  },
  analytics: {
    response_length: 285,
    processing_time_ms: 1200,
    model_used: "claude-sonnet-4-5-20250514",
  },
  session_status: {
    interactions_remaining: 2,
    should_finalize: false,
    finalization_reason: null,
  },
}
