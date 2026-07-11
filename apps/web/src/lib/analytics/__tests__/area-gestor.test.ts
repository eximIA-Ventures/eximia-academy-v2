import { describe, expect, it } from "vitest"
import { computeMetricBlock, computeUnitReferenceStats } from "../area-gestor"

/**
 * SH-1.1 — FIRST unit cover of the ÁREA/GESTOR aggregation engine. Focused on the
 * two additive computations this story introduces:
 *   • computeMetricBlock.distinctActiveDays (AC4) — UTC-day distinct days, mean per
 *     student in an aggregated block.
 *   • computeUnitReferenceStats (AC7) — per-student median resists the outlier the
 *     arithmetic mean does not.
 *
 * Both are pure over in-memory rows, so no Supabase client is mocked. computeMetric
 * Block's pre-existing mean logic is intentionally NOT re-asserted here (AC6: untouched).
 */

// Deterministic clock — distinctActiveDays / referenceStats don't depend on it, but a
// fixed value keeps the "active in last 30d" window stable regardless of wall time.
const NOW = Date.parse("2026-06-01T00:00:00Z")

/**
 * Minimal builder for the (non-exported) SessionRow shape computeMetricBlock consumes.
 * `status` defaults to "completed"; `depth` (when set) becomes analytics.depth_reached.
 */
function session(
  studentId: string,
  createdAt: string,
  opts: { status?: string | null; depth?: number } = {},
) {
  return {
    student_id: studentId,
    status: opts.status ?? "completed",
    chapter_id: null,
    created_at: createdAt,
    analytics: opts.depth !== undefined ? { depth_reached: opts.depth } : null,
  }
}

describe("computeMetricBlock — distinctActiveDays (AC2/AC3/AC4)", () => {
  it("per-student: 3 sessions on the SAME UTC day → 1", () => {
    const sessions = [
      session("s1", "2026-01-01T02:00:00Z"),
      session("s1", "2026-01-01T12:00:00Z"),
      session("s1", "2026-01-01T23:30:00Z"),
    ]
    expect(computeMetricBlock(["s1"], sessions, [], 4, NOW).distinctActiveDays).toBe(1)
  })

  it("per-student: 3 sessions on 3 DISTINCT UTC days → 3", () => {
    const sessions = [
      session("s1", "2026-01-01T10:00:00Z"),
      session("s1", "2026-01-02T10:00:00Z"),
      session("s1", "2026-01-03T10:00:00Z"),
    ]
    expect(computeMetricBlock(["s1"], sessions, [], 4, NOW).distinctActiveDays).toBe(3)
  })

  it("UTC-day grouping: hours spanning a full UTC date collapse to one day", () => {
    // Two sessions inside the SAME UTC calendar date (00:01Z and 23:59Z) → one day.
    const sessions = [session("s1", "2026-02-10T00:01:00Z"), session("s1", "2026-02-10T23:59:00Z")]
    expect(computeMetricBlock(["s1"], sessions, [], 4, NOW).distinctActiveDays).toBe(1)
  })

  it("aggregated block (2+ students): reports the MEAN distinct-active-days per student", () => {
    // s1 → 1 distinct day (3 sessions same day); s2 → 3 distinct days. Mean = (1+3)/2 = 2.
    const sessions = [
      session("s1", "2026-01-01T02:00:00Z"),
      session("s1", "2026-01-01T12:00:00Z"),
      session("s1", "2026-01-01T20:00:00Z"),
      session("s2", "2026-01-01T10:00:00Z"),
      session("s2", "2026-01-02T10:00:00Z"),
      session("s2", "2026-01-03T10:00:00Z"),
    ]
    expect(computeMetricBlock(["s1", "s2"], sessions, [], 4, NOW).distinctActiveDays).toBe(2)
  })

  it("aggregated mean divides by scope size incl. students with ZERO sessions", () => {
    // s1 → 2 days, s2 → 0 sessions (0 days), s3 → 1 day. Mean = (2+0+1)/3 = 1.
    const sessions = [
      session("s1", "2026-01-01T10:00:00Z"),
      session("s1", "2026-01-02T10:00:00Z"),
      session("s3", "2026-01-05T10:00:00Z"),
    ]
    expect(computeMetricBlock(["s1", "s2", "s3"], sessions, [], 4, NOW).distinctActiveDays).toBe(1)
  })
})

describe("computeUnitReferenceStats — median resists the outlier (AC5/AC7)", () => {
  // Unit of 5: one "champion" (deep + fully complete) + four medianos. The champion
  // drags the arithmetic mean up; the median must NOT follow.
  //   depth  → medianos 2,2,3,3 ; champion 7
  //   completion → medianos 1/4 (25%) ; champion 4/4 (100%)
  const CHAPTERS = 4
  const sessions = [
    session("s1", "2026-01-01T10:00:00Z", { depth: 2 }),
    session("s2", "2026-01-01T10:00:00Z", { depth: 2 }),
    session("s3", "2026-01-01T10:00:00Z", { depth: 3 }),
    session("s4", "2026-01-01T10:00:00Z", { depth: 3 }),
    // champion: four completed sessions (100% of 4 chapters) each at depth 7.
    session("s5", "2026-01-01T10:00:00Z", { depth: 7 }),
    session("s5", "2026-01-02T10:00:00Z", { depth: 7 }),
    session("s5", "2026-01-03T10:00:00Z", { depth: 7 }),
    session("s5", "2026-01-04T10:00:00Z", { depth: 7 }),
  ]
  const ids = ["s1", "s2", "s3", "s4", "s5"]

  it("avgDepth: median (3) < arithmetic mean (4.8)", () => {
    const ref = computeUnitReferenceStats(ids, sessions, [], CHAPTERS, NOW)
    const unit = computeMetricBlock(ids, sessions, [], CHAPTERS, NOW)
    expect(ref?.avgDepth).not.toBeNull()
    expect(ref?.avgDepth?.median).toBe(3)
    expect(unit.avgDepth).toBe(4.8) // the outlier-dragged mean
    // The whole point of the story: median holds where the mean does not.
    expect(ref?.avgDepth?.median).toBeLessThan(unit.avgDepth as number)
    // Quartiles are ordered.
    expect(ref?.avgDepth?.p25).toBeLessThanOrEqual(ref?.avgDepth?.median as number)
    expect(ref?.avgDepth?.median as number).toBeLessThanOrEqual(ref?.avgDepth?.p75 as number)
  })

  it("completionPct: median (25) < arithmetic mean (40)", () => {
    const ref = computeUnitReferenceStats(ids, sessions, [], CHAPTERS, NOW)
    const unit = computeMetricBlock(ids, sessions, [], CHAPTERS, NOW)
    expect(ref?.completionPct.median).toBe(25)
    expect(unit.completionPct).toBe(40) // the outlier-dragged mean
    expect(ref?.completionPct.median).toBeLessThan(unit.completionPct)
  })

  it("returns undefined for an empty population (no student → field omitted)", () => {
    expect(computeUnitReferenceStats([], sessions, [], CHAPTERS, NOW)).toBeUndefined()
  })

  it("avgDepth is null when no student had a depth signal", () => {
    const noDepth = [session("s1", "2026-01-01T10:00:00Z"), session("s2", "2026-01-01T10:00:00Z")]
    const ref = computeUnitReferenceStats(["s1", "s2"], noDepth, [], CHAPTERS, NOW)
    expect(ref?.avgDepth).toBeNull()
    // completionPct distribution is still present (all students have completion data).
    expect(ref?.completionPct).toBeDefined()
  })
})
