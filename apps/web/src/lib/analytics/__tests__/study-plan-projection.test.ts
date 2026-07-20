import { describe, expect, it } from "vitest"
import {
  DEFAULT_STUDY_PLAN_CHOICE,
  PT_PER_SESSION,
  type StudyPlanChoice,
  type StudyPlanDiagnostic,
  computeStudyPlanProjection,
} from "../study-plan-projection"

// Real numbers from the Rinaldo case (SH-2.7/2.7.1/2.7.2, Supabase tenant CORY,
// 2026-07-19): Progresso 50% (expectedProgressPct=33), Reflexões 8/41 (~19,5%).
// daysLeft/weeksLeft here are illustrative (this story does not fetch Rinaldo's
// real deadline) but same order of magnitude as the mockup's 121 dias/17 semanas.
const RINALDO: StudyPlanDiagnostic = {
  progressNow: 50,
  progressTarget: 33,
  reflDoneCount: 8,
  reflTotal: 41,
  reflNow: (8 / 41) * 100,
  reflTarget: 33,
  daysLeft: 121,
  weeksLeft: 17,
}

function choice(over: Partial<StudyPlanChoice> = {}): StudyPlanChoice {
  return { ...DEFAULT_STUDY_PLAN_CHOICE, days: [...DEFAULT_STUDY_PLAN_CHOICE.days], ...over }
}

describe("computeStudyPlanProjection — caso real Rinaldo (dado do SH-2.7)", () => {
  it("com 0 dias escolhidos, verdict é 'empty' e nada é projetado", () => {
    const result = computeStudyPlanProjection(RINALDO, choice({ days: Array(7).fill(false) }))
    expect(result.chosenDays).toBe(0)
    expect(result.verdict).toBe("empty")
    expect(result.sessionsPerWeek).toBe(0)
    expect(result.reflPerWeek).toBe(0)
  })

  it("3 dias, 2 sessões/dia, reflexão ligada — fecha os dois gaps (progressTarget=33 já é folgado p/ 50%)", () => {
    const result = computeStudyPlanProjection(RINALDO, choice())
    expect(result.chosenDays).toBe(3)
    expect(result.sessionsPerWeek).toBe(6)
    expect(result.reflPerWeek).toBe(3)
    // progressNow (50) já é >= progressTarget (33): projeção só sobe a partir daí.
    expect(result.progressOk).toBe(true)
    expect(result.progressProj).not.toBeNull()
    expect(result.progressProj as number).toBeGreaterThanOrEqual(50)
    expect(result.verdict).toBe("ok")
  })

  it("reflexão desligada some do cálculo de reflPerWeek e pode reprovar o gap de reflexão", () => {
    const result = computeStudyPlanProjection(RINALDO, choice({ reflFocus: false }))
    expect(result.reflPerWeek).toBe(0)
    // Sem nenhuma reflexão nova, reflProj fica igual ao reflNow (~19,5%), abaixo da meta 33%.
    expect(result.reflOk).toBe(false)
    expect(result.verdict).toBe("warn-refl")
  })

  it("subir sessionsPerDay aumenta a projeção de progresso monotonicamente", () => {
    const low = computeStudyPlanProjection(RINALDO, choice({ sessionsPerDay: 1 }))
    const high = computeStudyPlanProjection(RINALDO, choice({ sessionsPerDay: 5 }))
    expect((high.progressProj as number) >= (low.progressProj as number)).toBe(true)
  })

  it("progressProj nunca ultrapassa 100", () => {
    const result = computeStudyPlanProjection(
      RINALDO,
      choice({ days: Array(7).fill(true), sessionsPerDay: 5 }),
    )
    expect(result.progressProj).toBeLessThanOrEqual(100)
  })

  it("PT_PER_SESSION é a constante ilustrativa documentada (1.5), não recalculada", () => {
    expect(PT_PER_SESSION).toBe(1.5)
  })
})

describe("computeStudyPlanProjection — degradação graciosa (dado real ausente)", () => {
  const NO_DEADLINE: StudyPlanDiagnostic = {
    progressNow: 50,
    progressTarget: null,
    reflDoneCount: 8,
    reflTotal: 41,
    reflNow: (8 / 41) * 100,
    reflTarget: null,
    daysLeft: null,
    weeksLeft: null,
  }

  it("sem weeksLeft (sem deadline computável), progressProj/reflProj ficam null, verdict 'unknown'", () => {
    const result = computeStudyPlanProjection(NO_DEADLINE, choice())
    expect(result.progressProj).toBeNull()
    expect(result.reflProj).toBeNull()
    expect(result.progressOk).toBeNull()
    expect(result.reflOk).toBeNull()
    expect(result.verdict).toBe("unknown")
    // Nunca lança/crasha mesmo com dado ausente.
    expect(result.weeksToProgress).toBe(Number.POSITIVE_INFINITY)
  })

  it("sem 0 dias e sem weeksLeft, verdict continua 'empty' (chosenDays domina)", () => {
    const result = computeStudyPlanProjection(NO_DEADLINE, choice({ days: Array(7).fill(false) }))
    expect(result.verdict).toBe("empty")
  })

  const NO_REFLECTION_DENOMINATOR: StudyPlanDiagnostic = {
    ...RINALDO,
    reflTotal: null,
    reflNow: null,
  }

  it("sem reflectionsMax (reflTotal null), reflProj fica null mas progressProj continua real", () => {
    const result = computeStudyPlanProjection(NO_REFLECTION_DENOMINATOR, choice())
    expect(result.reflProj).toBeNull()
    expect(result.reflOk).toBeNull()
    expect(result.progressProj).not.toBeNull()
  })
})

describe("computeStudyPlanProjection — genericidade (não hardcoded ao Rinaldo)", () => {
  it("funciona para um segundo aluno com números completamente diferentes", () => {
    const ANGELO: StudyPlanDiagnostic = {
      progressNow: 50,
      progressTarget: 20,
      reflDoneCount: 1,
      reflTotal: 41,
      reflNow: (1 / 41) * 100,
      reflTarget: 20,
      daysLeft: 60,
      weeksLeft: 9,
    }
    const result = computeStudyPlanProjection(ANGELO, choice({ sessionsPerDay: 3 }))
    expect(result.chosenDays).toBe(3)
    expect(result.sessionsPerWeek).toBe(9)
    expect(result.progressProj).not.toBeNull()
    expect(result.verdict).not.toBe("empty")
  })
})
