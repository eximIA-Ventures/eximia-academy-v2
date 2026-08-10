// ---------------------------------------------------------------------------
// A ATERRISSAGEM do anúncio (AnnouncementHost, fase "balao").
//
// O defeito que este arquivo tranca (Hugo, 2026-08-04): o balão "É aqui que
// elas ficam" pousava sobre a tabela "Meu ritmo" SEM destacar coisa alguma — o
// anel existia só no `tour-host.tsx` — e, ancorado apenas na linha Percorrido,
// pousava logo abaixo dela, cobrindo a linha Conclusão que o próprio texto
// acabara de citar.
//
// As duas afirmações abaixo são as que falham se o anel sumir do caminho do
// anúncio ou se a âncora voltar a ser só a primeira linha. A geometria é
// injetada à mão porque o jsdom devolve retângulo zerado em tudo — sem isso,
// "o balão cobre a linha" não é sequer expressável num teste.
// ---------------------------------------------------------------------------

import { SPOTLIGHT_ATTR } from "@/components/onboarding/anchor-spotlight"
import { AnnouncementHost } from "@/components/onboarding/announcement-host"
import {
  ANCHORS,
  type AnchorName,
  FEATURE_KEYS,
  type PendingArtifact,
  anchorSelector,
} from "@/lib/onboarding/types"
import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

/** As duas linhas da tabela "Meu ritmo", uma imediatamente embaixo da outra. */
const PERCORRIDO_BOX = { top: 200, left: 100, width: 600, height: 40 }
const CONCLUSAO_BOX = { top: 240, left: 100, width: 600, height: 40 }

/**
 * Monta uma âncora com geometria REAL. `getBoundingClientRect` é sobrescrito no
 * próprio elemento (não no protótipo) para que âncoras diferentes possam ter
 * caixas diferentes — é exatamente a diferença entre elas que o teste mede.
 */
function mountAnchor(
  name: AnchorName,
  box: { top: number; left: number; width: number; height: number },
) {
  const el = document.createElement("div")
  el.setAttribute("data-onboarding", name)
  el.getBoundingClientRect = () =>
    ({
      x: box.left,
      y: box.top,
      top: box.top,
      left: box.left,
      right: box.left + box.width,
      bottom: box.top + box.height,
      width: box.width,
      height: box.height,
      toJSON: () => box,
    }) as DOMRect
  document.body.appendChild(el)
  return el
}

function clearAnchors() {
  for (const el of document.querySelectorAll("[data-onboarding]")) el.remove()
}

const ARTIFACT: PendingArtifact = {
  featureKey: FEATURE_KEYS.percorrido,
  kind: "announcement",
  version: 1,
  priority: 10,
  helpUrl: "",
  lastStep: null,
}

/** Renderiza e avança o modal (1 página) até a fase do balão de aterrissagem. */
function renderUntilLanding() {
  const view = render(<AnnouncementHost artifact={ARTIFACT} preview />)
  fireEvent.click(screen.getByRole("button", { name: "Ver onde fica" }))
  return view
}

function spotlightEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${SPOTLIGHT_ATTR}]`)
}

function px(value: string): number {
  return Number.parseFloat(value)
}

describe("AnnouncementHost — aterrissagem da novidade 1", () => {
  beforeEach(() => {
    clearAnchors()
  })

  afterEach(() => {
    clearAnchors()
    vi.restoreAllMocks()
  })

  it("destaca a âncora com o anel (o MESMO do tour), em vez de pousar sobre nada", () => {
    mountAnchor(ANCHORS.ritmoPercorrido, PERCORRIDO_BOX)
    mountAnchor(ANCHORS.ritmoConclusao, CONCLUSAO_BOX)

    renderUntilLanding()

    const anel = spotlightEl()
    expect(anel).not.toBeNull()
    // O anel é decorativo por construção: não intercepta clique nem é lido.
    expect(anel?.getAttribute("aria-hidden")).toBe("true")
    expect(anel?.className).toContain("pointer-events-none")
    // A marca visual é literalmente a mesma do tour (`tour-host.tsx` renderiza
    // este mesmo componente) — um anel diferente aqui seria uma segunda
    // convenção visual para a mesma ideia.
    expect(anel?.className).toContain("ring-cerrado-500")
  })

  it("o anel circula AS DUAS linhas que o texto cita, não só a primeira", () => {
    mountAnchor(ANCHORS.ritmoPercorrido, PERCORRIDO_BOX)
    mountAnchor(ANCHORS.ritmoConclusao, CONCLUSAO_BOX)

    renderUntilLanding()

    const anel = spotlightEl()
    // União das duas caixas: começa no topo de Percorrido e termina no fim de
    // Conclusão. Ancorar só na primeira daria height 40, não 80.
    expect(px(anel?.style.top ?? "")).toBe(PERCORRIDO_BOX.top)
    expect(px(anel?.style.height ?? "")).toBe(
      CONCLUSAO_BOX.top + CONCLUSAO_BOX.height - PERCORRIDO_BOX.top,
    )
  })

  it("o balão pousa ABAIXO do par, sem cobrir nenhuma das duas linhas", () => {
    mountAnchor(ANCHORS.ritmoPercorrido, PERCORRIDO_BOX)
    mountAnchor(ANCHORS.ritmoConclusao, CONCLUSAO_BOX)

    renderUntilLanding()

    const balao = screen.getByRole("dialog")
    const topoDoBalao = px((balao as HTMLElement).style.top)
    const fimDaLinhaIrma = CONCLUSAO_BOX.top + CONCLUSAO_BOX.height
    // Era AQUI que o defeito aparecia: ancorado só em Percorrido, o balão
    // pousava em 240+12 = 252, dentro da linha Conclusão.
    expect(topoDoBalao).toBeGreaterThanOrEqual(fimDaLinhaIrma)
  })

  it("com só UMA das duas âncoras no DOM, ainda aponta (não cai fora à toa)", () => {
    mountAnchor(ANCHORS.ritmoPercorrido, PERCORRIDO_BOX)

    renderUntilLanding()

    expect(spotlightEl()).not.toBeNull()
    // A união degrada para a única encontrada — sem a irmã, o par é a linha só.
    expect(px(spotlightEl()?.style.height ?? "")).toBe(PERCORRIDO_BOX.height)
    expect(screen.getByText("É aqui que elas ficam")).toBeInTheDocument()
  })

  it("sem NENHUMA âncora no DOM, encerra sem balão órfão", () => {
    expect(document.querySelector(anchorSelector(ANCHORS.ritmoPercorrido))).toBeNull()

    renderUntilLanding()

    expect(spotlightEl()).toBeNull()
    expect(screen.queryByText("É aqui que elas ficam")).not.toBeInTheDocument()
  })
})
