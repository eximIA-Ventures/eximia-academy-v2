import type { JourneyCourseContext } from "@/lib/journey/types"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { JourneyShell } from "../journey-shell"

// JRN-D (Hugo 2026-07-24) — o construtor SEMPRE tem volta: com 2+ cursos →
// "Minhas jornadas" (hub); com 1 só curso → "Meu ritmo" (/dashboard). Antes, o
// create-flow (sem `dashboard`) caía num <span/> vazio e o aluno ficava preso.

const push = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}))
// As server actions são "use server" (importam supabase/server + next/cache no
// load) — mock total para o import não tocar infra de servidor no jsdom.
vi.mock("../../actions", () => ({
  saveJourneyPlan: vi.fn(),
  updateJourneyPlan: vi.fn(),
}))

// jsdom não implementa matchMedia; a timeline do JourneyBuilder usa em um effect.
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

beforeEach(() => {
  push.mockClear()
})

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

function renderBuilder(courseOptions: { courseId: string; courseTitle: string }[]) {
  return render(
    <JourneyShell
      initialView="builder"
      hubCards={[]}
      courseOptions={courseOptions}
      selectedCourseId="course-1"
      dashboard={null}
      builderContext={CTX}
      builderEnrollmentId="enr-1"
      reviseInitial={null}
    />,
  )
}

describe("JourneyShell — back button no construtor (JRN-D)", () => {
  it("1 curso → 'Meu ritmo' navega para /dashboard (a home)", () => {
    renderBuilder([{ courseId: "course-1", courseTitle: "Análise e Solução de Problemas" }])
    const back = screen.getByRole("button", { name: /Meu ritmo/ })
    expect(back).toBeInTheDocument()
    fireEvent.click(back)
    expect(push).toHaveBeenCalledWith("/dashboard")
  })

  // Correção Hugo 2026-07-24 (ao vivo): o seletor de curso fica visível no
  // construtor mesmo com 1 só curso (antes escondia). Coexiste com o back "Meu ritmo".
  it("1 curso → o seletor de curso TAMBÉM aparece (sempre visível)", () => {
    renderBuilder([{ courseId: "course-1", courseTitle: "Análise e Solução de Problemas" }])
    expect(screen.getByLabelText("Trocar de curso")).toBeInTheDocument()
  })

  it("2+ cursos → 'Minhas jornadas' volta ao hub (sem navegar para fora)", () => {
    renderBuilder([
      { courseId: "course-1", courseTitle: "Análise e Solução de Problemas" },
      { courseId: "course-2", courseTitle: "Precificação" },
    ])
    const back = screen.getByRole("button", { name: /Minhas jornadas/ })
    expect(back).toBeInTheDocument()
    fireEvent.click(back)
    // volta ao hub (in-app), não navega para /dashboard.
    expect(screen.getByRole("heading", { name: "Minhas jornadas" })).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })

  it("o construtor NUNCA fica sem volta (há sempre um botão de voltar)", () => {
    renderBuilder([{ courseId: "course-1", courseTitle: "Análise e Solução de Problemas" }])
    // com 1 curso, o back é "Meu ritmo"; com 2+, "Minhas jornadas" — sempre existe um.
    expect(
      screen.queryByRole("button", { name: /Meu ritmo/ }) ??
        screen.queryByRole("button", { name: /Minhas jornadas/ }),
    ).not.toBeNull()
  })
})

// JRN-D+ (Hugo 2026-07-24) — o HUB "Minhas jornadas" também precisa de saída: era
// o topo do /jornada sem volta, e o aluno ficava preso. O back "Meu ritmo" leva à
// home (/dashboard).
describe("JourneyHub — saída para a home (JRN-D+)", () => {
  it("o hub mostra 'Meu ritmo' e navega para /dashboard", () => {
    render(
      <JourneyShell
        initialView="hub"
        hubCards={[
          {
            enrollmentId: "enr-1",
            courseId: "course-1",
            courseTitle: "Análise e Solução de Problemas",
            progressPct: 50,
            status: "no-journey",
            chipLabel: "sem jornada · monte a sua",
            openable: false,
          },
        ]}
        courseOptions={[{ courseId: "course-1", courseTitle: "Análise e Solução de Problemas" }]}
        selectedCourseId={null}
        dashboard={null}
        builderContext={null}
        builderEnrollmentId={null}
        reviseInitial={null}
      />,
    )
    const back = screen.getByRole("button", { name: /Meu ritmo/ })
    expect(back).toBeInTheDocument()
    fireEvent.click(back)
    expect(push).toHaveBeenCalledWith("/dashboard")
  })
})
