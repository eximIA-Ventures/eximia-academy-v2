// ---------------------------------------------------------------------------
// Montagem da Autogestão — as funções PURAS que transformam leitura crua nos
// três objetos de tela (Visão Geral, Padrões e Tendências, Mapa da Jornada).
// ---------------------------------------------------------------------------
// Nenhuma função aqui chama `Date.now()`, faz I/O ou lê `process.env`. O
// "agora" entra SEMPRE como `agora: Date`, parâmetro explícito das três
// funções de topo (`montarVisaoGeralAutogestao`, `montarPadroesAutogestao`,
// `montarMapaAutogestao`) — é o que permite ao teste deslocar o relógio e
// tornar "retomando há 14 dias" uma propriedade verificável, não uma promessa.
//
// Dias são contados em UTC (I-6, herdado do analytics do gestor):
// `chaveDiaUtc`/`diasUtcEntre`/`diasDistintosUtc`/`diasDistintosOrdenados` vêm
// de `../visao-geral/dia-utc`, e o bucket semanal reaproveita
// `../padroes-tendencias/semanas` — a MESMA aritmética de calendário que o
// gestor já testou, para esta tela não reabrir o mesmo defeito de fuso.
// ---------------------------------------------------------------------------

import { bucketizarSemanas } from "../padroes-tendencias/semanas"
import {
  chaveDiaUtc,
  diasDistintosOrdenados,
  diasDistintosUtc,
  diasUtcEntre,
} from "../visao-geral/dia-utc"
import type {
  FonteAutogestao,
  LinhaCapitulo,
  LinhaPlano,
  LinhaProgressoCapitulo,
  LinhaSessao,
  ModuloDuracaoPlano,
} from "./fonte"
import { primeiraFalha } from "./fonte"
import {
  CONCENTRACAO_MIN_FRACAO,
  DIAS_ATIVOS_SEMANA_REGULAR,
  FAVORECE_MIN_SEMANAS,
  FREQUENCIA_MEDIA_MIN_PERIODO_DIAS,
  HISTORICO_MODULOS_MAX,
  HORARIO_MIN_SESSOES,
  INSIGHT_MIN_OCORRENCIAS,
  JANELA_INICIO_MODULO_DIAS,
  MS_DIA,
  PARADO_DIAS,
  PAUSA_LONGA_DIAS,
  PERDA_DE_RITMO_MIN_OCORRENCIAS,
  RETOMADA_JANELA_DIAS,
  RITMO_TOLERANCIA_PP,
  SERIE_SEMANAS_MAX,
  SERIE_SEMANAS_MIN,
  SESSAO_PARADA_MIN_DIAS,
  SUSTENTANDO_SEMANAS,
} from "./parametros"
import {
  CTA_AJUSTAR_MEU_PLANO,
  CTA_AJUSTAR_PRAZO,
  CTA_CONTINUAR_MODULO,
  CTA_FAZER_NOVO_AJUSTE,
  CTA_PLANEJAR_SEMANA,
  CTA_RETOMAR_AGORA,
  CTA_RETOMAR_MEU_PLANO,
  CTA_RETOMAR_SESSAO,
  CTA_VER_CONTEUDO,
  CTA_VER_MEU_PLANO,
  CTA_VER_REFLEXOES,
  DISCLAIMER_CAUSALIDADE,
  MOTIVO_PLANO_AUSENTE,
  MOTIVO_PLANO_SEM_DURACAO,
  MOTIVO_SEM_META_FREQUENCIA,
  ROTULO_RITMO,
  ROTULO_STATUS_MODULO,
  ROTULO_TENDENCIA,
  SINTESE_ABAIXO_DO_RITMO,
  SINTESE_ADIANTADO,
  SINTESE_NO_RITMO,
  SINTESE_RETOMANDO,
  contagem,
  fraseAssociacao,
  rotuloUltimaAtividade,
  textoDoMotivo,
} from "./textos"
import {
  type BlocoAtencaoAutogestao,
  type BlocoComoEstou,
  type BlocoContinuidade,
  type BlocoFavorece,
  type BlocoHistorico,
  type BlocoModuloAtual,
  type BlocoMudancasAutogestao,
  type BlocoPerdaDeRitmo,
  type BlocoProximoMarco,
  type BlocoRespostaAosAjustes,
  type BlocoSerieRegularidade,
  type BlocoSinaisDoMomento,
  type BlocoTendencia,
  type BlocoTrilha,
  type ComLastro,
  type EstadoRitmo,
  type EstadoTendencia,
  type MapaJornadaAutogestaoDados,
  type MensagemSintese,
  PRIORIDADE_PROXIMO_MOVIMENTO,
  type PadroesAutogestaoDados,
  type PontoRegularidade,
  type ProximoMovimento,
  type StatusModulo,
  type TipoProximoMovimento,
  type VisaoGeralAutogestaoDados,
  semLastro,
  temLastro,
} from "./tipos"

// ===========================================================================
// Utilidades de data — puras, UTC, sem `Date.now()`
// ===========================================================================

function parseMs(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : t
}

function diaUtcParaMs(diaUtc: string): number {
  return Date.parse(`${diaUtc}T00:00:00.000Z`)
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function arredondarUmaCasa(v: number): number {
  return Math.round(v * 10) / 10
}

/** "02/08/2025" — dia/mês/ano, deslocado pelo fuso do tenant (offset em ms). */
function formatarDataBr(ms: number, offsetMs: number): string {
  const chave = chaveDiaUtc(ms + offsetMs)
  const [ano, mes, dia] = chave.split("-")
  return `${dia}/${mes}/${ano}`
}

function offsetMs(fonte: FonteAutogestao): number {
  return (fonte.fusoHorarioMinutosOffset ?? 0) * 60_000
}

const DIAS_SEMANA_ATE = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
] as const

/** 1.7 — fim da semana corrente (o próximo domingo, local do tenant), inclusive hoje se hoje já é domingo. */
export function fimDaSemanaCorrenteMs(agoraMs: number, offsetMsLocal: number): number {
  const localMs = agoraMs + offsetMsLocal
  const diaSemana = new Date(localMs).getUTCDay() // 0 = domingo, no referencial local
  const diasAteDomingo = (7 - diaSemana) % 7
  const domingoLocalMs = diaUtcParaMs(chaveDiaUtc(localMs)) + diasAteDomingo * MS_DIA
  return domingoLocalMs - offsetMsLocal
}

// ===========================================================================
// Carimbos de atividade — a união das 3 fontes que o contrato 1.2 declara
// ===========================================================================

/** `sessions.created_at` ∪ `slide_reflections.created_at` ∪ `chapter_view_progress.last_viewed_at`. */
export function carimbosDeAtividade(
  fonte: Pick<FonteAutogestao, "sessoes" | "reflexoes" | "progresso">,
): number[] {
  const out: number[] = []
  for (const s of fonte.sessoes) {
    const t = parseMs(s.created_at)
    if (t !== null) out.push(t)
  }
  for (const r of fonte.reflexoes) {
    const t = parseMs(r.created_at)
    if (t !== null) out.push(t)
  }
  for (const p of fonte.progresso) {
    const t = parseMs(p.last_viewed_at)
    if (t !== null) out.push(t)
  }
  return out
}

/** Todos os dias UTC distintos com atividade, do mais antigo ao mais recente. */
export function diasAtivosOrdenados(
  fonte: Pick<FonteAutogestao, "sessoes" | "reflexoes" | "progresso">,
): readonly string[] {
  return diasDistintosOrdenados(carimbosDeAtividade(fonte))
}

// ===========================================================================
// §8.2 / §17 — Regularidade (contrato 1.2, 2.3)
// ===========================================================================

