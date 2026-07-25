// ---------------------------------------------------------------------------
// EPIC-JORNADA — Motor puro de interação da timeline (Trilha B). SEM I/O, SEM
// DOM, SEM Date.now(). Portado fielmente do `app.js` da demo aprovada
// (JARVIS/apps/jornada-demo) — mecânica validada em 19 rounds pelo Hugo e
// provada por /tmp/jornada-proof/proof-teto.js. A React (builder/) só computa
// geometria de ponteiro e delega TODA a regra de negócio para cá.
//
// Contrato com Trilha A (`plan-math.ts`): este motor IMPORTA
// MIN_DAYS_PER_MODULE e fitToDeadline; nunca os redefine. Aqui vive só a
// MECÂNICA de interação (drag pixel→dia, cascata, clamp entre vizinhos, snap
// semanal, teto duro por módulo, presets do "Sugerir jornada", rótulos de
// duração). O domínio é sempre "dias por módulo" (mesmo array `moduleDurations`
// do contrato §1), o que mantém o motor testável sem datas nem pixels reais.
// ---------------------------------------------------------------------------

import { MIN_DAYS_PER_MODULE, fitToDeadline } from "./plan-math"
import type { RemainingWindow } from "./plan-math"
import type { JourneyUnit } from "./types"

const MIN = MIN_DAYS_PER_MODULE

/** clamp inclusivo (mesmo helper do app.js). */
export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

// --- JRN-E: janela restante (contrato-progresso §5) ------------------------

/**
 * A janela restante é a `RemainingWindow` de `plan-math.ts` (Trilha E1),
 * IMPORTADA — este motor nunca a redefine, do mesmo jeito que nunca redefiniu
 * `MIN_DAYS_PER_MODULE`/`fitToDeadline`. Aqui vive só a MECÂNICA de interação
 * consciente dela.
 *
 * Invariantes assumidos (contrato §5): `frozenIndices` e `remainingIndices` são
 * disjuntos, cobrem todos os índices, e `frozenIndices` é um subconjunto
 * QUALQUER — jamais um prefixo (o aluno real tem 0,1,2,4 concluídos com o 3
 * intocado no meio).
 */
export type { RemainingWindow } from "./plan-math"

/** Projeta o array completo no sub-array dos módulos VIVOS (na ordem deles). */
function liveOf(durations: readonly number[], w: RemainingWindow): number[] {
  return w.remainingIndices.map((i) => durations[i] ?? MIN)
}

/**
 * Espalha o sub-array dos vivos de volta na forma completa. Concluído recebe
 * `0` EXATO (contrato §5, invariante 3) — nunca um mínimo simbólico, senão o
 * módulo já feito voltaria a consumir janela.
 */
function scatterLive(live: readonly number[], w: RemainingWindow, length: number): number[] {
  const out = new Array<number>(length).fill(0)
  w.remainingIndices.forEach((idx, k) => {
    out[idx] = live[k]
  })
  return out
}

/** Posição do módulo `i` dentro do sub-array dos vivos; -1 se está congelado. */
function liveIndexOf(w: RemainingWindow, i: number): number {
  return w.remainingIndices.indexOf(i)
}

// --- Snap semanal | fino (SPEC round 12) -----------------------------------

/**
 * Snapa `desired` ao múltiplo de 7 viável dentro de [lo, hi] no modo semanas;
 * no modo dias, clamp fino. Se o range não contém múltiplo de 7, degrada para o
 * clamp fino — NUNCA trava o drag (regra dura da demo). Espelha `snapDays`.
 */
export function snapDays(desired: number, lo: number, hi: number, unit: JourneyUnit): number {
  if (unit !== "w") return clamp(desired, lo, hi)
  const wLo = Math.ceil(lo / 7) * 7
  const wHi = Math.floor(hi / 7) * 7
  if (wHi < wLo) return clamp(desired, lo, hi)
  return clamp(Math.round(desired / 7) * 7, wLo, wHi)
}

// --- Teto duro por módulo (SPEC round 19) ----------------------------------

/**
 * Máximo de dias que o módulo `i` pode ter sem empurrar o último marco além do
 * prazo final: todos os módulos SEGUINTES precisam caber com pelo menos MIN
 * dias cada. Espelha `maxDaysAt` (que na demo usa datas; aqui é aritmética de
 * dias, resultado idêntico).
 *   deadline − início(i) − MIN×(módulos após i)
 */
