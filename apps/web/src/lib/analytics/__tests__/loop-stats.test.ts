import { aggregateLoopStats } from "@/lib/analytics/loop-stats"
import { describe, expect, it } from "vitest"

/**
 * aggregateLoopStats — "O loop que você causou" (Uso da Plataforma).
 *
 * BUG FIXED (T4 review): the aggregate route used to sum per-template
 * `sent`/`returned` counts from `nudgeEfficacyByType`, whose unit is
 * NOTIFICATIONS. The card's copy is "alunos acionados" (STUDENTS), so a
 * student with 2+ nudges in scope was counted more than once — inflating
 * `acionados`/`voltaram` beyond the real number of distinct students. This
 * suite locks the fixed unit: one row per (recipient_id, returned_at); the
 * aggregation must count each recipient_id exactly once.
 *
 * The period filter itself (`sent_at >= periodStart`) is applied by the
 * caller's query (`computeLoopStats` in the aggregate route, via
 * `.gte("sent_at", periodStart.toISOString())`) BEFORE rows reach this pure
 * step — so testing "respects period" at this layer means: rows outside the
 * period are simply never in the input, and the aggregation must not invent
 * or leak counts beyond what it was given.
 */
describe("aggregateLoopStats", () => {
  it("returns the honest empty state when there are no rows in scope", () => {
    expect(aggregateLoopStats([])).toEqual({ acionados: 0, voltaram: 0, returnRatePct: 0 })
  })

  it("counts a student with multiple nudges in the period ONCE, not once per notification", () => {
    // student-1 received 3 nudges (3 notification rows) in the scoped period,
    // only the last one shows a return. Unit bug would report acionados=3.
    const rows = [
      { recipient_id: "student-1", returned_at: null },
      { recipient_id: "student-1", returned_at: null },
      { recipient_id: "student-1", returned_at: "2026-07-10T00:00:00.000Z" },
    ]
    const result = aggregateLoopStats(rows)
    expect(result.acionados).toBe(1)
    expect(result.voltaram).toBe(1)
    expect(result.returnRatePct).toBe(100)
  })

  it("counts distinct students across multiple notifications correctly (mixed returns)", () => {
    const rows = [
      { recipient_id: "student-1", returned_at: "2026-07-01T00:00:00.000Z" },
      { recipient_id: "student-1", returned_at: null },
      { recipient_id: "student-2", returned_at: null },
      { recipient_id: "student-3", returned_at: "2026-07-05T00:00:00.000Z" },
      { recipient_id: "student-3", returned_at: "2026-07-06T00:00:00.000Z" },
    ]
    const result = aggregateLoopStats(rows)
    // 3 distinct students acionados (student-1, student-2, student-3), NOT 5
    // (the raw notification row count).
    expect(result.acionados).toBe(3)
    // student-1 (returned on at least one row) + student-3 (both returned) = 2.
    // student-2 never returned.
    expect(result.voltaram).toBe(2)
    expect(result.returnRatePct).toBe(67) // round(2/3 * 100)
  })

  it("a student never returning across all their nudges does not count in voltaram", () => {
    const rows = [
      { recipient_id: "student-1", returned_at: null },
      { recipient_id: "student-2", returned_at: null },
    ]
    const result = aggregateLoopStats(rows)
    expect(result.acionados).toBe(2)
    expect(result.voltaram).toBe(0)
    expect(result.returnRatePct).toBe(0)
  })

  it("rows outside the period simply never arrive here (period filter is the caller's query)", () => {
    // Simulates the caller having ALREADY applied `sent_at >= periodStart` —
    // only in-period rows are passed in. An empty result for a period with no
    // nudges must be the honest empty state, not a fabricated non-zero value.
    const inPeriodRows: Array<{ recipient_id: string; returned_at: string | null }> = []
    expect(aggregateLoopStats(inPeriodRows)).toEqual({
      acionados: 0,
      voltaram: 0,
      returnRatePct: 0,
    })
  })
})
