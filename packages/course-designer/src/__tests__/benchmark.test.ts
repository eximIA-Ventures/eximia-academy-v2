/**
 * Benchmark Validation — Story 24.3
 *
 * Tests that validate blueprint quality using reference fixtures.
 * These tests use calculateBriefScore and validateBrief to check
 * that reference inputs produce quality outputs.
 *
 * Note: Full pipeline benchmark (with LLM calls) requires BENCHMARK=true
 * and is not part of standard CI. These tests validate the INPUT quality
 * and framework selection logic for the 3 reference fixtures.
 */

import { describe, expect, it } from "vitest"
import {
  calculateBriefScore,
  getBriefScoreRating,
  validateBrief,
} from "../schemas/input"
import { selectFramework } from "../framework-registry"
import {
  leadershipFixture,
  programmingFixture,
  problemSolvingFixture,
} from "./benchmark-fixtures"

describe("Benchmark: Input Quality Validation (Story 24.3 AC1)", () => {
  it.each([
    { name: "Leadership (8h, ELC+)", fixture: leadershipFixture },
    { name: "Programming (20h, Kolb)", fixture: programmingFixture },
    { name: "Problem Solving (12h, PBL)", fixture: problemSolvingFixture },
  ])("$name: brief score >= 90 (Excelente)", ({ fixture }) => {
    const score = calculateBriefScore(fixture)
    expect(score).toBeGreaterThanOrEqual(90)
    expect(getBriefScoreRating(score)).toBe("Excelente")
  })

  it.each([
    { name: "Leadership", fixture: leadershipFixture },
    { name: "Programming", fixture: programmingFixture },
    { name: "Problem Solving", fixture: problemSolvingFixture },
  ])("$name: validation passes with no errors", ({ fixture }) => {
    const result = validateBrief(fixture)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})

describe("Benchmark: Framework Selection (Story 24.3 AC4)", () => {
  it("Leadership fixture: selects ELC+ (default for long course)", () => {
    const result = selectFramework({
      behavior_change: leadershipFixture.behavior_change!,
      total_duration_hours: leadershipFixture.total_duration_hours!,
      experience_level: leadershipFixture.target_audience!.experience_level! as "intermediario",
      instructor_preferred_framework: leadershipFixture.framework === "auto" ? undefined : leadershipFixture.framework as "elc_plus",
    })
    expect(result.id).toBe("elc_plus")
  })

  it("Programming fixture: selects Kolb (instructor preference)", () => {
    const result = selectFramework({
      behavior_change: programmingFixture.behavior_change!,
      total_duration_hours: programmingFixture.total_duration_hours!,
      experience_level: programmingFixture.target_audience!.experience_level! as "iniciante",
      instructor_preferred_framework: programmingFixture.framework === "auto" ? undefined : programmingFixture.framework as "kolb_4",
    })
    expect(result.id).toBe("kolb_4")
  })

  it("Problem Solving fixture: selects PBL (resolver problemas keyword or instructor preference)", () => {
    const result = selectFramework({
      behavior_change: problemSolvingFixture.behavior_change!,
      total_duration_hours: problemSolvingFixture.total_duration_hours!,
      experience_level: problemSolvingFixture.target_audience!.experience_level! as "avancado",
      instructor_preferred_framework: problemSolvingFixture.framework === "auto" ? undefined : problemSolvingFixture.framework as "pbl_hmelo",
    })
    expect(result.id).toBe("pbl_hmelo")
  })
})

describe("Benchmark: Cross-fixture Diversity (Story 24.3 AC2)", () => {
  const fixtures = [leadershipFixture, programmingFixture, problemSolvingFixture]

  it("all 3 fixtures use different frameworks", () => {
    const frameworks = new Set(fixtures.map((f) => f.framework))
    expect(frameworks.size).toBe(3)
  })

  it("duration range covers short, medium, long courses", () => {
    const durations = fixtures.map((f) => f.total_duration_hours!).sort((a, b) => a - b)
    expect(durations[0]).toBeLessThanOrEqual(10) // short
    expect(durations[1]).toBeGreaterThanOrEqual(10) // medium
    expect(durations[2]).toBeGreaterThanOrEqual(15) // long
  })

  it("experience levels cover all 3 tiers", () => {
    const levels = new Set(fixtures.map((f) => f.target_audience!.experience_level))
    expect(levels).toContain("iniciante")
    expect(levels).toContain("intermediario")
    expect(levels).toContain("avancado")
  })

  it("all fixtures have >= 5 competencies", () => {
    for (const fixture of fixtures) {
      expect(fixture.core_competencies!.length).toBeGreaterThanOrEqual(5)
    }
  })

  it("all fixtures have success_metrics", () => {
    for (const fixture of fixtures) {
      expect(fixture.success_metrics!.length).toBeGreaterThanOrEqual(2)
    }
  })
})
