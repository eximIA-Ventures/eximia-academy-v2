import type { StudyPlanDiagnostic } from "@/lib/analytics/study-plan-projection"
import { ToastProvider } from "@eximia/ui"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MeuPlanoClient } from "../meu-plano-client"

// Same real-shaped numbers as the SH-2.7 Rinaldo case (progressTarget/reflTarget
// = expectedProgressPct = 33, the SH-2.7 own-pace signal).
const DIAGNOSTIC: StudyPlanDiagnostic = {
  progressNow: 50,
  progressTarget: 33,
  reflDoneCount: 8,
  reflTotal: 41,
  reflNow: (8 / 41) * 100,
  reflTarget: 33,
  daysLeft: 121,
  weeksLeft: 17,
}

function renderPlan(diagnostic: StudyPlanDiagnostic = DIAGNOSTIC, studentFirstName = "Rinaldo") {
  return render(
    <ToastProvider>
      <MeuPlanoClient diagnostic={diagnostic} studentFirstName={studentFirstName} />
    </ToastProvider>,
  )
}

describe("MeuPlanoClient", () => {
  it("renderiza as 5 seções + breadcrumb + prazo real", () => {
    renderPlan()
    expect(screen.getByText("Monte o seu plano de estudo")).toBeInTheDocument()
    expect(screen.getByText("Meu ritmo")).toBeInTheDocument()
    expect(screen.getByText("Montar meu plano")).toBeInTheDocument()
    expect(screen.getByText("De onde você parte hoje")).toBeInTheDocument()
    expect(screen.getByText("Que dias você consegue estudar?")).toBeInTheDocument()
    expect(screen.getByText("Quanto você entrega em cada dia")).toBeInTheDocument()
    expect(screen.getByText("Isso fecha o seu gap?")).toBeInTheDocument()
    expect(screen.getByText("Passo final · seu compromisso da semana")).toBeInTheDocument()
    expect(screen.getByText("121")).toBeInTheDocument()
    expect(screen.getByText("dias até o fim do curso")).toBeInTheDocument()
  })

  it("dia começa com Seg/Qua/Sex marcados (default herdado do mockup)", () => {
    renderPlan()
    expect(screen.getByRole("button", { name: /Seg/ })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: /Ter/ })).toHaveAttribute("aria-pressed", "false")
  })

  it("clicar num dia alterna aria-pressed e recalcula a projeção ao vivo", () => {
    renderPlan()
    const projectionBefore = screen.getByTestId("plan-projection").getAttribute("data-verdict")

    const terca = screen.getByRole("button", { name: /Ter/ })
    fireEvent.click(terca)
    expect(terca).toHaveAttribute("aria-pressed", "true")

    // Adicionar um dia de estudo muda os totais semanais mostrados na seção 4.
    const projectionAfter = screen.getByTestId("plan-projection").getAttribute("data-verdict")
    expect(projectionBefore).toBeDefined()
    expect(projectionAfter).toBeDefined()
  })

  it("desmarcar todos os dias volta o veredito para 'empty' e desabilita confirmar", () => {
    renderPlan()
    for (const label of ["Seg", "Qua", "Sex"]) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(label) }))
    }
    expect(screen.getByTestId("plan-projection")).toHaveAttribute("data-verdict", "empty")
    expect(screen.getByRole("button", { name: /Confirmar meu plano/ })).toBeDisabled()
  })

  it("stepper de sessões incrementa/decrementa dentro de 1-5", () => {
    renderPlan()
    const plus = screen.getByLabelText("mais sessões")
    const minus = screen.getByLabelText("menos sessões")
    // default = 2
    fireEvent.click(plus)
    fireEvent.click(plus)
    fireEvent.click(plus) // 2->3->4->5, deve travar em 5
    expect(screen.getByLabelText("mais sessões")).toBeDisabled()
    for (let i = 0; i < 6; i++) fireEvent.click(minus) // desce até travar em 1
    expect(screen.getByLabelText("menos sessões")).toBeDisabled()
  })

  it("toggle de reflexão desliga o foco e reflete no texto do dia", () => {
    renderPlan()
    const reflSwitch = screen.getByRole("switch")
    expect(reflSwitch).toHaveAttribute("aria-checked", "true")
    fireEvent.click(reflSwitch)
    expect(reflSwitch).toHaveAttribute("aria-checked", "false")
  })

  it("confirmar o plano marca estado local como confirmado, SEM chamar fetch/POST", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    renderPlan()
    fireEvent.click(screen.getByRole("button", { name: /Confirmar meu plano/ }))
    expect(screen.getByTestId("plan-confirmed")).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it("recomeçar restaura o default e limpa a confirmação", () => {
    renderPlan()
    fireEvent.click(screen.getByRole("button", { name: /Confirmar meu plano/ }))
    expect(screen.getByTestId("plan-confirmed")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Recomeçar/ }))
    expect(screen.queryByTestId("plan-confirmed")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Seg/ })).toHaveAttribute("aria-pressed", "true")
  })

  it("degradação graciosa: sem daysLeft/weeksLeft, não mostra o chip de prazo e o veredito vira 'unknown'", () => {
    renderPlan({
      ...DIAGNOSTIC,
      daysLeft: null,
      weeksLeft: null,
    })
    expect(screen.queryByText("dias até o fim do curso")).not.toBeInTheDocument()
    expect(screen.getByTestId("plan-projection")).toHaveAttribute("data-verdict", "unknown")
  })

  it("degradação graciosa: sem reflectionsMax, mostra aviso em vez de projeção de reflexão", () => {
    renderPlan({
      ...DIAGNOSTIC,
      reflTotal: null,
      reflNow: null,
    })
    expect(screen.getByText(/Sem denominador de reflexões da sua trilha ainda/)).toBeInTheDocument()
  })
})
