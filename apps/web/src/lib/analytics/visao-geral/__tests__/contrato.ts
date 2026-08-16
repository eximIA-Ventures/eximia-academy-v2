// ---------------------------------------------------------------------------
// Contrato compartilhado dos testes de invariante da aba "Visão geral".
//
// NÃO é um arquivo de teste (vitest só coleta `*.test.ts`). É a régua:
// resolve a camada de dados, declara a forma da entrada sintética, e exporta
// os DETECTORES usados por I-7 e I-8.
//
// Regra de imutabilidade (INVARIANTES.md, rodapé): este material é a rubrica
// do gauntlet. Quem implementa a camada de dados NÃO reescreve o que o mede.
//
// Fonte dos literais: SPEC-FUNCIONAL.md §12, §32, §10.2, §2 Regra 2.
// Fonte da forma de saída: components/analytics/visao-geral/fixture.ts.
// ---------------------------------------------------------------------------

// ===========================================================================
// 1 — Resolução da camada de dados
// ===========================================================================

/**
 * Import DEFERIDO para runtime. Se `../index.ts` ainda não existir, o erro
 * aparece como falha de teste com mensagem explícita, e NÃO como crash de
 * transform do vite. Falhar aqui é o comportamento CORRETO enquanto a camada
 * não existir — criar stub para ficar verde é exatamente o defeito que estes
 * testes combatem.
 */
export async function carregarModulo(): Promise<Record<string, unknown>> {
  const caminho = "../index"
  try {
    const mod = (await import(/* @vite-ignore */ caminho)) as Record<string, unknown>
    return mod
  } catch (causa) {
    const detalhe = causa instanceof Error ? causa.message : String(causa)
    throw new Error(
      [
        "CONTRATO NÃO CUMPRIDO: apps/web/src/lib/analytics/visao-geral/index.ts não pôde ser importado.",
        "Este teste DEVE falhar enquanto a camada de dados não existir.",
        "NÃO crie stub para fazer passar — teste que passa antes da implementação é o defeito.",
        `Causa: ${detalhe}`,
      ].join(" "),
    )
  }
}

/**
 * Resolve um export por allowlist de nomes. A allowlist existe porque o nome
 * do símbolo é convenção, não comportamento; a forma da SAÍDA é que é o
 * contrato. Se nenhum nome bater, o erro lista o que o módulo realmente
 * exporta, para o diagnóstico ser de uma linha.
 */
export function resolverExport<T = unknown>(
  mod: Record<string, unknown>,
  papel: string,
  nomesAceitos: readonly string[],
): T {
  for (const nome of nomesAceitos) {
    const valor = mod[nome]
    if (typeof valor === "function") return valor as T
  }
  const disponiveis = Object.keys(mod).join(", ") || "(nenhum)"
  throw new Error(
    `CONTRATO NÃO CUMPRIDO: nenhum export para "${papel}". ` +
      `Aceitos: ${nomesAceitos.join(" | ")}. Encontrados em ../index: ${disponiveis}.`,
  )
}

export const NOMES_ENTRADA_PRINCIPAL = [
  "computeVisaoGeral",
  "montarVisaoGeral",
  "carregarVisaoGeral",
  "buildVisaoGeral",
  "visaoGeral",
] as const

export const NOMES_PLACAR = ["computePlacar", "computeBlocoPlacar", "montarPlacar"] as const

export const NOMES_CHAVE_DIA = [
  "utcDayKey",
  "chaveDiaUtc",
  "diaUtc",
  "toUtcDayKey",
  "chaveDeDia",
] as const

export const NOMES_RESPOSTA = [
  "computeResposta",
  "computeRespostaAcionamentos",
  "computeLoopStats",
  "montarResposta",
] as const

/** Aceita entrada síncrona ou assíncrona sem afrouxar a asserção da saída. */
export async function chamar<T>(fn: (...args: never[]) => unknown, ...args: unknown[]): Promise<T> {
  return (await Promise.resolve((fn as (...a: unknown[]) => unknown)(...args))) as T
}

// ===========================================================================
// 2 — Forma da entrada sintética
// ===========================================================================

