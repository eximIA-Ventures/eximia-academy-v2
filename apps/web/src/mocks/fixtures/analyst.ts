import type { AnalystOutput } from "@eximia/agents"

export const analystFixture: AnalystOutput = {
  analysis_id: "analysis_e2e_mock_001",
  timestamp: new Date().toISOString(),
  ai_detection: {
    probability: 0.15,
    confidence: "high",
    verdict: "likely_human",
    indicators: [
      {
        type: "vocabulary_variation",
        description: "Variacao natural no vocabulario, consistente com escrita humana.",
        weight: -0.3,
      },
      {
        type: "response_time",
        description: "Tempo de resposta compativel com digitacao humana.",
        weight: -0.2,
      },
    ],
    flag: null,
  },
  metrics: {
    text: {
      message_length_chars: 150,
      message_length_words: 25,
      sentence_count: 3,
      avg_words_per_sentence: 8.3,
      has_question: false,
    },
    time: {
      timestamp: new Date().toISOString(),
      response_time_seconds: 45,
    },
    context: {
      turn_number: 1,
      chapter_id: "00000000-0000-0000-0000-000000000020",
      session_id: "session_e2e_mock",
    },
    quality: {
      topic_relevance: 0.8,
      depth_of_thought: "moderate",
      engagement_level: "medium",
    },
  },
  flags: [],
  observations: [
    "Mensagem apresenta padroes consistentes com escrita humana.",
    "Tempo de resposta dentro do esperado para interacao genuina.",
  ],
  recommendation: "Nenhuma acao necessaria. Mensagem classificada como provavelmente humana.",
}
