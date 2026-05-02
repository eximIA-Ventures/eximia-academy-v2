/**
 * Pure scoring functions for personality assessments.
 * These are extracted to a separate file so they can be tested
 * without importing server actions.
 */

interface BigFiveItem {
  id: number
  text: string
  dimension: string
  reversed: boolean
}

export const IPIP_NEO_20_ITEMS: BigFiveItem[] = [
  { id: 1, text: "Sou a alma da festa", dimension: "extraversion", reversed: false },
  { id: 2, text: "Não falo muito", dimension: "extraversion", reversed: true },
  { id: 3, text: "Me sinto confortável perto de pessoas", dimension: "extraversion", reversed: false },
  { id: 4, text: "Fico em segundo plano", dimension: "extraversion", reversed: true },
  { id: 5, text: "Me interesso pelos problemas dos outros", dimension: "agreeableness", reversed: false },
  { id: 6, text: "Me interesso pouco pelos outros", dimension: "agreeableness", reversed: true },
  { id: 7, text: "Tenho um coração mole", dimension: "agreeableness", reversed: false },
  { id: 8, text: "Não me interesso muito pelos outros", dimension: "agreeableness", reversed: true },
  { id: 9, text: "Estou sempre preparado", dimension: "conscientiousness", reversed: false },
  { id: 10, text: "Deixo minhas coisas largadas", dimension: "conscientiousness", reversed: true },
  { id: 11, text: "Presto atenção nos detalhes", dimension: "conscientiousness", reversed: false },
  { id: 12, text: "Faço bagunça nas coisas", dimension: "conscientiousness", reversed: true },
  { id: 13, text: "Fico estressado facilmente", dimension: "neuroticism", reversed: false },
  { id: 14, text: "Sou relaxado na maior parte do tempo", dimension: "neuroticism", reversed: true },
  { id: 15, text: "Me preocupo com as coisas", dimension: "neuroticism", reversed: false },
  { id: 16, text: "Raramente me sinto triste", dimension: "neuroticism", reversed: true },
  { id: 17, text: "Tenho uma imaginação rica", dimension: "openness", reversed: false },
  { id: 18, text: "Não tenho muita imaginação", dimension: "openness", reversed: true },
  { id: 19, text: "Tenho ideias excelentes", dimension: "openness", reversed: false },
  { id: 20, text: "Não me interesso por ideias abstratas", dimension: "openness", reversed: true },
]

export interface BigFiveResult {
  openness: number
  conscientiousness: number
  extraversion: number
  agreeableness: number
  neuroticism: number
}

export function scoreBigFive(answers: Record<number | string, number>): BigFiveResult {
  const computeAvg = (dim: string): number => {
    const items = IPIP_NEO_20_ITEMS.filter((i) => i.dimension === dim)
    const scores = items.map((item) => {
      const raw = answers[item.id]
      if (raw === undefined) return 3 // neutral default
      const clamped = Math.max(1, Math.min(5, raw))
      return item.reversed ? 6 - clamped : clamped
    })
    return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
  }

  return {
    openness: computeAvg("openness"),
    conscientiousness: computeAvg("conscientiousness"),
    extraversion: computeAvg("extraversion"),
    agreeableness: computeAvg("agreeableness"),
    neuroticism: computeAvg("neuroticism"),
  }
}

export interface EnneagramResult {
  type: number
  wing?: number
  scores: number[]
}

export function scoreEnneagram(ranking: number[]): EnneagramResult {
  if (ranking.length < 2) {
    throw new Error("Ranking array must have at least 2 elements")
  }
  const type = ranking[0]
  const adjacents = [type === 1 ? 9 : type - 1, type === 9 ? 1 : type + 1]
  const wing = adjacents.reduce((best, adj) =>
    ranking.indexOf(adj) < ranking.indexOf(best) ? adj : best,
  )
  // Type-indexed scores: scores[typeNumber - 1] = score for that type
  const scores = new Array(9).fill(0) as number[]
  ranking.forEach((typeNum, i) => { scores[typeNum - 1] = 9 - i })
  return { type, wing, scores }
}

