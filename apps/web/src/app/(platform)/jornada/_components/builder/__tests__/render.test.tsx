import type { JourneyCourseContext, JourneyPlan } from "@/lib/journey/types"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { JourneyReview } from "../../review/journey-review"
import { JourneyBuilder } from "../journey-builder"

// jsdom não implementa matchMedia; a timeline usa em um effect. Stub local
// (escopo do teste) — NÃO tocamos no test-setup compartilhado (território comum).
beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
  }
})

// Contexto canônico da demo (SPEC §2.2): 8 módulos, teto 126, meta 105.
const REFL = [2, 4, 3, 6, 5, 4, 3, 2]
const CTX: JourneyCourseContext = {
  courseId: "course-1",
  courseTitle: "Análise e Solução de Problemas",
  startDate: "2026-01-01",
  finalDeadlineDays: 126,
  managerDeadlineDays: 105,
  modules: REFL.map((refl, i) => ({
    chapterId: `ch-${i}`,
    title: `Módulo ${i + 1}`,
    order: i,
    interactionsExpected: 1,
    reflectionsExpected: refl,
  })),
}

const PLAN: JourneyPlan = {
  id: "plan-1",
  enrollmentId: "enr-1",
  studentId: "stu-1",
  courseId: "course-1",
  tenantId: "ten-1",
  status: "active",
  moduleDurations: [15, 15, 15, 15, 15, 15, 15, 15],
  preset: null,
  preferences: { cascade: true, unit: "w" },
  startDate: "2026-01-01",
  finalDeadlineDate: "2026-05-07",
  managerDeadlineDate: "2026-04-16",
  recalculatedAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
}

describe("JourneyBuilder — construtor (draft)", () => {
  it("renderiza título, CTA, timeline, banner e 8 linhas de módulo", () => {
    render(<JourneyBuilder context={CTX} />)
    expect(screen.getByText("Monte sua jornada")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Começar minha jornada" })).toBeInTheDocument()
    expect(screen.getByTestId("jornada-timeline")).toBeInTheDocument()
    expect(screen.getByTestId("jornada-summary")).toBeInTheDocument()
    // 8 steppers "+" = 8 módulos na tabela
    expect(screen.getAllByRole("button", { name: /^Alongar o Módulo/ })).toHaveLength(8)
  })

  it("confirmar entrega moduleDurations (8) + preferences ao callback", () => {
    const onConfirm = vi.fn()
    render(<JourneyBuilder context={CTX} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole("button", { name: "Começar minha jornada" }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    const payload = onConfirm.mock.calls[0][0]
    expect(payload.moduleDurations).toHaveLength(8)
    expect(payload.preferences).toEqual({ cascade: true, unit: "w" })
  })

  it("stepper '+' ajusta a duração do módulo (sincronia tabela↔estado)", () => {
    render(<JourneyBuilder context={CTX} />)
    // neutro = 15 dias/módulo; no modo semanas o rótulo é "2,1 semanas" (não múltiplo de 7)
    expect(screen.getAllByText("2,1 semanas").length).toBeGreaterThan(0)
    expect(screen.queryByText("3 semanas")).toBeNull()
    fireEvent.click(screen.getByLabelText("Alongar o Módulo 1 em 1 semana"))
    // +1 semana no M1: snap semanal 15 → 21 dias = "3 semanas"
    expect(screen.getByText("3 semanas")).toBeInTheDocument()
  })
})

describe("JourneyReview — revisar (active)", () => {
  it("renderiza badge, 'Salvar alterações' desabilitado sem mudança e 'Voltar'", () => {
    render(<JourneyReview context={CTX} plan={PLAN} />)
    expect(screen.getByText("Jornada ativa")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Revisar jornada" })).toBeInTheDocument()
    const save = screen.getByRole("button", { name: "Salvar alterações" })
    expect(save).toBeDisabled()
    expect(screen.getByRole("button", { name: "Voltar" })).toBeInTheDocument()
  })

  it("um ajuste habilita 'Salvar alterações' (mudança real vs snapshot)", () => {
    render(<JourneyReview context={CTX} plan={PLAN} />)
    fireEvent.click(screen.getByLabelText("Alongar o Módulo 1 em 1 semana"))
    expect(screen.getByRole("button", { name: "Salvar alterações" })).not.toBeDisabled()
  })

  it("'Voltar' chama onBack (descarta)", () => {
    const onBack = vi.fn()
    render(<JourneyReview context={CTX} plan={PLAN} onBack={onBack} />)
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
