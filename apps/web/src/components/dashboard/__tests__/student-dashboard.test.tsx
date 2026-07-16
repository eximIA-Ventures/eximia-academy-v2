import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { StudentDashboard } from "../student-dashboard"

const mockData = {
  summary: { enrolledCourses: 2, completedSessions: 5, completedChapters: 3 },
  courses: [
    {
      courseId: "c1",
      title: "Curso de React",
      progress: 60,
      lastAccessedAt: new Date().toISOString(),
      continueChapterId: "ch1",
    },
  ],
  recentSessions: [
    {
      sessionId: "s1",
      chapterTitle: "Introducao",
      status: "completed" as const,
      completedAt: new Date().toISOString(),
    },
  ],
}

describe("StudentDashboard", () => {
  /* === compact hero (redesign Hugo 2026-07-14) === */

  it("renders the lean greeting", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={mockData} />)

    expect(screen.getByRole("heading", { name: "Olá, Hugo." })).toBeInTheDocument()
  })

  it("renders the dynamic progress line: active course title + percent", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={mockData} />)

    expect(screen.getByText(/Você parou em/)).toBeInTheDocument()
    expect(screen.getAllByText("Curso de React").length).toBeGreaterThan(0)
    // "60%" appears in the hero line AND in the ActiveCourses progress ring
    expect(screen.getAllByText("60%").length).toBeGreaterThan(0)
  })

  it("hero CTA points to the smart continue destination (chapter of the active course)", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={mockData} />)

    expect(screen.getByRole("link", { name: /Continuar Trilha/ })).toHaveAttribute(
      "href",
      "/courses/c1/chapters/ch1",
    )
  })

  it("falls back to the start invitation + /courses when there is no course", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={{ ...mockData, courses: [] }} />)

    expect(screen.getByText(/Sua jornada começa aqui/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Começar Trilha/ })).toHaveAttribute("href", "/courses")
  })

  it("celebrates a fully completed course instead of a stale stop point", () => {
    const completed = {
      ...mockData,
      courses: [{ ...mockData.courses[0], progress: 100, continueChapterId: null }],
    }
    render(<StudentDashboard fullName="Hugo Capitelli" data={completed} />)

    expect(screen.getByText(/Você concluiu/)).toBeInTheDocument()
  })

  it("renders the 3 summary numbers as a discreet muted meta line, not stat blocks", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={mockData} />)

    expect(screen.getByText(/2 cursos/)).toBeInTheDocument()
    expect(screen.getByText(/5 sessões concluídas/)).toBeInTheDocument()
    expect(screen.getByText(/3 capítulos/)).toBeInTheDocument()
    // the old stat pills are gone
    expect(screen.queryByText("Cursos")).not.toBeInTheDocument()
    expect(screen.queryByText("Sessoes")).not.toBeInTheDocument()
  })

  it("replaces the institutional subtitle with the dynamic line; the photo STAYS (direção Hugo)", () => {
    const { container } = render(<StudentDashboard fullName="Hugo Capitelli" data={mockData} />)

    expect(screen.queryByText(/Desenvolvimento executivo/)).not.toBeInTheDocument()
    expect(container.innerHTML).toContain("unsplash.com")
  })

  /* === rest of the dashboard === */

  it("renders active courses with continue link", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={mockData} />)

    expect(screen.getByRole("link", { name: /Curso de React/ })).toHaveAttribute(
      "href",
      "/courses/c1/chapters/ch1",
    )
  })

  it("renders recent sessions as the Atividades recentes card (v6.1)", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={mockData} />)

    expect(screen.getByText("Atividades recentes")).toBeInTheDocument()
    expect(screen.getByText(/Concluiu "Introducao"/)).toBeInTheDocument()
    expect(screen.getByText("Concluída")).toBeInTheDocument()
  })

  it("does not render the content cards grid (removed 2026-07-14)", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={mockData} />)

    expect(screen.queryByText("Biblioteca")).not.toBeInTheDocument()
    expect(screen.queryByText("Materiais")).not.toBeInTheDocument()
    expect(screen.queryByText("Programas de desenvolvimento")).not.toBeInTheDocument()
    expect(screen.queryByText("Curadoria de conteudo")).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Fases 1A/1B (Hugo 2026-07-15) — trilhas integradas ao dashboard.
// 1 trilha → card completo; 2+ → grid de cards compactos (mais recente com
// destaque, "Ver todas" em 3+); "Seus Cursos" vira "Cursos avulsos" (só cursos
// fora de trilha, some se vazia). Sem trilha, degradação graciosa TOTAL.
// ---------------------------------------------------------------------------

