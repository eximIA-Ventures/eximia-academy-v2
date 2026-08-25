// ---------------------------------------------------------------------------
// Autogestão da minha Jornada — contrato de saída da camada de dados.
// ---------------------------------------------------------------------------
// Esta tela é INDIVIDUAL: não existe roster, não existe nome de terceiro, não
// existe comparação com a turma (spec §8.1: "Evitar usar a turma como
// referência principal nesta tela"). O sujeito de toda métrica é SEMPRE o
// próprio aprendiz — por isso nenhum tipo abaixo carrega `alunoId` de outra
// pessoa, ao contrário do analytics do gestor.
//
// SEM LASTRO (decisão do dono, `CONTRATO-DE-DADOS.md` §"Regra de lastro"): onde
// a especificação pede um número que NÃO tem fonte no banco hoje (meta de
// frequência semanal, meta de reflexões), o campo devolve `SemLastro` — nunca
// um número inventado, nunca `0`, nunca `null` silencioso. `0` e "sem meta"
// são afirmações DIFERENTES sobre o mundo, e só uma delas é verdadeira aqui.
//
// `ComEstado<T>` seguindo o mesmo desenho do analytics do gestor
// (`visao-geral/tipos.ts`): todo bloco declara `ok`/`vazio`/`erro`, nunca um
// booleano solto. Onde o conteúdo é um valor ÚNICO (não uma lista), o campo
// `conteudo` fica `null` fora de `ok` — uma lista vazia é verdade quando não há
// itens, mas um "60% concluído" vazio não tem valor honesto de repouso.
// ---------------------------------------------------------------------------

// ===========================================================================
// Tipos base
// ===========================================================================

export type Tom = "amber" | "red" | "green" | "blue" | "neutral"
export type ToneVariacao = "positivo" | "negativo"

export interface FalhaLeitura {
  codigo: string
  mensagem: string
}

/** Por que o dado não está lá — nunca um `null` que signifique três coisas. */
export type MotivoAusencia =
  | "sem-plano"
  | "sem-jornada-iniciada"
  | "sem-ajuste"
  | "sem-periodo-anterior"
  | "sem-historico-comparavel"
  | "sem-sessao-aberta"
  | "sem-atencao"
  | "sem-mudancas"
  | "sem-sinais"
  | "sem-historico-suficiente"
  | "sem-interrupcao"
  | "jornada-concluida"
  | "falha-de-leitura"

export interface EstadoBloco {
  estado: "ok" | "vazio" | "erro"
  erro: FalhaLeitura | null
  /** Literal da §31/§32 quando `estado === "vazio"`. Nunca um numeral. */
  textoVazio: string | null
  motivoVazio: MotivoAusencia | null
}

export type ComEstado<T> = T & EstadoBloco

// ===========================================================================
// SEM LASTRO — a régua da decisão do dono (2026-08-21)
// ===========================================================================

/**
 * O valor da regra "onde a spec pede um número sem fonte no banco". Os cinco
 * elementos do placar de lastro (1.3, 1.12 denominador, 1.13, 1.19, 3.6 quando
 * o plano é degenerado) usam esta forma em vez de um número.
 */
export interface SemLastro {
  lastro: "ausente"
  motivo: string
}

export type ComLastro<T> = T | SemLastro

export function semLastro(motivo: string): SemLastro {
  return { lastro: "ausente", motivo }
}

/** Type guard: separa o valor real do marcador de ausência. */
export function temLastro<T>(v: ComLastro<T>): v is T {
  return !(
    typeof v === "object" &&
    v !== null &&
    "lastro" in v &&
    (v as { lastro?: unknown }).lastro === "ausente"
  )
}

// ===========================================================================
// TELA 1 — VISÃO GERAL
// ===========================================================================

// --- §8.1 Ritmo --------------------------------------------------------------

export type EstadoRitmo = "adiantado" | "no-ritmo" | "abaixo-do-ritmo" | "retomando"

export interface IndicadorRitmo {
  estado: EstadoRitmo
  rotulo: string
}

// --- §8.2 Regularidade -------------------------------------------------------