// ─── DISC ───────────────────────────────────────────────────────────────

export interface DISCItem {
  id: number
  a: { text: string; dimension: "D" | "I" | "S" | "C" }
  b: { text: string; dimension: "D" | "I" | "S" | "C" }
}

export const DISC_ITEMS: DISCItem[] = [
  { id: 1, a: { text: "Gosto de assumir o controle das situações", dimension: "D" }, b: { text: "Prefiro colaborar e apoiar os outros", dimension: "S" } },
  { id: 2, a: { text: "Sou entusiasta e otimista", dimension: "I" }, b: { text: "Sou meticuloso e analítico", dimension: "C" } },
  { id: 3, a: { text: "Busco resultados rápidos e diretos", dimension: "D" }, b: { text: "Valorizo relacionamentos e harmonia", dimension: "I" } },
  { id: 4, a: { text: "Sou paciente e bom ouvinte", dimension: "S" }, b: { text: "Sou preciso e detalhista", dimension: "C" } },
  { id: 5, a: { text: "Tomo decisões rápidas e firmes", dimension: "D" }, b: { text: "Analiso todos os dados antes de decidir", dimension: "C" } },
  { id: 6, a: { text: "Gosto de convencer e influenciar pessoas", dimension: "I" }, b: { text: "Prefiro manter a estabilidade e rotina", dimension: "S" } },
  { id: 7, a: { text: "Aceito desafios com confiança", dimension: "D" }, b: { text: "Inspiro e motivo os outros com entusiasmo", dimension: "I" } },
  { id: 8, a: { text: "Sou leal e consistente no meu trabalho", dimension: "S" }, b: { text: "Sigo regras e procedimentos rigorosamente", dimension: "C" } },
  { id: 9, a: { text: "Sou competitivo e orientado a metas", dimension: "D" }, b: { text: "Sou cooperativo e busco consenso", dimension: "S" } },
  { id: 10, a: { text: "Gosto de socializar e conhecer pessoas novas", dimension: "I" }, b: { text: "Prefiro trabalhar com fatos e lógica", dimension: "C" } },
  { id: 11, a: { text: "Sou determinado e persistente", dimension: "D" }, b: { text: "Sou criativo e expressivo na comunicação", dimension: "I" } },
  { id: 12, a: { text: "Valorizo previsibilidade e segurança", dimension: "S" }, b: { text: "Busco qualidade e excelência nos detalhes", dimension: "C" } },
  { id: 13, a: { text: "Prefiro liderar e delegar tarefas", dimension: "D" }, b: { text: "Prefiro seguir instruções claras", dimension: "C" } },
  { id: 14, a: { text: "Sou expressivo e gosto de falar em público", dimension: "I" }, b: { text: "Sou reservado e prefiro ouvir", dimension: "S" } },
  { id: 15, a: { text: "Gosto de resolver problemas difíceis", dimension: "D" }, b: { text: "Gosto de ajudar os outros a se sentirem bem", dimension: "I" } },
  { id: 16, a: { text: "Sou calmo e ponderado sob pressão", dimension: "S" }, b: { text: "Sou cuidadoso e verifico tudo duas vezes", dimension: "C" } },
  { id: 17, a: { text: "Sou assertivo e direto ao ponto", dimension: "D" }, b: { text: "Sou diplomático e atencioso", dimension: "S" } },
  { id: 18, a: { text: "Gosto de ambientes animados e dinâmicos", dimension: "I" }, b: { text: "Prefiro ambientes organizados e estruturados", dimension: "C" } },
  { id: 19, a: { text: "Assumo riscos calculados para avançar", dimension: "D" }, b: { text: "Evito riscos e prefiro o caminho seguro", dimension: "S" } },
  { id: 20, a: { text: "Sou persuasivo e comunicativo", dimension: "I" }, b: { text: "Sou sistemático e organizado", dimension: "C" } },
  { id: 21, a: { text: "Foco em resultados acima de tudo", dimension: "D" }, b: { text: "Foco em pessoas e relacionamentos", dimension: "I" } },
  { id: 22, a: { text: "Sou confiável e previsível", dimension: "S" }, b: { text: "Sou criterioso e exigente com qualidade", dimension: "C" } },
  { id: 23, a: { text: "Gosto de mudar e inovar processos", dimension: "D" }, b: { text: "Gosto de celebrar conquistas em equipe", dimension: "I" } },
  { id: 24, a: { text: "Sou pacificador e evito conflitos", dimension: "S" }, b: { text: "Sou objetivo e baseado em evidências", dimension: "C" } },
  { id: 25, a: { text: "Sou impaciente com resultados lentos", dimension: "D" }, b: { text: "Sou paciente e dou tempo para as coisas acontecerem", dimension: "S" } },
  { id: 26, a: { text: "Gosto de trabalhar em equipe animada", dimension: "I" }, b: { text: "Prefiro trabalhar sozinho com concentração", dimension: "C" } },
  { id: 27, a: { text: "Priorizo eficiência e velocidade", dimension: "D" }, b: { text: "Priorizo precisão e conformidade", dimension: "C" } },
  { id: 28, a: { text: "Sou otimista e vejo oportunidades", dimension: "I" }, b: { text: "Sou realista e vejo riscos potenciais", dimension: "S" } },
]

