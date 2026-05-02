import type { CreatorOutput } from "@eximia/agents"

export const creatorFixture: CreatorOutput = {
  analysis: {
    main_concepts: ["fundamentos teoricos", "aplicacao pratica", "análise critica"],
    key_relationships: ["teoria-pratica", "causa-efeito", "contexto-aplicacao"],
    potential_angles: ["cenario real", "comparacao", "reflexao pessoal"],
    content_complexity: "media",
  },
  questions: [
    {
      text: "Considerando os conceitos apresentados no capítulo, como você aplicaria essas ideias para resolver um problema real no seu dia a dia profissional?",
      skill: "aplicacao",
      intention: "Avaliar capacidade de transferencia de conhecimento teorico para pratica.",
      expected_depth: "O aluno deve demonstrar compreensão dos conceitos e propor aplicacao concreta.",
      common_shallow_answer: "Eu usaria os conceitos no trabalho.",
      followup_prompts: [
        "Pode dar um exemplo mais especifico?",
        "Quais obstaculos você antecipa nessa aplicacao?",
      ],
      citations: ["Secao 1.2 - Fundamentos", "Secao 1.4 - Aplicacoes"],
      has_practical_scenario: true,
    },
    {
      text: "Análise criticamente as limitacoes da abordagem apresentada. Em quais situacoes ela poderia falhar?",
      skill: "analise",
      intention: "Estimular pensamento critico e identificacao de limitacoes.",
      expected_depth: "O aluno deve identificar pelo menos duas limitacoes concretas com justificativa.",
      common_shallow_answer: "A abordagem tem algumas limitacoes.",
      followup_prompts: [
        "Como você superaria essas limitacoes?",
        "Existe uma abordagem alternativa?",
      ],
      citations: ["Secao 1.3 - Metodologia"],
      has_practical_scenario: false,
    },
    {
      text: "Sintetize os principais aprendizados do capítulo e proponha uma conexão com outro tema que você já estudou.",
      skill: "sintese",
      intention: "Avaliar capacidade de síntese e conexão interdisciplinar.",
      expected_depth: "O aluno deve resumir pontos-chave e estabelecer conexão válida com outro domínio.",
      common_shallow_answer: "Os principais aprendizados são os conceitos do capítulo.",
      followup_prompts: [
        "Essa conexão e superficial ou profunda? Por que?",
        "Como essa integracao poderia gerar novos insights?",
      ],
      citations: ["Resumo do capítulo"],
      has_practical_scenario: false,
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
    chapter_title: "Capítulo 1",
    questions_generated: 3,
    skills_covered: ["aplicacao", "analise", "sintese"],
    has_practical_scenario: true,
  },
  warnings: null,
}