/** Dias distintos ÷ semanas do período. Várias sessões no MESMO dia contam 1. */
export function regularidadeVezesPorSemana(
  diasAtivosNoPeriodo: number,
  periodoDias: number,
): number {
  const semanas = periodoDias / 7
  if (semanas <= 0) return 0
  return arredondarUmaCasa(diasAtivosNoPeriodo / semanas)
}

/** "1,8x por semana" · "2x por semana" — sem `.0` supérfluo no caso inteiro. */
export function rotuloVezesPorSemana(vezesPorSemana: number): string {
  const arred = arredondarUmaCasa(vezesPorSemana)
  const texto = Number.isInteger(arred) ? String(arred) : arred.toFixed(1).replace(".", ",")
  return `${texto}x por semana`
}

/**
 * §17 — "Frequência média" só é uma palavra honesta quando a janela cobre
 * mais de 1 semana (`periodoDias >= FREQUENCIA_MEDIA_MIN_PERIODO_DIAS`,
 * parametros.ts). Achado da revisão adversarial (Annie Duke, 2026-08-21): com
 * o filtro em 7 dias há UMA única semana de dado — chamar isso de "média"
 * implica uma segunda semana para comparar que não existe, e "Nx por semana"
 * lê como taxa extrapolada de um histórico que o aluno não tem. Abaixo do
 * piso, o rótulo vira uma contagem simples desta semana, nunca a palavra
 * "média" nem a fração "por semana".
 */
export function rotuloFrequenciaMedia(diasAtivosNoPeriodo: number, periodoDias: number): string {
  if (periodoDias < FREQUENCIA_MEDIA_MIN_PERIODO_DIAS) {
    return `${contagem(diasAtivosNoPeriodo, "dia ativo", "dias ativos")} nesta semana`
  }
  return rotuloVezesPorSemana(regularidadeVezesPorSemana(diasAtivosNoPeriodo, periodoDias))
}

// ===========================================================================
// §8.3 — Progresso (contrato 1.4, 1.5)
// ===========================================================================

/** `chapter_view_progress.reached_last_slide_at` ÷ total de módulos do curso. */
export function progressoRealPercent(
  progresso: readonly LinhaProgressoCapitulo[],
  capitulos: readonly LinhaCapitulo[],
): number {
  if (capitulos.length === 0) return 0
  const concluidos = new Set(
    progresso.filter((p) => p.reached_last_slide_at).map((p) => p.chapter_id),
  )
  const idsDoCurso = new Set(capitulos.map((c) => c.id))
  let n = 0
  for (const id of concluidos) if (idsDoCurso.has(id)) n++
  return Math.round((n / capitulos.length) * 100)
}

/**
 * Progresso reconstruído "como se fosse `ateMs`": conta só os módulos cujo
 * `reached_last_slide_at` já tinha acontecido NAQUELE instante. É o que torna
 * o delta 1.11 verificável sem uma tabela de séries históricas de progresso —
 * o próprio carimbo de conclusão de cada módulo já É a série no tempo.
 */
export function progressoRealPercentAteMs(
  progresso: readonly LinhaProgressoCapitulo[],
  capitulos: readonly LinhaCapitulo[],
  ateMs: number,
): number {
  if (capitulos.length === 0) return 0
  const idsDoCurso = new Set(capitulos.map((c) => c.id))
  const concluidos = new Set<string>()
  for (const p of progresso) {
    const t = parseMs(p.reached_last_slide_at)
    if (t !== null && t <= ateMs && idsDoCurso.has(p.chapter_id)) concluidos.add(p.chapter_id)
  }
  return Math.round((concluidos.size / capitulos.length) * 100)
}

/** Soma de `days` do plano. `<= 0` é o plano degenerado (medido: 4 de 5 na produção). */
export function duracaoTotalPlanejadaDias(moduleDurations: readonly ModuloDuracaoPlano[]): number {
  return moduleDurations.reduce((acc, m) => acc + Math.max(0, m.days), 0)
}

/** 1.5 — "onde o plano previa estar hoje". SEM LASTRO sem plano ou plano degenerado. */
export function progressoPlanejadoHoje(
  plano: LinhaPlano | null,
  agoraMs: number,
): ComLastro<number> {
  if (!plano) return semLastro(MOTIVO_PLANO_AUSENTE)
  const total = duracaoTotalPlanejadaDias(plano.moduleDurations)
  if (total <= 0) return semLastro(MOTIVO_PLANO_SEM_DURACAO)
  const inicioMs = parseMs(plano.startDateISO)
  if (inicioMs === null) return semLastro(MOTIVO_PLANO_SEM_DURACAO)
  const decorridos = clamp(diasUtcEntre(inicioMs, agoraMs), 0, total)
  return Math.round((decorridos / total) * 100)
}

// ===========================================================================
// §6 / §17 — Pausas, retomadas e sequências (contrato 1.1, 1.15, 2.4, 2.5, 2.6)
// ===========================================================================

/** Estado de pausa CORRENTE: "parado" (§6), "retomando" (§6) ou `null` (nem um nem outro). */
export function estadoDePausa(
  dias: readonly string[],
  agoraMs: number,
): "parado" | "retomando" | null {
  if (dias.length === 0) return null
  const ultimoDiaMs = diaUtcParaMs(dias[dias.length - 1] as string)
  if (diasUtcEntre(ultimoDiaMs, agoraMs) >= PARADO_DIAS) return "parado"
  for (let i = dias.length - 1; i >= 1; i--) {
    const anteriorMs = diaUtcParaMs(dias[i - 1] as string)
    const atualMs = diaUtcParaMs(dias[i] as string)
    const gap = diasUtcEntre(anteriorMs, atualMs)
    if (gap >= PARADO_DIAS) {
      const diasDesdeRetorno = diasUtcEntre(atualMs, agoraMs)
      return diasDesdeRetorno <= RETOMADA_JANELA_DIAS ? "retomando" : null
    }
  }
  return null
}

/** §17 — retornos após ≥14 dias de pausa (contrato 2.6: 13d não conta, 15d conta). */
export function contarRetomadas(dias: readonly string[]): number {
  let n = 0
  for (let i = 1; i < dias.length; i++) {
    const anteriorMs = diaUtcParaMs(dias[i - 1] as string)
    const atualMs = diaUtcParaMs(dias[i] as string)
    if (diasUtcEntre(anteriorMs, atualMs) >= PARADO_DIAS) n++
  }
  return n
}

/** §17 — maior lacuna entre dois dias ativos consecutivos. */
export function maiorIntervaloDias(dias: readonly string[]): number {
  let maior = 0
  for (let i = 1; i < dias.length; i++) {
    const anteriorMs = diaUtcParaMs(dias[i - 1] as string)
    const atualMs = diaUtcParaMs(dias[i] as string)
    maior = Math.max(maior, diasUtcEntre(anteriorMs, atualMs))
  }
  return maior
}

/** §17 — semanas consecutivas terminando "agora" com ao menos 1 dia ativo. */
export function sequenciaAtualSemanas(dias: readonly string[], agoraMs: number): number {
  const carimbos = dias.map(diaUtcParaMs)
  let semanas = 0
  for (let fim = agoraMs; ; fim -= 7 * MS_DIA) {
    const inicio = fim - 7 * MS_DIA
    const teveAtividade = carimbos.some((t) => t >= inicio && t < fim)
    if (!teveAtividade) break
    semanas++
    if (semanas > 520) break // guarda de segurança (10 anos), nunca deveria disparar
  }
  return semanas
}