export interface MetaRegularidade {
  vezesPorSemana: number
  rotulo: string
}

export interface IndicadorRegularidade {
  vezesPorSemana: number
  rotulo: string
  /** 1.3 — SEM LASTRO: não existe meta de frequência semanal em `study_plans`. */
  meta: ComLastro<MetaRegularidade>
}

// --- §8.3 Progresso ----------------------------------------------------------

export interface IndicadorProgresso {
  percentual: number
  rotulo: string
  /** 1.5 — SEM LASTRO só quando o plano é degenerado (`days: 0` em tudo) ou ausente. */
  metaHoje: ComLastro<{ percentual: number; rotulo: string }>
  /** null quando `metaHoje` não tem lastro — não há o que subtrair. */
  deltaPp: number | null
  deltaRotulo: string | null
}

// --- §8.4 Última atividade ----------------------------------------------------

export interface IndicadorUltimaAtividade {
  dias: number | null
  rotulo: string
  proximaSessaoRecomendadaISO: string | null
  proximaSessaoRotulo: string | null
}

export interface ConteudoComoEstou {
  ritmo: IndicadorRitmo
  regularidade: IndicadorRegularidade
  progresso: IndicadorProgresso
  ultimaAtividade: IndicadorUltimaAtividade
}

export type BlocoComoEstou = ComEstado<{ conteudo: ConteudoComoEstou | null }>

// --- §9 Mensagem-síntese ------------------------------------------------------

export interface MensagemSintese {
  texto: string
  tom: Tom
}

// --- §10 O que mudou comigo? --------------------------------------------------

export type TipoMudancaAutogestao = "sessoes" | "regularidade" | "progresso" | "retomada"

export interface ItemMudancaAutogestao {
  id: TipoMudancaAutogestao
  texto: string
  tom: ToneVariacao
  ordem: number
}

export type BlocoMudancasAutogestao = ComEstado<{
  itens: readonly ItemMudancaAutogestao[]
}>

// --- §11 O que merece minha atenção? ------------------------------------------

export type TipoAtencao = "reflexoes" | "regularidade" | "sessao-aberta"

export interface ItemAtencao {
  id: TipoAtencao
  titulo: string
  texto: string
  acaoRotulo: string
}

export type BlocoAtencaoAutogestao = ComEstado<{
  itens: readonly ItemAtencao[]
}>

// --- §12 Meu próximo movimento -------------------------------------------------

export type TipoProximoMovimento =
  | "sessao-parada"
  | "atraso-de-plano"
  | "quebra-de-regularidade"
  | "compromisso-pendente"
  | "manutencao-de-ritmo"
  | "jornada-concluida"

/** §12.1 — a ordem É a prioridade; nunca reordenar por outro critério. */
export const PRIORIDADE_PROXIMO_MOVIMENTO: readonly TipoProximoMovimento[] = [
  "jornada-concluida",
  "sessao-parada",
  "atraso-de-plano",
  "quebra-de-regularidade",
  "compromisso-pendente",
  "manutencao-de-ritmo",
]

export interface ProximoMovimento {
  tipo: TipoProximoMovimento
  titulo: string
  texto: string
  ctaPrincipal: string
  ctaSecundario: string | null
}

// --- §13 Resposta aos meus últimos ajustes -------------------------------------

export interface SemanasDentroDoPlano {
  cumpridas: number
  total: number
}

export interface ConteudoRespostaAosAjustes {
  ultimoAjusteDias: number
  ultimoAjusteRotulo: string
  decisaoTexto: string
  frequenciaAntes: number
  frequenciaDepois: number
  progressoDeltaPp: number
  /** 1.19 — SEM LASTRO: depende da meta de frequência (1.3), que não existe. */
  semanasDentroDoPlano: ComLastro<SemanasDentroDoPlano>
  disclaimer: string
}

export type BlocoRespostaAosAjustes = ComEstado<{
  conteudo: ConteudoRespostaAosAjustes | null
}>

// --- §14 Sinais do meu momento -------------------------------------------------

export interface SinalDoMomento {
  id: string
  texto: string
}

