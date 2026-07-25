// ---------------------------------------------------------------------------
// EPIC-JORNADA — Funções puras compartilhadas (contrato §4). SEM I/O. Datas
// entram por parâmetro (nada de Date.now() escondido). B (timeline-engine)
// importa daqui; não redefine fitToDeadline/MIN_DAYS_PER_MODULE.
// Portado da mecânica do app.js da demo (fitDays/zoneOf/endsOf/NEUTRAL).
// ---------------------------------------------------------------------------

import type { JourneyModuleDuration, JourneyModuleMeta } from "./types"

export const MIN_DAYS_PER_MODULE = 4

const MS_PER_DAY = 86_400_000

/** Parseia uma ISO date (YYYY-MM-DD ou ISO completa) para ms de meia-noite UTC. */
function toUtcMidnightMs(isoDate: string): number {
  const d = new Date(isoDate)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/** ms → "YYYY-MM-DD". */
function toIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/**
 * Distribuição uniforme dos N módulos até o teto (SPEC §2.3 — 15 dias cada p/
 * 8 módulos / 126 dias). floor(teto / n), nunca abaixo do mínimo.
 */
export function neutralDurations(moduleCount: number, finalDeadlineDays: number): number[] {
  if (moduleCount <= 0) return []
  const per = Math.max(MIN_DAYS_PER_MODULE, Math.floor(finalDeadlineDays / moduleCount))
  return Array.from({ length: moduleCount }, () => per)
}

/**
 * Comprime proporcionalmente o excedente acima do mínimo até a soma == teto,
 * quando a soma estoura (SPEC round 19 — fitDays). Nunca ultrapassa o teto e
 * nunca reduz um módulo abaixo de MIN_DAYS_PER_MODULE. Se o teto for menor que
 * o mínimo possível (n × MIN), todos ficam no mínimo (não há como caber melhor).
 */
export function fitToDeadline(durations: number[], finalDeadlineDays: number): number[] {
  const n = durations.length
  if (n === 0) return []
  const minSum = n * MIN_DAYS_PER_MODULE
  if (finalDeadlineDays <= minSum) {
    return Array.from({ length: n }, () => MIN_DAYS_PER_MODULE)
  }
  const sum = durations.reduce((a, b) => a + b, 0)
  if (sum <= finalDeadlineDays) return durations.slice()

  const slacks = durations.map((d) => Math.max(0, d - MIN_DAYS_PER_MODULE))
  const totalSlack = slacks.reduce((a, b) => a + b, 0)
  const keepSlack = finalDeadlineDays - minSum
  const ratio = totalSlack > 0 ? keepSlack / totalSlack : 0
  const result = slacks.map((s) => MIN_DAYS_PER_MODULE + Math.floor(s * ratio))

  // distribui o resto round-robin (dos maiores slacks primeiro) até fechar o teto
  let rem = finalDeadlineDays - result.reduce((a, b) => a + b, 0)
  const order = slacks
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.i)
  let k = 0
  while (rem > 0 && order.length > 0) {
    result[order[k % order.length]] += 1
    rem--
    k++
  }
  return result
}

/**
 * Valida/normaliza durações vindas do cliente: comprimento == nº de módulos,
 * inteiros, min MIN, e clamp ao teto (fitToDeadline). Lança em input inválido —
 * a fronteira de escrita das server actions confia nisto.
 */
export function normalizeDurations(
  durations: number[],
  moduleCount: number,
  finalDeadlineDays: number,
): number[] {
  if (!Array.isArray(durations)) {
    throw new Error("moduleDurations deve ser um array")
  }
  if (durations.length !== moduleCount) {
    throw new Error(`moduleDurations tem ${durations.length} itens, esperado ${moduleCount}`)
  }
  const cleaned = durations.map((d, i) => {
    if (typeof d !== "number" || !Number.isFinite(d)) {
      throw new Error(`moduleDurations[${i}] inválido: ${d}`)
    }
    return Math.max(MIN_DAYS_PER_MODULE, Math.floor(d))
  })
  return fitToDeadline(cleaned, finalDeadlineDays)
}