export function maxDaysAt(
  durations: number[],
  i: number,
  finalDeadlineDays: number,
  window?: RemainingWindow,
): number {
  if (window) {
    // JRN-E: o teto por módulo é calculado SÓ entre os vivos, contra a janela
    // restante. Concluído não tem teto porque não tem duração: é 0 e fica 0.
    const k = liveIndexOf(window, i)
    if (k < 0) return 0
    return maxDaysAt(liveOf(durations, window), k, window.remainingDays)
  }
  const n = durations.length
  let before = 0
  for (let k = 0; k < i; k++) before += durations[k]
  const remMin = (n - 1 - i) * MIN
  return Math.floor(finalDeadlineDays - before - remMin)
}

/**
 * Com Auto-ajuste ligado, a cascata NUNCA empurra o último marco além do prazo
 * final: comprime os módulos SEGUINTES (do fim para trás, mín MIN) até absorver
 * o excedente. MUTA o array recebido (chamado internamente sobre uma cópia).
 * Espelha `capCascade`.
 */
function capCascadeInPlace(durations: number[], i: number, finalDeadlineDays: number): void {
  let endAt = 0
  for (let k = 0; k <= i; k++) endAt += durations[k]
  let after = 0
  for (let k = i + 1; k < durations.length; k++) after += durations[k]
  let over = after - (finalDeadlineDays - endAt)
  for (let k = durations.length - 1; k > i && over > 0; k--) {
    const cut = Math.min(over, durations[k] - MIN)
    durations[k] -= cut
    over -= cut
  }
}

// --- Drag (SPEC round 6/12/19) ---------------------------------------------

export interface InteractionOpts {
  /** Auto-ajuste: cascata liga/desliga (SPEC round 6). */
  cascade: boolean
  /** Unidade de ajuste: semanas | dias (SPEC round 12). */
  unit: JourneyUnit
  /** Teto duro "Disponível até" em dias (SPEC round 19). */
  finalDeadlineDays: number
  /**
   * JRN-E — janela restante. AUSENTE = aluno em dia 0, comportamento
   * pré-JRN-E idêntico. PRESENTE = toda a mecânica opera só sobre
   * `remainingIndices`, contra `remainingDays`, e nenhum caminho devolve
   * duração != 0 para um índice congelado.
   */
  window?: RemainingWindow
}

/**
 * Aplica um drag do marco `i` para `desiredDays` (duração desejada do módulo i).
 * Retorna um NOVO array (imutável). Auto-ajuste LIGADO (ou último marco):
 * cascata + teto duro. DESLIGADO: move só o módulo alvo, o vizinho seguinte
 * absorve a diferença (clamp entre vizinhos, mín MIN de cada lado). Espelha o
 * corpo do `pointermove` da demo.
 */
export function applyDrag(
  durations: number[],
  i: number,
  desiredDays: number,
  opts: InteractionOpts,
): number[] {
  const { cascade, unit, finalDeadlineDays, window } = opts
  if (window) {
    // JRN-E: arrastar um módulo concluído é no-op absoluto (AC-E2.1).
    const k = liveIndexOf(window, i)
    if (k < 0) return durations.slice()
    const next = applyDrag(liveOf(durations, window), k, desiredDays, {
      cascade,
      unit,
      finalDeadlineDays: window.remainingDays,
    })
    // Janela IMPOSSÍVEL (teto vencido: nem n × MIN cabe) — `snapDays` receberia
    // um teto por módulo negativo e devolveria duração negativa. `fitToDeadline`
    // já sabe degradar esse caso para "todos no mínimo" (contrato §7: a
    // invariante quebra por impossibilidade, nunca por bug). No caso viável, a
    // cascata já garantiu a soma e este passo é um no-op.
    return scatterLive(fitToDeadline(next, window.remainingDays), window, durations.length)
  }
  const out = durations.slice()
  const last = out.length - 1
  if (cascade || i === last) {
    out[i] = snapDays(desiredDays, MIN, maxDaysAt(out, i, finalDeadlineDays), unit)
    capCascadeInPlace(out, i, finalDeadlineDays)
  } else {
    const pair = out[i] + out[i + 1]
    const nd = snapDays(desiredDays, MIN, pair - MIN, unit)
    out[i + 1] = pair - nd
    out[i] = nd
  }
  return out
}

// --- Stepper ± (SPEC round 5/12) -------------------------------------------

