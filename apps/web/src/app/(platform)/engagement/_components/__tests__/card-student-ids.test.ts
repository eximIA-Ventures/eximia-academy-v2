import type { StudentTriagem } from "@/lib/student-triage"
import { describe, expect, it } from "vitest"
import { cardStudentIdsFrom } from "../types"

// =============================================================================
// Fatia 16 (spec §7.1.1) — cardStudentIdsFrom derives the FULL cohort behind
// each semáforo card from the SAME triagemByStudent Map that produces the
// cards' summary numbers. THE invariant of the reform: the list of a card has
// exactly the ids of that card's bucket, and its length equals the count the
// card displays (lista == número do card, by construction).
// =============================================================================

describe("cardStudentIdsFrom (fatia 16, cohort por card)", () => {
  it("splits a synthetic Map into the 3 buckets with exactly each bucket's ids", () => {
    const triagemByStudent = new Map<string, StudentTriagem>([
      ["a1", "atencao"],
      ["n1", "no_ritmo"],
      ["s1", "sem_acesso"],
      ["a2", "atencao"],
      ["n2", "no_ritmo"],
      ["a3", "atencao"],
    ])

    const result = cardStudentIdsFrom(triagemByStudent)

    expect(result.atencao).toEqual(["a1", "a2", "a3"])
    expect(result.no_ritmo).toEqual(["n1", "n2"])
    expect(result.sem_acesso).toEqual(["s1"])
  })

  it("INVARIANTE lista == número do card: each array's length equals the bucket count", () => {
    const entries: Array<[string, StudentTriagem]> = []
    for (let i = 0; i < 7; i++) entries.push([`at-${i}`, "atencao"])
    for (let i = 0; i < 4; i++) entries.push([`nr-${i}`, "no_ritmo"])
    for (let i = 0; i < 2; i++) entries.push([`sa-${i}`, "sem_acesso"])
    const triagemByStudent = new Map(entries)

    const result = cardStudentIdsFrom(triagemByStudent)

    // The counts a summary computed from the SAME Map would show on the cards.
    expect(result.atencao).toHaveLength(7)
    expect(result.no_ritmo).toHaveLength(4)
    expect(result.sem_acesso).toHaveLength(2)
    // No student appears in more than one bucket, none is lost.
    const all = [...result.atencao, ...result.no_ritmo, ...result.sem_acesso]
    expect(all).toHaveLength(triagemByStudent.size)
    expect(new Set(all).size).toBe(triagemByStudent.size)
  })

  it("empty Map → the 3 buckets exist and are empty (never undefined)", () => {
    const result = cardStudentIdsFrom(new Map())
    expect(result.atencao).toEqual([])
    expect(result.no_ritmo).toEqual([])
    expect(result.sem_acesso).toEqual([])
  })
})
