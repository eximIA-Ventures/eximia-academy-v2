// ---------------------------------------------------------------------------
// Textos literais de "Padrões e tendências" — §15, §16..§21, §32.
// ---------------------------------------------------------------------------
// Cada string aqui é LITERAL da spec ou do PNG aprovado: acento, caixa,
// pontuação final e tipo de separador contam. Elas moram num arquivo só para
// que a UI leia a CONSTANTE, e não uma segunda cópia escrita no JSX — que é o
// caminho pelo qual uma correção de texto "existe no código" e não aparece na
// tela.
//
// Os quatro literais da §32 são reusados de `visao-geral/textos.ts` por import,
// não copiados. Os dois textos que a §32 não cobre estão marcados como
// propostos e aguardam aval do dono, mesmo tratamento que a Visão geral deu.
// ---------------------------------------------------------------------------

export {
  /** §32 — literal. Reusado, nunca redigitado. */
  VAZIO_TENDENCIA,
  /** §32 — literal. */
  VAZIO_GARGALOS,
  /** §32 — literal. */
  VAZIO_SINAIS,
  /** NÃO está na §32 — proposto na Visão geral, reusado aqui. */
  VAZIO_SEM_ESCOPO,
  /** NÃO está na §32 — proposto na Visão geral, reusado aqui. */
  VAZIO_NINGUEM_INICIOU,
  /** I-4: o que a tela diz quando a leitura falha. Não é estado vazio. */
  ERRO_LEITURA,
} from "../visao-geral/textos"

// --- §15 moldura -----------------------------------------------------------

/** §15 — literal. */
export const MOLDURA_TITULO = "Entenda o que está mudando ao longo do tempo"

/**
 * §15 — literal da SPEC.
 *
 * O PNG grafa "está indo — e agir"; o travessão é marcador de texto gerado por
 * IA e está banido na casa, então vale o literal da spec (sem ele). A régua
 * visual aceita as duas formas (CRITERIOS-padroes.md, exclusão 19).
 */
export const MOLDURA_TEXTO =
  "Esta visão revela padrões e tendências que ajudam você a compreender para onde o engajamento está indo e agir com mais estratégia."

/** Rodapé da aba. NÃO está na spec — lido do PNG aprovado. */
export const FAIXA_FOCO =
  "Foco desta visão: identificar padrões e tendências ao longo do tempo para decisões mais estratégicas."

// --- Títulos e subtítulos dos 6 cards --------------------------------------

export const TITULO_MUDANCAS = "Principais mudanças no período"
export const TITULO_SERIE = "Evolução do ritmo"
export const SUBTITULO_SERIE = "Ativos e sessões por semana"
export const TITULO_SINAIS = "Sinais emergentes"
export const SUBTITULO_SINAIS = "Padrões que merecem atenção"
export const TITULO_GARGALOS = "Onde o ritmo caiu mais"
export const SUBTITULO_GARGALOS = "Queda vs período anterior"
export const TITULO_PARTICIPACAO = "Participação ao longo do tempo"
export const SUBTITULO_PARTICIPACAO = "Pessoas que mantiveram frequência semanal"
export const TITULO_RISCO = "Risco de perda de ritmo"
export const SUBTITULO_RISCO = "Classificação dos alunos por tendência"

/** §16 — a régua da comparação, visível inclusive em `vazio` e `erro`. */
export function subtituloComparativo(periodoDias: number): string {
  return `Comparado aos ${periodoDias} dias anteriores`
}

// --- Os 7 rótulos de ação (F-44) -------------------------------------------

export const ACAO_COMO_LER = "Como ler esta visão"
export const ACAO_MUDANCAS = "Ver todas as mudanças"
/** §17 — literal da spec. */
export const ACAO_SERIE = "Ver detalhes da série histórica"
export const ACAO_SINAIS = "Ver todos os sinais"
/** §19 — literal da spec. */
export const ACAO_GARGALOS = "Ver comparação completa"
export const ACAO_PARTICIPACAO = "Ver composição por semana"
export const ACAO_RISCO = "Ver critérios de classificação"

// --- §20 / §21 rótulos -----------------------------------------------------

export const ROTULO_FAIXA = {
  "2x-ou-mais": "2x ou mais/semana",
  "1x": "1x/semana",
  irregular: "Irregular",
  "sem-atividade": "Sem atividade",
} as const

/**
 * §21 rotula `Desacelerando` o mesmo conjunto que a §4 chama `perdendo-ritmo`.
 * É o MESMO conjunto de pessoas com dois rótulos em duas abas — registrado aqui
 * para não virar duas contagens. Nenhum dos dois é punitivo (I-8).
 */
export const ROTULO_CATEGORIA_RISCO = {
  sustentando: "Sustentando",
  desacelerando: "Desacelerando",
  parados: "Parados",
  retomando: "Retomando",
} as const

// --- Estados vazios que a §32 não cobre ------------------------------------

/** NÃO está na §32 — proposto. Aguarda aval do dono. */
export const VAZIO_PARTICIPACAO =
  "Ainda não há atividade suficiente para descrever a participação deste recorte."

/** NÃO está na §32 — proposto. Aguarda aval do dono. */
export const SEM_COMPARACAO_REGULARIDADE =
  "Ainda não há dois períodos comparáveis para medir a variação."

// --- Formatação numérica ---------------------------------------------------

/** U+2212. NÃO é o hífen, e NÃO é o travessão U+2014 de "dado ausente". */
export const MENOS = "−"

/** Traço de intervalo U+2013, usado nos rótulos de semana. */
export const TRACO_INTERVALO = "–"

/** "+3" / "−3". Contagem com sinal, nunca percentual (§16). */
export function comSinal(valor: number): string {
  return valor < 0 ? `${MENOS}${Math.abs(valor)}` : `+${valor}`
}

/** "+12%" / "−15%". */
export function percentualComSinal(valor: number): string {
  return `${comSinal(valor)}%`
}

/** "−6 p.p." — nesta tela o ponto percentual leva pontos (o PNG manda). */
export function pontosPercentuais(valor: number): string {
  return `${comSinal(valor)} p.p.`
}

/** "Base: 40 pessoas do recorte." — o denominador RENDERIZADO, nunca no hover. */
export function textoDenominador(pessoas: number): string {
  return `Base: ${pessoas} ${pessoas === 1 ? "pessoa" : "pessoas"} do recorte.`
}
