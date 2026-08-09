import { describe, expect, it } from "vitest"

/**
 * JRN-E-QA-1 — o READ-PATH tem de honrar o teto de coorte.
 *
 * O contrato §4 e o JSDoc de `alignDurationsToChapters` diziam que um capítulo
 * publicado DEPOIS da montagem entra com `MIN_DAYS_PER_MODULE` e que **o
 * chamador re-clampa**. A escrita clampa (`actions.ts`, via
 * `normalizeRemainingDurations`) e o construtor clampa (`journey-builder.tsx`,
 * via `fitRemainingToDeadline`). Só a LEITURA não clampava: o plano lido do
 * banco saía com a soma inflada e o dashboard entregava isso direto à timeline,
 * produzindo prazo ALÉM do teto — a quebra do exato invariante que a JRN-E
 * existe para proteger. Um aluno que nunca revisasse a jornada conviveria com o
 * furo indefinidamente.
 *
 * Repro do @qa: âncora 2026-01-01, teto 2026-04-11 (âncora + 100), jornada
 * [50, 50] somando exatamente a janela; publica-se `ch-c` → projeção [50,50,4]
 * → último prazo 2026-04-15, quatro dias além do teto.
 *
 * Estes testes exercitam o caminho REAL de leitura (`mapRowToJourneyPlan` sobre
 * uma row de `study_plans`) e afirmam sobre a DATA que a timeline produz, não
 * sobre uma reimplementação da aritmética.
 */

import { mapRowToJourneyPlan } from "../journey-plan-data"
import { UNTOUCHED_MODULE_PROGRESS } from "../module-progress"
import { computeRemainingWindow, moduleEndDatesAnchored } from "../plan-math"
import type { JourneyPlan } from "../types"

/** Âncora do replanejamento (`recalculated_at`) do repro. */
const ANCHOR = "2026-01-01"
/** Teto de coorte gravado na row: âncora + 100 dias. */
const CEILING = "2026-04-11"

function planRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "plan-1",
    enrollment_id: "enr-1",
    student_id: "stu-1",
    course_id: "course-1",
    tenant_id: "tenant-1",
    status: "active",
    module_durations: [
      { chapterId: "ch-a", days: 50 },
      { chapterId: "ch-b", days: 50 },
    ],
    preset: null,
    preferences: { cascade: true, unit: "w" },
    start_date: ANCHOR,
    recalculated_at: ANCHOR,
    final_deadline_date: CEILING,
    manager_deadline_date: null,
    baseline: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...over,
  }
}

/**
 * A timeline que o dashboard renderiza: exatamente as duas funções canônicas
 * que `dashboard-model.ts:234-240` consome, com nada concluído (o pior caso
 * para o teto — todo módulo ainda pede seus dias).
 */
function timelineOf(plan: JourneyPlan, cohortDeadline: string | null = CEILING) {
  const modules = plan.moduleDurations.map(() => ({ progress: UNTOUCHED_MODULE_PROGRESS }))
  const window = computeRemainingWindow(modules, plan.planningAnchorDate, cohortDeadline)
  return moduleEndDatesAnchored(plan.moduleDurations, window)
}

describe("mapRowToJourneyPlan — JRN-E-QA-1 (a leitura re-clampa ao teto de coorte)", () => {
  it("capítulo publicado DEPOIS da montagem NÃO empurra o prazo além do teto", () => {
    // Sem o clamp na leitura: projeção [50,50,4] → último prazo "2026-04-15".
    const plan = mapRowToJourneyPlan(planRow(), ["ch-a", "ch-b", "ch-c"])

    const ends = timelineOf(plan)
    expect(ends.at(-1)).toBe(CEILING)
    expect(plan.moduleDurations.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(100)
    expect(plan.moduleDurations).toEqual([48, 48, 4])
  })

  it("nenhum prazo lido ultrapassa o teto, com 1, 2 ou 3 capítulos publicados depois", () => {
    for (const extras of [["ch-c"], ["ch-c", "ch-d"], ["ch-c", "ch-d", "ch-e"]]) {
      const plan = mapRowToJourneyPlan(planRow(), ["ch-a", "ch-b", ...extras])
      for (const iso of timelineOf(plan)) {
        if (iso != null) expect(iso <= CEILING).toBe(true)
      }
    }
  })

  it("jornada intacta atravessa a leitura sem alteração (o clamp é no-op no caso saudável)", () => {
    const plan = mapRowToJourneyPlan(planRow(), ["ch-a", "ch-b"])
    expect(plan.moduleDurations).toEqual([50, 50])
    expect(timelineOf(plan).at(-1)).toBe(CEILING)
  })

  it("módulo concluído na montagem (0 dias) continua em 0 — o clamp não ressuscita concluído", () => {
    const row = planRow({
      module_durations: [
        { chapterId: "ch-a", days: 0 },
        { chapterId: "ch-b", days: 100 },
      ],
    })
    const plan = mapRowToJourneyPlan(row, ["ch-a", "ch-b", "ch-c"])
    expect(plan.moduleDurations[0]).toBe(0)
    expect(plan.moduleDurations.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(100)
  })

  it("sem teto computável (final_deadline_date null) a leitura NÃO destrói a jornada", () => {
    // Mesma degradação honesta que a escrita já tem (actions.ts: sem deadline
    // computável, o teto é a própria soma e não se clampa nada).
    const plan = mapRowToJourneyPlan(planRow({ final_deadline_date: null }), [
      "ch-a",
      "ch-b",
      "ch-c",
    ])
    expect(plan.moduleDurations).toEqual([50, 50, 4])
  })

  it("a VERDADE persistida (moduleDurationsByChapter) não é reescrita pelo clamp da projeção", () => {
    const plan = mapRowToJourneyPlan(planRow(), ["ch-a", "ch-b", "ch-c"])
    expect(plan.moduleDurationsByChapter).toEqual([
      { chapterId: "ch-a", days: 50 },
      { chapterId: "ch-b", days: 50 },
    ])
  })
})
