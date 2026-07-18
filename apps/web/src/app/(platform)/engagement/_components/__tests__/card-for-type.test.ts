import { describe, expect, it } from "vitest"
import { cardForType } from "../engagement-shell"

// =============================================================================
// Cards Mestre-Detalhe (fatia 6/6, doc 03 §4 decisão 4) — cardForType resolves
// a RAW, unvalidated `?type=` string to a card, whitelisting against the same
// 5 diagnostic cohorts the server validates in page.tsx.
//
// Regression coverage for the Eng-Revisor fatia 6 finding: bracket-indexing a
// plain object literal (CARD_BY_TYPE) with an unvalidated string resolves
// prototype-chain keys ("__proto__", "constructor", "toString") to a truthy
// non-card value instead of `undefined`, which crashed the whole page for
// ANY visitor hitting `/engagement?type=__proto__`. cardForType MUST reject
// these the same way it rejects any other invalid value.
// =============================================================================

describe("cardForType (Cards Mestre-Detalhe, ?type= whitelist)", () => {
  it("maps each of the 5 valid cohorts to its card", () => {
    expect(cardForType("never_accessed")).toBe("atencao")
    expect(cardForType("behind_teaching_plan")).toBe("atencao")
    expect(cardForType("no_reflection")).toBe("atencao")
    expect(cardForType("inactive")).toBe("sem_acesso")
    expect(cardForType("top_performer")).toBe("no_ritmo")
  })

  it("rejects non-cohort NudgeType values (announcement/custom)", () => {
    expect(cardForType("announcement")).toBeUndefined()
    expect(cardForType("custom")).toBeUndefined()
  })

  it("rejects null and empty string", () => {
    expect(cardForType(null)).toBeUndefined()
    expect(cardForType("")).toBeUndefined()
  })

  it("rejects garbage/unrelated strings", () => {
    expect(cardForType("not-a-real-type")).toBeUndefined()
  })

  it("REGRESSION (Eng-Revisor fatia 6 finding): rejects prototype-chain keys", () => {
    expect(cardForType("__proto__")).toBeUndefined()
    expect(cardForType("constructor")).toBeUndefined()
    expect(cardForType("toString")).toBeUndefined()
    expect(cardForType("hasOwnProperty")).toBeUndefined()
  })
})