/**
 * Latência de retomada: dias entre o dia de VOLTA de uma pausa ≥`PAUSA_LONGA_DIAS`
 * e o PRÓXIMO dia ativo depois dele. Reaproveitada em dois lugares da spec, que
 * cita literalmente o MESMO insight em §14 (Tela 1, sinal do momento) e §18
 * (Tela 2, o que favorece meu ritmo) — não é atalho, é a mesma pergunta feita
 * duas vezes na especificação.
 *
 * `agoraMs`, quando informado, exclui a ocorrência cujo retorno ainda está
 * dentro de `RETOMADA_JANELA_DIAS` de "agora" — a MESMA janela que
 * `estadoDePausa` usa para "ainda estou retomando" (§6). Achado da revisão
 * adversarial (Annie Duke, 2026-08-21): uma retomada ainda em curso não é uma
 * observação madura o bastante para entrar numa média — "Retomadas: 2" pode
 * conter uma que aconteceu há muito tempo (madura) e outra que é o próprio
 * "agora" do aluno (ele acabou de voltar; ainda não sabemos se o padrão
 * segura). Sem `agoraMs` (chamada só com o histórico de dias, sem relógio),
 * nenhuma exclusão acontece — mantém o comportamento anterior intacto.
 */
export function latenciasDeRetomada(dias: readonly string[], agoraMs?: number): number[] {
  const out: number[] = []
  for (let i = 1; i < dias.length - 1; i++) {
    const anteriorMs = diaUtcParaMs(dias[i - 1] as string)
    const retornoMs = diaUtcParaMs(dias[i] as string)
    const gap = diasUtcEntre(anteriorMs, retornoMs)
    if (gap > PAUSA_LONGA_DIAS) {
      const aindaEmCurso =
        agoraMs !== undefined && diasUtcEntre(retornoMs, agoraMs) <= RETOMADA_JANELA_DIAS
      if (!aindaEmCurso) {
        const proximoMs = diaUtcParaMs(dias[i + 1] as string)
        out.push(diasUtcEntre(retornoMs, proximoMs))
      }
    }
  }
  return out
}

/**
 * Média das latências, ou SEM LASTRO por amostra insuficiente (contrato 1.22).
 * `INSIGHT_MIN_OCORRENCIAS` (parametros.ts) é o piso: abaixo dele, 1 ocorrência
 * é anedota, não padrão — nunca um número solto na tela.
 */
export function latenciaMediaDeRetomada(
  dias: readonly string[],
  agoraMs?: number,
): ComLastro<number> {
  const latencias = latenciasDeRetomada(dias, agoraMs)
  if (latencias.length < INSIGHT_MIN_OCORRENCIAS) {
    return semLastro("poucas pausas longas registradas para calcular uma latência média")
  }
  const soma = latencias.reduce((a, b) => a + b, 0)
  return Math.round(soma / latencias.length)
}

// ===========================================================================
// §8.1 — Ritmo (contrato 1.1)
// ===========================================================================

export function calcularRitmo(
  progressoRealPct: number,
  progressoPlanejado: ComLastro<number>,
  estadoPausa: "parado" | "retomando" | null,
): EstadoRitmo {
  if (estadoPausa === "retomando") return "retomando"
  if (!temLastro(progressoPlanejado)) return "no-ritmo"
  const diff = progressoRealPct - progressoPlanejado
  if (diff > RITMO_TOLERANCIA_PP) return "adiantado"
  if (diff < -RITMO_TOLERANCIA_PP) return "abaixo-do-ritmo"
  return "no-ritmo"
}

function mensagemSintese(estado: EstadoRitmo): MensagemSintese {
  switch (estado) {
    case "adiantado":
      return { texto: SINTESE_ADIANTADO, tom: "green" }
    case "no-ritmo":
      return { texto: SINTESE_NO_RITMO, tom: "green" }
    case "abaixo-do-ritmo":
      return { texto: SINTESE_ABAIXO_DO_RITMO, tom: "amber" }
    case "retomando":
      return { texto: SINTESE_RETOMANDO, tom: "blue" }
  }
}

// ===========================================================================
// §10 — O que mudou comigo? (contrato 1.9, 1.10, 1.11)
// ===========================================================================

export function janelaAtual(agoraMs: number, periodoDias: number): { inicio: number; fim: number } {
  return { inicio: agoraMs - periodoDias * MS_DIA, fim: agoraMs }
}

export function janelaAnterior(
  agoraMs: number,
  periodoDias: number,
): { inicio: number; fim: number } {
  const { inicio } = janelaAtual(agoraMs, periodoDias)
  return { inicio: inicio - periodoDias * MS_DIA, fim: inicio }
}

function contarSessoesNaJanela(
  sessoes: readonly LinhaSessao[],
  loMs: number,
  hiMs: number,
): number {
  let n = 0
  for (const s of sessoes) {
    const t = parseMs(s.created_at)
    if (t !== null && t >= loMs && t < hiMs) n++
  }
  return n
}

/** 1.9 — "+1 sessão em relação ao período anterior". */
export function deltaSessoes(atual: number, anterior: number): number {
  return atual - anterior
}

/** 1.10 — variação percentual de regularidade entre janelas ("−15%"). */
export function deltaRegularidadePercent(atual: number, anterior: number): number | null {
  if (anterior <= 0) return null
  return Math.round((atual / anterior - 1) * 100)
}

/** 1.11 — variação de progresso, em pontos percentuais ("+5 p.p."). */
export function deltaProgressoPp(atual: number, anterior: number): number {
  return atual - anterior
}

// ===========================================================================
// §11 — O que merece minha atenção? (contrato 1.14)
// ===========================================================================

/** A sessão incompleta mais antiga (§12 Regra B), ou `null` se não houver nenhuma. */
export function sessaoEmAberto(
  sessoes: readonly LinhaSessao[],
  agoraMs: number,
): { chapterId: string | null; sessionId: string; diasAberta: number } | null {
  let escolhida: LinhaSessao | null = null
  for (const s of sessoes) {
    if (s.completed_at) continue
    if (!escolhida || Date.parse(s.created_at) < Date.parse(escolhida.created_at)) escolhida = s
  }
  if (!escolhida) return null
  const dias = diasUtcEntre(Date.parse(escolhida.created_at), agoraMs)
  if (dias < SESSAO_PARADA_MIN_DIAS) return null
  return { chapterId: escolhida.chapter_id, sessionId: escolhida.id, diasAberta: dias }
}

// ===========================================================================
// §12 — Meu próximo movimento (contrato 1.15)
// ===========================================================================

export interface CandidatosProximoMovimento {
  jornadaConcluida: boolean
  sessaoParada: boolean
  atrasoDePlano: boolean
  quebraDeRegularidade: boolean
  compromissoPendente: boolean
}

/** §12.1 — a ordem de `PRIORIDADE_PROXIMO_MOVIMENTO` decide, nunca a soma de sinais. */
export function escolherProximoMovimento(c: CandidatosProximoMovimento): TipoProximoMovimento {
  const aplicavel: Record<TipoProximoMovimento, boolean> = {
    "jornada-concluida": c.jornadaConcluida,
    "sessao-parada": c.sessaoParada,
    "atraso-de-plano": c.atrasoDePlano,
    "quebra-de-regularidade": c.quebraDeRegularidade,
    "compromisso-pendente": c.compromissoPendente,
    "manutencao-de-ritmo": true, // fallback — sempre aplicável (§32 Regra D)
  }
  for (const tipo of PRIORIDADE_PROXIMO_MOVIMENTO) {
    if (aplicavel[tipo]) return tipo
  }
  return "manutencao-de-ritmo"
}

