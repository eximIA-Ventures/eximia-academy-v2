import { describe, expect, it } from "vitest"
import { buildUnitStatsBlock, buildUnitStatsBlockFromRoster } from "../unit-stats-block"

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

// ===========================================================================
// 2026-08-12 — o filtro de sub-time (`?teams=`) é aplicado no CLIENTE (o
// dropdown escreve com history.replaceState, sem round-trip RSC), então o hero
// "Meu time está engajado esta semana?" precisa recalcular o bloco "Meu Time" a
// partir do roster já filtrado. A regra que importa aqui é a EQUIVALÊNCIA: com
// a mesma população, as duas derivações têm de dar o mesmo bloco — senão o
// simples ato de filtrar e desfiltrar mudaria o número.
// ===========================================================================

describe("buildUnitStatsBlockFromRoster", () => {
  const ROSTER = [
    { totalSessions: 2, completedSessions: 1, reflectionsCount: 2, daysSinceLastActivity: 4 },
    { totalSessions: 1, completedSessions: 1, reflectionsCount: 0, daysSinceLastActivity: 24 },
    { totalSessions: 1, completedSessions: 1, reflectionsCount: 0, daysSinceLastActivity: 60 },
  ]

  it("produz o MESMO bloco que buildUnitStatsBlock para a mesma população", () => {
    const fromRows = buildUnitStatsBlock(
      "Meu Time",
      ["caio", "cintia", "neusa"],
      [
        { student_id: "caio", status: "completed", created_at: daysAgo(4) },
        { student_id: "caio", status: "in_progress", created_at: daysAgo(4) },
        { student_id: "cintia", status: "completed", created_at: daysAgo(24) },
        { student_id: "neusa", status: "completed", created_at: daysAgo(60) },
      ],
      [{ student_id: "caio" }, { student_id: "caio" }],
      1,
      NOW,
    )

    expect(buildUnitStatsBlockFromRoster("Meu Time", ROSTER, 1)).toEqual(fromRows)
  })

  it("reduzir a população reduz o bloco (o hero acompanha o sub-time escolhido)", () => {
    const block = buildUnitStatsBlockFromRoster("Meu Time", ROSTER.slice(0, 1), 1)

    expect(block.totalStudents).toBe(1)
    expect(block.totalSessions).toBe(2)
    expect(block.completedSessions).toBe(1)
    expect(block.completionPct).toBe(100)
    expect(block.avgSessionsPerStudent).toBe(2)
  })

  it("ativo é decorrido < 30 dias, igual ao corte de created_at do original", () => {
    const block = buildUnitStatsBlockFromRoster(
      "Meu Time",
      [
        { totalSessions: 1, completedSessions: 0, reflectionsCount: 0, daysSinceLastActivity: 29 },
        { totalSessions: 1, completedSessions: 0, reflectionsCount: 0, daysSinceLastActivity: 30 },
        {
          totalSessions: 0,
          completedSessions: 0,
          reflectionsCount: 0,
          daysSinceLastActivity: null,
        },
      ],
      2,
    )

    expect(block.activeStudents).toBe(1)
  })

  it("sub-time vazio não vira NaN/Infinity", () => {
    const block = buildUnitStatsBlockFromRoster("Meu Time", [], 5)

    expect(block).toMatchObject({
      totalStudents: 0,
      activeStudents: 0,
      completionPct: 0,
      avgSessionsPerStudent: 0,
    })
  })
})
