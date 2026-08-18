// ---------------------------------------------------------------------------
// "Padrões e tendências" — contrato de saída da camada de dados.
// ---------------------------------------------------------------------------
// UMA REGRA GOVERNA ESTE ARQUIVO: campo que precisa chegar à tela é
// OBRIGATÓRIO, nunca opcional. Um `?` aqui é o buraco por onde uma correção
// desaparece sem quebrar nada — o produtor deixa de emitir, o compilador cala,
// e a tela volta ao comportamento anterior sem uma linha vermelha. Onde a
// ausência é um estado REAL do mundo (não há comparação, não há nota a dar), o
// tipo diz `| null`: o consumidor é obrigado a ramificar.
//
// `ComEstado<T>` é importado da Visão geral e vale para os 6 blocos: o produtor
// é obrigado a declarar `ok`/`vazio`/`erro` (I-3 e I-4 representáveis no tipo).
// A Visão geral usa `Partial<EstadoBloco>` nos blocos dela por compatibilidade
// com a fixture antiga; aqui não há essa dívida, então os quatro campos são
// obrigatórios.
//
// I-8 é estrutural neste arquivo: NENHUM tipo abaixo tem campo de pessoa —
// nem `alunoId`, nem `nome`, nem `iniciais`, nem `avatarTone`. A tela fala de
// agregados, séries, padrões, MÓDULOS, faixas e contagens. O verificador F-42
// prova que nome nenhum vaza para a saída; este arquivo faz o vazamento não
// ter onde morar.
// ---------------------------------------------------------------------------

import type { ComEstado, FalhaLeitura, Tom } from "../visao-geral/tipos"

export type {
  ComEstado,
  EstadoBloco,
  FalhaLeitura,
  MotivoAusencia,
  Tom,
} from "../visao-geral/tipos"

/** Leitura semântica da variação. NÃO é a direção da seta. */
export type ToneVariacao = "positivo" | "negativo"

// ===========================================================================
// Ação — 7 na tela, nenhuma escreve (F-44)
// ===========================================================================

export interface Acao {
  id: string
  rotulo: string
  /**
   * `false` em todas as 7, e é contrato, não configuração: nada nesta tela
   * grava em banco. O gate `acoesEstaoAtivas()` da Visão geral continua sendo
   * a única porta para qualquer escrita que venha a existir, e o `.env.local`
   * deste repo aponta para PRODUÇÃO.
   */
  ctaEscreve: boolean
}

// ===========================================================================
// §15 — moldura da aba
// ===========================================================================

export interface Moldura {
  titulo: string
  texto: string
  acao: Acao
}

// ===========================================================================
// §16 — Principais mudanças no período
// ===========================================================================

export type TipoMudanca = "ativos" | "regularidade" | "modulos" | "retomadas"

export interface ItemMudanca {
  id: TipoMudanca
  titulo: string
  /** Sempre presente: quando não há afirmação a fazer, é a régua da comparação. */
  subtexto: string
  /** String pronta, já com sinal e unidade ("+3", "−6 p.p.", "−15%"). */
  valorTexto: string
  /** A COR vem daqui, nunca do sinal do glifo. */
  tom: ToneVariacao
  /** Posição de exibição, 1..4. */
  ordem: number
  /** Quantas pessoas o item representa. É por aqui que a lista ordena. */
  pessoas: number
}

export interface BlocoMudancas {
  titulo: string
  /** "Comparado aos N dias anteriores" — visível inclusive em vazio e erro. */
  subtitulo: string
  itens: readonly ItemMudanca[]
  acao: Acao
}

// ===========================================================================
// §17 — Evolução do ritmo
// ===========================================================================

export interface PontoSerie {
  /** 0 = semana mais antiga da série. */
  indice: number
  /** "26 mai – 1 jun" · "2 – 8 jun". Formatado em UTC (I-6). */
  rotulo: string
  inicioISO: string
  fimISO: string
  /** Pessoas distintas com ≥1 sessão na semana. */
  ativos: number
  /** Total de sessões criadas na semana. */
  sessoes: number
}

export interface EixoY {
  passo: number
  topo: number
  /** 6 marcas, de 0 ao topo. */
  ticks: readonly number[]
}

export interface EntradaLegenda {
  id: "ativos" | "sessoes"
  rotulo: string
  tom: Tom
}

export interface BlocoSerie {
  titulo: string
  subtitulo: string
  /** MVP tem uma só. A UI mostra estado, não um menu que não oferece nada. */
  periodicidade: "semanal"
  opcoes: readonly "semanal"[]
  legenda: readonly EntradaLegenda[]
  pontos: readonly PontoSerie[]
  /** `null` quando o bloco está vazio: eixo sem série é gráfico vazio. */
  eixoY: EixoY | null
  acao: Acao
}

