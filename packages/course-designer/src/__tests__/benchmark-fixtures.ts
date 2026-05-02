/**
 * Benchmark fixtures — Reference inputs for quality validation (Story 24.3)
 */

import type { PartialBriefInput } from "../schemas/input"

export const leadershipFixture: PartialBriefInput = {
  course_title: "Liderança Transformacional para Gestores",
  business_goal: "Aumentar em 40% o índice de engajamento das equipes lideradas pelos participantes",
  behavior_change: "Aplicar técnicas de liderança situacional e coaching no dia a dia da gestão",
  success_metrics: [
    "Engajamento +40% (eNPS)",
    "Turnover reduzido em 15%",
    "NPS do treinamento > 8.5",
  ],
  problem_statement: "Gestores recém-promovidos não possuem ferramentas de liderança e dependem de comando-e-controle",
  target_audience: {
    role: "Gerente / Coordenador",
    experience_level: "intermediario" as const,
    prior_knowledge: ["Gestão básica de pessoas", "Feedback"],
    group_size: 25,
    motivation_context: "Programa de desenvolvimento de líderes obrigatório",
  },
  core_competencies: [
    "Liderança Situacional",
    "Coaching e Mentoring",
    "Comunicação Assertiva",
    "Gestão de Conflitos",
    "Delegação Eficaz",
  ],
  topics_outline: [
    "Estilos de Liderança",
    "Coaching na Prática",
    "Comunicação e Feedback",
    "Gestão de Conflitos",
    "Delegação e Empowerment",
  ],
  total_duration_hours: 8,
  constraints: {
    weeks: 4,
    hours_per_week: 2,
    delivery_mode: "blended" as const,
    cohort_based: true,
  },
  framework: "elc_plus" as const,
  interaction_strategy: "bloom_mapped" as const,
  language: "pt-br" as const,
}

export const programmingFixture: PartialBriefInput = {
  course_title: "Fundamentos de Programação Python para Analistas",
  business_goal: "Reduzir em 60% o tempo de análise de dados manuais migrando para scripts Python",
  behavior_change: "Criar scripts de automação e análise de dados usando Python no contexto de trabalho",
  success_metrics: [
    "Tempo de análise -60%",
    "Ao menos 3 scripts criados por participante",
    "Certificação interna aprovada",
  ],
  problem_statement: "Analistas gastam 70% do tempo em tarefas manuais no Excel que poderiam ser automatizadas",
  target_audience: {
    role: "Analista de Dados / Business Analyst",
    experience_level: "iniciante" as const,
    prior_knowledge: ["Excel avançado"],
    group_size: 40,
    motivation_context: "Transformação digital da área — migração de Excel para Python",
  },
  core_competencies: [
    "Variáveis e Tipos de Dados",
    "Estruturas de Controle",
    "Funções e Módulos",
    "Manipulação de Arquivos",
    "Pandas para Análise de Dados",
    "Visualização com Matplotlib",
    "Automação de Tarefas",
  ],
  topics_outline: [
    "Introdução ao Python",
    "Variáveis, Tipos e Operadores",
    "Condicionais e Loops",
    "Funções",
    "Manipulação de Dados com Pandas",
    "Visualização de Dados",
    "Projeto Final: Automação",
  ],
  total_duration_hours: 20,
  constraints: {
    weeks: 10,
    hours_per_week: 2,
    delivery_mode: "online_sync" as const,
    cohort_based: true,
  },
  framework: "kolb_4" as const,
  interaction_strategy: "bloom_mapped" as const,
  language: "pt-br" as const,
}

export const problemSolvingFixture: PartialBriefInput = {
  course_title: "Resolução de Problemas Complexos para Líderes Seniores",
  business_goal: "Melhorar em 35% a taxa de resolução de problemas cross-funcionais no primeiro ciclo",
  behavior_change: "Aplicar frameworks estruturados de resolução de problemas e tomar decisões baseadas em evidências",
  success_metrics: [
    "Taxa de resolução no 1o ciclo +35%",
    "Satisfação stakeholders > 8",
    "Casos resolvidos documentados ≥ 2 por participante",
  ],
  problem_statement: "Problemas complexos são escalados sem análise estruturada, gerando retrabalho e atrasos",
  target_audience: {
    role: "Diretor / Gerente Sênior",
    experience_level: "avancado" as const,
    prior_knowledge: ["Gestão de projetos", "Lean Six Sigma", "Pensamento sistêmico"],
    group_size: 15,
    motivation_context: "Programa de alta performance para líderes seniores",
  },
  core_competencies: [
    "Análise de Causa Raiz (5 Porquês, Ishikawa)",
    "Frameworks de Decisão (Cynefin, OODA)",
    "Pensamento Sistêmico",
    "Trade-off Analysis",
    "Facilitação de Resolução de Problemas",
  ],
  topics_outline: [
    "Tipos de Problemas: Simples, Complicados, Complexos",
    "Ferramentas de Análise de Causa Raiz",
    "Frameworks de Decisão",
    "Pensamento Sistêmico Aplicado",
    "Facilitação e Tomada de Decisão em Grupo",
  ],
  total_duration_hours: 12,
  constraints: {
    weeks: 6,
    hours_per_week: 2,
    delivery_mode: "blended" as const,
    cohort_based: true,
  },
  framework: "pbl_hmelo" as const,
  interaction_strategy: "bloom_mapped" as const,
  language: "pt-br" as const,
}
