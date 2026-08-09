// ---------------------------------------------------------------------------
// EPIC-JORNADA — Helpers puros de data/geometria do construtor (Trilha B/E2).
// Datas entram por parâmetro (ISO). Toda aritmética em UTC de meia-noite para
// bater com `plan-math.ts` (dono A/E1) e evitar drift de fuso. Reusa
// `moduleEndDates` e `cohortDeadlineDate` de A — não reimplementa acumulação de
// datas nem a aritmética do teto de coorte.
//
// JRN-E (Trilha E2) — aqui vive a ÚNICA porta de leitura do progresso por
// módulo no lado do construtor (`progressOf` / `journeyWindow`) e a geometria
// do trilho quando há módulos concluídos (`trackLayout`). Ver
// docs/stories/epic-jornada/contrato-progresso.md.
// ---------------------------------------------------------------------------

import { UNTOUCHED_MODULE_PROGRESS } from "@/lib/journey/module-progress"
import type { RemainingWindow } from "@/lib/journey/plan-math"
import {
  cohortDeadlineDate,
  computeRemainingWindow,
  moduleEndDates,
  moduleEndDatesAnchored,
} from "@/lib/journey/plan-math"
import type {
  JourneyCourseContext,
  JourneyModuleMeta,
  JourneyModuleProgress,
} from "@/lib/journey/types"

const MS_PER_DAY = 86_400_000
export const MESES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
]