export interface AlunoBruto {
  id: string
  nome: string
  iniciais?: string
}

export interface AtividadeBruta {
  studentId: string
  /** ISO. Imutável — é o carimbo confiável. */
  createdAt: string
  /** ISO. Mutável (sessão reusada faz bump só aqui). */
  updatedAt?: string | null
  tipo?: "sessao" | "reflexao" | "quiz" | "cenario" | "atividade"
  questionId?: string | null
  chapterId?: string | null
}

export interface AcionamentoBruto {
  recipientId: string
  /** ISO. */
  sentAt: string
  sentByManager?: string
}

export interface MatriculaBruta {
  studentId: string
  courseId: string
  status: "active" | "completed" | "cancelled"
  createdAt: string
  progressPercent: number
}

export interface CursoBruto {
  id: string
  deadlineDays: number | null
}

export interface EntradaVisaoGeral {
  agoraISO: string
  periodoDias: number
  gestorId: string
  /** Recorte: ids dos alunos sob o gestor. É o "mesmo universo" de I-5. */
  escopo: readonly string[]
  alunos: readonly AlunoBruto[]
  atividades: readonly AtividadeBruta[]
  acionamentos: readonly AcionamentoBruto[]
  matriculas: readonly MatriculaBruta[]
  cursos: readonly CursoBruto[]
}

export const AGORA_ISO = "2026-08-15T12:00:00.000Z"
export const AGORA_MS = Date.parse(AGORA_ISO)
export const DIA_MS = 86_400_000

export const diasAtras = (n: number, horaUtc = 10): string => {
  const base = new Date(AGORA_MS - n * DIA_MS)
  base.setUTCHours(horaUtc, 0, 0, 0)
  return base.toISOString()
}

/**
 * População base: 6 pessoas com padrões diferentes o bastante para que
 * qualquer métrica de taxa saia FORA de 0% e 100%. Uma fixture degenerada
 * (todo mundo igual) deixaria um teste de variância passar por acidente.
 */
export function entradaBase(): EntradaVisaoGeral {
  const alunos: AlunoBruto[] = [
    { id: "P1", nome: "Adriana Fontes", iniciais: "AF" },
    { id: "P2", nome: "Bruno Tavares", iniciais: "BT" },
    { id: "P3", nome: "Camila Rezende", iniciais: "CR" },
    { id: "P4", nome: "Diego Prado", iniciais: "DP" },
    { id: "P5", nome: "Elisa Moraes", iniciais: "EM" },
    { id: "P6", nome: "Venilton Amaral", iniciais: "VA" },
  ]

  const atividades: AtividadeBruta[] = [
    // P1 — regular nas 4 semanas da janela atual e nas 4 anteriores.
    ...regular("P1", 0, 56),
    // P2 — regular só na janela atual.
    ...regular("P2", 0, 28),
    // P3 — regular só na janela anterior; parou.
    ...regular("P3", 30, 56),
    // P4 — esporádico: 2 dias na janela atual.
    { studentId: "P4", createdAt: diasAtras(3), tipo: "sessao", questionId: "Q1" },
    { studentId: "P4", createdAt: diasAtras(12), tipo: "reflexao" },
    // P5 — parado há 20 dias (já iniciou).
    { studentId: "P5", createdAt: diasAtras(20), tipo: "sessao", questionId: "Q1" },
    { studentId: "P5", createdAt: diasAtras(24), tipo: "sessao", questionId: "Q1" },
    // P6 — nunca iniciou: nenhuma atividade, de propósito.
  ]

  const matriculas: MatriculaBruta[] = alunos.map((a, i) => ({
    studentId: a.id,
    courseId: "C1",
    status: "active" as const,
    createdAt: diasAtras(60),
    progressPercent: [70, 60, 30, 45, 20, 0][i] ?? 0,
  }))

  return {
    agoraISO: AGORA_ISO,
    periodoDias: 30,
    gestorId: "G1",
    escopo: alunos.map((a) => a.id),
    alunos,
    atividades,
    acionamentos: [],
    matriculas,
    cursos: [{ id: "C1", deadlineDays: 90 }],
  }
}