/**
 * Data de um prazo de COORTE (ISO "YYYY-MM-DD") = âncora + offset em dias, com a
 * âncora truncada à meia-noite UTC.
 *
 * É deliberadamente a MESMA aritmética que o construtor usa para rotular
 * "Disponível até" / "Meta do gestor" (journey-builder.tsx `isoLabel`,
 * consequence-banner.tsx `isoAt`, timeline-canvas.tsx `isoAtOffset`): a tela e o
 * banco TÊM de produzir a mesma data a partir da mesma âncora. Quando isso
 * divergiu (tela ancorada na matrícula, escrita ancorada em `new Date()`), o
 * teto duro andava para frente a cada dia de demora do aluno em clicar.
 */
export function cohortDeadlineDate(anchorIso: string, offsetDays: number): string {
  return toIsoDate(toUtcMidnightMs(anchorIso) + offsetDays * MS_PER_DAY)
}

/** Datas de fim (ISO) de cada módulo dado startDate + durations acumuladas. */
export function moduleEndDates(startDate: string, durations: number[]): string[] {
  const startMs = toUtcMidnightMs(startDate)
  let acc = 0
  return durations.map((d) => {
    acc += d
    return toIsoDate(startMs + acc * MS_PER_DAY)
  })
}

/** Conclusão planejada (ISO) = startDate + soma(durations). */
export function plannedCompletionDate(startDate: string, durations: number[]): string {
  const total = durations.reduce((a, b) => a + b, 0)
  return toIsoDate(toUtcMidnightMs(startDate) + total * MS_PER_DAY)
}

/**
 * Zona semântica da conclusão vs meta/final (SPEC round 16/19):
 * green ≤ meta · amber entre meta e final · red > final (guarda defensiva —
 * inalcançável por interação com o teto duro do round 19).
 */
export function zoneOf(
  plannedCompletionDays: number,
  managerDeadlineDays: number | null,
  finalDeadlineDays: number,
): "green" | "amber" | "red" {
  if (plannedCompletionDays > finalDeadlineDays) return "red"
  if (managerDeadlineDays != null && plannedCompletionDays > managerDeadlineDays) return "amber"
  return "green"
}

// ===========================================================================
// JRN-E — Janela RESTANTE (contrato-progresso §5). Tudo aditivo: nada acima é
// reescrito. `neutralDurations`/`fitToDeadline`/`normalizeDurations`/
// `moduleEndDates` continuam válidos e são a BASE do que vem abaixo.
// ===========================================================================

export interface RemainingWindow {
  /** = context.planningAnchorDate (hoje). */
  anchorDate: string
  /** = context.remainingWindowDays (≥ 0). */
  remainingDays: number
  /** true quando o teto de coorte já venceu (deadline estritamente no passado). */
  expired: boolean
  /** índices (na ordem de `modules`) dos módulos concluídos — duração fixa em 0. */
  frozenIndices: number[]
  /** índices dos módulos que ainda consomem janela — duração ≥ MIN_DAYS_PER_MODULE. */
  remainingIndices: number[]
}

/**
 * Dias entre a âncora do planejamento e o teto de coorte, clampado em 0.
 *
 * Sem teto computável (`cohortDeadlineDate === null`) devolve 0 — honesto, não
 * inventa uma janela. Na prática esse caminho é inalcançável pelo produto:
 * `fetchJourneyCourseContext` já devolve null quando `deadline_days` é nulo.
 */
export function remainingWindowDaysBetween(
  planningAnchorDate: string,
  cohortDeadline: string | null,
): number {
  if (!cohortDeadline) return 0
  const deltaMs = toUtcMidnightMs(cohortDeadline) - toUtcMidnightMs(planningAnchorDate)
  if (!Number.isFinite(deltaMs)) return 0
  return Math.max(0, Math.round(deltaMs / MS_PER_DAY))
}

/**
 * Deriva a janela restante a partir do progresso real dos módulos. PURA — a
 * data de "hoje" entra por parâmetro, nada de Date.now() escondido.
 *
 * `frozenIndices` é um conjunto ARBITRÁRIO, nunca um prefixo: o aluno real do
 * lançamento tem 0,1,2,4 concluídos e o 3 intocado (R1 da JRN-E).
 */
