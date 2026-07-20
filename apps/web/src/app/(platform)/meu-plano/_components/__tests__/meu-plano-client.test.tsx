import type { StudyPlanDiagnostic } from "@/lib/analytics/study-plan-projection"
import { ToastProvider } from "@eximia/ui"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MeuPlanoClient } from "../meu-plano-client"

// ---------------------------------------------------------------------------
// SH-3.2 — tests rewritten for the Krug redesign. The screen no longer has 5
// numbered sections; it opens with the ready-made plan (verdict + summary +
// day ribbon + primary CTA) and hides day/session/reflection controls behind
// an "Ajustar meu plano" <details>, and the full bars behind "Ver o cálculo
// completo". Coverage is preserved/expanded: same data shown, same
// interactivity (day toggle, stepper, reflection switch, confirm, reset,
// no-fetch boundary, graceful degradation), plus the new disclosures and the
// always-visible summary. `<details>` children are in the DOM even when
// collapsed, so Testing Library queries still reach the controls.
// ---------------------------------------------------------------------------

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

describe("MeuPlanoClient (SH-3.2 — Krug redesign)", () => {
  it("abre com o plano pronto: título, veredito, resumo essencial e CTA principal — sem seções numeradas", () => {
    renderPlan()
    // caminho óbvio: título curto + card do plano pronto
    expect(screen.getByText("Seu plano de estudo desta semana")).toBeInTheDocument()
    // veredito ao vivo (default Seg/Qua/Sex, 2 sessões, reflexão on → fecha o gap)
    expect(screen.getByTestId("plan-projection")).toBeInTheDocument()
    expect(screen.getByText("Esse plano fecha o seu gap")).toBeInTheDocument()
    // ação principal única e óbvia
    expect(screen.getByRole("button", { name: /Confirmar meu plano/ })).toBeInTheDocument()
    // breadcrumb de volta ao Meu ritmo
    expect(screen.getByText("Meu ritmo")).toBeInTheDocument()
    expect(screen.getByText("Meu plano")).toBeInTheDocument()
    // a estrutura antiga de 5 seções numeradas foi REMOVIDA
    expect(screen.queryByText("De onde você parte hoje")).not.toBeInTheDocument()
    expect(screen.queryByText("Isso fecha o seu gap?")).not.toBeInTheDocument()
  })

  it("resumo essencial (1 frase + 1 número) fica sempre visível, citando a carga semanal", () => {
    renderPlan()
    // default: 3 dias x 2 sessões = 6 sessões, 3 reflexões por semana
    expect(screen.getByText(/6 sessões e 3 reflexões por semana/)).toBeInTheDocument()
  })

  it("controles de ajuste (dias/sessões/reflexão) existem, recolhidos atrás de 'Ajustar meu plano'", () => {
    renderPlan()
    expect(screen.getByText("Ajustar meu plano")).toBeInTheDocument()
    // conteúdo do <details> está no DOM mesmo recolhido
    expect(screen.getByRole("button", { name: /Seg/ })).toBeInTheDocument()
    expect(screen.getByLabelText("mais sessões")).toBeInTheDocument()
    expect(screen.getByRole("switch")).toBeInTheDocument()
  })

  it("o cálculo completo (barras + prazo) existe atrás de 'Ver o cálculo completo'", () => {
    renderPlan()
    expect(screen.getByText("Ver o cálculo completo")).toBeInTheDocument()
    expect(screen.getByText("Progresso do curso")).toBeInTheDocument()
    expect(screen.getByText("Reflexões")).toBeInTheDocument()
    // prazo real aparece no detalhe
    expect(screen.getByText(/121 dias/)).toBeInTheDocument()
  })

  it("dia começa com Seg/Qua/Sex marcados (default herdado do mockup)", () => {
    renderPlan()
    expect(screen.getByRole("button", { name: /Seg/ })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: /Ter/ })).toHaveAttribute("aria-pressed", "false")
  })

  it("clicar num dia alterna aria-pressed e recalcula o resumo/veredito ao vivo", () => {
    renderPlan()
    const summaryBefore = screen.getByText(/6 sessões e 3 reflexões por semana/)
    expect(summaryBefore).toBeInTheDocument()

    const terca = screen.getByRole("button", { name: /Ter/ })
    fireEvent.click(terca)
    expect(terca).toHaveAttribute("aria-pressed", "true")

    // 4 dias x 2 sessões = 8 sessões, 4 reflexões — o resumo recomputou ao vivo
    expect(screen.getByText(/8 sessões e 4 reflexões por semana/)).toBeInTheDocument()
  })

  it("desmarcar todos os dias volta o veredito para 'empty' e desabilita confirmar", () => {
    renderPlan()
    for (const label of ["Seg", "Qua", "Sex"]) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(label) }))
    }
    expect(screen.getByTestId("plan-projection")).toHaveAttribute("data-verdict", "empty")
    expect(screen.getByRole("button", { name: /Confirmar meu plano/ })).toBeDisabled()
    // resumo orienta a reabrir o ajuste em vez de deixar o aluno perdido
    expect(screen.getByText(/desligou todos os dias/)).toBeInTheDocument()
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

  it("toggle de reflexão desliga o foco e recalcula o resumo (sem reflexões na frase)", () => {
    renderPlan()
    const reflSwitch = screen.getByRole("switch")
    expect(reflSwitch).toHaveAttribute("aria-checked", "true")
    fireEvent.click(reflSwitch)
    expect(reflSwitch).toHaveAttribute("aria-checked", "false")
    // sem reflexão, o resumo cita só as sessões (3 dias x 2 = 6 sessões)
    expect(screen.getByText(/6 sessões por semana/)).toBeInTheDocument()
  })

  it("confirmar o plano marca estado local como confirmado, SEM chamar fetch/POST", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    renderPlan()
    fireEvent.click(screen.getByRole("button", { name: /Confirmar meu plano/ }))
    expect(screen.getByTestId("plan-confirmed")).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it("recomeçar (voltar ao plano sugerido) restaura o default e limpa a confirmação", () => {
    renderPlan()
    // muda um dia para sair do default, confirma
    fireEvent.click(screen.getByRole("button", { name: /Ter/ }))
    fireEvent.click(screen.getByRole("button", { name: /Confirmar meu plano/ }))
    expect(screen.getByTestId("plan-confirmed")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Voltar ao plano sugerido/ }))
    expect(screen.queryByTestId("plan-confirmed")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Seg/ })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: /Ter/ })).toHaveAttribute("aria-pressed", "false")
  })

  it("degradação graciosa: sem daysLeft/weeksLeft, veredito vira 'unknown' e o detalhe não mostra o prazo", () => {
    renderPlan({
      ...DIAGNOSTIC,
      daysLeft: null,
      weeksLeft: null,
    })
    expect(screen.getByTestId("plan-projection")).toHaveAttribute("data-verdict", "unknown")
    expect(screen.getByText("Seu plano sugerido está pronto")).toBeInTheDocument()
    // sem prazo real, a linha de prazo do cálculo completo some (sem número falso)
    expect(screen.queryByText(/dias até o fim do curso/)).not.toBeInTheDocument()
    expect(screen.queryByText(/121 dias/)).not.toBeInTheDocument()
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
