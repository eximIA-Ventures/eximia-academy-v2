import { describe, expect, it } from "vitest"
import { deriveNudgeTypeFromRitmo } from "../derive-nudge-type"

// =============================================================================
// E6 AC10 — deriveNudgeTypeFromRitmo maps a student's REAL ritmo to the template
// the Sheet pre-fills, WITHOUT touching computeStudentAction (which only sees
// `triagem`, not `ritmo`). Three canonical cases required by the story.
// =============================================================================

describe("deriveNudgeTypeFromRitmo (E6 AC10)", () => {
  it("atrasado → behind_teaching_plan (the new E2 cohort)", () => {
    expect(deriveNudgeTypeFromRitmo("atrasado", 5)).toBe("behind_teaching_plan")
    // atraso wins even if totalSessions is 0 — the ritmo is authoritative here.
    expect(deriveNudgeTypeFromRitmo("atrasado", 0)).toBe("behind_teaching_plan")
  })

  it("nao_iniciado → never_accessed", () => {
    expect(deriveNudgeTypeFromRitmo("nao_iniciado", 0)).toBe("never_accessed")
  })

  it("totalSessions === 0 fallback → never_accessed even when ritmo is no_ritmo", () => {
    expect(deriveNudgeTypeFromRitmo("no_ritmo", 0)).toBe("never_accessed")
  })

  it("otherwise (no_ritmo with sessions) → inactive", () => {
    expect(deriveNudgeTypeFromRitmo("no_ritmo", 3)).toBe("inactive")
  })
})
