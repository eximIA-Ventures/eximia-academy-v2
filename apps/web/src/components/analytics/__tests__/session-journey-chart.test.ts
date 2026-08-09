import { describe, expect, it } from "vitest"
import { deduplicateWeekLabels, formatWeekLabel } from "../session-journey-chart"

// ===========================================================================
// T3 (Crivo review, 2026-07-18) — "Sessões por Semana" showed confusing week
// labels like "Sem 4/4" → "Sem 1/5" across a month boundary, even though the
// underlying 12-week server range (analytics/page.tsx) has NO real gap — the
// OLD `formatWeekLabel` computed a week-of-month index that resets every
// month. Fixed by anchoring the label to the week's actual start date
// ("Sem de DD/MM"), which is always monotonic within a rolling window.
// ===========================================================================

describe("formatWeekLabel", () => {
  it("formats a mid-month date with zero-padded day and month", () => {
    expect(formatWeekLabel("7/5")).toBe("Sem de 07/05")
  })

  it("formats an already-2-digit date unchanged (just prefixed)", () => {
    expect(formatWeekLabel("14/7")).toBe("Sem de 14/07")
  })

  it("month-boundary weeks produce distinct, unambiguous, chronologically ordered labels (the reported bug)", () => {
    // Two CONTIGUOUS 7-day buckets: one starting 28/4, the next starting 5/5.
    // The old week-of-month algorithm produced "Sem 4/4" then "Sem 1/5" — the
    // index resets, so bar N+1's index is LOWER than bar N's, reading as a
    // skipped/non-continuous week. The date-anchored label never regresses.
    const endOfApril = formatWeekLabel("28/4")
    const startOfMay = formatWeekLabel("5/5")
    expect(endOfApril).toBe("Sem de 28/04")
    expect(startOfMay).toBe("Sem de 05/05")
    expect(endOfApril).not.toBe(startOfMay)
  })

  it("a full continuous 12-week range never produces two identical labels", () => {
    // Mirrors the server's rolling-window generation (page.tsx): 12 weekly
    // buckets 7 days apart, starting from a fixed date.
    const start = new Date("2026-04-27T00:00:00.000Z")
    const labels = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(start.getTime() + i * 7 * 86_400_000)
      return formatWeekLabel(`${d.getUTCDate()}/${d.getUTCMonth() + 1}`)
    })
    expect(new Set(labels).size).toBe(12)
  })

  it("returns the raw string unchanged when it cannot be parsed", () => {
    expect(formatWeekLabel("not-a-date")).toBe("not-a-date")
    expect(formatWeekLabel("")).toBe("")
  })
})

describe("deduplicateWeekLabels", () => {
  it("leaves distinct labels untouched", () => {
    expect(deduplicateWeekLabels(["Sem de 07/05", "Sem de 14/05"])).toEqual([
      "Sem de 07/05",
      "Sem de 14/05",
    ])
  })

  it("appends a prime to a repeated label (defensive edge case)", () => {
    expect(deduplicateWeekLabels(["Sem de 07/05", "Sem de 07/05"])).toEqual([
      "Sem de 07/05",
      "Sem de 07/05'",
    ])
  })
})