const TRAIL = {
  trailId: "t1",
  title: "Formação Lean",
  description: "Melhoria contínua da operação",
  isMandatory: false,
  progressPct: 33,
  currentIndex: 1,
  currentCourseTitle: "Análise e Solução de Problemas",
  currentCoursePct: 50,
  continueHref: "/courses/c2/chapters/ch9",
  lastActivityAt: "2026-07-15T10:00:00.000Z",
  courses: [
    {
      courseId: "c1",
      title: "Fundamentos da Melhoria Contínua",
      state: "completed" as const,
      progressPct: 100,
    },
    {
      courseId: "c2",
      title: "Análise e Solução de Problemas",
      state: "active" as const,
      progressPct: 50,
    },
    { courseId: "c3", title: "Padronização e Kaizen", state: "locked" as const, progressPct: 0 },
  ],
}

const TRAIL_2 = {
  trailId: "t2",
  title: "Liderança na Prática",
  description: "Gestão de pessoas no dia a dia",
  isMandatory: false,
  progressPct: 80,
  currentIndex: 4,
  currentCourseTitle: "Feedback Contínuo",
  currentCoursePct: 10,
  continueHref: "/courses/c24/chapters/ch40",
  lastActivityAt: "2026-07-10T10:00:00.000Z",
  courses: [
    { courseId: "c20", title: "Papel do Líder", state: "completed" as const, progressPct: 100 },
    { courseId: "c21", title: "Comunicação", state: "completed" as const, progressPct: 100 },
    { courseId: "c22", title: "Delegação", state: "completed" as const, progressPct: 100 },
    { courseId: "c23", title: "1:1s", state: "completed" as const, progressPct: 100 },
    { courseId: "c24", title: "Feedback Contínuo", state: "active" as const, progressPct: 10 },
  ],
}

const TRAIL_3 = {
  trailId: "t3",
  title: "Segurança do Trabalho",
  description: "NRs essenciais da planta",
  isMandatory: true,
  progressPct: 0,
  currentIndex: 0,
  currentCourseTitle: "NR-12 Fundamentos",
  currentCoursePct: 0,
  continueHref: "/courses/c30",
  lastActivityAt: "2026-07-01T10:00:00.000Z",
  courses: [
    { courseId: "c30", title: "NR-12 Fundamentos", state: "active" as const, progressPct: 0 },
    { courseId: "c31", title: "EPIs", state: "locked" as const, progressPct: 0 },
    { courseId: "c32", title: "Brigada", state: "locked" as const, progressPct: 0 },
    { courseId: "c33", title: "CIPA", state: "locked" as const, progressPct: 0 },
  ],
}

describe("Fase 1A — 1 trilha: card completo + hero de trilha", () => {
  const dataWithTrail = { ...mockData, trails: [TRAIL] }

  it("com trilha: o hero cita a trilha, a posição e o curso atual com %", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={dataWithTrail} />)

    expect(screen.getByText(/Você está na trilha/)).toBeInTheDocument()
    expect(screen.getByText(/curso 2 de 3/)).toBeInTheDocument()
    expect(screen.getAllByText("Formação Lean").length).toBeGreaterThan(0)
    // A linha padrão "Você parou em {curso}" dá lugar à linha de trilha.
    expect(screen.queryByText(/Você parou em/)).not.toBeInTheDocument()
  })

  it("com trilha: o CTA Continuar Trilha mira o capítulo do curso ATUAL da trilha", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={dataWithTrail} />)

    expect(screen.getByRole("link", { name: /Continuar Trilha/ })).toHaveAttribute(
      "href",
      "/courses/c2/chapters/ch9",
    )
  })

  it("com 1 trilha: card COMPLETO (não o grid compacto), com steps e link", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={dataWithTrail} />)

    expect(screen.getByTestId("trail-progress-card")).toBeInTheDocument()
    expect(screen.queryByTestId("compact-trail-card")).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Ver trilha completa/ })).toHaveAttribute(
      "href",
      "/trails/t1",
    )
    expect(screen.getByText("Fundamentos da Melhoria Contínua")).toBeInTheDocument()
    expect(screen.getByText("Padronização e Kaizen")).toBeInTheDocument()
    expect(screen.getByText("33%")).toBeInTheDocument()
  })

  it("sem trilha: degradação graciosa — nada de trilha, dashboard como antes", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={mockData} />)

    expect(screen.queryByTestId("trail-progress-card")).not.toBeInTheDocument()
    expect(screen.queryByTestId("compact-trail-card")).not.toBeInTheDocument()
    expect(screen.queryByText(/Você está na trilha/)).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /Ver trilha completa/ })).not.toBeInTheDocument()
    // "Seus Cursos" volta a listar tudo (nada de "Cursos avulsos").
    expect(screen.getByText("Seus Cursos")).toBeInTheDocument()
    expect(screen.queryByText("Cursos avulsos")).not.toBeInTheDocument()
    // O CTA volta ao destino padrão (capítulo do curso mais recente).
    expect(screen.getByRole("link", { name: /Continuar Trilha/ })).toHaveAttribute(
      "href",
      "/courses/c1/chapters/ch1",
    )
  })
})