export interface DISCResult {
  d: number
  i: number
  s: number
  c: number
}

/** Scores DISC from forced-choice answers. answers[itemId] = "a" | "b" */
export function scoreDISC(answers: Record<number | string, "a" | "b">): DISCResult {
  const counts = { D: 0, I: 0, S: 0, C: 0 }

  for (const [id, choice] of Object.entries(answers)) {
    const item = DISC_ITEMS.find((it) => it.id === Number(id))
    if (!item) continue
    if (choice !== "a" && choice !== "b") continue
    const chosen = choice === "a" ? item.a : item.b
    counts[chosen.dimension]++
  }

  const matched = counts.D + counts.I + counts.S + counts.C
  if (matched === 0) {
    return { d: 0, i: 0, s: 0, c: 0 }
  }

  // Largest-remainder rounding to guarantee sum = 100
  const rawPcts = [
    { key: "d" as const, val: (counts.D / matched) * 100 },
    { key: "i" as const, val: (counts.I / matched) * 100 },
    { key: "s" as const, val: (counts.S / matched) * 100 },
    { key: "c" as const, val: (counts.C / matched) * 100 },
  ]
  const floored = rawPcts.map((p) => ({ ...p, floor: Math.floor(p.val), remainder: p.val - Math.floor(p.val) }))
  let remaining = 100 - floored.reduce((sum, p) => sum + p.floor, 0)
  floored.sort((a, b) => b.remainder - a.remainder)
  for (const p of floored) {
    if (remaining > 0) { p.floor++; remaining-- }
  }

  const result = { d: 0, i: 0, s: 0, c: 0 }
  for (const p of floored) { result[p.key] = p.floor }
  return result
}

// ─── Multiple Intelligences (Gardner) ───────────────────────────────────

export interface MultipleIntelligencesItem {
  id: number
  text: string
  intelligence: string
}