/** Atividade em 2 dias distintos por semana, entre `deDias` e `ateDias` atrás. */
function regular(studentId: string, deDias: number, ateDias: number): AtividadeBruta[] {
  const out: AtividadeBruta[] = []
  for (let d = deDias; d < ateDias; d += 7) {
    out.push({ studentId, createdAt: diasAtras(d + 1), tipo: "sessao", questionId: "Q1" })
    out.push({ studentId, createdAt: diasAtras(d + 4), tipo: "reflexao" })
  }
  return out
}

// ===========================================================================
// 3 — Mutadores usados pelos testes de invariância / variância
// ===========================================================================

/**
 * Duplica a população: cada pessoa ganha um gêmeo com id novo e carimbos
 * IDÊNTICOS. Toda taxa e todo delta têm de ficar iguais. Se algum se mexer,
 * um dos lados da comparação está lendo escopo diferente do outro (I-5).
 */
export function clonarPopulacao(e: EntradaVisaoGeral, sufixo = "-b"): EntradaVisaoGeral {
  const novoId = (id: string) => `${id}${sufixo}`
  return {
    ...e,
    escopo: [...e.escopo, ...e.escopo.map(novoId)],
    alunos: [...e.alunos, ...e.alunos.map((a) => ({ ...a, id: novoId(a.id) }))],
    atividades: [
      ...e.atividades,
      ...e.atividades.map((a) => ({ ...a, studentId: novoId(a.studentId) })),
    ],
    acionamentos: [
      ...e.acionamentos,
      ...e.acionamentos.map((n) => ({ ...n, recipientId: novoId(n.recipientId) })),
    ],
    matriculas: [
      ...e.matriculas,
      ...e.matriculas.map((m) => ({ ...m, studentId: novoId(m.studentId) })),
    ],
  }
}

/**
 * Espelha o comportamento da janela atual na janela anterior, deslocando cada
 * carimbo por −periodoMs. Se as duas janelas tiverem a MESMA duração e o mesmo
 * denominador, todo delta tem de dar 0. Duração diferente, ou denominador
 * recalculado por janela, quebra isso (I-5).
 */
export function espelharNoPeriodoAnterior(e: EntradaVisaoGeral): EntradaVisaoGeral {
  const periodoMs = e.periodoDias * DIA_MS
  const deslocar = (iso: string) => new Date(Date.parse(iso) - periodoMs).toISOString()
  return {
    ...e,
    atividades: [
      ...e.atividades,
      ...e.atividades.map((a) => ({
        ...a,
        createdAt: deslocar(a.createdAt),
        updatedAt: a.updatedAt ? deslocar(a.updatedAt) : a.updatedAt,
      })),
    ],
  }
}

/** Remove toda atividade da janela ANTERIOR: o comportamento passado muda. */
export function esvaziarPeriodoAnterior(e: EntradaVisaoGeral): EntradaVisaoGeral {
  const corte = AGORA_MS - e.periodoDias * DIA_MS
  return { ...e, atividades: e.atividades.filter((a) => Date.parse(a.createdAt) >= corte) }
}

// ===========================================================================
// 4 — Literais obrigatórios da SPEC-FUNCIONAL
// ===========================================================================

/** §12 — texto obrigatório do bloco "Resposta aos seus acionamentos". */
export const RESSALVA_CAUSALIDADE =
  "Resultado observado após o acionamento. Não representa comprovação causal."

/** §32 — os quatro estados vazios, literais. */
export const TEXTOS_VAZIOS = {
  tendencia: "Precisamos de pelo menos dois períodos de atividade para identificar uma tendência.",
  acionamentos: "Você ainda não realizou acionamentos neste período.",
  gargalos: "Nenhum gargalo relevante foi identificado neste período.",
  sinais: "Nenhum sinal relevante fora do padrão foi identificado.",
} as const

// ===========================================================================
// 5 — Travessia genérica do objeto de saída
// ===========================================================================

export interface NoVisitado {
  caminho: string
  chave: string
  valor: unknown
}

