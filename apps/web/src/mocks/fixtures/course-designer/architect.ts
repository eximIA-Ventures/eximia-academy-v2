import type { ArchitectOutput } from "@eximia/course-designer"

export const courseArchitectFixture: ArchitectOutput = {
  course_structure: {
    total_modules: 3,
    primary_framework: "elc_plus",
    complementary_frameworks: ["kolb_4"],
    bloom_progression: ["understanding", "applying", "analyzing"],
    spiral_levels: ["fundamentos", "variacao", "conflito_humano"],
  },
  modules: [
    {
      order: 1,
      title: "Fundamentos e Contexto",
      description: "Introducao aos conceitos fundamentais e enquadramento do domínio.",
      spiral_level: "fundamentos",
      objectives: [
        {
          text: "O participante será capaz de identificar os conceitos-chave do domínio.",
          bloom_level: "understanding",
          abcd: {
            audience: "O participante",
            behavior: "identificar os conceitos-chave",
            condition: "Dado um cenario introdutorio",
            degree: "com 80% de acuracia",
          },
        },
        {
          text: "O participante será capaz de descrever as relacoes entre os conceitos.",
          bloom_level: "understanding",
          abcd: {
            audience: "O participante",
            behavior: "descrever as relacoes",
            condition: "A partir de um mapa conceitual",
            degree: "cobrindo pelo menos 3 relacoes",
          },
        },
        {
          text: "O participante será capaz de explicar a importancia prática do domínio.",
          bloom_level: "understanding",
          abcd: {
            audience: "O participante",
            behavior: "explicar a importancia pratica",
            condition: "Em contexto corporativo",
            degree: "com exemplos relevantes",
          },
        },
      ],
      assessments: [
        {
          type: "diagnostic",
          method: "quiz",
          description: "Quiz de verificacao de conhecimentos previos.",
          alignment: "Objetivo 1",
          kirkpatrick_level: "L2",
        },
        {
          type: "formative",
          method: "reflection",
          description: "Reflexao sobre conexoes entre conceitos.",
          alignment: "Objetivo 2",
          kirkpatrick_level: "L1",
        },
        {
          type: "formative",
          method: "self_assessment",
          description: "Autoavaliacao sobre relevancia pratica.",
          alignment: "Objetivo 3",
          kirkpatrick_level: "L1",
        },
      ],
      framework_stages: [
        {
          key: "engage",
          name: "Engajamento",
          percentage: 15,
          activities: ["Discussão sobre experiencias previas"],
        },
        {
          key: "explore",
          name: "Exploracao",
          percentage: 30,
          activities: ["Leitura dirigida", "Mapa conceitual"],
        },
        {
          key: "explain",
          name: "Explicacao",
          percentage: 25,
          activities: ["Video-aula", "Exemplo trabalhado"],
        },
        {
          key: "elaborate",
          name: "Elaboracao",
          percentage: 20,
          activities: ["Exercicio pratico guiado"],
        },
        {
          key: "evaluate",
          name: "Avaliacao",
          percentage: 10,
          activities: ["Quiz de verificacao"],
        },
      ],
      problema_motor: {
        description:
          "Como um novo colaborador pode navegar a complexidade do domínio sem experiencia previa?",
        pressure: 2,
        ambiguity: 2,
        stakes: 2,
        tension_score: 8,
      },
      rubrics: null,
      interaction_type: "socratic_dialogue",
    },
    {
      order: 2,
      title: "Aplicacao Pratica",
      description: "Aplicacao dos conceitos em cenarios simulados.",
      spiral_level: "variacao",
      objectives: [
        {
          text: "O participante será capaz de aplicar os conceitos em cenarios simulados.",
          bloom_level: "applying",
          abcd: {
            audience: "O participante",
            behavior: "aplicar os conceitos",
            condition: "Em cenarios simulados",
            degree: "resolvendo 3 de 4 casos",
          },
        },
        {
          text: "O participante será capaz de selecionar a abordagem adequada para cada situacao.",
          bloom_level: "applying",
          abcd: {
            audience: "O participante",
            behavior: "selecionar a abordagem adequada",
            condition: "Dado multiplos cenarios",
            degree: "com justificativa fundamentada",
          },
        },
        {
          text: "O participante será capaz de demonstrar o uso correto das ferramentas.",
          bloom_level: "applying",
          abcd: {
            audience: "O participante",
            behavior: "demonstrar o uso correto",
            condition: "Em ambiente de pratica",
            degree: "completando todas as etapas",
          },
        },
      ],
      assessments: [
        {
          type: "formative",
          method: "case_study",
          description: "Estudo de caso com cenario de aplicacao.",
          alignment: "Objetivo 1",
          kirkpatrick_level: "L2",
        },
        {
          type: "formative",
          method: "peer_review",
          description: "Revisão por pares da solucao proposta.",
          alignment: "Objetivo 2",
          kirkpatrick_level: "L2",
        },
        {
          type: "summative",
          method: "simulation",
          description: "Simulacao prática com rubrica.",
          alignment: "Objetivo 3",
          kirkpatrick_level: "L3",
        },
      ],
      framework_stages: [
        {
          key: "engage",
          name: "Engajamento",
          percentage: 10,
          activities: ["Desafio pratico introdutorio"],
        },
        {
          key: "explore",
          name: "Exploracao",
          percentage: 25,
          activities: ["Estudo de caso"],
        },
        {
          key: "explain",
          name: "Explicacao",
          percentage: 20,
          activities: ["Demonstracao ao vivo"],
        },
        {
          key: "elaborate",
          name: "Elaboracao",
          percentage: 30,
          activities: ["Pratica guiada", "Resolucao de problemas"],
        },
        {
          key: "evaluate",
          name: "Avaliacao",
          percentage: 15,
          activities: ["Simulacao avaliativa"],
        },
      ],
      problema_motor: {
        description: "O que acontece quando a teoria nao funciona na pratica? Como adaptar?",
        pressure: 3,
        ambiguity: 3,
        stakes: 3,
        tension_score: 27,
      },
      rubrics: null,
      interaction_type: "socratic_dialogue",
    },
    {
      order: 3,
      title: "Análise e Integracao",
      description: "Análise critica e integracao dos aprendizados.",
      spiral_level: "conflito_humano",
      objectives: [
        {
          text: "O participante será capaz de analisar cenarios complexos identificando padroes.",
          bloom_level: "analyzing",
          abcd: {
            audience: "O participante",
            behavior: "analisar cenarios complexos",
            condition: "Dado dados reais do negocio",
            degree: "identificando pelo menos 3 padroes",
          },
        },
        {
          text: "O participante será capaz de comparar abordagens e justificar escolhas.",
          bloom_level: "analyzing",
          abcd: {
            audience: "O participante",
            behavior: "comparar abordagens",
            condition: "Em contexto de decisao",
            degree: "com argumentacao estruturada",
          },
        },
        {
          text: "O participante será capaz de propor melhorias baseadas na analise.",
          bloom_level: "analyzing",
          abcd: {
            audience: "O participante",
            behavior: "propor melhorias",
            condition: "A partir dos resultados da analise",
            degree: "com plano de acao viavel",
          },
        },
      ],
      assessments: [
        {
          type: "summative",
          method: "project",
          description: "Projeto final com análise de cenario real.",
          alignment: "Objetivo 1",
          kirkpatrick_level: "L3",
        },
        {
          type: "formative",
          method: "rubric",
          description: "Avaliacao por rubrica da argumentacao.",
          alignment: "Objetivo 2",
          kirkpatrick_level: "L2",
        },
        {
          type: "summative",
          method: "portfolio",
          description: "Portfolio com propostas de melhoria.",
          alignment: "Objetivo 3",
          kirkpatrick_level: "L4",
        },
      ],
      framework_stages: [
        {
          key: "engage",
          name: "Engajamento",
          percentage: 10,
          activities: ["Provocacao com problema real"],
        },
        {
          key: "explore",
          name: "Exploracao",
          percentage: 20,
          activities: ["Análise de dados reais"],
        },
        {
          key: "explain",
          name: "Explicacao",
          percentage: 15,
          activities: ["Frameworks de analise"],
        },
        {
          key: "elaborate",
          name: "Elaboracao",
          percentage: 35,
          activities: ["Projeto integrador", "Discussão em grupo"],
        },
        {
          key: "evaluate",
          name: "Avaliacao",
          percentage: 20,
          activities: ["Apresentacao e defesa do projeto"],
        },
      ],
      problema_motor: {
        description: "Como lidar quando stakeholders divergem sobre a melhor abordagem?",
        pressure: 4,
        ambiguity: 4,
        stakes: 4,
        tension_score: 64,
      },
      rubrics: null,
      interaction_type: "socratic_dialogue",
    },
  ],
  assessment_strategy: {
    formative_count: 5,
    summative_count: 3,
    diagnostic_count: 1,
    overall_approach: "Backward design with progressive complexity and varied assessment methods.",
    kirkpatrick_coverage: { L1: true, L2: true, L3: true, L4: true },
  },
}