function montarProximoMovimento(
  tipo: TipoProximoMovimento,
  contexto: { moduloTitulo: string | null; diasAberta: number | null },
): ProximoMovimento {
  switch (tipo) {
    case "jornada-concluida":
      return {
        tipo,
        titulo: "Você concluiu sua jornada",
        texto: "Revise sua evolução ou feche esta jornada.",
        ctaPrincipal: CTA_VER_MEU_PLANO,
        ctaSecundario: null,
      }
    case "sessao-parada":
      return {
        tipo,
        titulo: contexto.moduloTitulo
          ? `Retome "${contexto.moduloTitulo}"`
          : "Retome sua sessão em aberto",
        texto: "Conclua a sessão para voltar ao ritmo do seu plano.",
        ctaPrincipal: CTA_RETOMAR_SESSAO,
        ctaSecundario: null,
      }
    case "atraso-de-plano":
      return {
        tipo,
        titulo: "Seu progresso está abaixo do previsto",
        texto: "Veja o menor passo necessário para recuperar o ritmo.",
        ctaPrincipal: CTA_RETOMAR_AGORA,
        ctaSecundario: CTA_AJUSTAR_MEU_PLANO,
      }
    case "quebra-de-regularidade":
      return {
        tipo,
        titulo: "Sua frequência está abaixo do combinado",
        texto: "Deseja retomar ou ajustar seu plano?",
        ctaPrincipal: CTA_RETOMAR_MEU_PLANO,
        ctaSecundario: CTA_AJUSTAR_MEU_PLANO,
      }
    case "compromisso-pendente":
      return {
        tipo,
        titulo: "Há um compromisso pendente do seu plano",
        texto: "Revise o que ficou em aberto.",
        ctaPrincipal: CTA_PLANEJAR_SEMANA,
        ctaSecundario: null,
      }
    case "manutencao-de-ritmo":
      return {
        tipo,
        titulo: "Você sustentou seu ritmo",
        texto: "Mantenha o padrão.",
        ctaPrincipal: CTA_VER_MEU_PLANO,
        ctaSecundario: null,
      }
  }
}

// ===========================================================================
// §14 — Sinais do meu momento (contrato 1.20, 1.21, 1.22)
// ===========================================================================

const FAIXAS_HORARIO: readonly { id: string; rotulo: string; deHora: number; ateHora: number }[] = [
  { id: "madrugada", rotulo: "0h–6h", deHora: 0, ateHora: 6 },
  { id: "manha", rotulo: "6h–12h", deHora: 6, ateHora: 12 },
  { id: "tarde", rotulo: "12h–19h", deHora: 12, ateHora: 19 },
  { id: "noite", rotulo: "19h–22h", deHora: 19, ateHora: 22 },
  { id: "fim-de-noite", rotulo: "22h–24h", deHora: 22, ateHora: 24 },
]

/** 1.20 — faixa horária de maior concentração, ou `null` sem amostra/concentração suficiente. */
export function melhorHorario(
  sessoes: readonly LinhaSessao[],
  offsetMsLocal: number,
): string | null {
  if (sessoes.length < HORARIO_MIN_SESSOES) return null
  const porFaixa = new Map<string, number>()
  for (const s of sessoes) {
    const t = parseMs(s.created_at)
    if (t === null) continue
    const hora = new Date(t + offsetMsLocal).getUTCHours()
    const faixa = FAIXAS_HORARIO.find((f) => hora >= f.deHora && hora < f.ateHora)
    if (faixa) porFaixa.set(faixa.id, (porFaixa.get(faixa.id) ?? 0) + 1)
  }
  let melhorId: string | null = null
  let melhorN = 0
  for (const [id, n] of porFaixa) {
    if (n > melhorN) {
      melhorId = id
      melhorN = n
    }
  }
  if (!melhorId || melhorN / sessoes.length < CONCENTRACAO_MIN_FRACAO) return null
  return FAIXAS_HORARIO.find((f) => f.id === melhorId)?.rotulo ?? null
}

const DIAS_SEMANA_PT: readonly string[] = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
]

/** 1.21 — os até 2 dias da semana de maior concentração, ou `[]` se a distribuição for plana. */
export function diasDaSemanaPreferidos(
  sessoes: readonly LinhaSessao[],
  offsetMsLocal: number,
): string[] {
  if (sessoes.length < HORARIO_MIN_SESSOES) return []
  const porDia = new Map<number, number>()
  for (const s of sessoes) {
    const t = parseMs(s.created_at)
    if (t === null) continue
    const diaSemana = new Date(t + offsetMsLocal).getUTCDay()
    porDia.set(diaSemana, (porDia.get(diaSemana) ?? 0) + 1)
  }
  const ordenados = [...porDia.entries()].sort((a, b) => b[1] - a[1])
  const top2 = ordenados.slice(0, 2)
  const somaTop2 = top2.reduce((acc, [, n]) => acc + n, 0)
  if (somaTop2 / sessoes.length < CONCENTRACAO_MIN_FRACAO) return []
  return top2.map(([dia]) => DIAS_SEMANA_PT[dia] as string)
}

// ===========================================================================
// TELA 1 — VISÃO GERAL
// ===========================================================================

/**
 * "Nunca iniciou a jornada": zero atividade E zero plano — nada para ancorar
 * sequer um "0%". Um plano SEM atividade ainda tem chão para computar ritmo
 * real (contrato 1.1: "concluir 0 [módulos], esperar Abaixo do ritmo" é
 * justamente um aluno com plano e zero progresso — isso é "abaixo do ritmo",
 * não "vazio"). Só quando NEM plano existe é que não há nada a mostrar.
 */
function nuncaIniciouJornada(fonte: FonteAutogestao): boolean {
  return (
    fonte.plano === null &&
    fonte.sessoes.length === 0 &&
    fonte.reflexoes.length === 0 &&
    fonte.progresso.length === 0
  )
}