function toUtcMs(iso: string): number {
  const d = new Date(iso)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/** "7 ago" a partir de um ISO date (UTC-estável). */
export function fmtDay(iso: string): string {
  const ms = toUtcMs(iso)
  const d = new Date(ms)
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`
}

/** ISO date de `startDate + dias`. */
export function isoAtOffset(startDate: string, dayOffset: number): string {
  return new Date(toUtcMs(startDate) + dayOffset * MS_PER_DAY).toISOString().slice(0, 10)
}

/** Offsets acumulados (fim de cada módulo em dias desde T0). */
export function endOffsets(durations: number[]): number[] {
  let acc = 0
  return durations.map((d) => {
    acc += d
    return acc
  })
}

export interface DerivedDates {
  /** fim de cada módulo (ISO), reusando moduleEndDates de A. */
  ends: string[]
  /** início de cada módulo (ISO). */
  starts: string[]
  /** offsets de fim (dias desde T0). */
  endDays: number[]
  /** conclusão planejada (ISO). */
  completion: string
  /** total de dias da jornada. */
  totalDays: number
}

/** Datas derivadas de startDate + durations (fim/início/conclusão). */
export function deriveDates(startDate: string, durations: number[]): DerivedDates {
  const ends = moduleEndDates(startDate, durations)
  const endDays = endOffsets(durations)
  const starts = durations.map((_, i) => (i === 0 ? startDate : ends[i - 1]))
  const totalDays = endDays[endDays.length - 1] ?? 0
  return { ends, starts, endDays, completion: ends[ends.length - 1] ?? startDate, totalDays }
}

export interface MonthTick {
  label: string
  dayOffset: number
}

/**
 * Régua de meses: um marco no dia 1 de cada mês visível na janela
 * [minDay, minDay+spanDays] relativa a startDate. Espelha o loop de `.tl-month`
 * do buildTimeline.
 */
export function monthTicks(startDate: string, minDay: number, spanDays: number): MonthTick[] {
  const startMs = toUtcMs(startDate)
  const minMs = startMs + minDay * MS_PER_DAY
  const maxMs = startMs + (minDay + spanDays) * MS_PER_DAY
  const ticks: MonthTick[] = []
  const m = new Date(minMs)
  // primeiro dia do mês corrente
  let cur = Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), 1)
  // avança até o primeiro mês >= minMs
  while (cur < minMs) {
    const nx = new Date(cur)
    cur = Date.UTC(nx.getUTCFullYear(), nx.getUTCMonth() + 1, 1)
  }
  while (cur <= maxMs) {
    const d = new Date(cur)
    ticks.push({
      label: MESES[d.getUTCMonth()],
      dayOffset: Math.round((cur - startMs) / MS_PER_DAY),
    })
    cur = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)
  }
  return ticks
}

/** Percentual [0,100] de um dayOffset dentro da janela do trilho. */
export function pctOf(dayOffset: number, minDay: number, spanDays: number): number {
  return ((dayOffset - minDay) / spanDays) * 100
}

/** Espessura do segmento (7–16px) proporcional à duração (round 8). */
export function segThickness(days: number, maxDays: number): number {
  const t = Math.min(1, Math.max(0, (days - 4) / Math.max(1, maxDays - 4)))
  return 7 + 9 * t
}

// ===========================================================================
// JRN-E — leitura do progresso e janela restante (Trilha E2)
//
// Este bloco é ADAPTADOR, não motor: `computeRemainingWindow`,
// `moduleEndDatesAnchored` e `cohortDeadlineDate` são de `plan-math.ts` (Trilha
// E1) e são IMPORTADOS, nunca reimplementados (Constitution, Artigo IV). O que
// vive aqui é só o que a UI precisa por cima do contrato: leitura tolerante do
// progresso, o vetor `frozen` paralelo aos módulos (O(1) por linha), a meta do
// gestor em dias de janela e a geometria do trilho.
// ===========================================================================

/** Dias inteiros entre duas ISO dates (UTC de meia-noite). Pode ser negativo. */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toUtcMs(toIso) - toUtcMs(fromIso)) / MS_PER_DAY)
}

/**
 * Leitura tolerante de `modules[i].progress`.
 *
 * O campo é OBRIGATÓRIO no contrato (§2) e a Trilha E1 já o entrega. A tolerância
 * existe para o RUNTIME de quem foi montado antes dele: mocks de suítes que não
 * são território de E2 continuam passando um contexto sem `progress`, e o
 * construtor não pode explodir por causa disso — ele degrada para o
 * comportamento pré-JRN-E (aluno em dia 0).
 */
export function progressOf(mod: JourneyModuleMeta | undefined): JourneyModuleProgress | null {
  const p = mod?.progress
  return p && typeof p === "object" ? p : null
}

/**
 * Janela restante para a UI: a `RemainingWindow` do contrato (§5), calculada
 * por `computeRemainingWindow`, mais os campos que só a tela usa.
 *
 * Sem `planningAnchorDate` em runtime (contexto anterior ao JRN-E), a âncora
 * degrada para a matrícula e a janela para o teto de coorte inteiro — que é
 * EXATAMENTE o comportamento de antes, com o mesmo `cohortDeadlineDate` que a
 * escrita usa (commit d60ec27).
 */
export interface JourneyWindow extends RemainingWindow {
  /** paralelo a `modules`: o módulo i está concluído (trava)? */
  frozen: boolean[]
  /** Teto duro em data absoluta (matrícula + deadline_days). NUNCA se move. */
  cohortDeadlineDate: string
  /** Meta do gestor em data absoluta. null nos dois tenants de hoje. */
  cohortManagerDeadlineDate: string | null
  /** Dias da âncora até a meta do gestor. null sem meta; negativo se passou. */
  managerRemainingDays: number | null
  /**
   * true quando EXISTE ao menos um módulo concluído. É esta a pergunta que a
   * copy da tela faz — "posso dizer que o aluno concluiu alguma coisa?".
   *
   * Substitui o antigo `hasProgress` ("o contexto trouxe progresso"), que era
   * uma pergunta sem resposta útil: depois da Trilha E1,
   * `fetchJourneyCourseContext` SEMPRE popula `progress` (com
   * `UNTOUCHED_MODULE_PROGRESS` quando não há nada), então aquela guarda era
   * constante `true` em produção e o aluno recém-matriculado lia "Você já
   * concluiu 0 de 8 módulos" (JRN-E-QA-3). Guarda de copy pergunta pelo FATO,
   * nunca pela presença do campo.
   */
  hasCompletedModules: boolean
  /**
   * true quando algum módulo AINDA NÃO concluído já foi tocado
   * (`completedRatio > 0`). Distingue "linha de partida de verdade" de "começou
   * e não terminou nada": no segundo caso a partida NÃO é por igual, porque
   * `progressAwareNeutralDurations` dá peso `1 - completedRatio` ao parcial (D4).
   */
  hasPartialProgress: boolean
}

/**
 * Módulos no formato que as funções puras de E1 esperam
 * (`Pick<JourneyModuleMeta, "progress">`), com o fallback honesto de
 * `UNTOUCHED_MODULE_PROGRESS` para quem não trouxe progresso em runtime —
 * "planned", zerado, nunca um "done" fabricado que travaria um módulo à toa.
 */
export function progressModules(
  modules: readonly JourneyModuleMeta[],
): Array<{ progress: JourneyModuleProgress }> {
  return modules.map((m) => ({ progress: progressOf(m) ?? UNTOUCHED_MODULE_PROGRESS }))
}

export function journeyWindow(context: JourneyCourseContext): JourneyWindow {
  const legacy = context as Partial<JourneyCourseContext>
  const { modules, startDate, finalDeadlineDays, managerDeadlineDays } = context

  const anchorDate = legacy.planningAnchorDate ?? startDate
  const deadline = legacy.cohortDeadlineDate ?? cohortDeadlineDate(startDate, finalDeadlineDays)
  const managerDate =
    legacy.cohortManagerDeadlineDate ??
    (managerDeadlineDays != null ? cohortDeadlineDate(startDate, managerDeadlineDays) : null)

  const progresses = modules.map((m) => progressOf(m))
  const window = computeRemainingWindow(progressModules(modules), anchorDate, deadline)

  return {
    ...window,
    frozen: progresses.map((p) => p?.frozen === true),
    cohortDeadlineDate: deadline,
    cohortManagerDeadlineDate: managerDate,
    managerRemainingDays: managerDate != null ? daysBetween(anchorDate, managerDate) : null,
    hasCompletedModules: window.frozenIndices.length > 0,
    hasPartialProgress: progresses.some(
      (p) => p != null && p.frozen !== true && (p.completedRatio ?? 0) > 0,
    ),
  }
}

// --- geometria do trilho com módulos concluídos ----------------------------

/**
 * Span VISUAL (em "dias de trilho") de um módulo concluído. Módulo concluído
 * não consome dia futuro (decisão D2), então ele vale 0 no orçamento — mas
 * precisa de largura para existir como marco na timeline e preservar a ordem
 * quando o progresso é ESPARSO (o aluno real tem 0,1,2,4 concluídos e o 3
 * intocado no meio). Este span não entra em conta nenhuma de prazo.
 *
 * Piso da largura de UM concluído — nunca menos que isto, nem com muitos
 * concluídos e pouca folga restante. Ver `frozenModuleTrackDays`: a constante
 * sozinha era a causa do defeito visual relatado pelo Hugo em teste manual
 * (2026-07-28) — fixa, ela desaba para uma fatia minúscula do eixo sempre que
 * há 3+ concluídos (o denominador `remainingDays` cresce, a fatia não), e os
 * círculos (tamanho fixo em px) colidem.
 */
export const FROZEN_TRACK_DAYS = 6

/** Teto da largura de um concluído — nunca mais que isto, senão 1-2
 *  concluídos com muita folga restante abrem um vão enorme antes do 1º marco
 *  vivo (o defeito oposto: vazio parecendo intencional demais). */
const FROZEN_TRACK_DAYS_MAX = 18

/** Fração-alvo do orçamento visual (folga restante + a mesma margem que
 *  `trackView`, timeline-engine.ts, soma ao span exibido) reservada para a
 *  ZONA dos concluídos como um todo — fixa e independente da CONTAGEM de
 *  concluídos: a zona não incha nem murcha por ter mais ou menos módulos
 *  feitos, só a fatia individual de cada um muda. */
const FROZEN_ZONE_SHARE = 0.3

/** Mesma margem de `trackView` (10 antes + 42 depois), replicada aqui só para
 *  dimensionar a zona dos concluídos na MESMA escala do eixo real — nunca
 *  para redefinir `trackView`, que segue sendo o único dono do span exibido. */
const TRACK_VIEW_PADDING_DAYS = 52

function clampInt(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/**
 * Largura visual (dias de trilho) de UM módulo concluído, dado quantos estão
 * concluídos e quanto resta de folga real. A ZONA inteira mira uma fatia
 * constante (`FROZEN_ZONE_SHARE`) do orçamento visual — só o que cabe em CADA
 * marco encolhe conforme a contagem cresce, sempre entre piso e teto.
 */
export function frozenModuleTrackDays(frozenCount: number, remainingDays: number): number {
  if (frozenCount <= 0) return FROZEN_TRACK_DAYS
  const budget = remainingDays + TRACK_VIEW_PADDING_DAYS
  const perModule = (FROZEN_ZONE_SHARE * budget) / frozenCount
  return clampInt(Math.round(perModule), FROZEN_TRACK_DAYS, FROZEN_TRACK_DAYS_MAX)
}

export interface TrackLayout {
  /** início de cada módulo no eixo do trilho. */
  starts: number[]
  /** fim de cada módulo no eixo do trilho. */
  ends: number[]
  /** posição do teto duro no eixo do trilho (nenhum módulo passa daqui). */
  deadlineTrack: number
  /** posição da meta do gestor no eixo; null sem meta ou se já passou. */
  metaTrack: number | null
  /** posição de "hoje": início do primeiro módulo ainda vivo. */
  todayTrack: number
  /** soma dos spans visuais dos concluídos (0 quando não há progresso). */
  frozenTrack: number
}

/**
 * Geometria do trilho. Sem módulo concluído (`frozen` todo false) o eixo do
 * trilho É o eixo de dias e o resultado é IDÊNTICO ao de antes do JRN-E.
 *
 * Com concluídos, o eixo passa a ser "dias de trilho": cada concluído ocupa
 * `frozenModuleTrackDays(...)` de largura visual, in loco (preserva a ordem
 * dos módulos mesmo com buraco no meio), e cada módulo vivo ocupa seus dias
 * reais. `deadlineTrack = frozenTrack + remainingDays` marca EXATAMENTE o
 * ponto em que a soma dos vivos empata com a janela — o teto duro continua
 * sendo um teto, em pixels e em dias, qualquer que seja a contagem de
 * concluídos. Resíduo de sobreposição em px real (círculo/rótulo de tamanho
 * fixo vs. eixo em %) é resolvido por `declutterPx`, chamado do lado do
 * `timeline-canvas.tsx` — geometria de dia aqui, pixel real lá.
 */
export function trackLayout(
  durations: number[],
  frozen: readonly boolean[],
  remainingDays: number,
  managerRemainingDays: number | null,
): TrackLayout {
  const starts: number[] = []
  const ends: number[] = []
  let acc = 0
  let frozenTrack = 0
  let todayTrack: number | null = null
  const frozenCount = frozen.filter((f) => f === true).length
  const perFrozenSpan = frozenModuleTrackDays(frozenCount, remainingDays)
  durations.forEach((d, i) => {
    const isFrozen = frozen[i] === true
    if (!isFrozen && todayTrack == null) todayTrack = acc
    const span = isFrozen ? perFrozenSpan : d
    if (isFrozen) frozenTrack += perFrozenSpan
    starts.push(acc)
    acc += span
    ends.push(acc)
  })
  const deadlineTrack = frozenTrack + remainingDays
  return {
    starts,
    ends,
    deadlineTrack,
    metaTrack:
      managerRemainingDays != null && managerRemainingDays >= 0
        ? frozenTrack + managerRemainingDays
        : null,
    todayTrack: todayTrack ?? frozenTrack,
    frozenTrack,
  }
}

export interface AnchoredDates {
  /** fim de cada módulo (ISO); null para concluído — não tem prazo futuro. */
  ends: (string | null)[]
  /** início de cada módulo (ISO); null para concluído. */
  starts: (string | null)[]
  /** conclusão planejada do que RESTA (ISO). */
  completion: string
  /** soma dos dias dos módulos vivos. */
  totalDays: number
}

/**
 * Datas do que RESTA, ancoradas em hoje (D2). Delega o acúmulo para
 * `moduleEndDatesAnchored` (plan-math, E1) — que já devolve `null` no
 * concluído — e só deriva os inícios por encadeamento entre vivos.
 */
export function anchoredDates(durations: number[], window: JourneyWindow): AnchoredDates {
  const ends = moduleEndDatesAnchored(durations, window)
  const starts: (string | null)[] = []
  let prevEnd: string = window.anchorDate
  let totalDays = 0
  ends.forEach((end, i) => {
    if (end == null) {
      starts.push(null)
      return
    }
    starts.push(prevEnd)
    prevEnd = end
    totalDays += Math.max(0, durations[i] ?? 0)
  })
  return { ends, starts, completion: prevEnd, totalDays }
}

// --- JRN-E — declutter de marcos em pixel real -----------------------------

/**
 * Resolve sobreposição de marcadores por espaçamento mínimo em PIXELS — o
 * dia-de-trilho é resolução-agnóstico (%), mas o círculo/rótulo do marco tem
 * largura FIXA em px; só o pixel real sabe se colide (`timeline-canvas.tsx`
 * mede o container e chama isto DEPOIS de posicionar tudo em %).
 *
 * Sweep para a frente: empurra cada posição pelo menos `minGapPx` além da
 * anterior, preservando a ordem (a ordem de `natural` já é a ordem visual
 * correta, esparsa ou não). Se houver `ceilingPx` — a posição do 1º marco
 * VIVO, que representa uma DATA real e por isso NUNCA se move — um segundo
 * sweep para trás garante que nenhum concluído o ultrapasse: na pior das
 * hipóteses, os concluídos entre si terminam mais apertados que `minGapPx`;
 * o marco vivo, nunca.
 */
export function declutterPx(
  naturalPx: readonly number[],
  minGapPx: number,
  ceilingPx: number | null,
): number[] {
  const out = naturalPx.slice()
  for (let i = 1; i < out.length; i++) {
    out[i] = Math.max(out[i], out[i - 1] + minGapPx)
  }
  if (ceilingPx != null && out.length > 0) {
    const last = out.length - 1
    if (out[last] > ceilingPx) {
      out[last] = ceilingPx
      for (let i = last - 1; i >= 0; i--) {
        out[i] = Math.min(out[i], out[i + 1] - minGapPx)
      }
    }
  }
  return out
}
