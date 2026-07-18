import { describe, expect, it } from "vitest"
import { buildUnitStatsBlock } from "../unit-stats-block"

// ===========================================================================
// T2 (Crivo review, 2026-07-18) — "Meu time está engajado esta semana?" hero
// showed 0%/0%/0.0 for a manager while the SAME recorte's Tabela simplificada
// showed real progress (100% concluído, engajamento 83/39/35). Root cause:
// `unitStats` was hard-coded to `[]` for the manager lens (no `areas` row
// represents a team) — reducing over an empty array trivially yields zero.
// This pins the extracted math so a "Meu Time" block built from the SAME
// roster the Tabela simplificada uses produces NON-ZERO, correct numbers.
// ===========================================================================

const NOW = new Date("2026-07-18T12:00:00.000Z").getTime()
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

describe("buildUnitStatsBlock", () => {
  it("computes non-zero stats for a team recorte with real activity (caso Rinaldo/Caio)", () => {
    const block = buildUnitStatsBlock(
      "Meu Time",
      ["caio", "cintia", "neusa"],
      [
        { student_id: "caio", status: "completed", created_at: daysAgo(4) },
        { student_id: "cintia", status: "completed", created_at: daysAgo(24) },
        { student_id: "neusa", status: "completed", created_at: daysAgo(60) },
      ],
      [{ student_id: "caio" }, { student_id: "caio" }],
      1, // totalChapters — 1 chapter, all 3 students completed it → 100%
      NOW,
    )

    expect(block.areaName).toBe("Meu Time")
    expect(block.totalStudents).toBe(3)
    expect(block.completedSessions).toBe(3)
    expect(block.completionPct).toBe(100) // 3 completed / (3 students * 1 chapter)
    // "caio" (4d) and "cintia" (24d) are within 30 days; "neusa" (60d) is not.
    expect(block.activeStudents).toBe(2)
    expect(block.reflectionCount).toBe(2)
    expect(block.avgSessionsPerStudent).toBe(1)
  })

  it("intersects sessions/reflections by studentIds — an out-of-recorte student never inflates the block", () => {
    const block = buildUnitStatsBlock(
      "Meu Time",
      ["s1"],
      [
        { student_id: "s1", status: "completed", created_at: daysAgo(1) },
        { student_id: "outsider", status: "completed", created_at: daysAgo(1) },
      ],
      [{ student_id: "outsider" }],
      2,
      NOW,
    )

    expect(block.totalStudents).toBe(1)
    expect(block.totalSessions).toBe(1) // "outsider" excluded
    expect(block.reflectionCount).toBe(0) // "outsider" excluded
  })

  it("zero students → zero-percent block, no division by zero (NaN)", () => {
    const block = buildUnitStatsBlock("Meu Time", [], [], [], 5, NOW)

    expect(block.totalStudents).toBe(0)
    expect(block.completionPct).toBe(0)
    expect(block.avgSessionsPerStudent).toBe(0)
    expect(block.activeStudents).toBe(0)
  })

  it("zero chapters (no curriculum yet) → completionPct is 0, not NaN/Infinity", () => {
    const block = buildUnitStatsBlock(
      "Meu Time",
      ["s1"],
      [{ student_id: "s1", status: "completed", created_at: daysAgo(1) }],
      [],
      0,
      NOW,
    )

    expect(block.completionPct).toBe(0)
  })
})