export function montarVisaoGeralAutogestao(
  fonte: FonteAutogestao,
  agora: Date,
): VisaoGeralAutogestaoDados {
  const agoraMs = agora.getTime()
  const { falhas } = fonte
  const falhaGeral = primeiraFalha(falhas, [
    "sessoes",
    "reflexoes",
    "progresso",
    "capitulos",
    "plano",
  ])

  if (falhaGeral) {
    const blocoErro = {
      estado: "erro" as const,
      erro: falhaGeral,
      textoVazio: null,
      motivoVazio: null,
    }
    return {
      estado: "erro",
      erro: falhaGeral,
      comoEstou: { ...blocoErro, conteudo: null },
      sintese: { texto: textoDoMotivo("falha-de-leitura"), tom: "neutral" },
      mudancas: { ...blocoErro, itens: [] },
      atencao: { ...blocoErro, itens: [] },
      proximoMovimento: montarProximoMovimento("manutencao-de-ritmo", {
        moduloTitulo: null,
        diasAberta: null,
      }),
      respostaAosAjustes: { ...blocoErro, conteudo: null },
      sinaisDoMomento: { ...blocoErro, itens: [] },
    }
  }

  if (nuncaIniciouJornada(fonte)) {
    const vazio = {
      estado: "vazio" as const,
      erro: null,
      textoVazio: textoDoMotivo("sem-jornada-iniciada"),
      motivoVazio: "sem-jornada-iniciada" as const,
    }
    return {
      estado: "vazio",
      erro: null,
      comoEstou: { ...vazio, conteudo: null },
      sintese: { texto: textoDoMotivo("sem-jornada-iniciada"), tom: "neutral" },
      mudancas: { ...vazio, itens: [] },
      atencao: { ...vazio, itens: [] },
      proximoMovimento: montarProximoMovimento("manutencao-de-ritmo", {
        moduloTitulo: null,
        diasAberta: null,
      }),
      respostaAosAjustes: { ...vazio, conteudo: null },
      sinaisDoMomento: { ...vazio, itens: [] },
    }
  }

  const dias = diasAtivosOrdenados(fonte)
  const estadoPausa = estadoDePausa(dias, agoraMs)
  const progressoReal = progressoRealPercent(fonte.progresso, fonte.capitulos)
  const progressoPlanejado = progressoPlanejadoHoje(fonte.plano, agoraMs)
  const ritmo = calcularRitmo(progressoReal, progressoPlanejado, estadoPausa)

  const { inicio: atualIni, fim: atualFim } = janelaAtual(agoraMs, fonte.periodoDias)
  const { inicio: anteriorIni, fim: anteriorFim } = janelaAnterior(agoraMs, fonte.periodoDias)
  const diasAtivosAtual = diasDistintosUtc(carimbosDeAtividade(fonte), atualIni, atualFim).size
  const diasAtivosAnterior = diasDistintosUtc(
    carimbosDeAtividade(fonte),
    anteriorIni,
    anteriorFim,
  ).size
  const regularidadeAtual = regularidadeVezesPorSemana(diasAtivosAtual, fonte.periodoDias)
  const regularidadeAnterior = regularidadeVezesPorSemana(diasAtivosAnterior, fonte.periodoDias)

  const metaRegularidade = semLastro(MOTIVO_SEM_META_FREQUENCIA)

  const ultimoDia = dias.length > 0 ? diaUtcParaMs(dias[dias.length - 1] as string) : null
  const diasDesdeUltima = ultimoDia !== null ? diasUtcEntre(ultimoDia, agoraMs) : null

  const comoEstou: BlocoComoEstou = {
    estado: "ok",
    erro: null,
    textoVazio: null,
    motivoVazio: null,
    conteudo: {
      ritmo: { estado: ritmo, rotulo: ROTULO_RITMO[ritmo] as string },
      regularidade: {
        vezesPorSemana: regularidadeAtual,
        rotulo: rotuloVezesPorSemana(regularidadeAtual),
        meta: metaRegularidade,
      },
      progresso: {
        percentual: progressoReal,
        rotulo: `${progressoReal}%`,
        metaHoje: temLastro(progressoPlanejado)
          ? { percentual: progressoPlanejado, rotulo: `${progressoPlanejado}%` }
          : progressoPlanejado,
        deltaPp: temLastro(progressoPlanejado) ? progressoReal - progressoPlanejado : null,
        deltaRotulo: temLastro(progressoPlanejado)
          ? `${progressoReal - progressoPlanejado >= 0 ? "+" : ""}${progressoReal - progressoPlanejado} p.p. em relação ao planejado`
          : null,
      },
      ultimaAtividade: {
        dias: diasDesdeUltima,
        rotulo: rotuloUltimaAtividade(diasDesdeUltima),
        // 1.7 — só recomenda um alvo quando o aluno está abaixo do ritmo; "no
        // ritmo"/"adiantado" não precisam de uma data empurrando o próximo passo.
        proximaSessaoRecomendadaISO:
          ritmo === "abaixo-do-ritmo"
            ? new Date(fimDaSemanaCorrenteMs(agoraMs, offsetMs(fonte))).toISOString()
            : null,
        proximaSessaoRotulo:
          ritmo === "abaixo-do-ritmo"
            ? `até ${DIAS_SEMANA_ATE[new Date(fimDaSemanaCorrenteMs(agoraMs, offsetMs(fonte)) + offsetMs(fonte)).getUTCDay()]}`
            : null,
      },
    },
  }

  // --- §10 O que mudou comigo? -----------------------------------------------
  const mudancasItens: BlocoMudancasAutogestao["itens"][number][] = []
  const dSessoes = deltaSessoes(
    contarSessoesNaJanela(fonte.sessoes, atualIni, atualFim),
    contarSessoesNaJanela(fonte.sessoes, anteriorIni, anteriorFim),
  )
  if (dSessoes !== 0) {
    mudancasItens.push({
      id: "sessoes",
      texto: `${dSessoes > 0 ? "+" : ""}${dSessoes} ${Math.abs(dSessoes) === 1 ? "sessão" : "sessões"} em relação ao período anterior.`,
      tom: dSessoes > 0 ? "positivo" : "negativo",
      ordem: mudancasItens.length + 1,
    })
  }
  const dRegularidade = deltaRegularidadePercent(regularidadeAtual, regularidadeAnterior)
  if (dRegularidade !== null && dRegularidade !== 0) {
    mudancasItens.push({
      id: "regularidade",
      texto: `Frequência ${dRegularidade > 0 ? "subiu" : "caiu"} ${Math.abs(dRegularidade)}% em relação ao período anterior.`,
      tom: dRegularidade > 0 ? "positivo" : "negativo",
      ordem: mudancasItens.length + 1,
    })
  }
  const progressoNoInicioDoAtual = progressoRealPercentAteMs(
    fonte.progresso,
    fonte.capitulos,
    atualIni,
  )
  const dProgresso = deltaProgressoPp(progressoReal, progressoNoInicioDoAtual)
  if (dProgresso !== 0) {
    mudancasItens.push({
      id: "progresso",
      texto: `${dProgresso > 0 ? "+" : ""}${dProgresso} p.p. de progresso em relação ao período anterior.`,
      tom: dProgresso > 0 ? "positivo" : "negativo",
      ordem: mudancasItens.length + 1,
    })
  }
  const atencaoItensBase: {
    id: "reflexoes" | "regularidade" | "sessao-aberta"
    titulo: string
    texto: string
    acaoRotulo: string
  }[] = []
  const aberta = sessaoEmAberto(fonte.sessoes, agoraMs)
  const capituloDaSessaoAberta = aberta
    ? (fonte.capitulos.find((c) => c.id === aberta.chapterId)?.title ?? null)
    : null
  if (aberta) {
    atencaoItensBase.push({
      id: "sessao-aberta",
      titulo: "Sessão em aberto",
      texto: capituloDaSessaoAberta
        ? `Você iniciou "${capituloDaSessaoAberta}" há ${aberta.diasAberta} ${aberta.diasAberta === 1 ? "dia" : "dias"} e ainda não concluiu.`
        : `Você tem uma sessão em aberto há ${aberta.diasAberta} ${aberta.diasAberta === 1 ? "dia" : "dias"}.`,
      acaoRotulo: CTA_RETOMAR_SESSAO,
    })
  }

  const atencao: BlocoAtencaoAutogestao =
    atencaoItensBase.length === 0
      ? {
          estado: "vazio",
          erro: null,
          textoVazio: textoDoMotivo("sem-atencao"),
          motivoVazio: "sem-atencao",
          itens: [],
        }
      : { estado: "ok", erro: null, textoVazio: null, motivoVazio: null, itens: atencaoItensBase }

  const proximoMovimentoTipo = escolherProximoMovimento({
    jornadaConcluida: progressoReal >= 100,
    sessaoParada: aberta !== null,
    atrasoDePlano: ritmo === "abaixo-do-ritmo",
    quebraDeRegularidade: dRegularidade !== null && dRegularidade < 0,
    compromissoPendente: false,
  })
  const proximoMovimento = montarProximoMovimento(proximoMovimentoTipo, {
    moduloTitulo: capituloDaSessaoAberta,
    diasAberta: aberta?.diasAberta ?? null,
  })

  // --- §13 Resposta aos meus últimos ajustes -----------------------------------
  const baseline = fonte.plano?.baseline ?? null
  let respostaAosAjustes: BlocoRespostaAosAjustes
  if (!baseline) {
    respostaAosAjustes = {
      estado: "vazio",
      erro: null,
      textoVazio: textoDoMotivo("sem-ajuste"),
      motivoVazio: "sem-ajuste",
      conteudo: null,
    }
  } else {
    const capturedAtMs = parseMs(baseline.capturedAt) ?? agoraMs
    const ultimoAjusteDias = diasUtcEntre(capturedAtMs, agoraMs)
    const primeiroDiaMs = dias.length > 0 ? diaUtcParaMs(dias[0] as string) : capturedAtMs
    const diasAntesDoAjuste = diasDistintosUtc(
      carimbosDeAtividade(fonte),
      primeiroDiaMs,
      capturedAtMs,
    ).size
    const diasDepoisDoAjuste = diasDistintosUtc(
      carimbosDeAtividade(fonte),
      capturedAtMs,
      agoraMs,
    ).size
    const semanasAntes = Math.max(1, diasUtcEntre(primeiroDiaMs, capturedAtMs) / 7)
    const semanasDepois = Math.max(1, diasUtcEntre(capturedAtMs, agoraMs) / 7)
    respostaAosAjustes = {
      estado: "ok",
      erro: null,
      textoVazio: null,
      motivoVazio: null,
      conteudo: {
        ultimoAjusteDias,
        ultimoAjusteRotulo: `há ${ultimoAjusteDias} ${ultimoAjusteDias === 1 ? "dia" : "dias"}`,
        decisaoTexto: "Você ajustou seu plano.",
        frequenciaAntes: arredondarUmaCasa(diasAntesDoAjuste / semanasAntes),
        frequenciaDepois: arredondarUmaCasa(diasDepoisDoAjuste / semanasDepois),
        progressoDeltaPp: progressoReal - baseline.progressPct,
        semanasDentroDoPlano: semLastro(MOTIVO_SEM_META_FREQUENCIA),
        disclaimer: DISCLAIMER_CAUSALIDADE,
      },
    }
  }

  // --- §14 Sinais do meu momento ------------------------------------------------
  const off = offsetMs(fonte)
  const sinaisItens: { id: string; texto: string }[] = []
  const horario = melhorHorario(fonte.sessoes, off)
  // Sem "melhor" — juízo de valor/causal que a §2 Regra 2 e o §18 proíbem
  // (achado da revisão adversarial, Annie Duke, 2026-08-21): a faixa é uma
  // CONCENTRAÇÃO observada, não uma avaliação de qual horário é superior.
  if (horario) {
    sinaisItens.push({
      id: "horario-frequente",
      texto: `Você costuma estudar mais no período de ${horario}.`,
    })
  }
  const diasPreferidos = diasDaSemanaPreferidos(fonte.sessoes, off)
  if (diasPreferidos.length > 0) {
    sinaisItens.push({
      id: "dias-da-semana",
      texto: `${diasPreferidos.map((d) => d[0]?.toUpperCase() + d.slice(1)).join(" e ")} são seus dias.`,
    })
  }
  const latencia = latenciaMediaDeRetomada(dias, agoraMs)
  if (temLastro(latencia)) {
    sinaisItens.push({
      id: "latencia-retomada",
      texto: `Leva ${latencia} ${latencia === 1 ? "dia" : "dias"} para retomar.`,
    })
  }

  const sinaisDoMomento: BlocoSinaisDoMomento =
    sinaisItens.length === 0
      ? {
          estado: "vazio",
          erro: null,
          textoVazio: textoDoMotivo("sem-sinais"),
          motivoVazio: "sem-sinais",
          itens: [],
        }
      : {
          estado: "ok",
          erro: null,
          textoVazio: null,
          motivoVazio: null,
          itens: sinaisItens.slice(0, 3),
        }

  const mudancas: BlocoMudancasAutogestao =
    mudancasItens.length === 0
      ? {
          estado: "vazio",
          erro: null,
          textoVazio: textoDoMotivo("sem-mudancas"),
          motivoVazio: "sem-mudancas",
          itens: [],
        }
      : {
          estado: "ok",
          erro: null,
          textoVazio: null,
          motivoVazio: null,
          itens: mudancasItens.slice(0, 3),
        }

  return {
    estado: "ok",
    erro: null,
    comoEstou,
    sintese: mensagemSintese(ritmo),
    mudancas,
    atencao,
    proximoMovimento,
    respostaAosAjustes,
    sinaisDoMomento,
  }
}