export const MULTIPLE_INTELLIGENCES_ITEMS: MultipleIntelligencesItem[] = [
  // Linguistic (5 items)
  { id: 1, text: "Gosto de ler livros, artigos e textos diversos", intelligence: "linguistic" },
  { id: 2, text: "Escrever me ajuda a organizar meus pensamentos", intelligence: "linguistic" },
  { id: 3, text: "Tenho facilidade com palavras e jogos de linguagem", intelligence: "linguistic" },
  { id: 4, text: "Gosto de contar histórias e explicar ideias verbalmente", intelligence: "linguistic" },
  { id: 5, text: "Aprendo bem ouvindo palestras e lendo textos", intelligence: "linguistic" },
  // Logical-Mathematical (5 items)
  { id: 6, text: "Gosto de resolver problemas lógicos e puzzles", intelligence: "logical" },
  { id: 7, text: "Penso em termos de causa e efeito", intelligence: "logical" },
  { id: 8, text: "Números e estatísticas me interessam", intelligence: "logical" },
  { id: 9, text: "Gosto de categorizar e classificar informações", intelligence: "logical" },
  { id: 10, text: "Procuro padrões e regularidades nos dados", intelligence: "logical" },
  // Spatial (5 items)
  { id: 11, text: "Penso em imagens e consigo visualizar conceitos", intelligence: "spatial" },
  { id: 12, text: "Tenho boa orientação espacial e senso de direção", intelligence: "spatial" },
  { id: 13, text: "Gosto de desenhar, pintar ou criar visualizações", intelligence: "spatial" },
  { id: 14, text: "Mapas e diagramas me ajudam a entender melhor", intelligence: "spatial" },
  { id: 15, text: "Consigo imaginar objetos 3D e rota-los mentalmente", intelligence: "spatial" },
  // Musical (5 items)
  { id: 16, text: "Percebo facilmente ritmos e melodias", intelligence: "musical" },
  { id: 17, text: "Música me ajuda a concentrar ou estudar", intelligence: "musical" },
  { id: 18, text: "Consigo lembrar melodias e canções com facilidade", intelligence: "musical" },
  { id: 19, text: "Percebo quando alguem canta ou toca fora do tom", intelligence: "musical" },
  { id: 20, text: "Gosto de criar ou improvisar músicas", intelligence: "musical" },
  // Bodily-Kinesthetic (5 items)
  { id: 21, text: "Aprendo melhor fazendo e praticando", intelligence: "kinesthetic" },
  { id: 22, text: "Tenho boa coordenação motora", intelligence: "kinesthetic" },
  { id: 23, text: "Gosto de atividades fisicas e esportes", intelligence: "kinesthetic" },
  { id: 24, text: "Uso gestos e linguagem corporal ao me comunicar", intelligence: "kinesthetic" },
  { id: 25, text: "Prefiro aprender com as mãos — montar, construir, experimentar", intelligence: "kinesthetic" },
  // Interpersonal (5 items)
  { id: 26, text: "Entendo bem as emoções e intenções dos outros", intelligence: "interpersonal" },
  { id: 27, text: "Gosto de trabalhar em grupo e colaborar", intelligence: "interpersonal" },
  { id: 28, text: "As pessoas me procuram para pedir conselhos", intelligence: "interpersonal" },
  { id: 29, text: "Consigo mediar conflitos entre pessoas", intelligence: "interpersonal" },
  { id: 30, text: "Me adapto facilmente a diferentes grupos sociais", intelligence: "interpersonal" },
  // Intrapersonal (5 items)
  { id: 31, text: "Conheço bem minhas forças e fraquezas", intelligence: "intrapersonal" },
  { id: 32, text: "Gosto de refletir sobre meus sentimentos e motivações", intelligence: "intrapersonal" },
  { id: 33, text: "Tenho objetivos claros e sei o que quero", intelligence: "intrapersonal" },
  { id: 34, text: "Prefiro estudar sozinho no meu ritmo", intelligence: "intrapersonal" },
  { id: 35, text: "Entendo minhas reações emocionais e consigo gerenciá-las", intelligence: "intrapersonal" },
  // Naturalist (5 items)
  { id: 36, text: "Percebo padrões na natureza e no ambiente", intelligence: "naturalist" },
  { id: 37, text: "Gosto de classificar e organizar elementos naturais", intelligence: "naturalist" },
  { id: 38, text: "Me sinto conectado com o meio ambiente", intelligence: "naturalist" },
  { id: 39, text: "Tenho interesse em plantas, animais ou fenômenos naturais", intelligence: "naturalist" },
  { id: 40, text: "Percebo mudanças sutis no clima, estações ou paisagens", intelligence: "naturalist" },
]

