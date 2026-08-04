// ---------------------------------------------------------------------------
// AnnouncementModal + announcement-content — porte do protótipo aprovado
// (app/dev/preview-feature-review/page.tsx) para produção.
//
// Cobre as 5 coisas que o protótipo tinha e que não podiam se perder (véu na
// janela, pontos só com total>1, o par TOUR_STEPS↔TOUR_STEP_ORDER do
// contrato), mais o que o protótipo NÃO tinha e produção exige: role/aria de
// diálogo, foco preso, Esc fecha.
// ---------------------------------------------------------------------------

import { ANCHORS, TOUR_STEP_ORDER } from "@/lib/onboarding/types"
import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { JORNADA_PAGES, PERCORRIDO_PAGES, TOUR_STEPS } from "../announcement-content"
import { AnnouncementModal } from "../announcement-modal"

describe("AnnouncementModal — novidade 1 (percorrido-vs-conclusao)", () => {
  it("renderiza título, corpo e cartões, sem pontos de paginação (total === 1)", () => {
    const { container } = render(
      <AnnouncementModal
        pagina={PERCORRIDO_PAGES[0]}
        passo={1}
        total={PERCORRIDO_PAGES.length}
        selo="Novidade 1 de 2"
        onAvancar={vi.fn()}
        onPular={vi.fn()}
        rotuloPular="Pular"
      />,
    )

    expect(screen.getByText(/percorrer/)).toBeInTheDocument()
    expect(screen.getByText(/concluir/)).toBeInTheDocument()
    expect(screen.getByText("Percorrido")).toBeInTheDocument()
    expect(screen.getByText("Conclusão")).toBeInTheDocument()
    expect(screen.getByText(/No seu caso:/)).toBeInTheDocument()

    // Um ponto solitário anunciaria uma navegação que não existe — com uma
    // página só, nenhum ponto deve estar no DOM.
    expect(container.querySelector(".bg-cerrado-400")).not.toBeInTheDocument()
  })

  it("o véu cobre a janela inteira (fixed inset-0), não só o cartão", () => {
    const { container } = render(
      <AnnouncementModal
        pagina={PERCORRIDO_PAGES[0]}
        passo={1}
        total={1}
        selo="Novidade 1 de 2"
        onAvancar={vi.fn()}
        onPular={vi.fn()}
        rotuloPular="Pular"
      />,
    )

    const veu = container.querySelector(".fixed.inset-0.z-40")
    expect(veu).toBeInTheDocument()
    // O véu é irmão do wrapper do cartão, não seu ancestral — se ele
    // envolvesse o cartão, só o cartão escureceria.
    expect(veu?.contains(screen.getByRole("dialog"))).toBe(false)
  })
})

describe("AnnouncementModal — novidade 2 (jornada-intro), navegação entre telas", () => {
  function JornadaHost({ onPular }: { onPular: () => void }) {
    const [i, setI] = useState(0)
    return (
      <AnnouncementModal
        pagina={JORNADA_PAGES[i]}
        passo={i + 1}
        total={JORNADA_PAGES.length}
        selo="Novidade 2 de 2"
        onAvancar={() => setI((k) => Math.min(k + 1, JORNADA_PAGES.length - 1))}
        onVoltar={i > 0 ? () => setI((k) => k - 1) : undefined}
        onPular={onPular}
        rotuloPular="Deixar para depois"
      />
    )
  }

  it("mostra a primeira tela sem botão Voltar, e 3 pontos de paginação", () => {
    render(<JornadaHost onPular={vi.fn()} />)
    expect(screen.getByText("Você pode montar sua jornada de estudos")).toBeInTheDocument()
    expect(screen.queryByText("Voltar")).not.toBeInTheDocument()
  })

  it("avança para a segunda e a terceira tela, e volta corretamente", () => {
    render(<JornadaHost onPular={vi.fn()} />)

    fireEvent.click(screen.getByText("Ver como funciona"))
    expect(screen.getByText("Cada módulo ganha uma data")).toBeInTheDocument()
    expect(screen.getByText("Voltar")).toBeInTheDocument()

    fireEvent.click(screen.getByText("Onde eu encontro isso"))
    expect(screen.getByText("Onde você monta sua jornada")).toBeInTheDocument()

    fireEvent.click(screen.getByText("Voltar"))
    expect(screen.getByText("Cada módulo ganha uma data")).toBeInTheDocument()
  })

  it("o rótulo de pular é parametrizável — 'Deixar para depois' em N2", () => {
    render(<JornadaHost onPular={vi.fn()} />)
    expect(screen.getByText("Deixar para depois")).toBeInTheDocument()
  })
})