// ===========================================================================
// TELA 2 — MEUS PADRÕES E TENDÊNCIAS
// ===========================================================================

/** §16 — série semanal de dias ativos, do mais antigo ao mais recente. */
export function serieSemanalDiasAtivos(
  carimbos: readonly number[],
  agoraMs: number,
  nSemanas: number,
): PontoRegularidade[] {
  const baldes = bucketizarSemanas(agoraMs, nSemanas)
  return baldes.map((b) => ({
    indice: b.indice,
    rotulo: b.rotulo,
    inicioISO: new Date(b.inicioMs).toISOString(),
    fimISO: new Date(b.fimMs).toISOString(),
    diasAtivos: diasDistintosUtc(carimbos, b.inicioMs, b.fimMs).size,
  }))
}

/** §19 — estado dominante do período, um dos 4 rótulos possíveis. */
export function classificarTendencia(
  pontos: readonly PontoRegularidade[],
  estadoPausa: "parado" | "retomando" | null,
): EstadoTendencia {
  if (pontos.length < SERIE_SEMANAS_MIN) return "sem-padrao-suficiente"
  if (estadoPausa === "retomando") return "retomando"
  const ultimasN = pontos.slice(-SUSTENTANDO_SEMANAS)
  if (ultimasN.length === SUSTENTANDO_SEMANAS && ultimasN.every((p) => p.diasAtivos > 0))
    return "sustentando"
  const semanasComAtividade = pontos.filter((p) => p.diasAtivos > 0)
  if (semanasComAtividade.length === 0) return "sem-padrao-suficiente"
  const meio = Math.ceil(pontos.length / 2)
  const somaAntiga = pontos.slice(0, meio).reduce((a, p) => a + p.diasAtivos, 0)
  const somaRecente = pontos.slice(meio).reduce((a, p) => a + p.diasAtivos, 0)
  return somaRecente < somaAntiga ? "desacelerando" : "sustentando"
}