export type BlocoSinaisDoMomento = ComEstado<{
  itens: readonly SinalDoMomento[]
}>

// --- Agregado da Tela 1 --------------------------------------------------------

export interface VisaoGeralAutogestaoDados {
  estado: "ok" | "vazio" | "erro"
  erro: FalhaLeitura | null
  comoEstou: BlocoComoEstou
  sintese: MensagemSintese
  mudancas: BlocoMudancasAutogestao
  atencao: BlocoAtencaoAutogestao
  proximoMovimento: ProximoMovimento
  respostaAosAjustes: BlocoRespostaAosAjustes
  sinaisDoMomento: BlocoSinaisDoMomento
}

// ===========================================================================
// TELA 2 — MEUS PADRÕES E TENDÊNCIAS
// ===========================================================================

// --- §16 Minha regularidade ao longo do tempo ----------------------------------

export interface PontoRegularidade {
  /** 0 = semana mais antiga da série. */
  indice: number
  rotulo: string
  inicioISO: string
  fimISO: string
  diasAtivos: number
}

export type BlocoSerieRegularidade = ComEstado<{
  pontos: readonly PontoRegularidade[]
  /** 2.2 — SEM LASTRO: mesma ausência de meta de frequência (1.3). */
  metaLinha: ComLastro<MetaRegularidade>
  /** 16.1 — insight automático abaixo do gráfico; null quando não há o que dizer. */
  insight: string | null
}>

// --- §17 Meu padrão de continuidade ---------------------------------------------

export interface ConteudoContinuidade {
  frequenciaMedia: number
  frequenciaRotulo: string
  maiorIntervaloDias: number
  sequenciaAtualSemanas: number
  retomadas: number
}

export type BlocoContinuidade = ComEstado<{
  conteudo: ConteudoContinuidade | null
}>

// --- §18 O que favorece meu ritmo? ----------------------------------------------

export interface InsightFavorece {
  id: string
  texto: string
}

export type BlocoFavorece = ComEstado<{
  itens: readonly InsightFavorece[]
}>

// --- §19 Tendência atual ---------------------------------------------------------

export type EstadoTendencia =
  | "sustentando"
  | "desacelerando"
  | "retomando"
  | "sem-padrao-suficiente"

export interface LinhaTemporalTendencia {
  rotulo: string
}

export interface ConteudoTendencia {
  estado: EstadoTendencia
  texto: string
  linhaTemporal: readonly LinhaTemporalTendencia[]
}

export type BlocoTendencia = ComEstado<{
  conteudo: ConteudoTendencia | null
}>

// --- Agregado da Tela 2 -----------------------------------------------------------

export interface PadroesAutogestaoDados {
  estado: "ok" | "vazio" | "erro"
  erro: FalhaLeitura | null
  serie: BlocoSerieRegularidade
  continuidade: BlocoContinuidade
  favorece: BlocoFavorece
  tendencia: BlocoTendencia
}

// ===========================================================================
// TELA 3 — MEU MAPA DA JORNADA
// ===========================================================================

// --- §22 Minha jornada nos módulos --------------------------------------------------

export type StatusModulo = "concluido" | "em-andamento" | "nao-iniciado"

export interface ModuloTrilha {
  id: string
  ordem: number
  titulo: string
  status: StatusModulo
}

export type BlocoTrilha = ComEstado<{
  modulos: readonly ModuloTrilha[]
}>

// --- §23 Onde estou agora ------------------------------------------------------------

export interface ConteudoModuloAtual {
  id: string
  titulo: string
  progressoPercent: number
  iniciadoEmISO: string
  iniciadoEmRotulo: string
  sessoesConcluidas: number
  sessoesTotal: number
  ultimaAtividadeLabel: string
  /** null quando não há duração média medida o bastante para estimar. */
  estimativaRestanteMinutos: number | null
  estimativaRotulo: string | null
}

export type BlocoModuloAtual = ComEstado<{
  conteudo: ConteudoModuloAtual | null
}>

// --- §24 Meu próximo marco -------------------------------------------------------------

