import { describe, expect, it } from "vitest"
import {
  type FrameworkSelectionInput,
  getFrameworkConfig,
  listFrameworks,
  selectFramework,
} from "../framework-registry"
import type { FrameworkId } from "../schemas/shared"

describe("getFrameworkConfig (Story 20.2)", () => {
  it.each(["elc_plus", "kolb_4", "pbl_hmelo"] as FrameworkId[])("returns config for %s", (id) => {
    const config = getFrameworkConfig(id)
    expect(config.id).toBe(id)
    expect(config.type).toBe("learning_cycle")
    expect(config.stages.length).toBeGreaterThan(0)
  })

  it("throws for unknown id", () => {
    expect(() => getFrameworkConfig("unknown" as FrameworkId)).toThrow("Unknown framework id")
  })
})

describe("listFrameworks (Story 20.2)", () => {
  it("returns 3 frameworks", () => {
    const list = listFrameworks()
    expect(list).toHaveLength(3)
    expect(list.map((f) => f.id)).toEqual(["elc_plus", "kolb_4", "pbl_hmelo"])
  })

  it("each item has id, name, description", () => {
    for (const fw of listFrameworks()) {
      expect(fw.id).toBeTruthy()
      expect(fw.name).toBeTruthy()
      expect(fw.description).toBeTruthy()
    }
  })
})

describe("selectFramework decision tree (Story 20.2 AC5)", () => {
  const base: FrameworkSelectionInput = {
    behavior_change: "Melhorar produtividade",
    total_duration_hours: 20,
    experience_level: "intermediario",
  }

  it("P1: instructor preference overrides all", () => {
    const result = selectFramework({ ...base, instructor_preferred_framework: "kolb_4" })
    expect(result.id).toBe("kolb_4")
  })

  it("P2: 'resolver problemas' selects PBL", () => {
    const result = selectFramework({ ...base, behavior_change: "resolver problemas complexos" })
    expect(result.id).toBe("pbl_hmelo")
  })

  it("P2: 'tomar decisões' selects PBL", () => {
    const result = selectFramework({ ...base, behavior_change: "tomar decisões estratégicas" })
    expect(result.id).toBe("pbl_hmelo")
  })

  it("P3: short course + non-beginner selects Kolb", () => {
    const result = selectFramework({ ...base, total_duration_hours: 8 })
    expect(result.id).toBe("kolb_4")
  })

  it("P3: short course + beginner defaults to ELC+", () => {
    const result = selectFramework({
      ...base,
      total_duration_hours: 8,
      experience_level: "iniciante",
    })
    expect(result.id).toBe("elc_plus")
  })

  it("Default: ELC+", () => {
    const result = selectFramework(base)
    expect(result.id).toBe("elc_plus")
  })
})

describe("Framework integrity checks (Story 20.2)", () => {
  const ids: FrameworkId[] = ["elc_plus", "kolb_4", "pbl_hmelo"]

  it.each(ids)("%s: time_percentage sums to 100", (id) => {
    const config = getFrameworkConfig(id)
    const sum = config.stages.reduce((acc, s) => acc + s.time_percentage, 0)
    expect(sum).toBe(100)
  })

  it.each(ids)("%s: quality_criteria weights sum to 100", (id) => {
    const config = getFrameworkConfig(id)
    const sum = config.quality_criteria.reduce((acc, c) => acc + c.weight, 0)
    expect(sum).toBe(100)
  })

  it.each(ids)("%s: assessment_dimensions weights sum to 100", (id) => {
    const config = getFrameworkConfig(id)
    const sum = config.assessment_dimensions.reduce((acc, d) => acc + d.weight, 0)
    expect(sum).toBe(100)
  })
})
