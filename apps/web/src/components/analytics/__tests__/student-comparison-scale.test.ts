import { describe, expect, it } from "vitest"
import {
  type ComparisonMetric,
  countLeads,
  formatMetric,
  toMetricBar,
} from "../student-comparison-scale"

function metric(over: Partial<ComparisonMetric>): ComparisonMetric {
  return {
    key: over.key ?? "k",
    label: over.label ?? "L",
    studentValue: over.studentValue ?? 0,
    unitValue: over.unitValue ?? 0,
    format: over.format ?? "int",
  }
}

describe("toMetricBar — honest shared scale (max = larger of the two)", () => {
  it("8 vs 4 renders 100% vs 50%, NOT two full bars (the original bug)", () => {
    const bar = toMetricBar(metric({ studentValue: 8, unitValue: 4 }))
    expect(bar.studentWidthPct).toBe(100)
    expect(bar.unitWidthPct).toBe(50)
    // The two widths must differ — the whole point of the redesign.
    expect(bar.studentWidthPct).not.toBe(bar.unitWidthPct)
  })

  it("student BELOW average scales the student bar, unit bar fills", () => {
    const bar = toMetricBar(metric({ studentValue: 3, unitValue: 6 }))
    expect(bar.studentWidthPct).toBe(50)
    expect(bar.unitWidthPct).toBe(100)
    expect(bar.studentAhead).toBe(false)
  })

  it("equal values render two equal (full) bars", () => {
    const bar = toMetricBar(metric({ studentValue: 6, unitValue: 6 }))
    expect(bar.studentWidthPct).toBe(100)
    expect(bar.unitWidthPct).toBe(100)
    expect(bar.studentAhead).toBe(true)
  })

  it("both zero → both bars empty (honest: nothing happened)", () => {
    const bar = toMetricBar(metric({ studentValue: 0, unitValue: 0 }))
    expect(bar.studentWidthPct).toBe(0)
    expect(bar.unitWidthPct).toBe(0)
  })

  it("percentages scale against each other, not against 100", () => {
    // 75% vs 63%: max is 75, so student=100%, unit=84%. Bars compare the pair,
    // not the absolute 0–100 axis — the comparison stays legible even when both
    // values are high.
    const bar = toMetricBar(metric({ studentValue: 75, unitValue: 63, format: "pct" }))
    expect(bar.studentWidthPct).toBe(100)
    expect(Math.round(bar.unitWidthPct)).toBe(84)
  })
})

describe("toMetricBar — delta vs média guarded against média = 0", () => {
  it("média = 0 → deltaPct is null (no division by zero, no ∞%)", () => {
    const bar = toMetricBar(metric({ studentValue: 5, unitValue: 0 }))
    expect(bar.deltaPct).toBeNull()
    // Student still visibly wins the bar.
    expect(bar.studentWidthPct).toBe(100)
    expect(bar.unitWidthPct).toBe(0)
    expect(bar.studentAhead).toBe(true)
  })

  it("both zero → deltaPct null (média = 0)", () => {
    const bar = toMetricBar(metric({ studentValue: 0, unitValue: 0 }))
    expect(bar.deltaPct).toBeNull()
  })

  it("signed relative delta: 8 vs 4 → +100%", () => {
    const bar = toMetricBar(metric({ studentValue: 8, unitValue: 4 }))
    expect(bar.deltaPct).toBe(100)
  })

  it("signed relative delta: 3 vs 6 → -50%", () => {
    const bar = toMetricBar(metric({ studentValue: 3, unitValue: 6 }))
    expect(bar.deltaPct).toBe(-50)
  })

  it("equal values → delta 0", () => {
    const bar = toMetricBar(metric({ studentValue: 6, unitValue: 6 }))
    expect(bar.deltaPct).toBe(0)
  })
})

describe("formatMetric", () => {
  it("pct rounds and appends %", () => {
    expect(formatMetric(74.6, "pct")).toBe("75%")
  })
  it("decimal keeps one place", () => {
    expect(formatMetric(13, "decimal")).toBe("13.0")
  })
  it("int rounds", () => {
    expect(formatMetric(5.7, "int")).toBe("6")
  })
})

describe("countLeads", () => {
  it("counts rows where student is at or above the average", () => {
    const bars = [
      toMetricBar(metric({ studentValue: 8, unitValue: 4 })), // ahead
      toMetricBar(metric({ studentValue: 6, unitValue: 6 })), // equal → ahead
      toMetricBar(metric({ studentValue: 3, unitValue: 6 })), // behind
    ]
    expect(countLeads(bars)).toBe(2)
  })
})
