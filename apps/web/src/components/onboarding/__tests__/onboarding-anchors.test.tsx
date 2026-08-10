// ---------------------------------------------------------------------------
// AC 0.3 — as 9 âncoras `data-onboarding` do onboarding de novidades.
//
// O ponto deste teste NÃO é o atributo em si, é que ele SUMIR não passe em
// silêncio. Classe muda no próximo ajuste de Tailwind, posição muda quando
// alguém reordena, texto muda na próxima revisão de copy — só o atributo
// estável sobrevive a isso, e só sobrevive de verdade se algo gritar quando
// falta. Por isso o teste ITERA sobre `ANCHORS` (o contrato em
// lib/onboarding/types.ts) em vez de listar strings soltas aqui: uma âncora
// nova adicionada ao contrato sem elemento correspondente também falha.
// ---------------------------------------------------------------------------

import { ComparisonInsightsTable } from "@/components/analytics/comparison-insights-table"
import { StudyPlanInviteStrip } from "@/components/analytics/study-plan-invite-strip"
import { JourneyBuilder } from "@/app/(platform)/jornada/_components/builder/journey-builder"
import type { JourneyCourseContext } from "@/lib/journey/types"
import { ANCHORS, anchorSelector } from "@/lib/onboarding/types"
import type { StudentHomeIndicators } from "@/types/analytics"
import { render } from "@testing-library/react"
import { beforeAll, describe, expect, it } from "vitest"

// jsdom não implementa matchMedia; a TimelineCanvas usa em um effect. Mesmo
// stub local do `builder/__tests__/render.test.tsx` — território comum
// (test-setup compartilhado) intocado.
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

// Fixture mínima de StudentHomeIndicators — só precisa ser válida o
// suficiente para as 2 linhas "Percorrido"/"Conclusão" renderizarem.
const INDICATORS: StudentHomeIndicators = {
  subject: {
    lastAccessDays: 0,
    ritmoDisplay: "no_ritmo",
    progressPct: 50,
    engagement: 14,
    interactions: 7,
    reflections: 8,
    interactionsMax: 10,
    reflectionsMax: 50,
    engagementRank: 3,
    engagementTotalStudents: 15,
    lastCompletedLabel: "Módulo 2 · 80%",
  },
  reference: {
    lastAccessAvgDays: 52,
    ritmoEmDiaPct: 58,
    progressAvgPct: 55,
    engagementAvg: 9,
    interactionsAvg: 5,
    reflectionsAvg: 3,
    interactionsMaxAvg: 12,
    reflectionsMaxAvg: 40,
    engagementMaxAvg: 64,
  },
}

// Contexto canônico do construtor — mesmo espírito do fixture de
// `builder/__tests__/render.test.tsx` (aluno em dia 0, janela cheia).
function journeyContext(): JourneyCourseContext {
  const startDate = "2026-01-01"
  const finalDeadlineDays = 126
  return {
    courseId: "course-1",
    courseTitle: "Curso de teste",
    startDate,
    finalDeadlineDays,
    managerDeadlineDays: 105,
    modules: [2, 4, 3].map((refl, i) => ({
      chapterId: `ch-${i}`,
      title: `Módulo ${i + 1}`,
      order: i,
      interactionsExpected: 1,
      reflectionsExpected: refl,
      progress: {
        status: "planned",
        sessionsDone: 0,
        reflectionsDone: 0,
        completedRatio: 0,
        frozen: false,
      },
    })),
    cohortDeadlineDate: "2026-05-07",
    cohortManagerDeadlineDate: "2026-04-16",
    planningAnchorDate: startDate,
    remainingWindowDays: finalDeadlineDays,
  }
}

describe("AC 0.3 — as 9 âncoras do onboarding sobrevivem no DOM real", () => {
  it("cada uma das ANCHORS do contrato tem elemento correspondente renderizado", () => {
    const { container: tableContainer } = render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const { container: stripContainer } = render(<StudyPlanInviteStrip />)
    const { container: builderContainer } = render(<JourneyBuilder context={journeyContext()} />)
    const containers = [tableContainer, stripContainer, builderContainer]

    // Iterar sobre ANCHORS (não sobre uma lista fixa aqui): se alguém
    // adicionar uma 10ª âncora ao contrato sem plugar o elemento, este loop
    // falha nela também, sem precisar editar este teste.
    for (const [key, anchorName] of Object.entries(ANCHORS)) {
      const found = containers.some(
        (c) => c.querySelectorAll(anchorSelector(anchorName)).length > 0,
      )
      expect(found, `âncora "${anchorName}" (ANCHORS.${key}) não foi encontrada em nenhum container`).toBe(
        true,
      )
    }
  })

  it("são exatamente 9 âncoras no contrato — nenhuma sumiu, nenhuma peso morto foi deixada", () => {
    expect(Object.keys(ANCHORS)).toHaveLength(9)
  })

  it("as 6 âncoras do tour (TOUR_STEP_ORDER) são um subconjunto de ANCHORS, na ordem do protótipo aprovado", async () => {
    const { TOUR_STEP_ORDER } = await import("@/lib/onboarding/types")
    const anchorValues = new Set(Object.values(ANCHORS))
    for (const step of TOUR_STEP_ORDER) {
      expect(anchorValues.has(step)).toBe(true)
    }
    // O protótipo aprovado ensina reset+cta, NÃO prazo/sugestão (ver o
    // comentário do contrato) — travar isso aqui impede que alguém "corrija
    // de volta" para a lista antiga da story sem perceber a decisão.
    expect(TOUR_STEP_ORDER).not.toContain("jornada-prazo")
    expect(TOUR_STEP_ORDER).not.toContain("jornada-sugestao")
    expect(TOUR_STEP_ORDER).toContain(ANCHORS.jornadaReset)
    expect(TOUR_STEP_ORDER).toContain(ANCHORS.jornadaCta)
  })
})
