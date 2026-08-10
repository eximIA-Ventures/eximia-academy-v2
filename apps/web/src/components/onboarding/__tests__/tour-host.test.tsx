// ---------------------------------------------------------------------------
// Motor do tour (TourHost) — story §2.2, a regra dura de resolução.
//
// As 4 cenas exigidas pela tarefa:
//   1. com as 6 âncoras presentes, o tour completa e chama onResolve.
//   2. com 5 âncoras, ele NÃO resolve e permanece armado (onResolve nunca chamado).
//   3. initialStep retoma no passo certo.
//   4. Esc sai sem resolver.
//
// As âncoras são montadas como <div data-onboarding="..."> soltas no DOM do
// teste — este arquivo não depende do app real (`anchor()`/`ANCHORS` bastam).
// ---------------------------------------------------------------------------

import { TOUR_STEP_ORDER, type TourStep } from "@/lib/onboarding/types"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TourHost } from "../tour-host"

const STEPS: TourStep[] = TOUR_STEP_ORDER.map((anchorName, i) => ({
  anchor: anchorName,
  titulo: `Passo ${i + 1}`,
  corpo: `Corpo do passo ${i + 1}`,
}))

/** Monta um <div> âncora por nome, direto no body — mesmo atributo que o app real usa. */
function mountAnchors(names: readonly string[]) {
  for (const name of names) {
    const el = document.createElement("div")
    el.setAttribute("data-onboarding", name)
    document.body.appendChild(el)
  }
}

function clearAnchors() {
  for (const el of document.querySelectorAll("[data-onboarding]")) {
    el.remove()
  }
}

async function pressArrowRight(times: number) {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowRight" })
    })
  }
}

describe("TourHost", () => {
  beforeEach(() => {
    clearAnchors()
  })

  afterEach(() => {
    clearAnchors()
    vi.restoreAllMocks()
  })

  it("com as 6 âncoras presentes, completa o tour e chama onResolve com o último passo", async () => {
    mountAnchors(TOUR_STEP_ORDER)
    const onResolve = vi.fn()

    render(<TourHost steps={STEPS} onResolve={onResolve} />)

    expect(screen.getByText("Passo 1")).toBeInTheDocument()

    // 5 avanços para chegar ao último passo (índice 5), mais 1 para concluir.
    await pressArrowRight(STEPS.length)

    expect(onResolve).toHaveBeenCalledTimes(1)
    expect(onResolve).toHaveBeenCalledWith(STEPS.length - 1)
    // UI se fecha ao concluir — nada de balão nem overlay sobrando no DOM.
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("com 5 âncoras (uma ausente), NÃO resolve e permanece armado", async () => {
    const withoutOne = TOUR_STEP_ORDER.filter((a) => a !== TOUR_STEP_ORDER[2])
    mountAnchors(withoutOne)
    const onResolve = vi.fn()
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    render(<TourHost steps={STEPS} onResolve={onResolve} />)

    // Avança pelos 6 passos via teclado — o passo cuja âncora sumiu não
    // renderiza balão (anchorRect é null), então o teclado é o único jeito de
    // atravessá-lo, exatamente o comportamento que expõe o bug do gatilho.
    await pressArrowRight(STEPS.length)

    expect(onResolve).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(TOUR_STEP_ORDER[2]))
  })

  it("initialStep retoma no passo certo", () => {
    mountAnchors(TOUR_STEP_ORDER)
    const resumeIndex = 3

    render(<TourHost steps={STEPS} initialStep={resumeIndex} onResolve={vi.fn()} />)

    expect(screen.getByText(`Passo ${resumeIndex + 1}`)).toBeInTheDocument()
    expect(screen.getByText(`passo ${resumeIndex + 1} de ${STEPS.length}`)).toBeInTheDocument()
  })

  it("Esc sai sem resolver", async () => {
    mountAnchors(TOUR_STEP_ORDER)
    const onResolve = vi.fn()
    const onExit = vi.fn()

    render(<TourHost steps={STEPS} onResolve={onResolve} onExit={onExit} />)
    expect(screen.getByText("Passo 1")).toBeInTheDocument()

    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" })
    })

    expect(onResolve).not.toHaveBeenCalled()
    expect(onExit).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("clamps initialStep fora do intervalo para o passo válido mais próximo", () => {
    mountAnchors(TOUR_STEP_ORDER)
    render(<TourHost steps={STEPS} initialStep={99} onResolve={vi.fn()} />)
    expect(screen.getByText(`Passo ${STEPS.length}`)).toBeInTheDocument()
  })
})