export const INTELLIGENCE_LABELS: Record<string, string> = {
  linguistic: "Linguística",
  logical: "Lógico-Matemática",
  spatial: "Espacial",
  musical: "Musical",
  kinesthetic: "Corporal-Cinestésica",
  interpersonal: "Interpessoal",
  intrapersonal: "Intrapessoal",
  naturalist: "Naturalista",
}

export interface MultipleIntelligencesResult {
  linguistic: number
  logical: number
  spatial: number
  musical: number
  kinesthetic: number
  interpersonal: number
  intrapersonal: number
  naturalist: number
}

/** Scores 8 intelligences from Likert 1-5 answers. Returns average per intelligence. */
export function scoreMultipleIntelligences(answers: Record<number | string, number>): MultipleIntelligencesResult {
  const computeAvg = (intel: string): number => {
    const items = MULTIPLE_INTELLIGENCES_ITEMS.filter((i) => i.intelligence === intel)
    const scores = items.map((item) => {
      const raw = answers[item.id]
      if (raw === undefined) return 3 // neutral default
      return Math.max(1, Math.min(5, raw))
    })
    return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
  }

  return {
    linguistic: computeAvg("linguistic"),
    logical: computeAvg("logical"),
    spatial: computeAvg("spatial"),
    musical: computeAvg("musical"),
    kinesthetic: computeAvg("kinesthetic"),
    interpersonal: computeAvg("interpersonal"),
    intrapersonal: computeAvg("intrapersonal"),
    naturalist: computeAvg("naturalist"),
  }
}

// ─── Career Anchors (Schein) ────────────────────────────────────────────

export interface CareerAnchorsItem {
  id: number
  text: string
  anchor: string
}

export const CAREER_ANCHORS_ITEMS: CareerAnchorsItem[] = [
  // Technical/Functional Competence (5 items)
  { id: 1, text: "Me realizo quando me torno especialista em uma área técnica", anchor: "technical" },
  { id: 2, text: "Prefiro ser reconhecido pela minha competência técnica", anchor: "technical" },
  { id: 3, text: "Gosto de resolver problemas complexos da minha área", anchor: "technical" },
  { id: 4, text: "Ficaria insatisfeito se nao pudesse aprofundar minha expertise", anchor: "technical" },
  { id: 5, text: "Valorizo mais ser expert do que ser gerente", anchor: "technical" },
  // General Management (5 items)
  { id: 6, text: "Quero chegar a uma posição de liderança geral", anchor: "management" },
  { id: 7, text: "Gosto de coordenar e integrar o trabalho de outros", anchor: "management" },
  { id: 8, text: "Me motiva ter responsabilidade por resultados amplos", anchor: "management" },
  { id: 9, text: "Quero tomar decisões que impactam toda a organização", anchor: "management" },
  { id: 10, text: "Gosto de lidar com problemas complexos e multifuncionais", anchor: "management" },
  // Autonomy/Independence (5 items)
  { id: 11, text: "Preciso de liberdade para definir meu próprio ritmo de trabalho", anchor: "autonomy" },
  { id: 12, text: "Me incomodo com regras e restrições excessivas", anchor: "autonomy" },
  { id: 13, text: "Prefiro trabalhar de forma independente", anchor: "autonomy" },
  { id: 14, text: "Escolheria autonomia em vez de um salario maior", anchor: "autonomy" },
  { id: 15, text: "Me sinto melhor quando posso fazer as coisas do meu jeito", anchor: "autonomy" },
  // Security/Stability (5 items)
  { id: 16, text: "Valorizo previsibilidade e estabilidade no emprego", anchor: "security" },
  { id: 17, text: "Um bom plano de aposentadoria é importante para mim", anchor: "security" },
  { id: 18, text: "Prefiro trabalhar em organizações sólidas e estáveis", anchor: "security" },
  { id: 19, text: "Segurança financeira é uma prioridade na minha carreira", anchor: "security" },
  { id: 20, text: "Evitaria mudar de emprego se isso comprometesse minha estabilidade", anchor: "security" },
  // Entrepreneurial Creativity (5 items)
  { id: 21, text: "Sonho em criar meu próprio negócio", anchor: "entrepreneurship" },
  { id: 22, text: "Gosto de inventar coisas novas e inovar", anchor: "entrepreneurship" },
  { id: 23, text: "Me motiva construir algo que seja totalmente meu", anchor: "entrepreneurship" },
  { id: 24, text: "Estou disposto a correr riscos para criar algo novo", anchor: "entrepreneurship" },
  { id: 25, text: "Tenho varias ideias de projetos e empreendimentos", anchor: "entrepreneurship" },
  // Service/Dedication to a Cause (5 items)
  { id: 26, text: "Quero que meu trabalho contribua para um mundo melhor", anchor: "service" },
  { id: 27, text: "Me realizo ajudando outros a se desenvolverem", anchor: "service" },
  { id: 28, text: "Escolheria um trabalho com propósito mesmo ganhando menos", anchor: "service" },
  { id: 29, text: "Me importo com o impacto social do meu trabalho", anchor: "service" },
  { id: 30, text: "Gosto de trabalhar em causas que considero importantes", anchor: "service" },
  // Pure Challenge (5 items)
  { id: 31, text: "Busco situações cada vez mais desafiadoras", anchor: "challenge" },
  { id: 32, text: "Me motivo quando enfrento problemas aparentemente impossíveis", anchor: "challenge" },
  { id: 33, text: "A competição me energiza e me faz dar o melhor", anchor: "challenge" },
  { id: 34, text: "Ficaria entediado em um trabalho fácil e rotineiro", anchor: "challenge" },
  { id: 35, text: "Gosto de testar meus limites e superar obstáculos", anchor: "challenge" },
  // Lifestyle (5 items)
  { id: 36, text: "Equilibrio entre vida pessoal e trabalho e essencial", anchor: "lifestyle" },
  { id: 37, text: "Recusaria uma promoção se prejudicasse minha qualidade de vida", anchor: "lifestyle" },
  { id: 38, text: "Quero flexibilidade para conciliar trabalho e família", anchor: "lifestyle" },
  { id: 39, text: "Minha carreira deve se integrar harmoniosamente à minha vida", anchor: "lifestyle" },
  { id: 40, text: "Valorizo organizações que respeitam o tempo pessoal", anchor: "lifestyle" },
]

