/**
 * Kolb Learning Style Inventory (KLSI) — 12 situations × 4 learning modes
 * Each situation has 4 completion options mapped to:
 * CE (Concrete Experience), RO (Reflective Observation),
 * AC (Abstract Conceptualization), AE (Active Experimentation)
 */

export interface KolbItem {
  id: number
  situation: string
  options: {
    ce: string
    ro: string
    ac: string
    ae: string
  }
}

export const KOLB_ITEMS: KolbItem[] = [
  {
    id: 1,
    situation: "Quando aprendo algo novo, eu prefiro...",
    options: {
      ce: "Vivenciar e experimentar na prática",
      ro: "Observar e refletir antes de agir",
      ac: "Entender a teoria e os conceitos por trás",
      ae: "Testar e ver o que funciona",
    },
  },
  {
    id: 2,
    situation: "Diante de um problema no trabalho, eu costumo...",
    options: {
      ce: "Confiar na minha intuição e sentimentos",
      ro: "Analisar cuidadosamente todas as perspectivas",
      ac: "Buscar um modelo ou framework lógico",
      ae: "Agir rapidamente e ajustar no caminho",
    },
  },
  {
    id: 3,
    situation: "Em uma reunião de equipe, meu papel natural é...",
    options: {
      ce: "Conectar pessoas e facilitar o diálogo",
      ro: "Ouvir atentamente e fazer perguntas",
      ac: "Estruturar a discussão com dados e lógica",
      ae: "Propor ações concretas e próximos passos",
    },
  },
  {
    id: 4,
    situation: "Quando recebo feedback, eu...",
    options: {
      ce: "Sinto o impacto emocional primeiro",
      ro: "Reflito sobre o que foi dito com calma",
      ac: "Analiso a lógica e a fundamentação",
      ae: "Já penso em como aplicar as mudanças",
    },
  },
  {
    id: 5,
    situation: "Em um curso ou treinamento, eu aprendo melhor quando...",
    options: {
      ce: "Há atividades práticas e simulações",
      ro: "Posso observar exemplos e demonstrações",
      ac: "O conteúdo é bem estruturado e lógico",
      ae: "Posso experimentar e errar livremente",
    },
  },
  {
    id: 6,
    situation: "Ao tomar uma decisão importante, eu...",
    options: {
      ce: "Confio no que sinto ser certo",
      ro: "Considero múltiplos pontos de vista",
      ac: "Modelo cenários e analiso dados",
      ae: "Tomo a decisão e corrijo se necessário",
    },
  },
  {
    id: 7,
    situation: "Quando estou em um grupo de estudo, eu prefiro...",
    options: {
      ce: "Compartilhar experiências pessoais",
      ro: "Escutar e processar as ideias dos outros",
      ac: "Debater conceitos e teorias",
      ae: "Fazer exercícios e resolver problemas",
    },
  },
  {
    id: 8,
    situation: "Diante de uma mudança organizacional, eu...",
    options: {
      ce: "Me preocupo com como as pessoas serão afetadas",
      ro: "Observo como a mudança se desenrola antes de reagir",
      ac: "Avalio se a estratégia faz sentido logicamente",
      ae: "Abraço a mudança e busco oportunidades",
    },
  },
  {
    id: 9,
    situation: "Minha maior força como profissional é...",
    options: {
      ce: "Empatia e capacidade de me conectar",
      ro: "Capacidade de análise e reflexão",
      ac: "Pensamento estruturado e planejamento",
      ae: "Orientação para resultados e ação",
    },
  },
  {
    id: 10,
    situation: "Quando leio um livro técnico, eu...",
    options: {
      ce: "Busco exemplos reais e histórias",
      ro: "Faço anotações e destaco insights",
      ac: "Foco nos modelos e frameworks apresentados",
      ae: "Já penso em como aplicar no meu contexto",
    },
  },
  {
    id: 11,
    situation: "Em uma situação de conflito, eu...",
    options: {
      ce: "Busco entender os sentimentos envolvidos",
      ro: "Dou um passo atrás para ganhar perspectiva",
      ac: "Analiso a causa raiz do conflito",
      ae: "Proponho uma solução prática imediata",
    },
  },
  {
    id: 12,
    situation: "O que mais me motiva no aprendizado é...",
    options: {
      ce: "A conexão humana e as experiências vividas",
      ro: "O prazer de compreender algo profundamente",
      ac: "A elegância de um conceito bem formulado",
      ae: "O poder de transformar conhecimento em ação",
    },
  },
]

export const KOLB_MODES = {
  ce: { label: "Experiência Concreta", short: "EC", axis: "grasping", direction: 1 },
  ro: { label: "Observação Reflexiva", short: "OR", axis: "transforming", direction: -1 },
  ac: { label: "Conceituação Abstrata", short: "CA", axis: "grasping", direction: -1 },
  ae: { label: "Experimentação Ativa", short: "EA", axis: "transforming", direction: 1 },
} as const

export type KolbMode = keyof typeof KOLB_MODES