describe("AnnouncementModal — acessibilidade", () => {
  it("expõe role=dialog, aria-modal e aria-labelledby apontando para o título", () => {
    render(
      <AnnouncementModal
        pagina={PERCORRIDO_PAGES[0]}
        passo={1}
        total={1}
        selo="Novidade 1 de 2"
        onAvancar={vi.fn()}
        onPular={vi.fn()}
        rotuloPular="Pular"
      />,
    )

    const dialog = screen.getByRole("dialog")
    expect(dialog).toHaveAttribute("aria-modal", "true")
    const labelledBy = dialog.getAttribute("aria-labelledby")
    expect(labelledBy).toBeTruthy()
    expect(document.getElementById(labelledBy as string)).toHaveTextContent(/percorrer/)
  })

  it("Esc chama onPular", () => {
    const onPular = vi.fn()
    render(
      <AnnouncementModal
        pagina={PERCORRIDO_PAGES[0]}
        passo={1}
        total={1}
        selo="Novidade 1 de 2"
        onAvancar={vi.fn()}
        onPular={onPular}
        rotuloPular="Pular"
      />,
    )

    fireEvent.keyDown(document, { key: "Escape" })
    expect(onPular).toHaveBeenCalledTimes(1)
  })

  it("o X e o link de pular chamam onPular", () => {
    const onPular = vi.fn()
    render(
      <AnnouncementModal
        pagina={PERCORRIDO_PAGES[0]}
        passo={1}
        total={1}
        selo="Novidade 1 de 2"
        onAvancar={vi.fn()}
        onPular={onPular}
        rotuloPular="Pular"
      />,
    )

    fireEvent.click(screen.getByLabelText("Fechar"))
    fireEvent.click(screen.getByText("Pular"))
    expect(onPular).toHaveBeenCalledTimes(2)
  })

  it("o foco fica preso: Tab do último elemento focável volta ao primeiro", () => {
    render(
      <AnnouncementModal
        pagina={PERCORRIDO_PAGES[0]}
        passo={1}
        total={1}
        selo="Novidade 1 de 2"
        onAvancar={vi.fn()}
        onPular={vi.fn()}
        rotuloPular="Pular"
      />,
    )

    const dialog = screen.getByRole("dialog")
    const focusables = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    const first = focusables[0]
    const last = focusables[focusables.length - 1]

    last.focus()
    expect(document.activeElement).toBe(last)
    fireEvent.keyDown(document, { key: "Tab" })
    expect(document.activeElement).toBe(first)

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true })
    expect(document.activeElement).toBe(last)
  })

  it("ao montar, o foco entra no diálogo (aria-labelledby é legível de imediato)", () => {
    render(
      <AnnouncementModal
        pagina={PERCORRIDO_PAGES[0]}
        passo={1}
        total={1}
        selo="Novidade 1 de 2"
        onAvancar={vi.fn()}
        onPular={vi.fn()}
        rotuloPular="Pular"
      />,
    )

    expect(document.activeElement).toBe(screen.getByRole("dialog"))
  })
})

describe("announcement-content — TOUR_STEPS amarrado a TOUR_STEP_ORDER", () => {
  it("tem exatamente os 6 passos, na mesma ordem de âncoras do contrato", () => {
    expect(TOUR_STEPS).toHaveLength(6)
    expect(TOUR_STEPS.map((step) => step.anchor)).toEqual([...TOUR_STEP_ORDER])
  })

  it("os passos reset e cta estão presentes — não prazo nem sugestão (CORREÇÃO 2 da story)", () => {
    const anchors = TOUR_STEPS.map((step) => step.anchor)
    expect(anchors).toContain(ANCHORS.jornadaReset)
    expect(anchors).toContain(ANCHORS.jornadaCta)
    expect(anchors).not.toContain("jornada-prazo")
    expect(anchors).not.toContain("jornada-sugestao")
  })

  it("PERCORRIDO_PAGES tem 1 tela e JORNADA_PAGES tem 3, como no protótipo aprovado", () => {
    expect(PERCORRIDO_PAGES).toHaveLength(1)
    expect(JORNADA_PAGES).toHaveLength(3)
  })
})
