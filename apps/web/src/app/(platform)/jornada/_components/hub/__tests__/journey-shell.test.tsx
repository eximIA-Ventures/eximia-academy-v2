import type { JourneyCourseContext } from "@/lib/journey/types"
import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { DashboardModel } from "../../dashboard/dashboard-model"
import type { HubCard } from "../hub-model"
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

// ---------------------------------------------------------------------------
// JRN-D (fix Hugo 2026-07-25, ao vivo: "clicar no card do hub não faz nada")
// ---------------------------------------------------------------------------
// O card chamava `router.push('/jornada?curso=X')`, que troca só o search param
// da MESMA rota: o App Router preserva a instância do shell e o `useState(initialView)`
// antigo ignorava o prop novo do servidor → a URL mudava e a tela ficava parada.
// Estes testes exercitam exatamente esse contrato: MESMA árvore re-renderizada
// com o recorte novo do SSR tem de trocar a tela exibida.
// ---------------------------------------------------------------------------

const C1 = { courseId: "course-1", courseTitle: "Análise e Solução de Problemas" }
const C2 = { courseId: "course-2", courseTitle: "Precificação" }

const CTX2: JourneyCourseContext = { ...CTX, courseId: "course-2", courseTitle: C2.courseTitle }

const CARD_1: HubCard = {
  enrollmentId: "enr-1",
  courseId: "course-1",
  courseTitle: C1.courseTitle,
  progressPct: 50,
  status: "no-journey",
  chipLabel: "sem jornada · monte a sua",
  openable: false,
}

/** Modelo mínimo de dashboard (view-model puro; o cálculo real é coberto por
 *  dashboard-model.test.ts). Aqui só precisa RENDERIZAR para provar a troca de tela. */
const DASH_MODEL: DashboardModel = {
  courseTitle: C1.courseTitle,
  moduleCount: 3,
  totalItems: 12,
  startDateIso: "2026-01-01",
  managerDeadlineIso: "2026-04-16",
  finalDeadlineIso: "2026-05-07",
  isDayZero: false,
  isCompleted: false,
  progressPct: 40,
  expectedPct: 50,
  sessionsPerWeek: 3,
  sessionsDone: 2,
  currentModule: { order: 1, title: "Módulo 1", deadlineIso: "2026-02-01" },
  modules: [
    {
      chapterId: "ch-0",
      order: 1,
      title: "Módulo 1",
      deadlineIso: "2026-02-01",
      interactionsExpected: 1,
      reflectionsExpected: 2,
      status: "doing",
    },
  ],
  weekly: null,
  ai: {
    state: "onpace",
    read: [{ t: "Você está no ritmo." }],
    actionLabel: "Continuar",
    action: [{ t: "Siga para o próximo item." }],
  },
  ritmo: {
    state: "active",
    ringPct: 80,
    ringOnTrack: true,
    donePerWeek: 2,
    combinedPerWeek: 3,
    needLabel: null,
    dayZeroPacePerWeek: null,
    weekSessions: { planned: 3, realized: 2 },
  },
}

type ShellProps = ComponentProps<typeof JourneyShell>

function shellProps(over: Partial<ShellProps> = {}): ShellProps {
  return {
    initialView: "hub",
    hubCards: [CARD_1],
    courseOptions: [C1],
    selectedCourseId: null,
    dashboard: null,
    builderContext: null,
    builderEnrollmentId: null,
    reviseInitial: null,
    ...over,
  }
}

const builderAnchor = (over: Partial<ShellProps> = {}): ShellProps =>
  shellProps({
    initialView: "builder",
    selectedCourseId: "course-1",
    builderContext: CTX,
    builderEnrollmentId: "enr-1",
    ...over,
  })

describe("JourneyShell — reancoragem no recorte do servidor (fix do card do hub)", () => {
  it("clicar no card do hub navega para /jornada?curso= (o SSR decide o destino)", () => {
    render(<JourneyShell {...shellProps()} />)
    fireEvent.click(screen.getByTestId("hub-card"))
    expect(push).toHaveBeenCalledWith("/jornada?curso=course-1")
  })

  it("MESMA árvore + recorte novo do servidor (hub → construtor) troca a tela", () => {
    const { rerender } = render(<JourneyShell {...shellProps()} />)
    expect(screen.getByTestId("journey-hub")).toBeInTheDocument()

    // é o que o push do card provoca: mesma rota, mesma instância, props novos.
    rerender(<JourneyShell {...builderAnchor()} />)

    expect(screen.queryByTestId("journey-hub")).toBeNull()
    expect(screen.getByTestId("jornada-timeline")).toBeInTheDocument()
  })

  it("MESMA árvore + recorte novo do servidor (hub → dashboard) troca a tela", () => {
    const { rerender } = render(<JourneyShell {...shellProps()} />)
    expect(screen.getByTestId("journey-hub")).toBeInTheDocument()

    rerender(
      <JourneyShell
        {...shellProps({
          initialView: "dashboard",
          selectedCourseId: "course-1",
          dashboard: {
            model: DASH_MODEL,
            hrefs: { continueHref: "/courses", interactionHref: null, reflectionHref: null },
          },
        })}
      />,
    )

    expect(screen.queryByTestId("journey-hub")).toBeNull()
    expect(screen.getByTestId("journey-dashboard")).toBeInTheDocument()
  })

  // CourseSwitcher: seu `onChange` faz o MESMO push de rota, então o contrato
  // que o cobre é este — trocar o curso servido descarta a view local antiga.
  it("trocar de curso (CourseSwitcher) descarta a view local e reancorra no servidor", () => {
    const { rerender } = render(<JourneyShell {...builderAnchor({ courseOptions: [C1, C2] })} />)
    // transição local legítima: volto ao hub sem sair da rota (URL segue ?curso=course-1).
    fireEvent.click(screen.getByRole("button", { name: /Minhas jornadas/ }))
    expect(screen.getByTestId("journey-hub")).toBeInTheDocument()

    // agora o servidor reancorra em outro curso: a view local NÃO pode sobreviver.
    rerender(
      <JourneyShell
        {...builderAnchor({
          courseOptions: [C1, C2],
          selectedCourseId: "course-2",
          builderContext: CTX2,
          builderEnrollmentId: "enr-2",
        })}
      />,
    )

    expect(screen.queryByTestId("journey-hub")).toBeNull()
    expect(screen.getByTestId("jornada-timeline")).toBeInTheDocument()
  })

  it("voltar ao hub (local) e clicar no MESMO card reabre o curso, sem navegar", () => {
    render(<JourneyShell {...builderAnchor({ courseOptions: [C1, C2], hubCards: [CARD_1] })} />)
    fireEvent.click(screen.getByRole("button", { name: /Minhas jornadas/ }))
    expect(screen.getByTestId("journey-hub")).toBeInTheDocument()

    // o curso do card JÁ é o da URL: `push` não mudaria prop algum, então a tela
    // tem de voltar pela decisão do servidor que já está carregada.
    fireEvent.click(screen.getByTestId("hub-card"))
    expect(push).not.toHaveBeenCalled()
    expect(screen.getByTestId("jornada-timeline")).toBeInTheDocument()
  })
})