export function montarPadroesAutogestao(
  fonte: FonteAutogestao,
  agora: Date,
): PadroesAutogestaoDados {
  const agoraMs = agora.getTime()
  const { falhas } = fonte
  const falhaGeral = primeiraFalha(falhas, ["sessoes", "reflexoes", "progresso", "plano"])

  if (falhaGeral) {
    const blocoErro = {
      estado: "erro" as const,
      erro: falhaGeral,
      textoVazio: null,
      motivoVazio: null,
    }
    return {
      estado: "erro",
      erro: falhaGeral,
      serie: {
        ...blocoErro,
        pontos: [],
        metaLinha: semLastro(MOTIVO_SEM_META_FREQUENCIA),
        insight: null,
      },
      continuidade: { ...blocoErro, conteudo: null },
      favorece: { ...blocoErro, itens: [] },
      tendencia: { ...blocoErro, conteudo: null },
    }
  }

  const dias = diasAtivosOrdenados(fonte)
  const carimbos = carimbosDeAtividade(fonte)
  const estadoPausa = estadoDePausa(dias, agoraMs)

  if (dias.length === 0) {
    const vazio = {
      estado: "vazio" as const,
      erro: null,
      textoVazio: textoDoMotivo("sem-jornada-iniciada"),
      motivoVazio: "sem-jornada-iniciada" as const,
    }
    return {
      estado: "vazio",
      erro: null,
      serie: {
        ...vazio,
        pontos: [],
        metaLinha: semLastro(MOTIVO_SEM_META_FREQUENCIA),
        insight: null,
      },
      continuidade: { ...vazio, conteudo: null },
      favorece: { ...vazio, itens: [] },
      tendencia: { ...vazio, conteudo: null },
    }
  }

  const nSemanas = SERIE_SEMANAS_MAX
  const pontos = serieSemanalDiasAtivos(carimbos, agoraMs, nSemanas)
  const semanasComAtividade = pontos.filter((p) => p.diasAtivos > 0).length

  const serie: BlocoSerieRegularidade =
    semanasComAtividade < SERIE_SEMANAS_MIN
      ? {
          estado: "vazio",
          erro: null,
          textoVazio: textoDoMotivo("sem-historico-suficiente"),
          motivoVazio: "sem-historico-suficiente",
          pontos,
          metaLinha: semLastro(MOTIVO_SEM_META_FREQUENCIA),
          insight: null,
        }
      : {
          estado: "ok",
          erro: null,
          textoVazio: null,
          motivoVazio: null,
          pontos,
          metaLinha: semLastro(MOTIVO_SEM_META_FREQUENCIA),
          insight: null,
        }

  // 2.3 é "idem 1.2": dias distintos ÷ semanas do MESMO `periodoDias` do filtro
  // global (§4.2) — não o teto de 12 semanas do gráfico (esse é só a largura
  // visível da série, não o denominador da frequência média).
  const diasAtivosNoPeriodoDoFiltro = diasDistintosUtc(
    carimbos,
    agoraMs - fonte.periodoDias * MS_DIA,
    agoraMs,
  ).size
  const frequenciaMedia = regularidadeVezesPorSemana(diasAtivosNoPeriodoDoFiltro, fonte.periodoDias)
  const continuidade: BlocoContinuidade = {
    estado: "ok",
    erro: null,
    textoVazio: null,
    motivoVazio: null,
    conteudo: {
      frequenciaMedia,
      frequenciaRotulo: rotuloFrequenciaMedia(diasAtivosNoPeriodoDoFiltro, fonte.periodoDias),
      maiorIntervaloDias: maiorIntervaloDias(dias),
      sequenciaAtualSemanas: sequenciaAtualSemanas(dias, agoraMs),
      retomadas: contarRetomadas(dias),
    },
  }

  const semanasRegulares = pontos.filter((p) => p.diasAtivos >= DIAS_ATIVOS_SEMANA_REGULAR).length
  const favoreceItens: { id: string; texto: string }[] = []
  if (semanasRegulares >= FAVORECE_MIN_SEMANAS) {
    favoreceItens.push({
      id: "distribuicao-de-dias",
      texto: fraseAssociacao(
        "nas-semanas",
        "você estuda em pelo menos 2 dias diferentes, sua atividade se mantém mais consistente.",
      ),
    })
  }
  const latencia = latenciaMediaDeRetomada(dias, agoraMs)
  if (temLastro(latencia)) {
    favoreceItens.push({
      id: "pausas-prolongadas",
      texto: fraseAssociacao(
        "observamos",
        `quando você passa mais de ${PAUSA_LONGA_DIAS} dias sem estudar, sua retomada demora em média ${latencia} ${latencia === 1 ? "dia" : "dias"}.`,
      ),
    })
  }

  const favorece: BlocoFavorece =
    favoreceItens.length === 0
      ? {
          estado: "vazio",
          erro: null,
          textoVazio: textoDoMotivo("sem-historico-suficiente"),
          motivoVazio: "sem-historico-suficiente",
          itens: [],
        }
      : {
          estado: "ok",
          erro: null,
          textoVazio: null,
          motivoVazio: null,
          itens: favoreceItens.slice(0, 3),
        }

  const estadoTendencia = classificarTendencia(pontos, estadoPausa)
  const tendencia: BlocoTendencia = {
    estado: "ok",
    erro: null,
    textoVazio: null,
    motivoVazio: null,
    conteudo: {
      estado: estadoTendencia,
      texto: `${ROTULO_TENDENCIA[estadoTendencia]}.`,
      linhaTemporal: pontos.map((p) => ({
        rotulo: `${p.rotulo}: ${p.diasAtivos} ${p.diasAtivos === 1 ? "dia ativo" : "dias ativos"}`,
      })),
    },
  }

  return { estado: "ok", erro: null, serie, continuidade, favorece, tendencia }
}

// ===========================================================================
// TELA 3 — MEU MAPA DA JORNADA
// ===========================================================================

/** 3.1 — status do módulo, na ordem do curso, sem NENHUM "vermelho" (spec §22). */
export function statusDoModulo(progresso: LinhaProgressoCapitulo | undefined): StatusModulo {
  if (!progresso) return "nao-iniciado"
  if (progresso.reached_last_slide_at) return "concluido"
  if (progresso.first_viewed_at) return "em-andamento"
  return "nao-iniciado"
}

/** O módulo atual = o primeiro, na ordem do curso, que ainda não está concluído. */
export function moduloAtualId(
  capitulos: readonly LinhaCapitulo[],
  progressoPorId: ReadonlyMap<string, LinhaProgressoCapitulo>,
): string | null {
  const ordenados = [...capitulos].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  for (const c of ordenados) {
    if (statusDoModulo(progressoPorId.get(c.id)) !== "concluido") return c.id
  }
  return null // todos concluídos — jornada concluída
}

