// ---------------------------------------------------------------------------
// EPIC-JORNADA — Helpers puros de data/geometria do construtor (Trilha B).
// Datas entram por parâmetro (ISO). Toda aritmética em UTC de meia-noite para
// bater com `plan-math.ts` (dono A) e evitar drift de fuso. Reusa
// `moduleEndDates` de A — não reimplementa acumulação de datas.
// ---------------------------------------------------------------------------

import { moduleEndDates } from "@/lib/journey/plan-math"

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