describe("Fase 1B — multi-trilha: grid compacto, retomada e cursos avulsos", () => {
  // Trilhas já chegam ordenadas por recência do fetch (mais recente primeiro).
  const dataMulti = { ...mockData, trails: [TRAIL, TRAIL_2, TRAIL_3] }

  it("2+ trilhas: grid de cards COMPACTOS no lugar do card completo", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={dataMulti} />)

    expect(screen.getAllByTestId("compact-trail-card")).toHaveLength(3)
    expect(screen.queryByTestId("trail-progress-card")).not.toBeInTheDocument()
    expect(screen.getByText("Minhas Trilhas")).toBeInTheDocument()
  })

  it("ordenação: a trilha mais recente vem primeiro, com destaque 'Recente'", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={dataMulti} />)

    const cards = screen.getAllByTestId("compact-trail-card")
    expect(cards[0].textContent).toContain("Formação Lean")
    expect(cards[0].textContent).toContain("Recente")
    // Só o primeiro card carrega o destaque.
    expect(screen.getAllByText("Recente")).toHaveLength(1)
    expect(cards[1].textContent).not.toContain("Recente")
  })

  it("trilha obrigatória exibe o badge âmbar 'Obrigatória'", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={dataMulti} />)

    expect(screen.getByText("Obrigatória")).toBeInTheDocument()
    const mandatoryCard = screen
      .getAllByTestId("compact-trail-card")
      .find((c) => c.textContent?.includes("Segurança do Trabalho"))
    expect(mandatoryCard?.textContent).toContain("Obrigatória")
  })

  it("3+ trilhas: link 'Ver todas' → /trails; com 2 trilhas o link some", () => {
    const { unmount } = render(<StudentDashboard fullName="Hugo Capitelli" data={dataMulti} />)
    // Unificação: "Ver todas" aponta para /courses (a aba /trails morreu).
    expect(screen.getByRole("link", { name: /Ver todas/ })).toHaveAttribute("href", "/courses")
    unmount()

    render(
      <StudentDashboard
        fullName="Hugo Capitelli"
        data={{ ...mockData, trails: [TRAIL, TRAIL_2] }}
      />,
    )
    expect(screen.getAllByTestId("compact-trail-card")).toHaveLength(2)
    expect(screen.queryByRole("link", { name: /Ver todas/ })).not.toBeInTheDocument()
  })

  it("cursos de trilha NÃO duplicam na lista; sem avulso, a seção some", () => {
    // mockData só tem c1, que pertence à TRAIL → zero avulsos.
    render(<StudentDashboard fullName="Hugo Capitelli" data={dataMulti} />)

    expect(screen.queryByText("Cursos avulsos")).not.toBeInTheDocument()
    expect(screen.queryByText("Seus Cursos")).not.toBeInTheDocument()
    expect(screen.queryByText("Curso de React")).not.toBeInTheDocument()
  })

  it("com curso avulso: seção 'Cursos avulsos' lista SÓ os fora de trilha", () => {
    const withStandalone = {
      ...dataMulti,
      courses: [
        ...mockData.courses, // c1 — dentro da TRAIL, não deve aparecer
        {
          courseId: "c9",
          title: "Excel para Gestão",
          progress: 70,
          lastAccessedAt: "2026-07-05T10:00:00.000Z",
          continueChapterId: "ch90",
        },
      ],
    }
    render(<StudentDashboard fullName="Hugo Capitelli" data={withStandalone} />)

    expect(screen.getByText("Cursos avulsos")).toBeInTheDocument()
    expect(screen.getByText("Excel para Gestão")).toBeInTheDocument()
    expect(screen.queryByText("Curso de React")).not.toBeInTheDocument()
  })

  it("retomada: curso AVULSO mais recente que as trilhas → hero cita o curso", () => {
    const standaloneRecent = {
      ...dataMulti,
      courses: [
        {
          courseId: "c9",
          title: "Excel para Gestão",
          progress: 70,
          // Mais recente que TRAIL.lastActivityAt (2026-07-15T10:00) → retomada.
          lastAccessedAt: "2026-07-15T12:00:00.000Z",
          continueChapterId: "ch90",
        },
      ],
    }
    render(<StudentDashboard fullName="Hugo Capitelli" data={standaloneRecent} />)

    expect(screen.getByText(/Você parou em/)).toBeInTheDocument()
    expect(screen.queryByText(/Você está na trilha/)).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Continuar Trilha/ })).toHaveAttribute(
      "href",
      "/courses/c9/chapters/ch90",
    )
  })
})

