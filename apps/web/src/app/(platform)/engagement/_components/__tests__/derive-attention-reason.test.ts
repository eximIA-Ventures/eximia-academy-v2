import { describe, expect, it } from "vitest"
import { deriveAttentionReason } from "../derive-attention-reason"

// =============================================================================
// Cards Mestre-Detalhe (fatia 4/6, doc 03 §4 decisão 2) — deriveAttentionReason
// only produces a phrase when a student is in the "Atenção" card's
// no_reflection cohort PURELY because of no_reflection (their real triagem is
// NOT already "atencao", which would make the explanation redundant).
// =============================================================================

describe("deriveAttentionReason (Cards Mestre-Detalhe, no_reflection)", () => {
  it("no_reflection + triagem no_ritmo → explains the orthogonal reason", () => {
    expect(
      deriveAttentionReason({ triagem: "no_ritmo", completedSessions: 2, reflectionsCount: 0 }),
    ).toBe("No ritmo, mas sem interações recentes de reflexão.")
  })

  it("no_reflection + triagem sem_acesso → explains the orthogonal reason", () => {
    expect(
      deriveAttentionReason({ triagem: "sem_acesso", completedSessions: 3, reflectionsCount: 0 }),
    ).toBe("Sem acesso recente, e também sem reflexões registradas.")
  })

  it("no_reflection + triagem atencao → null (cohort title already explains it)", () => {
    expect(
      deriveAttentionReason({ triagem: "atencao", completedSessions: 2, reflectionsCount: 0 }),
    ).toBeNull()
  })

  it("completedSessions below threshold → null even with zero reflections", () => {
    expect(
      deriveAttentionReason({ triagem: "no_ritmo", completedSessions: 1, reflectionsCount: 0 }),
    ).toBeNull()
  })

  it("reflectionsCount > 0 → null even with enough sessions", () => {
    expect(
      deriveAttentionReason({ triagem: "no_ritmo", completedSessions: 5, reflectionsCount: 2 }),
    ).toBeNull()
  })

  it("triagem undefined → null (nothing to compose a claim from)", () => {
    expect(
      deriveAttentionReason({ triagem: undefined, completedSessions: 2, reflectionsCount: 0 }),
    ).toBeNull()
  })
})
