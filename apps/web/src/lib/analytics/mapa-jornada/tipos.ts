// ---------------------------------------------------------------------------
// Mapa da jornada — contrato de saída da camada de dados.
// ---------------------------------------------------------------------------
// Régua: CONTRATO-mapa.md (F-01..F-35) e SPEC-FUNCIONAL.md §22 a §28.
//
// DUAS REGRAS DE FORMA que valem para TODO tipo deste arquivo, e que vieram da
// tela anterior a preço alto:
//
//   1. `ComEstado<T>` em TODO bloco (nunca `Partial<EstadoBloco>`). Na Visão
//      geral o estado era opcional no tipo público para a fixture continuar
//      atribuível; aqui não há fixture legada a acomodar, então o compilador
//      OBRIGA quem produz a declarar ok/vazio/erro. É I-3 e I-4 virando erro de
//      compilação em vez de disciplina.
//
//   2. CAMPO QUE PRECISA CHEGAR À TELA É OBRIGATÓRIO (lição 3 da tela
//      anterior: campo opcional deixa um fix desaparecer sem quebrar nada).
//      Por isso `textoRodape` (F-05), `notaRegua` (F-22) e `notaPeriodo` (F-33)
//      não têm `?`. Se alguém remover o texto, o build cai.
//
// O que NÃO existe aqui, de propósito: nenhuma chave de posição em lista de
// PESSOAS (F-34/I-8) e nenhum campo capaz de carregar texto de reflexão (I-7).
// A ausência é verificável — ver `__tests__/f-34-apoia-nao-vigia.test.ts` e
// `f-32-erro-de-consulta-lido.test.ts`.
// ---------------------------------------------------------------------------

import type {
  ComEstado,
  EstadoJornada,
  FalhaLeitura,
  MotivoAusencia,
  Tom,
} from "@/lib/analytics/visao-geral/tipos"

export type { ComEstado, EstadoBloco, EstadoJornada, FalhaLeitura, MotivoAusencia, Tom }
export type { Origem } from "@/lib/analytics/visao-geral/tipos"

import type { EstadoBloco } from "@/lib/analytics/visao-geral/tipos"
import type { DetalhesMapa } from "./detalhes"

// ===========================================================================
// §23 — a matriz
// ===========================================================================

/**
 * Os três estados da célula (§23 e §31). NÃO existe um quarto para "sem dado":
 * a §31 diz literalmente que cinza é *"não iniciado, ausência de dado, estado
 * neutro"* — as duas coisas na mesma cor, por desenho da spec. É por isso que
 * `BlocoMapa.textoRodape` é obrigatório: a ambiguidade tem de estar publicada
 * na tela, não escondida num comentário (F-05).
 */
export type EstadoCelula = "concluido" | "em-andamento" | "nao-iniciado"

export interface ColunaModulo {
  /** `chapters.id`. */
  id: string
  /** 1-based (F-02): `chapters."order"` é 0-based no schema. */
  numero: number
  titulo: string
  cursoId: string
}

export interface LinhaPessoa {
  alunoId: string
  nome: string
  iniciais: string
  /** Derivado das INICIAIS, nunca do estado (F-34c). */
  avatarTone: Tom
  estado: EstadoJornada
  /** Paralelo a `BlocoMapa.colunas`, mesmo índice, mesmo comprimento. */
  celulas: readonly EstadoCelula[]
}

/** §23 "Filtros internos". Ordem FIXA, nunca ordenada por tamanho (F-07). */
export interface FiltroInterno {
  id: "todos" | "perdendo-ritmo" | "parados" | "nao-iniciaram" | "sustentando"
  rotulo: string
  total: number
}

export interface ItemLegenda {
  estado: EstadoCelula
  rotulo: string
}

export type BlocoMapa = ComEstado<{
  titulo: string
  subtitulo: string
  /** F-01: cardinalidade do roster. É o denominador de F-09/F-16/F-27/F-29. */
  totalAlunos: number
  /** "40 alunos" — string pronta, com singular correto. */
  totalAlunosLabel: string
  filtroRotulo: string
  filtros: readonly FiltroInterno[]
  colunas: readonly ColunaModulo[]
  /** Amostra exibida (F-06), já cortada em `AMOSTRA_LINHAS`. */
  linhas: readonly LinhaPessoa[]
  exibidas: number
  resto: number
  /** "+ 32 alunos" · `null` quando `resto === 0` (nunca "+ 0 alunos"). */
  rotuloResto: string | null
  legenda: readonly ItemLegenda[]
  /**
   * F-05 · OBRIGATÓRIO. A régua do cinza, renderizada (I-2), nunca tooltip.
   * Cinza carrega "não iniciou" e "não temos dado" na mesma cor; sem esta
   * linha na tela, o gestor lê ausência de instrumentação como ausência de
   * esforço da pessoa.
   */
  textoRodape: string
}>

// ===========================================================================
// §24 — gargalos por módulo
// ===========================================================================

export interface LinhaGargalo {
  moduloId: string
  /**
   * F-10 · POSIÇÃO NA LISTA DE GARGALOS, 1-based (1º, 2º, ... 5º). É o numeral
   * do badge, e é o que o PNG de referência mostra: lá as cinco linhas trazem
   * `1 2 3 4 5` ao lado dos módulos 6, 7, 5, 4 e 3 — ou seja, a posição, não o
   * número do módulo. Campo OBRIGATÓRIO: opcional deixaria o badge cair de
   * volta em `numero` sem quebrar nada (lição 3 da tela anterior).
   *
   * Permitido por I-8/F-34a pela mesma razão que os badges 1/2/3 de "O que
   * fazer agora": ordena MÓDULOS, nunca pessoas.
   */
  ordem: number
  /** Posição do MÓDULO na grade (F-02). Alimenta o insight F-28 ("módulos a a b"). */
  numero: number
  titulo: string
  pessoas: number
  pct: number
  /** 0..1 relativo ao maior numerador. Só desenho de barra (V-21). */
  proporcao: number
  tom: Tom
}

