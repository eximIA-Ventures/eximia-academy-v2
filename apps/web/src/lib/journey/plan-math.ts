// ---------------------------------------------------------------------------
// EPIC-JORNADA — Funções puras compartilhadas (contrato §4). SEM I/O. Datas
// entram por parâmetro (nada de Date.now() escondido). B (timeline-engine)
// importa daqui; não redefine fitToDeadline/MIN_DAYS_PER_MODULE.
// Portado da mecânica do app.js da demo (fitDays/zoneOf/endsOf/NEUTRAL).
// ---------------------------------------------------------------------------

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
