// ---------------------------------------------------------------------------
// JRN-E (Trilha E3) — RTL do bloco "Ponto de partida" (AC-E3.1).
// ---------------------------------------------------------------------------
// Prova visual do que o dashboard-model.test.ts prova no cálculo: o progresso
// anterior à jornada aparece SEPARADO, rotulado como histórico, e nenhum número
// de desempenho da jornada é inflado por ele.
// ---------------------------------------------------------------------------

import { render, screen } from "@testing-library/react"
import { beforeAll, describe, expect, it, vi } from "vitest"
import type { DashboardModel } from "../dashboard-model"
import { JourneyDashboard } from "../journey-dashboard"

// jsdom não implementa matchMedia; o count-up do hero consulta reduced-motion.
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

const HREFS = { continueHref: "/curso", interactionHref: null, reflectionHref: null }

function model(over: Partial<DashboardModel> = {}): DashboardModel {
  return {
    courseTitle: "Análise e Solução de Problemas",
    moduleCount: 3,
    totalItems: 15,
    startDateIso: "2026-01-01",
    managerDeadlineIso: "2026-04-16",
    finalDeadlineIso: "2026-05-07",
    isDayZero: false,
    isCompleted: false,
    progressPct: 62,
    expectedPct: 60,
    sessionsPerWeek: 3,
    sessionsDone: 26,
    currentModule: { order: 2, title: "Módulo 2", deadlineIso: "2026-04-01" },
    modules: [
      {
        chapterId: "ch1",
        order: 1,
        title: "Módulo 1",
        deadlineIso: null,
        interactionsExpected: 1,
        reflectionsExpected: 2,
        status: "done",
        frozen: true,
      },
      {
        chapterId: "ch2",
        order: 2,
        title: "Módulo 2",
        deadlineIso: "2026-04-01",
        interactionsExpected: 1,
        reflectionsExpected: 4,
        status: "doing",
        frozen: false,
      },
    ],
    weekly: null,
    ai: {
      state: "onpace",
      read: [{ t: "Você está em dia: 6 sessões feitas." }],
      actionLabel: "Próximo passo",
      action: [{ t: "Siga no Módulo 2." }],
    },
    ritmo: {
      state: "active",
      ringPct: 80,
      ringOnTrack: false,
      donePerWeek: 3,
      combinedPerWeek: 3.5,
      needLabel: null,
      dayZeroPacePerWeek: null,
      weekSessions: null,
    },
    startingPoint: {
      progressPct: 50,
      sessionsDone: 20,
      reflectionsDone: 8,
      modulesDone: 1,
      capturedAt: "2026-03-01",
    },
    sinceJourney: { progressPct: 12, sessionsDone: 6, reflectionsDone: 3 },
    anchorDateIso: "2026-03-01",
    daysSinceAnchor: 14,
    ...over,
  }
}

function renderDash(m: DashboardModel) {
  return render(
    <JourneyDashboard model={m} hrefs={HREFS} onBackToHub={vi.fn()} onRevisar={vi.fn()} />,
  )
}

describe("JRN-E · bloco 'Ponto de partida' (AC-E3.1)", () => {
  it("renderiza o histórico à parte, rotulado, com o delta separado", () => {
    renderDash(model())
    const strip = screen.getByTestId("starting-point")
    expect(strip).toBeTruthy()
    expect(strip.textContent).toContain("Ponto de partida")
    expect(strip.textContent).toContain("50% do curso concluído")
    expect(strip.textContent).toContain("a jornada mede o que vem daqui para frente")
    // o delta da jornada é 12, e aparece separado do histórico
    expect(screen.getByTestId("starting-point-delta").textContent).toContain("+12%")
  })

  it("não some o ponto de partida ao realizado: 50 + 12 nunca vira 62 como mérito", () => {
    renderDash(model())
    const strip = screen.getByTestId("starting-point")
    // o bloco fala do histórico; jamais apresenta 62% como conquista da jornada
    expect(strip.textContent).not.toContain("62%")
    // e o card de progresso rotula o número como progresso DO CURSO
    expect(screen.getByText("Progresso do curso")).toBeTruthy()
  })

  it("sem baseline (jornada montada no dia 0), o bloco não existe", () => {
    renderDash(model({ startingPoint: null, sinceJourney: undefined }))
    expect(screen.queryByTestId("starting-point")).toBeNull()
  })

  it("marca o ponto de partida na barra de progresso, como contexto", () => {
    renderDash(model())
    const marker = screen.getByTestId("baseline-marker")
    expect(marker.getAttribute("title")).toBe("ponto de partida: 50%")
    expect((marker as HTMLElement).style.left).toBe("50%")
  })

  it("dia 0 com jornada parada há 14 dias não diz 'começa hoje'", () => {
    renderDash(model({ isDayZero: true, ritmo: { ...model().ritmo, state: "day0", ringPct: 0 } }))
    expect(screen.getByTestId("journey-hero").textContent).toContain("nada registrado ainda")
    expect(screen.getByTestId("journey-hero").textContent).not.toContain("começa hoje")
  })

  it("módulo concluído aparece sem prazo futuro fabricado", () => {
    const { container } = renderDash(model())
    const frozenRow = container.querySelector('tr[data-frozen="true"]')
    expect(frozenRow).toBeTruthy()
    expect(frozenRow?.textContent).toContain("concluído")
    expect(frozenRow?.textContent).toContain("—")
  })
})

describe("JRN-E · o bloco reage a dado novo (sem estado semeado por props)", () => {
  it("rerender com outro model atualiza histórico e delta", () => {
    const { rerender } = renderDash(model())
    expect(screen.getByTestId("starting-point-delta").textContent).toContain("+12%")

    const next = model({
      progressPct: 80,
      startingPoint: {
        progressPct: 50,
        sessionsDone: 20,
        reflectionsDone: 8,
        modulesDone: 1,
        capturedAt: "2026-03-01",
      },
      sinceJourney: { progressPct: 30, sessionsDone: 14, reflectionsDone: 7 },
    })
    rerender(
      <JourneyDashboard model={next} hrefs={HREFS} onBackToHub={vi.fn()} onRevisar={vi.fn()} />,
    )
    // se o bloco guardasse o valor num useState semeado por prop, continuaria +12%
    expect(screen.getByTestId("starting-point-delta").textContent).toContain("+30%")
    expect(screen.getByTestId("starting-point").textContent).toContain("50% do curso concluído")
  })
})