export interface BumpResult {
  durations: number[]
  /** false quando o snap não produziu movimento válido (no-op da demo). */
  changed: boolean
}

/**
 * Ajuste pela tabela: ±1 passo (semana no modo "w", dia no modo "d"). O snap
 * nunca inverte a direção do clique (validMove) — sem movimento válido, no-op.
 * Espelha `bumpDays`. Retorna sempre um objeto; `changed:false` mantém o array
 * de entrada inalterado.
 */
export function applyBump(
  durations: number[],
  i: number,
  delta: number,
  opts: InteractionOpts,
): BumpResult {
  const { cascade, unit, finalDeadlineDays, window } = opts
  if (window) {
    // JRN-E: concluído não tem stepper; se chegar aqui, é no-op (AC-E2.1).
    const k = liveIndexOf(window, i)
    if (k < 0) return { durations, changed: false }
    const r = applyBump(liveOf(durations, window), k, delta, {
      cascade,
      unit,
      finalDeadlineDays: window.remainingDays,
    })
    if (!r.changed) return { durations, changed: false }
    return { durations: scatterLive(r.durations, window, durations.length), changed: true }
  }
  const step = unit === "w" ? 7 : 1
  const last = durations.length - 1
  const cur = durations[i]
  const validMove = (nd: number) => nd !== cur && delta > 0 === nd > cur
  const out = durations.slice()
  if (cascade || i === last) {
    const nd = snapDays(cur + delta * step, MIN, maxDaysAt(out, i, finalDeadlineDays), unit)
    if (!validMove(nd)) return { durations, changed: false }
    out[i] = nd
    capCascadeInPlace(out, i, finalDeadlineDays)
  } else {
    const pair = out[i] + out[i + 1]
    const nd = snapDays(cur + delta * step, MIN, pair - MIN, unit)
    if (!validMove(nd)) return { durations, changed: false }
    out[i + 1] = pair - nd
    out[i] = nd
  }
  return { durations: out, changed: true }
}

// --- Geometria pixel→dia (SPEC § perceptível, portado do view da demo) ------

/**
 * Janela temporal do trilho, em dias relativos a T0: começa 10 dias antes de T0
 * e termina 42 dias após o prazo final (mesma folga visual do `buildTimeline`).
 */
export function trackView(finalDeadlineDays: number): { minDay: number; spanDays: number } {
  const minDay = -10
  const maxDay = finalDeadlineDays + 42
  return { minDay, spanDays: maxDay - minDay }
}

/**
 * Converte a razão [0,1] da posição do ponteiro no trilho para a duração
 * desejada (em dias) do módulo `i` — `round(dataDoPonteiro − inícioDoMódulo)`.
 * Espelha `desired = Math.round((dateMs - startMs) / DAY)` do `pointermove`.
 *
 * JRN-E: com módulos concluídos, o eixo do trilho deixa de ser o eixo de dias
 * (o concluído ocupa largura visual sem consumir dia), então o início do módulo
 * vem de `trackStarts` (`trackLayout`, journey-format) e o teto passado é o
 * `deadlineTrack`. Sem `trackStarts`, o comportamento é o de antes, idêntico.
 */
export function desiredDaysFromRatio(
  durations: number[],
  i: number,
  ratio: number,
  finalDeadlineDays: number,
  trackStarts?: readonly number[],
): number {
  const { minDay, spanDays } = trackView(finalDeadlineDays)
  let startDay = 0
  if (trackStarts) {
    startDay = trackStarts[i] ?? 0
  } else {
    for (let k = 0; k < i; k++) startDay += durations[k]
  }
  const pointerDay = minDay + clamp(ratio, 0, 1) * spanDays
  return Math.round(pointerDay - startDay)
}

// --- Presets do "✨ Sugerir jornada" (SPEC round 6/19) ----------------------

/** Modelos do dropdown: fator × distribuição-base, rótulo. Ordem da demo. */
export const JOURNEY_PRESETS: ReadonlyArray<{ factor: number; label: string }> = [
  { factor: 1.3, label: "Tranquilo" },
  { factor: 1, label: "Moderado" },
  { factor: 0.75, label: "Intenso" },
]

/**
 * Distribuição de um preset: base × fator, mín MIN por módulo, clampada ao teto
 * duro por `fitToDeadline` (round 19 — nenhum preset conclui além do prazo).
 * Espelha `modelDays`.
 */