/** Percorre todo o objeto (objetos e arrays), entregando cada par chave/valor. */
export function percorrer(raiz: unknown, visitar: (no: NoVisitado) => void): void {
  const vistos = new WeakSet<object>()
  const andar = (valor: unknown, caminho: string, chave: string): void => {
    if (valor === null || typeof valor !== "object") {
      visitar({ caminho, chave, valor })
      return
    }
    if (vistos.has(valor as object)) return
    vistos.add(valor as object)
    visitar({ caminho, chave, valor })
    if (Array.isArray(valor)) {
      valor.forEach((item, i) => andar(item, `${caminho}[${i}]`, chave))
      return
    }
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      andar(v, caminho ? `${caminho}.${k}` : k, k)
    }
  }
  andar(raiz, "", "")
}

export function coletarStrings(raiz: unknown): Array<{ caminho: string; texto: string }> {
  const out: Array<{ caminho: string; texto: string }> = []
  percorrer(raiz, ({ caminho, valor }) => {
    if (typeof valor === "string") out.push({ caminho, texto: valor })
  })
  return out
}

export function coletarChaves(raiz: unknown): Array<{ caminho: string; chave: string }> {
  const out: Array<{ caminho: string; chave: string }> = []
  percorrer(raiz, ({ caminho, chave }) => {
    if (chave) out.push({ caminho, chave })
  })
  return out
}

// ===========================================================================
// 6 — DETECTORES (I-7 e I-8)
//
// Ficam aqui, exportados, porque cada teste que os usa TAMBÉM os alimenta com
// uma violação plantada. Detector que nunca acusa nada é detector que passa
// por vacuidade — a violação plantada prova que ele morde.
// ===========================================================================

/**
 * I-7 — conteúdo protegido pela §30.
 *
 * Duas famílias, com réguas diferentes de propósito:
 *  • CONTEUDO: só é violação quando o VALOR é string. Contar reflexões é
 *    legítimo (§8.4 usa reflexão como sinal de participação); carregar o TEXTO
 *    da reflexão não é.
 *  • SEMPRE: violação em qualquer tipo. Competência, interpretação psicológica
 *    e laudo não pertencem a esta visão nem como número.
 */
export const PADRAO_CHAVE_LGPD_CONTEUDO =
  /reflex|reflection|verbatim|transcri|resposta.?aberta|texto.?livre|conteudo.?privado|conteúdo.?privado/i

export const PADRAO_CHAVE_LGPD_SEMPRE =
  /competenc|competênc|psico|psicol|perfil.?comportament|diagnostic|laudo|avaliacao.?de.?competencia/i

/** I-8 — chaves de posição em ranking. `prioridade` NÃO entra: é ação (C-39). */
export const PADRAO_CHAVE_RANKING =
  /^(posicao|posição|rank|ranking|colocacao|colocação|classificacao|classificação|pontuacao|pontuação|score|nota|indice.?geral)$/i

/** I-8 — vocabulário de cobrança proibido pela §2 Regra 2 e §10.2. */
export const TERMOS_PUNITIVOS = [
  "cobrar",
  "cobrança",
  "penalizar",
  "penalidade",
  "advertir",
  "advertência",
  "punir",
  "pior aluno",
  "piores alunos",
  "melhores alunos",
  "ranking",
  "pódio",
  "top 3",
  "top 5",
  "desempenho individual",
] as const

export interface Violacao {
  caminho: string
  detalhe: string
}

export function detectarChavesLgpd(raiz: unknown): Violacao[] {
  const out: Violacao[] = []
  percorrer(raiz, ({ caminho, chave, valor }) => {
    if (!chave) return
    if (PADRAO_CHAVE_LGPD_SEMPRE.test(chave)) {
      out.push({ caminho, detalhe: `chave proibida pela §30: ${chave}` })
      return
    }
    if (PADRAO_CHAVE_LGPD_CONTEUDO.test(chave) && typeof valor === "string") {
      out.push({ caminho, detalhe: `texto de reflexão exposto em: ${chave}` })
    }
  })
  return out
}

