import type { CalculatorOutput } from "@eximia/course-designer"

export const courseCalculatorFixture: CalculatorOutput = {
  time_allocation: {
    total_minutes: 480,
    modules: [
      {
        module_order: 1,
        total_minutes: 140,
        per_stage: { engage: 21, explore: 42, explain: 35, elaborate: 28, evaluate: 14 },
        chunks: [
          { title: "Boas-vindas e diagnostico", duration_min: 15, type: "activity" },
          { title: "Conceitos fundamentais", duration_min: 25, type: "content" },
          { title: "Pausa", duration_min: 5, type: "break" },
          { title: "Exploracao guiada", duration_min: 25, type: "activity" },
          { title: "Video-aula explicativa", duration_min: 20, type: "content" },
          { title: "Exercicio pratico", duration_min: 25, type: "activity" },
          { title: "Reflexao individual", duration_min: 10, type: "reflection" },
          { title: "Quiz de verificacao", duration_min: 15, type: "assessment" },
        ],
      },
      {
        module_order: 2,
        total_minutes: 170,
        per_stage: { engage: 17, explore: 42, explain: 34, elaborate: 51, evaluate: 26 },
        chunks: [
          { title: "Desafio introdutorio", duration_min: 15, type: "activity" },
          { title: "Estudo de caso parte 1", duration_min: 25, type: "content" },
          { title: "Pausa", duration_min: 5, type: "break" },
          { title: "Estudo de caso parte 2", duration_min: 25, type: "activity" },
          { title: "Demonstracao ao vivo", duration_min: 20, type: "content" },
          { title: "Pratica guiada", duration_min: 30, type: "activity" },
          { title: "Pausa", duration_min: 5, type: "break" },
          { title: "Resolucao de problemas", duration_min: 20, type: "activity" },
          { title: "Reflexao em grupo", duration_min: 10, type: "reflection" },
          { title: "Simulacao avaliativa", duration_min: 15, type: "assessment" },
        ],
      },
      {
        module_order: 3,
        total_minutes: 170,
        per_stage: { engage: 17, explore: 34, explain: 26, elaborate: 59, evaluate: 34 },
        chunks: [
          { title: "Provocacao com problema real", duration_min: 15, type: "activity" },
          { title: "Análise de dados", duration_min: 25, type: "content" },
          { title: "Pausa", duration_min: 5, type: "break" },
          { title: "Frameworks de analise", duration_min: 20, type: "content" },
          { title: "Projeto integrador parte 1", duration_min: 30, type: "activity" },
          { title: "Pausa", duration_min: 5, type: "break" },
          { title: "Projeto integrador parte 2", duration_min: 25, type: "activity" },
          { title: "Discussão em grupo", duration_min: 15, type: "activity" },
          { title: "Reflexao final", duration_min: 10, type: "reflection" },
          { title: "Apresentacao e defesa", duration_min: 20, type: "assessment" },
        ],
      },
    ],
    attention_span_respected: true,
  },
  cognitive_load: {
    modules: [
      {
        module_order: 1,
        intrinsic_load: "low",
        extraneous_load: "low",
        germane_load: "medium",
        new_concepts_count: 4,
        concurrent_concepts: 2,
        recommendation: "Load is well-balanced for foundational content.",
      },
      {
        module_order: 2,
        intrinsic_load: "medium",
        extraneous_load: "low",
        germane_load: "medium",
        new_concepts_count: 3,
        concurrent_concepts: 3,
        recommendation: "Practical application helps manage cognitive load through scaffolding.",
      },
      {
        module_order: 3,
        intrinsic_load: "high",
        extraneous_load: "low",
        germane_load: "high",
        new_concepts_count: 3,
        concurrent_concepts: 4,
        recommendation:
          "Integration phase is demanding but breaks and peer discussion help manage load.",
      },
    ],
    overall_balance: "optimal",
    warnings: [],
  },
  pacing_strategy: {
    recommended_schedule: "2 sessions per week, 4 hours each, over 1 week",
    spaced_repetition_points: [
      "Review Module 1 concepts at start of Module 2",
      "Quick recap of Module 1-2 at start of Module 3",
    ],
    break_pattern: "5-min break every 25-30 minutes of active learning",
  },
}