export type BlocoGargalos = ComEstado<{
  titulo: string
  subtitulo: string
  linhas: readonly LinhaGargalo[]
  /** `null` quando não há módulo além do corte (F-10). */
  linkRodape: string | null
}>

// ===========================================================================
// §25 — distribuição por etapa
// ===========================================================================

export interface TileDistribuicao {
  id: "concluidos" | "em-andamento" | "travados" | "nao-iniciados"
  rotulo: string
  valor: number
  pct: number
  tom: Tom
  icone: string
}

export type BlocoDistribuicao = ComEstado<{
  titulo: string
  subtitulo: string
  /** F-16: os quatro somam EXATAMENTE `BlocoMapa.totalAlunos`. */
  tiles: readonly TileDistribuicao[]
}>

// ===========================================================================
// §26 — pessoas que travaram no mesmo ponto
// ===========================================================================

export interface LinhaTravado {
  alunoId: string
  nome: string
  iniciais: string
  avatarTone: Tom
  /** `null` quando não há evidência no módulo âncora ⇒ travessão. */
  paradoHaDias: number | null
  paradoHaLabel: string
  ultimaAtividadeLabel: string
}

export type BlocoTravados = ComEstado<{
  /**
   * F-21 · o discriminante do CONTEÚDO, nunca da superfície. `false` aqui com
   * `estado:"vazio"` é "não há concentração"; `false` com `estado:"erro"` é
   * falha de leitura. Os dois NÃO podem colapsar num só (discriminante).
   *
   * `false` suprime módulo âncora, lista e CTA — e NÃO o card. O card fica na
   * tela dizendo qual dos dois casos é (§32); a §26 só proíbe inventar
   * concentração onde não há.
   */
  presente: boolean
  titulo: string
  subtitulo: string
  moduloRotulo: string
  /** Título do módulo âncora (F-17), ou string vazia quando ausente. */
  moduloTitulo: string
  cabecalhos: readonly string[]
  /** Fila de triagem, nunca pódio (F-34): sem posição, sem badge. */
  linhas: readonly LinhaTravado[]
  ctaRotulo: string
  /** Total COMPLETO da população, não o corte exibido (F-21). */
  ctaTotal: number
}>

// ===========================================================================
// §27 — funil de avanço por módulo
// ===========================================================================

export interface LinhaFunil {
  moduloId: string
  numero: number
  titulo: string
  chegaram: number
  iniciaram: number
  concluiram: number
  /** `null` quando `chegaram === 0` ⇒ travessão, nunca 0% nem NaN (I-3). */
  conversaoPct: number | null
  conversaoLabel: string
}

export type BlocoFunil = ComEstado<{
  titulo: string
  subtitulo: string
  cabecalhos: readonly string[]
  linhas: readonly LinhaFunil[]
  /**
   * F-22 · OBRIGATÓRIO. "Chegaram" é constante por curso porque o produto NÃO
   * trava módulo (achado A-2). Sem esta régua na tela, uma coluna constante ao
   * lado de duas que caem lê-se como consulta quebrada.
   */
  notaRegua: string
  linkRodape: string | null
}>

// ===========================================================================
// §28 — insights do mapa
// ===========================================================================

export interface ItemInsight {
  id: "concluiu" | "em-andamento" | "gargalo"
  texto: string
  icone: string
  iconeTom: Tom
}

export interface AcaoRecomendada {
  titulo: string
  texto: string
  ctaRotulo: string
  ctaIcone: string
  /**
   * `true` só em CTA que gravaria em banco. Enquanto o gate estiver desligado,
   * quem renderiza mantém o botão inerte (mesmo desenho de `visao-geral`).
   */
  ctaEscreve: boolean
  moduloId: string
}

export type BlocoInsights = ComEstado<{
  titulo: string
  /** No MÁXIMO 3 (§28). Insight sem fonte é OMITIDO, nunca genérico. */
  itens: readonly ItemInsight[]
  acao: AcaoRecomendada | null
}>

// ===========================================================================
// Agregado
// ===========================================================================

export interface ContextoMapa {
  agoraISO: string
  periodoDias: number
  /** Nome do curso filtrado, ou `null` para "Todos os cursos". */
  cursoFiltro: string | null
  totalAlunos: number
}

export interface MapaJornadaDados {
  estado: "ok" | "vazio" | "erro"
  erro: FalhaLeitura | null
  contexto: ContextoMapa
  mapa: BlocoMapa
  gargalos: BlocoGargalos
  distribuicao: BlocoDistribuicao
  travados: BlocoTravados
  funil: BlocoFunil
  insights: BlocoInsights
  /**
   * O DESTINO de cada CTA desta tela e as fichas da §30 do roster inteiro.
   *
   * OBRIGATÓRIO pela mesma regra 2 do cabeçalho deste arquivo: campo que precisa
   * chegar à tela não é opcional. Seis elementos desta aba pareciam acionáveis e
   * não eram; um `?` aqui deixaria qualquer um deles voltar ao estado decorativo
   * sem quebrar o build.
   */
  detalhes: DetalhesMapa
  /** Faixa informativa de largura total do rodapé da tela (V-08/V-32). */
  faixaRodape: string
  /**
   * F-33 · OBRIGATÓRIO. O mapa é posição ACUMULADA: matriz, distribuição e
   * funil medem idêntico em 7, 30 e 90 dias. Isso é legítimo e
   * indistinguível de bug enquanto não estiver escrito na tela.
   */
  notaPeriodo: string
}