export function computeRemainingWindow(
  modules: ReadonlyArray<Pick<JourneyModuleMeta, "progress">>,
  planningAnchorDate: string,
  cohortDeadline: string | null,
): RemainingWindow {
  const frozenIndices: number[] = []
  const remainingIndices: number[] = []
  modules.forEach((m, i) => {
    if (m.progress.frozen) frozenIndices.push(i)
    else remainingIndices.push(i)
  })
  const remainingDays = remainingWindowDaysBetween(planningAnchorDate, cohortDeadline)
  const expired =
    cohortDeadline != null && toUtcMidnightMs(cohortDeadline) < toUtcMidnightMs(planningAnchorDate)
  return { anchorDate: planningAnchorDate, remainingDays, expired, frozenIndices, remainingIndices }
}

/**
 * Distribui EXATAMENTE `total` dias entre n posições, proporcionalmente a
 * `weights`, com piso MIN_DAYS_PER_MODULE em cada uma.
 *
 * Determinística: o resto da divisão inteira vai para as maiores partes
 * fracionárias, desempatando pelo índice. Quando `total` não cabe nem no
 * mínimo (n × MIN), devolve todos no mínimo — mesma degradação honesta de
 * `fitToDeadline` (a janela é impossível, não é um bug).
 */
function distributeExact(total: number, weights: readonly number[]): number[] {
  const n = weights.length
  if (n === 0) return []
  const minSum = n * MIN_DAYS_PER_MODULE
  if (total <= minSum) return Array.from({ length: n }, () => MIN_DAYS_PER_MODULE)

  const extra = total - minSum
  const safeWeights = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0))
  const sumW = safeWeights.reduce((a, b) => a + b, 0)
  // Todos os pesos zerados (ex.: todos os vivos com completedRatio 1) → uniforme.
  const effective = sumW > 0 ? safeWeights : safeWeights.map(() => 1)
  const sumEff = effective.reduce((a, b) => a + b, 0)

  const raw = effective.map((w) => (extra * w) / sumEff)
  const floors = raw.map((r) => Math.floor(r))
  let rest = extra - floors.reduce((a, b) => a + b, 0)
  const order = raw
    .map((r, i) => ({ frac: r - Math.floor(r), i }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (let k = 0; rest > 0 && k < order.length; k++, rest--) {
    floors[order[k].i] += 1
  }
  return floors.map((f) => MIN_DAYS_PER_MODULE + f)
}

/**
 * Partida do construtor CONSCIENTE DO PROGRESSO — substitui `neutralDurations`
 * no fluxo de montagem/revisão em curso.
 *
 * - frozen              → 0 dias, EXATO (não consome janela futura — D2)
 * - parcial (0<ratio<1) → peso `1 - completedRatio`, piso MIN_DAYS_PER_MODULE
 * - intocado            → peso 1 (fatia cheia)
 *
 * A janela restante é distribuída entre os vivos proporcionalmente a esses
 * pesos, somando EXATAMENTE `window.remainingDays` (AC-E1.3). Quando todos os
 * vivos estão intocados, os pesos são uniformes e cada um recebe a fatia
 * inteira — idêntico à leitura literal "fatia × (1 − ratio)" do contrato §5.
 * Com parciais, os dias que o módulo parcial não precisa vão para quem precisa,
 * em vez de sobrarem sem dono no fim da janela (ver Change Log da JRN-E).
 *
 * Comprimento do resultado === modules.length, sempre.
 */
export function progressAwareNeutralDurations(
  modules: ReadonlyArray<Pick<JourneyModuleMeta, "progress">>,
  window: RemainingWindow,
): number[] {
  const result = Array.from({ length: modules.length }, () => 0)
  const live = window.remainingIndices
  if (live.length === 0) return result
  const weights = live.map((i) => {
    const ratio = modules[i]?.progress.completedRatio ?? 0
    const clamped = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0
    return 1 - clamped
  })
  const days = distributeExact(window.remainingDays, weights)
  live.forEach((i, k) => {
    result[i] = days[k]
  })
  return result
}

/** Índices frozen + vivos, na ordem, para validar comprimento. */
function windowLength(window: RemainingWindow): number {
  return window.frozenIndices.length + window.remainingIndices.length
}

/**
 * `fitToDeadline` restrito aos `remainingIndices`; frozen permanecem em 0 exato.
 * Clampa (nunca infla): soma dos vivos ≤ remainingDays, exceto quando nem o
 * mínimo cabe — aí todos os vivos ficam em MIN_DAYS_PER_MODULE.
 */
export function fitRemainingToDeadline(durations: number[], window: RemainingWindow): number[] {
  const live = window.remainingIndices
  const fitted = fitToDeadline(
    live.map((i) => durations[i] ?? MIN_DAYS_PER_MODULE),
    window.remainingDays,
  )
  const result = Array.from({ length: durations.length }, () => 0)
  live.forEach((i, k) => {
    result[i] = fitted[k]
  })
  return result
}

/**
 * `normalizeDurations` consciente de frozen — a fronteira de escrita confia
 * nisto. Lança em input inválido, igual ao original.
 *
 * Garante: comprimento === frozen+vivos · frozen === 0 exato · vivos ≥
 * MIN_DAYS_PER_MODULE · soma dos vivos ≤ remainingDays (salvo janela
 * impossível). Um cliente que mandar dias num módulo concluído tem esse valor
 * zerado no servidor, não aceito.
 */
export function normalizeRemainingDurations(
  durations: number[],
  window: RemainingWindow,
): number[] {
  if (!Array.isArray(durations)) {
    throw new Error("moduleDurations deve ser um array")
  }
  const expected = windowLength(window)
  if (durations.length !== expected) {
    throw new Error(`moduleDurations tem ${durations.length} itens, esperado ${expected}`)
  }
  durations.forEach((d, i) => {
    if (typeof d !== "number" || !Number.isFinite(d)) {
      throw new Error(`moduleDurations[${i}] inválido: ${d}`)
    }
  })
  const cleaned = Array.from({ length: expected }, () => 0)
  for (const i of window.remainingIndices) {
    cleaned[i] = Math.max(MIN_DAYS_PER_MODULE, Math.floor(durations[i]))
  }
  return fitRemainingToDeadline(cleaned, window)
}

/**
 * Datas de fim por módulo a partir da ÂNCORA do replanejamento (hoje), não do
 * T0 da matrícula. Módulo frozen → null: concluído não tem prazo futuro, e
 * fabricar uma data para ele seria mentir na timeline.
 *
 * Sibling de `moduleEndDates` (que continua existindo, com o comportamento
 * inalterado, para quem ancora na matrícula).
 */
export function moduleEndDatesAnchored(
  durations: number[],
  window: RemainingWindow,
): (string | null)[] {
  const anchorMs = toUtcMidnightMs(window.anchorDate)
  const frozen = new Set(window.frozenIndices)
  let acc = 0
  return durations.map((d, i) => {
    if (frozen.has(i)) return null
    acc += Math.max(0, d)
    return toIsoDate(anchorMs + acc * MS_PER_DAY)
  })
}

/**
 * Projeta a verdade persistida (ancorada por `chapterId`) na ordem dos
 * capítulos publicados de HOJE:
 *
 * - capítulo conhecido → seus `days` persistidos
 * - capítulo NOVO      → MIN_DAYS_PER_MODULE (o chamador re-clampa com
 *                        `fitRemainingToDeadline`, que é quem conhece a janela)
 * - capítulo removido  → entrada ignorada, SEM deslizar os vizinhos
 *
 * É exatamente a bomba-relógio que o array posicional puro tinha: despublicar
 * um capítulo do meio deslizava todas as durações seguintes. Pura e determinística.
 */
export function alignDurationsToChapters(
  persisted: readonly JourneyModuleDuration[],
  chapterIdsInOrder: readonly string[],
): number[] {
  const byChapter = new Map<string, number>()
  for (const entry of persisted) {
    if (!entry || typeof entry.chapterId !== "string") continue
    const days = Number(entry.days)
    if (!Number.isFinite(days)) continue
    byChapter.set(entry.chapterId, Math.max(0, Math.floor(days)))
  }
  return chapterIdsInOrder.map((id) => byChapter.get(id) ?? MIN_DAYS_PER_MODULE)
}
