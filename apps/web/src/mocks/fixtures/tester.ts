import type { TesterOutput } from "@eximia/agents"

export const testerFixture: TesterOutput = {
  verdict: "APPROVED",
  score: 0.85,
  criteria_results: {
    C1_no_direct_answer: {
      passed: true,
      severity: "CRITICAL",
      notes: "A resposta nao fornece respostas diretas, mantendo o metodo socratico.",
    },
    C2_open_question: {
      passed: true,
      severity: "CRITICAL",
      notes: "A resposta termina com uma pergunta aberta que estimula reflexao.",
    },
    C3_constructive_feedback: {
      passed: true,
      severity: "MAJOR",
      notes: "Feedback construtivo e encorajador presente no primeiro paragrafo.",
    },
    C4_no_labels: {
      passed: true,
      severity: "MAJOR",
      notes: "Nenhum rotulo artificial encontrado na resposta.",
    },
    C5_natural_flow: {
      passed: true,
      severity: "MINOR",
      notes: "Fluxo natural e conversacional mantido ao longo da resposta.",
    },
    C6_topic_connection: {
      passed: true,
      severity: "MINOR",
      notes: "Resposta bem conectada ao topico do capítulo.",
    },
  },
  summary: {
    passed_count: 6,
    failed_count: 0,
    critical_failures: [],
    major_failures: [],
    minor_issues: [],
  },
  recommendation: "Resposta aprovada. Qualidade excelente em todos os criterios avaliados.",
  observations: [
    "A resposta manteve tom acolhedor e encorajador.",
    "Boa conexão entre o feedback e a pergunta de aprofundamento.",
  ],
}