export function detectarChavesRanking(raiz: unknown): Violacao[] {
  return coletarChaves(raiz)
    .filter((n) => PADRAO_CHAVE_RANKING.test(n.chave))
    .map((n) => ({ caminho: n.caminho, detalhe: `chave de ranking: ${n.chave}` }))
}

export function detectarVocabularioPunitivo(raiz: unknown): Violacao[] {
  const out: Violacao[] = []
  for (const { caminho, texto } of coletarStrings(raiz)) {
    const baixo = texto.toLowerCase()
    for (const termo of TERMOS_PUNITIVOS) {
      if (baixo.includes(termo))
        out.push({ caminho, detalhe: `termo punitivo "${termo}": ${texto}` })
    }
  }
  return out
}

/**
 * I-8 — lista numerada por mérito. Acusa quando uma lista tem, ao mesmo tempo,
 * (a) uma chave numérica de posição sequencial 1..N E (b) uma chave de mérito
 * cuja ordem é monotônica decrescente. Uma das duas sozinha não é ranking:
 * "prioridade 1,2,3" de AÇÃO é permitido (C-39), e ordenar por dias sem acesso
 * sem numerar também é (fila de triagem).
 */
export function detectarListaComRankingNumerado(raiz: unknown): Violacao[] {
  const out: Violacao[] = []
  percorrer(raiz, ({ caminho, valor }) => {
    if (!Array.isArray(valor) || valor.length < 2) return
    const itens = valor.filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
    if (itens.length !== valor.length) return

    const chaves = Object.keys(itens[0] ?? {})
    const chavePosicao = chaves.find((k) => PADRAO_CHAVE_RANKING.test(k))
    if (!chavePosicao) return

    const posicoes = itens.map((i) => i[chavePosicao])
    const sequencial = posicoes.every((p, idx) => typeof p === "number" && p === idx + 1)
    if (!sequencial) return

    const chaveMerito = chaves.find(
      (k) => k !== chavePosicao && itens.every((i) => typeof i[k] === "number"),
    )
    if (!chaveMerito) {
      out.push({ caminho, detalhe: `lista numerada 1..N por "${chavePosicao}"` })
      return
    }
    const merito = itens.map((i) => i[chaveMerito] as number)
    const decrescente = merito.every((v, idx) => idx === 0 || (merito[idx - 1] as number) >= v)
    if (decrescente) {
      out.push({
        caminho,
        detalhe: `lista numerada por "${chavePosicao}" e ordenada por mérito decrescente "${chaveMerito}"`,
      })
    }
  })
  return out
}

/** Numeral solto: string que é só um número (ou número com %) — o "0" de I-3. */
export function contemNumeralSolto(raiz: unknown): Array<{ caminho: string; texto: string }> {
  return coletarStrings(raiz).filter(({ texto }) => /^\s*-?\d+(?:[.,]\d+)?\s*%?\s*$/.test(texto))
}

// ===========================================================================
// 7 — Localização dos arquivos da run (I-4 e I-7 estático)
// ===========================================================================

export const DIR_CAMADA_DADOS = "apps/web/src/lib/analytics/visao-geral"

/**
 * Remove comentários antes de qualquer varredura estática (I-4 e I-7).
 *
 * Não é detalhe de higiene. Na primeira execução real, o detector de I-4
 * acusou `fonte-supabase.ts:6 → const { data } = await ...`, que era o texto
 * do COMENTÁRIO explicando por que aquele padrão é proibido. Um detector que
 * reprova quem documenta a regra é pior que nenhum detector: ensina a apagar a
 * documentação para ficar verde.
 *
 * As quebras de linha são preservadas para o número de linha do relatório
 * continuar apontando o lugar certo. `//` precedido de `:` é mantido, senão
 * toda URL (`https://`) viraria início de comentário.
 */
export function semComentarios(fonte: string): string {
  return fonte
    .replace(/\/\*[\s\S]*?\*\//g, (bloco) => bloco.replace(/[^\n]/g, " "))
    .split("\n")
    .map((linha) => linha.replace(/(^|[^:])\/\/.*$/, "$1"))
    .join("\n")
}
