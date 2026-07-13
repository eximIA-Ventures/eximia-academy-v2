import { describe, expect, it } from "vitest"
import {
  type ComparisonMetric,
  buildVerdict,
  countLeads,
  formatMetric,
  pickFocusMetric,
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

describe("pickFocusMetric — the next-gain anchor", () => {
  it("picks the metric with the worst (most negative) relative delta", () => {
    const bars = [
      toMetricBar(metric({ key: "a", studentValue: 8, unitValue: 4 })), // +100%
      toMetricBar(metric({ key: "b", studentValue: 3, unitValue: 6 })), // -50%
      toMetricBar(metric({ key: "c", studentValue: 9, unitValue: 10 })), // -10%
    ]
    expect(pickFocusMetric(bars)?.key).toBe("b")
  })

  it("when all ahead, picks the THINNEST lead (smallest positive delta)", () => {
    const bars = [
      toMetricBar(metric({ key: "a", studentValue: 8, unitValue: 4 })), // +100%
      toMetricBar(metric({ key: "b", studentValue: 11, unitValue: 10 })), // +10%
      toMetricBar(metric({ key: "c", studentValue: 12, unitValue: 6 })), // +100%
    ]
    expect(pickFocusMetric(bars)?.key).toBe("b")
  })

  it("ignores rows with null delta (média = 0)", () => {
    const bars = [
      toMetricBar(metric({ key: "a", studentValue: 5, unitValue: 0 })), // null
      toMetricBar(metric({ key: "b", studentValue: 3, unitValue: 6 })), // -50%
    ]
    expect(pickFocusMetric(bars)?.key).toBe("b")
  })

  it("returns null when no row is comparable (every média = 0)", () => {
    const bars = [
      toMetricBar(metric({ key: "a", studentValue: 5, unitValue: 0 })),
      toMetricBar(metric({ key: "b", studentValue: 3, unitValue: 0 })),
    ]
    expect(pickFocusMetric(bars)).toBeNull()
  })
})

describe("buildVerdict — graded headline + coach copy", () => {
  it("above: student leads EVERY dimension", () => {
    const bars = [
      toMetricBar(metric({ key: "sessions", studentValue: 13, unitValue: 6 })),
      toMetricBar(metric({ key: "reflections", studentValue: 8, unitValue: 4 })),
    ]
    const v = buildVerdict(bars)
    expect(v.level).toBe("above")
    expect(v.headline).toBe("Você está acima da média")
  })

  it("partial: student leads at least half but not all", () => {
    const bars = [
      toMetricBar(metric({ key: "sessions", studentValue: 13, unitValue: 6 })), // ahead
      toMetricBar(metric({ key: "reflections", studentValue: 2, unitValue: 8 })), // behind
    ]
    const v = buildVerdict(bars)
    expect(v.level).toBe("partial")
    expect(v.headline).toBe("Você está parcialmente acima da média")
  })

  it("below: student leads fewer than half", () => {
    const bars = [
      toMetricBar(metric({ key: "sessions", studentValue: 2, unitValue: 6 })), // behind
      toMetricBar(metric({ key: "active", studentValue: 10, unitValue: 40 })), // behind
      toMetricBar(metric({ key: "reflections", studentValue: 9, unitValue: 4 })), // ahead
    ]
    const v = buildVerdict(bars)
    expect(v.level).toBe("below")
    expect(v.headline).toBe("Você está abaixo da média")
  })

  it("coach copy targets the weakest dimension (reflections gap)", () => {
    const bars = [
      toMetricBar(metric({ key: "sessions", studentValue: 13, unitValue: 6 })), // strong
      toMetricBar(metric({ key: "reflections", studentValue: 2, unitValue: 8 })), // weak → focus
    ]
    const v = buildVerdict(bars)
    expect(v.focusKey).toBe("reflections")
    expect(v.coachLine).toContain("reflexões")
    expect(v.nextStep).toContain("reflexão")
  })

  it("uses the sessions 'strong' coach line when sessions is the thinnest lead (all ahead)", () => {
    // Strong pace: sessions is the anchor (smallest positive delta), "strong" mood.
    const bars = [
      toMetricBar(metric({ key: "sessions", studentValue: 7, unitValue: 6 })), // +17% (thinnest)
      toMetricBar(metric({ key: "reflections", studentValue: 8, unitValue: 4 })), // +100%
    ]
    const v = buildVerdict(bars)
    expect(v.level).toBe("above")
    // sessions has the thinner lead here → focus, strong mood.
    expect(v.focusKey).toBe("sessions")
    expect(v.coachLine).toContain("ritmo")
  })

  it("no em dash anywhere in the generated copy (house rule)", () => {
    const bars = [
      toMetricBar(metric({ key: "sessions", studentValue: 2, unitValue: 6 })),
      toMetricBar(metric({ key: "reflections", studentValue: 1, unitValue: 8 })),
    ]
    const v = buildVerdict(bars)
    expect(`${v.headline} ${v.coachLine} ${v.nextStep}`).not.toContain("—")
  })

  it("falls back gracefully when no dimension is comparable", () => {
    const bars = [
      toMetricBar(metric({ key: "sessions", studentValue: 3, unitValue: 0 })),
      toMetricBar(metric({ key: "reflections", studentValue: 5, unitValue: 0 })),
    ]
    const v = buildVerdict(bars)
    expect(v.focusKey).toBeNull()
    expect(v.coachLine.length).toBeGreaterThan(0)
    expect(v.nextStep.length).toBeGreaterThan(0)
  })
})