export function presetDurations(
  baseDurations: number[],
  factor: number,
  finalDeadlineDays: number,
  window?: RemainingWindow,
): number[] {
  if (window) {
    // JRN-E: o preset escala e clampa SÓ os vivos, contra a janela restante.
    // Nenhum preset devolve dia para módulo concluído nem estoura o teto duro.
    const scaledLive = liveOf(baseDurations, window).map((b) =>
      Math.max(MIN, Math.round(b * factor)),
    )
    return scatterLive(
      fitToDeadline(scaledLive, window.remainingDays),
      window,
      baseDurations.length,
    )
  }
  const scaled = baseDurations.map((b) => Math.max(MIN, Math.round(b * factor)))
  return fitToDeadline(scaled, finalDeadlineDays)
}

/**
 * Consequência exibida no dropdown, refletindo o valor REAL clampado (round 19).
 * Moderado (fator 1) tem copy fixa. Espelha `modelDesc`.
 */
export function presetConsequence(
  baseDurations: number[],
  factor: number,
  finalDeadlineDays: number,
  window?: RemainingWindow,
): string {
  if (factor === 1) return "o equilíbrio sugerido pela IA"
  const baseSum = baseDurations.reduce((a, b) => a + b, 0)
  const sum = presetDurations(baseDurations, factor, finalDeadlineDays, window).reduce(
    (a, b) => a + b,
    0,
  )
  const w = Math.round((sum - baseSum) / 7)
  return w < 0
    ? `termina ~${-w} semana${-w === 1 ? "" : "s"} antes`
    : `termina ~${w} semana${w === 1 ? "" : "s"} depois`
}

// --- Rótulos de duração (SPEC round 12/16) ---------------------------------

/**
 * "N semanas" / "N dias" conforme o modo. Semanas com 1 decimal (vírgula)
 * quando não múltiplo de 7. Espelha `durLabel`.
 */
export function durationLabel(days: number, unit: JourneyUnit): string {
  if (unit === "w") {
    const w = days / 7
    const txt = days % 7 === 0 ? String(w) : w.toFixed(1).replace(".", ",")
    return `${txt} ${txt === "1" ? "semana" : "semanas"}`
  }
  return `${days} ${days === 1 ? "dia" : "dias"}`
}

/**
 * Intervalo em semanas por extenso ("17,1 semanas"), independente do modo —
 * usado no banner de conclusão e na linha-resumo. Espelha `weeksLabel`.
 */
export function weeksLabel(days: number): string {
  const w = days / 7
  const t = days % 7 === 0 ? String(w) : w.toFixed(1).replace(".", ",")
  return `${t} ${t === "1" ? "semana" : "semanas"}`
}

// --- Distribuição-base do "Sugerir" ----------------------------------------

/**
 * Distribuição-base sugerida (a "×1" de referência para os presets), derivada
 * da folga real de cada módulo do contexto do curso. Na demo é fixa em
 * BASE = [7,14,14,21,14,21,14,14]; aqui deriva do nº de módulos e do teto para
 * ser portável a qualquer curso, degradando para o neutro quando não houver
 * sinal melhor. Peso opcional por módulo (ex.: reflexões esperadas) enviesa a
 * distribuição proporcionalmente, como os `base` da demo.
 */
export function suggestionBase(
  moduleCount: number,
  finalDeadlineDays: number,
  weights?: number[],
  window?: RemainingWindow,
): number[] {
  if (window) {
    // JRN-E: a base ×1 é distribuída SÓ entre os vivos, sobre a janela restante.
    const liveWeights = weights ? window.remainingIndices.map((i) => weights[i] ?? 1) : undefined
    const live = suggestionBase(window.remainingIndices.length, window.remainingDays, liveWeights)
    return scatterLive(live, window, moduleCount)
  }
  if (moduleCount <= 0) return []
  const w =
    weights && weights.length === moduleCount && weights.some((x) => x > 0)
      ? weights.map((x) => Math.max(1, x))
      : Array.from({ length: moduleCount }, () => 1)
  const totalW = w.reduce((a, b) => a + b, 0)
  // usa ~94% do teto como alvo da base ×1 (folga leve, como os 119/126 da demo)
  const target = Math.round(finalDeadlineDays * 0.94)
  const base = w.map((x) => Math.max(MIN, Math.round((x / totalW) * target)))
  return fitToDeadline(base, finalDeadlineDays)
}