export function montarMapaAutogestao(
  fonte: FonteAutogestao,
  agora: Date,
): MapaJornadaAutogestaoDados {
  const agoraMs = agora.getTime()
  const { falhas } = fonte
  const falhaGeral = primeiraFalha(falhas, ["progresso", "capitulos", "sessoes", "plano"])

  if (falhaGeral) {
    const blocoErro = {
      estado: "erro" as const,
      erro: falhaGeral,
      textoVazio: null,
      motivoVazio: null,
    }
    return {
      estado: "erro",
      erro: falhaGeral,
      trilha: { ...blocoErro, modulos: [] },
      moduloAtual: { ...blocoErro, conteudo: null },
      proximoMarco: { ...blocoErro, conteudo: null },
      perdaDeRitmo: { ...blocoErro, conteudo: null },
      historico: { ...blocoErro, itens: [] },
    }
  }

  if (fonte.capitulos.length === 0) {
    const vazio = {
      estado: "vazio" as const,
      erro: null,
      textoVazio: textoDoMotivo("sem-jornada-iniciada"),
      motivoVazio: "sem-jornada-iniciada" as const,
    }
    return {
      estado: "vazio",
      erro: null,
      trilha: { ...vazio, modulos: [] },
      moduloAtual: { ...vazio, conteudo: null },
      proximoMarco: { ...vazio, conteudo: null },
      perdaDeRitmo: { ...vazio, conteudo: null },
      historico: { ...vazio, itens: [] },
    }
  }

  const capitulosOrdenados = [...fonte.capitulos].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const progressoPorId = new Map(fonte.progresso.map((p) => [p.chapter_id, p] as const))

  // `ordem` é o NUMERAL exibido na trilha (§22) e no prefixo "Módulo {ordem} —"
  // de "Onde estou agora" (§23) — SEMPRE 1-based (o aluno conta módulos a
  // partir de 1). `c.order`/o índice `i` do array são 0-based (posição na
  // tabela `chapters`); sem o `+ 1` a trilha mostrava `0, 1, 2…` e o card
  // "Onde estou agora" ficava incoerente com o próprio numeral da trilha.
  const modulos = capitulosOrdenados.map((c, i) => ({
    id: c.id,
    ordem: (c.order ?? i) + 1,
    titulo: c.title ?? "Módulo",
    status: statusDoModulo(progressoPorId.get(c.id)),
  }))
  const trilha: BlocoTrilha = {
    estado: "ok",
    erro: null,
    textoVazio: null,
    motivoVazio: null,
    modulos,
  }

  const off = offsetMs(fonte)
  const atualId = moduloAtualId(fonte.capitulos, progressoPorId)

  let moduloAtual: BlocoModuloAtual
  if (!atualId) {
    moduloAtual = {
      estado: "vazio",
      erro: null,
      textoVazio: textoDoMotivo("jornada-concluida"),
      motivoVazio: "jornada-concluida",
      conteudo: null,
    }
  } else {
    const cap = capitulosOrdenados.find((c) => c.id === atualId) as LinhaCapitulo
    const p = progressoPorId.get(atualId)
    const maxSlide = p?.max_slide_index ?? 0
    const totalSlides = p?.slides_total_at_last_view ?? 0
    const progressoPercent = totalSlides > 0 ? Math.round((maxSlide / totalSlides) * 100) : 0
    const iniciadoEmMs = parseMs(p?.first_viewed_at ?? null)
    const sessoesDoModulo = fonte.sessoes.filter((s) => s.chapter_id === atualId)
    const sessoesConcluidas = sessoesDoModulo.filter((s) => s.completed_at).length
    const ultimaAtividadeMs = parseMs(p?.last_viewed_at ?? null)
    const diasUltimaAtividade =
      ultimaAtividadeMs !== null ? diasUtcEntre(ultimaAtividadeMs, agoraMs) : null
    const slidesRestantes = Math.max(0, totalSlides - maxSlide)
    const duracaoMedia = fonte.duracaoMediaPorSlideMinutos
    moduloAtual = {
      estado: "ok",
      erro: null,
      textoVazio: null,
      motivoVazio: null,
      conteudo: {
        id: atualId,
        titulo: cap.title ?? "Módulo",
        progressoPercent,
        iniciadoEmISO: iniciadoEmMs !== null ? new Date(iniciadoEmMs).toISOString() : "",
        iniciadoEmRotulo: iniciadoEmMs !== null ? formatarDataBr(iniciadoEmMs, off) : "",
        sessoesConcluidas,
        sessoesTotal: sessoesDoModulo.length,
        ultimaAtividadeLabel: rotuloUltimaAtividade(diasUltimaAtividade),
        estimativaRestanteMinutos:
          duracaoMedia !== null ? Math.round(slidesRestantes * duracaoMedia) : null,
        estimativaRotulo:
          duracaoMedia !== null ? `~${Math.round(slidesRestantes * duracaoMedia)}min` : null,
      },
    }
  }

  // --- §24 Meu próximo marco -----------------------------------------------
  let proximoMarco: BlocoProximoMarco
  if (!atualId) {
    proximoMarco = {
      estado: "vazio",
      erro: null,
      textoVazio: textoDoMotivo("jornada-concluida"),
      motivoVazio: "jornada-concluida",
      conteudo: null,
    }
  } else {
    const capAtual = capitulosOrdenados.find((c) => c.id === atualId) as LinhaCapitulo
    const inicioMs = parseMs(fonte.plano?.startDateISO ?? null)
    let prazo: ComLastro<{ dataISO: string; rotulo: string }>
    if (!fonte.plano || inicioMs === null) {
      prazo = semLastro(MOTIVO_PLANO_AUSENTE)
    } else {
      let acumulado = 0
      let diasDoAtual = 0
      for (const c of capitulosOrdenados) {
        const dur = fonte.plano.moduleDurations.find((m) => m.chapterId === c.id)
        const diasModulo = dur ? Math.max(0, dur.days) : 0
        acumulado += diasModulo
        if (c.id === atualId) {
          diasDoAtual = diasModulo
          break
        }
      }
      if (diasDoAtual <= 0) {
        prazo = semLastro(MOTIVO_PLANO_SEM_DURACAO)
      } else {
        const prazoMs = inicioMs + acumulado * MS_DIA
        prazo = { dataISO: new Date(prazoMs).toISOString(), rotulo: formatarDataBr(prazoMs, off) }
      }
    }
    proximoMarco = {
      estado: "ok",
      erro: null,
      textoVazio: null,
      motivoVazio: null,
      conteudo: {
        moduloTitulo: capAtual.title ?? "Módulo",
        prazo,
        texto: temLastro(prazo)
          ? "Este marco mantém você dentro do ritmo previsto no seu plano."
          : "Ainda não é possível calcular um prazo: seu plano não define uma duração para este módulo.",
      },
    }
  }

  // --- §25 Onde costumo perder ritmo? ---------------------------------------
  const dias = diasAtivosOrdenados(fonte)
  const iniciosDeModulo = fonte.progresso
    .map((p) => parseMs(p.first_viewed_at))
    .filter((t): t is number => t !== null)
  const pausas: number[] = []
  for (let i = 1; i < dias.length; i++) {
    const anteriorMs = diaUtcParaMs(dias[i - 1] as string)
    const atualMs = diaUtcParaMs(dias[i] as string)
    const gap = diasUtcEntre(anteriorMs, atualMs)
    if (gap < PAUSA_LONGA_DIAS) continue
    const comecouLogoAposInicio = iniciosDeModulo.some((inicioMs) => {
      const dist = diasUtcEntre(inicioMs, anteriorMs)
      return dist >= 0 && dist <= JANELA_INICIO_MODULO_DIAS
    })
    if (comecouLogoAposInicio) pausas.push(gap)
  }

  const perdaDeRitmo: BlocoPerdaDeRitmo =
    pausas.length < PERDA_DE_RITMO_MIN_OCORRENCIAS
      ? {
          estado: "vazio",
          erro: null,
          textoVazio: textoDoMotivo("sem-interrupcao"),
          motivoVazio: "sem-interrupcao",
          conteudo: null,
        }
      : {
          estado: "ok",
          erro: null,
          textoVazio: null,
          motivoVazio: null,
          conteudo: {
            texto: "Nas suas últimas interrupções, você perdeu ritmo ao iniciar módulos novos.",
            mediaDiasPausa: Math.round(pausas.reduce((a, b) => a + b, 0) / pausas.length),
          },
        }

  // --- §26 Histórico recente dos módulos --------------------------------------
  const comInicio = fonte.progresso
    .map((p) => ({ p, inicioMs: parseMs(p.first_viewed_at) }))
    .filter((x): x is { p: LinhaProgressoCapitulo; inicioMs: number } => x.inicioMs !== null)
    .sort((a, b) => b.inicioMs - a.inicioMs)
    .slice(0, HISTORICO_MODULOS_MAX)

  const historicoItens = comInicio.map(({ p }) => {
    const cap = capitulosOrdenados.find((c) => c.id === p.chapter_id)
    const status = statusDoModulo(p)
    const maxSlide = p.max_slide_index ?? 0
    const totalSlides = p.slides_total_at_last_view ?? 0
    const ultimaMs = parseMs(p.last_viewed_at)
    const diasUltima = ultimaMs !== null ? diasUtcEntre(ultimaMs, agoraMs) : null
    return {
      id: p.chapter_id,
      titulo: cap?.title ?? "Módulo",
      estadoLabel: ROTULO_STATUS_MODULO[status] as string,
      progressoPercent: totalSlides > 0 ? Math.round((maxSlide / totalSlides) * 100) : 0,
      ultimaAtividadeLabel: status === "concluido" ? "—" : rotuloUltimaAtividade(diasUltima),
    }
  })

  const historico: BlocoHistorico =
    historicoItens.length === 0
      ? {
          estado: "vazio",
          erro: null,
          textoVazio: textoDoMotivo("sem-jornada-iniciada"),
          motivoVazio: "sem-jornada-iniciada",
          itens: [],
        }
      : { estado: "ok", erro: null, textoVazio: null, motivoVazio: null, itens: historicoItens }

  return { estado: "ok", erro: null, trilha, moduloAtual, proximoMarco, perdaDeRitmo, historico }
}

// Re-exportados para uso direto nos CTAs de outros módulos, se preciso.
export {
  CTA_VER_REFLEXOES,
  CTA_CONTINUAR_MODULO,
  CTA_VER_CONTEUDO,
  CTA_AJUSTAR_PRAZO,
  CTA_FAZER_NOVO_AJUSTE,
}