export interface ConteudoProximoMarco {
  moduloTitulo: string
  /** 3.6 — SEM LASTRO quando o plano não define dias para o módulo (`days: 0`). */
  prazo: ComLastro<{ dataISO: string; rotulo: string }>
  texto: string
}

export type BlocoProximoMarco = ComEstado<{
  conteudo: ConteudoProximoMarco | null
}>

// --- §25 Onde costumo perder ritmo? -----------------------------------------------------

export interface ConteudoPerdaDeRitmo {
  texto: string
  mediaDiasPausa: number
}

export type BlocoPerdaDeRitmo = ComEstado<{
  conteudo: ConteudoPerdaDeRitmo | null
}>

// --- §26 Histórico recente dos módulos --------------------------------------------------

export interface HistoricoModulo {
  id: string
  titulo: string
  estadoLabel: string
  progressoPercent: number
  ultimaAtividadeLabel: string
}

export type BlocoHistorico = ComEstado<{
  itens: readonly HistoricoModulo[]
}>

// --- Agregado da Tela 3 -------------------------------------------------------------------

export interface MapaJornadaAutogestaoDados {
  estado: "ok" | "vazio" | "erro"
  erro: FalhaLeitura | null
  trilha: BlocoTrilha
  moduloAtual: BlocoModuloAtual
  proximoMarco: BlocoProximoMarco
  perdaDeRitmo: BlocoPerdaDeRitmo
  historico: BlocoHistorico
}

// ===========================================================================
// MAPA DE CALOR DE ATIVIDADE — reusado por DOIS consumidores: a Autogestão
// (escopo = um aluno) e o Analytics de time do gestor (escopo = todos os
// alunos do tenant). A MESMA grade, duas fontes de carimbos — o escopo é
// decisão de QUEM MONTA os carimbos (`mapa-de-calor.ts`), nunca um branch
// dentro dos tipos ou do cálculo. Por isso nenhum tipo abaixo carrega
// `studentId`/`alunoId`: a grade não sabe, e não precisa saber, de quem são
// os carimbos que a formaram.
//
// Abaixo do piso de amostra (`MAPA_DE_CALOR_MIN_ATIVIDADES`, `parametros.ts`),
// o bloco devolve `SemLastro` — nunca uma grade quase vazia (decisão do
// dono). Ver `ResultadoMapaDeCalor` ao final desta seção.
// ===========================================================================

export interface CelulaMapaDeCalor {
  /** 0 = domingo .. 6 = sábado, no fuso do TENANT — nunca o do processo. */
  diaSemana: number
  /** 0..`MAPA_DE_CALOR_FAIXAS - 1` — cada faixa cobre `MAPA_DE_CALOR_HORAS_POR_FAIXA` horas locais. */
  faixa: number
  contagem: number
}

export interface GradeMapaDeCalor {
  /** 7 linhas (diaSemana) × 12 colunas (faixa) — sempre as 84 células, nunca esparso. */
  celulas: readonly (readonly CelulaMapaDeCalor[])[]
  /** Maior `contagem` de UMA célula — normaliza a escala de cor de quem desenha. */
  maximo: number
}

export interface DiaCalendario {
  /** "AAAA-MM-DD" — chave do dia LOCAL do tenant (mesmo idioma de `chaveDiaUtc(ms + offset)`). */
  diaUtc: string
  contagem: number
}

export interface SemanaCalendario {
  /** 0 = semana mais antiga do calendário. */
  indice: number
  inicioMs: number
  fimMs: number
  rotulo: string
  /** Sempre 7 entradas, domingo a sábado, nesta ordem. */
  dias: readonly DiaCalendario[]
}

export interface CalendarioMapaDeCalor {
  semanas: readonly SemanaCalendario[]
  maximo: number
}

export interface MapaDeCalorAtividade {
  grade: GradeMapaDeCalor
  calendario: CalendarioMapaDeCalor
}

/** SEM LASTRO quando a amostra bruta não sustenta a grade — nunca `0` fingido. */
export type ResultadoMapaDeCalor = ComLastro<MapaDeCalorAtividade>
