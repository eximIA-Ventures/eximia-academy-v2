import { describe, expect, it } from "vitest"
import {
  type ComparisonMetric,
  buildProgressHeadline,
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

/** The full concatenated copy of a headline result — what the assertions scan. */
function copyOf(r: ReturnType<typeof buildProgressHeadline>): string {
  return `${r.headline} ${r.coachLine} ${r.nextStep ?? ""}`
}

// A student clearly advancing on every dimension (high own completion).
const highProgressBars = [
  toMetricBar(metric({ key: "completion", studentValue: 82, unitValue: 40, format: "pct" })),
  toMetricBar(metric({ key: "sessions", studentValue: 13, unitValue: 6, format: "decimal" })),
  toMetricBar(metric({ key: "reflections", studentValue: 9, unitValue: 4 })),
]

// A student just starting (low own completion, thin activity).
const lowProgressBars = [
  toMetricBar(metric({ key: "completion", studentValue: 8, unitValue: 40, format: "pct" })),
  toMetricBar(metric({ key: "sessions", studentValue: 2, unitValue: 6, format: "decimal" })),
  toMetricBar(metric({ key: "reflections", studentValue: 1, unitValue: 8 })),
]

describe("buildProgressHeadline — own-progress hero copy", () => {
  it("returns the { headline, coachLine, nextStep, focusKey } shape (AC1)", () => {
    const r = buildProgressHeadline(highProgressBars)
    expect(typeof r.headline).toBe("string")
    expect(r.headline.length).toBeGreaterThan(0)
    expect(typeof r.coachLine).toBe("string")
    expect(r.coachLine.length).toBeGreaterThan(0)
    expect(typeof r.nextStep).toBe("string")
  })

  it("leads with the student's own progress, never a comparison (AC2, high)", () => {
    const r = buildProgressHeadline(highProgressBars)
    expect(copyOf(r)).not.toMatch(/m[ée]dia|comparad|acima|abaixo/i)
  })

  it("leads with the student's own progress, never a comparison (AC2, low)", () => {
    const r = buildProgressHeadline(lowProgressBars)
    expect(copyOf(r)).not.toMatch(/m[ée]dia|comparad|acima|abaixo/i)
  })

  it("contains no em dash anywhere in the generated copy (AC4)", () => {
    expect(copyOf(buildProgressHeadline(highProgressBars))).not.toContain("—")
    expect(copyOf(buildProgressHeadline(lowProgressBars))).not.toContain("—")
  })

  it("headline tone follows the student's OWN completion, not a delta (AC2)", () => {
    // High own completion → advancing tone; low own completion → starting tone.
    expect(buildProgressHeadline(highProgressBars).headline).toBe(
      "Você está avançando com consistência",
    )
    expect(buildProgressHeadline(lowProgressBars).headline).toBe(
      "Seu progresso começa pela próxima sessão",
    )
  })

  it("anchors coaching on the next-gain metric (focusKey mirrors pickFocusMetric)", () => {
    // reflections is the worst relative delta here → the next gain to name.
    const bars = [
      toMetricBar(metric({ key: "completion", studentValue: 55, unitValue: 40, format: "pct" })),
      toMetricBar(metric({ key: "sessions", studentValue: 13, unitValue: 6, format: "decimal" })),
      toMetricBar(metric({ key: "reflections", studentValue: 2, unitValue: 8 })),
    ]
    const r = buildProgressHeadline(bars)
    expect(r.focusKey).toBe("reflections")
    expect(r.coachLine).toContain("reflex")
    // Still no comparative framing even when naming a real gap (AC2).
    expect(copyOf(r)).not.toMatch(/m[ée]dia|comparad|acima|abaixo/i)
  })

  it("falls back to own-progress copy when no dimension is comparable (AC7)", () => {
    // Every unit value 0 → deltaPct null everywhere → no focus metric.
    const bars = [
      toMetricBar(metric({ key: "completion", studentValue: 30, unitValue: 0, format: "pct" })),
      toMetricBar(metric({ key: "sessions", studentValue: 4, unitValue: 0, format: "decimal" })),
    ]
    const r = buildProgressHeadline(bars)
    expect(r.focusKey).toBeUndefined()
    expect(r.coachLine.length).toBeGreaterThan(0)
    expect(r.nextStep?.length).toBeGreaterThan(0)
    expect(copyOf(r)).not.toMatch(/m[ée]dia|comparad|acima|abaixo/i)
    expect(copyOf(r)).not.toContain("—")
  })

  it("stays neutral-toned when no completion row is present (graceful)", () => {
    const bars = [
      toMetricBar(metric({ key: "sessions", studentValue: 5, unitValue: 6, format: "decimal" })),
    ]
    const r = buildProgressHeadline(bars)
    expect(r.headline).toBe("Você está construindo seu ritmo de estudo")
    expect(copyOf(r)).not.toMatch(/m[ée]dia|comparad|acima|abaixo/i)
  })
})
