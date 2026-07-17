import { describe, expect, it } from "vitest"
import { engagementScoreOf, leituraOf } from "../roster-insights-table"

// =============================================================================
// Fatia 16 (spec §7.1.2) — leituraOf, the deterministic verdict of the
// "Leitura" column. Precedence (first match wins):
//   1. engagement (completedSessions*2 + reflectionsCount) STRICTLY above the
//      cohort average → acima_media (a TIE is NOT above).
//   2. daysSinceLastActivity ∈ [0..7] → ativo.
//   3. daysSinceLastActivity === null → nunca.
//   4. otherwise → sem_atividade with the exact day count.
// =============================================================================

describe("engagementScoreOf (same formula as getEngagementScore)", () => {
  it("is completedSessions*2 + reflectionsCount", () => {
    expect(engagementScoreOf({ completedSessions: 3, reflectionsCount: 4 })).toBe(10)
    expect(engagementScoreOf({ completedSessions: 0, reflectionsCount: 0 })).toBe(0)
  })
})

describe("leituraOf (fatia 16, coluna Leitura)", () => {
  it("acima da média VENCE ativo (precedence 1 over 2)", () => {
    // engagement 12 > avg 5, AND recently active — acima_media must win.
    const verdict = leituraOf(
      { completedSessions: 5, reflectionsCount: 2, daysSinceLastActivity: 1 },
      5,
    )
    expect(verdict).toEqual({ kind: "acima_media" })
  })

  it("EMPATE na média NÃO é acima (strictly greater required)", () => {
    // engagement 10 === avg 10 → not acima_media; days 3 → ativo.
    const verdict = leituraOf(
      { completedSessions: 4, reflectionsCount: 2, daysSinceLastActivity: 3 },
      10,
    )
    expect(verdict).toEqual({ kind: "ativo" })
  })

  it("daysSinceLastActivity = 0 é ativo", () => {
    const verdict = leituraOf(
      { completedSessions: 0, reflectionsCount: 0, daysSinceLastActivity: 0 },
      10,
    )
    expect(verdict).toEqual({ kind: "ativo" })
  })

  it("boundary: 7 dias ainda é ativo; 8 dias já não é", () => {
    expect(
      leituraOf({ completedSessions: 0, reflectionsCount: 0, daysSinceLastActivity: 7 }, 10),
    ).toEqual({ kind: "ativo" })
    expect(
      leituraOf({ completedSessions: 0, reflectionsCount: 0, daysSinceLastActivity: 8 }, 10),
    ).toEqual({ kind: "sem_atividade", days: 8 })
  })

  it("null é nunca (precedence 3)", () => {
    const verdict = leituraOf(
      { completedSessions: 0, reflectionsCount: 0, daysSinceLastActivity: null },
      10,
    )
    expect(verdict).toEqual({ kind: "nunca" })
  })

  it("null with engagement above average is still acima_media (precedence 1 over 3)", () => {
    const verdict = leituraOf(
      { completedSessions: 6, reflectionsCount: 0, daysSinceLastActivity: null },
      5,
    )
    expect(verdict).toEqual({ kind: "acima_media" })
  })

  it("8+ dias abaixo da média é sem_atividade com o N exato de dias", () => {
    const verdict = leituraOf(
      { completedSessions: 1, reflectionsCount: 0, daysSinceLastActivity: 12 },
      10,
    )
    expect(verdict).toEqual({ kind: "sem_atividade", days: 12 })
  })
})