// ===========================================================================
// §18 — Sinais emergentes
// ===========================================================================

export type TipoSinal = "recorrencia" | "limiar"

export interface ItemSinal {
  id: string
  tipo: TipoSinal
  titulo: string
  descricao: string
  badgeRotulo: string
  badgeTom: Tom
  icone: string
  pessoas: number
  ordem: number
}

export interface BlocoSinais {
  titulo: string
  subtitulo: string
  itens: readonly ItemSinal[]
  /**
   * Silêncio explicado e silêncio mudo são mensagens diferentes: "nenhum sinal"
   * pode ser time saudável OU dois terços do recorte sem histórico comparável.
   */
  textoComplementar: string | null
  acao: Acao
}

// ===========================================================================
// §19 — Onde o ritmo caiu mais (MÓDULOS, nunca pessoas)
// ===========================================================================

export interface ItemGargalo {
  /** id do capítulo. Objeto de currículo, não de gente. */
  id: string
  /** 1..4. Ordena MÓDULOS por magnitude de queda — não classifica ninguém. */
  posicao: number
  moduloTitulo: string
  variacaoPercent: number
  valorTexto: string
  /** 0..1. Comprimento da barra, com piso para a menor queda continuar visível. */
  fracaoBarra: number
  ativosAtual: number
  ativosAnterior: number
}

export interface BlocoGargalos {
  titulo: string
  subtitulo: string
  itens: readonly ItemGargalo[]
  acao: Acao
}

// ===========================================================================
// §20 — Participação ao longo do tempo
// ===========================================================================

export type IdFaixa = "2x-ou-mais" | "1x" | "irregular" | "sem-atividade"

export interface FaixaParticipacao {
  id: IdFaixa
  rotulo: string
  pessoas: number
  /** Inteiro. Os quatro somam EXATAMENTE 100 (método do maior resto). */
  percentual: number
  tom: Tom
}

export interface BlocoParticipacao {
  titulo: string
  subtitulo: string
  /** Partição exaustiva do recorte, sempre nesta ordem. */
  faixas: readonly FaixaParticipacao[]
  /** O denominador RENDERIZADO, nunca no `title` (I-2). */
  textoDenominador: string
  /**
   * "A regularidade caiu 6 p.p. no período." — ou o texto de ausência de
   * comparação. NUNCA "estável" quando o que existe é falta de período
   * anterior.
   */
  frase: string
  /** `null` quando não há variação relevante nem comparação possível. */
  deltaPp: number | null
  acao: Acao
}

// ===========================================================================
// §21 — Risco de perda de ritmo
// ===========================================================================

export type IdCategoriaRisco = "sustentando" | "desacelerando" | "parados" | "retomando"

export interface CategoriaRisco {
  id: IdCategoriaRisco
  rotulo: string
  pessoas: number
  percentual: number
  tom: Tom
  icone: string
}

export interface BlocoRisco {
  titulo: string
  subtitulo: string
  /** As 4 da §21, sempre presentes quando o bloco está `ok`. */
  categorias: readonly CategoriaRisco[]
  /**
   * `EstadoJornada` tem SEIS valores e a §21 desenha QUATRO cards: concluídos e
   * não iniciados sumiriam sem deixar rastro, e os 4 cards passariam a afirmar
   * uma partição que não é partição. `null` quando a soma FECHA — uma nota
   * dizendo "0 pessoas fora" é ruído.
   */
  notaCobertura: string | null
  acao: Acao
}

// ===========================================================================
// Agregado
// ===========================================================================

export interface ContextoPadroes {
  agoraISO: string
  periodoDias: number
  periodoInicioISO: string
  periodoFimISO: string
  periodoAnteriorInicioISO: string
  periodoAnteriorFimISO: string
  /** Denominador congelado de TODO percentual desta tela. */
  totalRecorte: number
}

export interface PadroesTendenciasDados {
  estado: "ok" | "vazio" | "erro"
  erro: FalhaLeitura | null
  contexto: ContextoPadroes
  moldura: Moldura
  mudancas: ComEstado<BlocoMudancas>
  serie: ComEstado<BlocoSerie>
  sinais: ComEstado<BlocoSinais>
  gargalos: ComEstado<BlocoGargalos>
  participacao: ComEstado<BlocoParticipacao>
  risco: ComEstado<BlocoRisco>
  faixaFoco: string
  /** As 7 ações da tela, coletadas dos blocos. Nenhuma escreve (F-44). */
  acoes: readonly Acao[]
}
