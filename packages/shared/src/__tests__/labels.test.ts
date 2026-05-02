import { describe, expect, it } from "vitest"
import { PLATFORM_LABELS } from "../constants/labels"

describe("PLATFORM_LABELS", () => {
  it("defines corporate courses label", () => {
    expect(PLATFORM_LABELS.courses).toBe("Cursos e Trilhas")
  })

  it("defines corporate hierarchy", () => {
    expect(PLATFORM_LABELS.hierarchy).toEqual(["Gestor T&D", "Lider", "Colaborador"])
  })

  it("defines corporate dashboard metrics", () => {
    expect(PLATFORM_LABELS.dashboard_metrics).toEqual(["Competencias", "ROI"])
  })

  it("defines corporate onboarding sector", () => {
    expect(PLATFORM_LABELS.onboarding_sector.label).toBe("Setor/Area")
    expect(PLATFORM_LABELS.onboarding_sector.type).toBe("text")
  })

  it("defines corporate engagement and completion labels", () => {
    expect(PLATFORM_LABELS.engagementRate).toBe("Competencias Ativas")
    expect(PLATFORM_LABELS.completionRate).toBe("ROI de Treinamento")
  })
})