// ---------------------------------------------------------------------------
// Minha Jornada v6.1 (Hugo 2026-07-16) — blocos aprovados: Próximo passo
// provocativo (CTA único, NextStepBar suprimida), Meu plano da semana + modal,
// Minha posição na jornada (faixas sem ranking) e Atividades recentes.
// ---------------------------------------------------------------------------

const MJ_DATA = {
  ...mockData,
  recentSessions: [{ ...mockData.recentSessions[0], whenLabel: "ontem" }],
  nextStep: {
    chapterId: "ch1",
    chapterTitle: "Diagrama de Ishikawa",
    courseId: "c1",
    courseTitle: "Curso de React",
  },
  weeklyPlan: {
    goal: 3,
    days: [0, 1, 2, 4],
    reminder: { enabled: true, time: "08h" },
  },
  weekDays: [
    { dow: "Seg", state: "done" as const, task: "Introducao" },
    { dow: "Ter", state: "missed" as const, task: "Em aberto" },
    { dow: "Qua", state: "today" as const, task: "Diagrama de Ishikawa" },
    { dow: "Qui", state: "rest" as const, task: "Descanso" },
    { dow: "Sex", state: "scheduled" as const, task: "Sessão planejada" },
    { dow: "Sáb", state: "rest" as const, task: "Descanso" },
    { dow: "Dom", state: "rest" as const, task: "Descanso" },
  ],
  sessionsThisWeek: 1,
  streakDays: 3,
  journey: {
    bandIndex: 2,
    bandLabel: "No ritmo",
    progressPct: 60,
    pctToNextBand: 10,
    nextBandLabel: "Adiantado",
    distribution: [
      { label: "Iniciando", pct: 12, isYou: false },
      { label: "Em movimento", pct: 35, isYou: false },
      { label: "No ritmo", pct: 40, isYou: true },
      { label: "Adiantado", pct: 10, isYou: false },
      { label: "Concluído", pct: 3, isYou: false },
    ],
  },
}

describe("Minha Jornada v6.1, blocos aprovados", () => {
  it("renders the provocative next step card with activation question and real CTA", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={MJ_DATA} />)

    expect(
      screen.getByText("O que você vai aplicar desta vez no seu trabalho real?"),
    ).toBeInTheDocument()
    expect(screen.getByText(/Diagrama de Ishikawa · Curso de React/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Continuar agora/ })).toHaveAttribute(
      "href",
      "/courses/c1/chapters/ch1",
    )
    expect(screen.getByRole("button", { name: "Responder depois" })).toBeInTheDocument()
  })

  it("renders the weekly plan card with goal, streak, day states and reminder footer", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={MJ_DATA} />)

    expect(screen.getByText("Meu plano da semana")).toBeInTheDocument()
    expect(screen.getByText(/esta semana/)).toBeInTheDocument()
    expect(screen.getByText(/3 dias no ritmo/)).toBeInTheDocument()
    expect(screen.getByText(/Lembretes por e-mail ativados às 08h/)).toBeInTheDocument()
    expect(screen.getByText("Feito")).toBeInTheDocument()
    expect(screen.getByText("Hoje")).toBeInTheDocument()
    expect(screen.getByText("Agendado")).toBeInTheDocument()
  })

  it("renders the weekly plan empty state when no plan is saved", () => {
    render(
      <StudentDashboard
        fullName="Hugo Capitelli"
        data={{ ...MJ_DATA, weeklyPlan: null, weekDays: [] }}
      />,
    )

    expect(screen.getByRole("button", { name: "Montar meu plano" })).toBeInTheDocument()
  })

  it("renders the journey position card with bands and the no-ranking principle", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={MJ_DATA} />)

    expect(screen.getByText("Minha posição na jornada")).toBeInTheDocument()
    expect(screen.getByText("Você")).toBeInTheDocument()
    expect(screen.getByText("Faixas · sem ranking")).toBeInTheDocument()
    expect(screen.getByText("No ritmo · você")).toBeInTheDocument()
    expect(
      screen.getByText("A comparação é sempre por faixa, nunca por posição individual."),
    ).toBeInTheDocument()
  })

  it("omits the class distribution when the aggregation is unavailable", () => {
    render(
      <StudentDashboard
        fullName="Hugo Capitelli"
        data={{ ...MJ_DATA, journey: { ...MJ_DATA.journey, distribution: null } }}
      />,
    )

    expect(screen.queryByText("Distribuição da turma")).not.toBeInTheDocument()
    expect(screen.getByText("Minha posição na jornada")).toBeInTheDocument()
  })

  it("shows relative time on recent activities", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={MJ_DATA} />)

    expect(screen.getByText("ontem")).toBeInTheDocument()
  })
})