export const ANCHOR_LABELS: Record<string, string> = {
  technical: "Competência Técnica",
  management: "Gestão Geral",
  autonomy: "Autonomia",
  security: "Segurança/Estabilidade",
  entrepreneurship: "Criatividade Empreendedora",
  service: "Serviço/Dedicação",
  challenge: "Desafio Puro",
  lifestyle: "Estilo de Vida",
}

export interface CareerAnchorsResult {
  technical: number
  management: number
  autonomy: number
  security: number
  entrepreneurship: number
  service: number
  challenge: number
  lifestyle: number
  top3: string[]
}

/** Scores 8 career anchors from Likert 1-6 answers. Returns average per anchor + top 3. */
export function scoreCareerAnchors(answers: Record<number | string, number>): CareerAnchorsResult {
  const anchorKeys = ["technical", "management", "autonomy", "security", "entrepreneurship", "service", "challenge", "lifestyle"] as const
  const computeAvg = (anchor: string): number => {
    const items = CAREER_ANCHORS_ITEMS.filter((i) => i.anchor === anchor)
    const scores = items.map((item) => {
      const raw = answers[item.id]
      if (raw === undefined) return 3.5 // true midpoint of 1-6 scale
      return Math.max(1, Math.min(6, raw))
    })
    return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
  }

  const result: Record<string, number> = {}
  for (const anchor of anchorKeys) {
    result[anchor] = computeAvg(anchor)
  }

  const sorted = [...anchorKeys].sort((a, b) => result[b] - result[a])
  const top3 = sorted.slice(0, 3) as string[]

  return {
    technical: result.technical,
    management: result.management,
    autonomy: result.autonomy,
    security: result.security,
    entrepreneurship: result.entrepreneurship,
    service: result.service,
    challenge: result.challenge,
    lifestyle: result.lifestyle,
    top3,
  }
}
