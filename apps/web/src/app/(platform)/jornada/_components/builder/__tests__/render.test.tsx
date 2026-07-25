import { MIN_DAYS_PER_MODULE } from "@/lib/journey/plan-math"
import type {
  JourneyCourseContext,
  JourneyModuleProgress,
  JourneyPlan,
  JourneyStatus,
} from "@/lib/journey/types"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { JourneyReview } from "../../review/journey-review"
import { JourneyBuilder } from "../journey-builder"

// jsdom não implementa matchMedia; a timeline usa em um effect. Stub local
// (escopo do teste) — NÃO tocamos no test-setup compartilhado (território comum).
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

// Contexto canônico da demo (SPEC §2.2): 8 módulos, teto 126, meta 105.
const REFL = [2, 4, 3, 6, 5, 4, 3, 2]

const UNTOUCHED: JourneyModuleProgress = {
  status: "planned",
  sessionsDone: 0,
  reflectionsDone: 0,
  completedRatio: 0,
  frozen: false,
}
const DONE: JourneyModuleProgress = {
  status: "done",
  sessionsDone: 1,
  reflectionsDone: 0,
  completedRatio: 1,
  frozen: true,
}

function ctx(overrides: Partial<JourneyCourseContext> = {}): JourneyCourseContext {
  const startDate = overrides.startDate ?? "2026-01-01"
  const finalDeadlineDays = overrides.finalDeadlineDays ?? 126
  return {
    courseId: "course-1",
    courseTitle: "Análise e Solução de Problemas",
    startDate,
    finalDeadlineDays,
    managerDeadlineDays: 105,
    modules: REFL.map((refl, i) => ({
      chapterId: `ch-${i}`,
      title: `Módulo ${i + 1}`,
      order: i,
      interactionsExpected: 1,
      reflectionsExpected: refl,
      progress: UNTOUCHED,
    })),
    // Aluno em dia 0: a âncora É a matrícula e a janela é o teto inteiro.
    cohortDeadlineDate: "2026-05-07",
    cohortManagerDeadlineDate: "2026-04-16",
    planningAnchorDate: startDate,
    remainingWindowDays: finalDeadlineDays,
    ...overrides,
  }
}

/**
 * O ALUNO REAL do lançamento (JRN-E §1.2, matrícula 77f43ca0…): módulos 0,1,2,4
 * concluídos, **3 intocado no meio**, 5 em andamento, 6 e 7 não iniciados.
 *
 * O progresso NÃO é um prefixo. Um fixture cômodo ("os N primeiros") não
 * provaria nada — é exatamente o desenho que quebra para este aluno.
 *
 * Duas honestidades preservadas de propósito (riscos R2/R3 da story):
 * - o módulo 0 é "done" com 1 sessão e **0 de 2 reflexões**;
 * - o módulo 3 tem **4 de 4 reflexões e 0 interações** e mesmo assim o motor o
 *   classifica como "planned" (não iniciado).
 */
function ctxAlunoReal(overrides: Partial<JourneyCourseContext> = {}): JourneyCourseContext {
  const base = ctx({
    planningAnchorDate: "2026-03-01",
    remainingWindowDays: 67, // 2026-03-01 → 2026-05-07
    ...overrides,
  })
  const done = new Set([0, 1, 2, 4])
  return {
    ...base,
    modules: base.modules.map((m, i) => {
      if (done.has(i)) return { ...m, progress: { ...DONE, reflectionsDone: 0 } }
      if (i === 3) {
        // 4 de 4 reflexões, 0 interações → "planned", editável, ratio > 0
        return {
          ...m,
          reflectionsExpected: 4,
          progress: {
            status: "planned",
            sessionsDone: 0,
            reflectionsDone: 4,
            completedRatio: 4 / 5,
            frozen: false,
          },
        }
      }
      if (i === 5) {
        return {
          ...m,
          progress: {
            status: "doing",
            sessionsDone: 0,
            reflectionsDone: 1,
            completedRatio: 1 / 5,
            frozen: false,
          },
        }
      }
      return m
    }),
  }
}

function plan(overrides: Partial<JourneyPlan> = {}): JourneyPlan {
  return {
    id: "plan-1",
    enrollmentId: "enr-1",
    studentId: "stu-1",
    courseId: "course-1",
    tenantId: "ten-1",
    status: "active" as JourneyStatus,
    moduleDurations: [15, 15, 15, 15, 15, 15, 15, 15],
    moduleDurationsByChapter: REFL.map((_, i) => ({ chapterId: `ch-${i}`, days: 15 })),
    preset: null,
    preferences: { cascade: true, unit: "w" },
    startDate: "2026-01-01",
    finalDeadlineDate: "2026-05-07",
    managerDeadlineDate: "2026-04-16",
    recalculatedAt: null,
    planningAnchorDate: "2026-01-01",
    baseline: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

/** Linhas da tabela "Seus módulos, em detalhe", na ordem visual. */
function moduleRows(): HTMLElement[] {
  const table = screen.getByRole("table")
  return within(table).getAllByRole("row").slice(1) as HTMLElement[]
}

describe("JourneyBuilder — construtor (draft)", () => {
  it("renderiza título, CTA, timeline, banner e 8 linhas de módulo", () => {
    render(<JourneyBuilder context={ctx()} />)
    expect(screen.getByText("Monte sua jornada")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Começar minha jornada" })).toBeInTheDocument()
    expect(screen.getByTestId("jornada-timeline")).toBeInTheDocument()
    expect(screen.getByTestId("jornada-summary")).toBeInTheDocument()
    // 8 steppers "+" = 8 módulos na tabela
    expect(screen.getAllByRole("button", { name: /^Alongar o Módulo/ })).toHaveLength(8)
  })

  it("confirmar entrega moduleDurations (8) + preferences ao callback", () => {
    const onConfirm = vi.fn()
    render(<JourneyBuilder context={ctx()} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole("button", { name: "Começar minha jornada" }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    const payload = onConfirm.mock.calls[0][0]
    expect(payload.moduleDurations).toHaveLength(8)
    expect(payload.preferences).toEqual({ cascade: true, unit: "w" })
  })

  it("stepper '+' ajusta a duração do módulo (sincronia tabela↔estado)", () => {
    const onConfirm = vi.fn()
    render(<JourneyBuilder context={ctx()} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByLabelText("Alongar o Módulo 1 em 1 semana"))
    fireEvent.click(screen.getByRole("button", { name: "Começar minha jornada" }))
    const after = onConfirm.mock.calls[0][0].moduleDurations as number[]
    // snap semanal: o M1 sobe para o próximo múltiplo de 7 acima do neutro
    expect(after[0] % 7).toBe(0)
    expect(after[0]).toBeGreaterThan(16)
    expect(after.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(126)
  })
})

// ---------------------------------------------------------------------------
// JRN-E — construtor consciente do progresso, sobre o padrão ESPARSO real
// ---------------------------------------------------------------------------

describe("JRN-E — construtor no MEIO do curso (progresso esparso 0,1,2,4)", () => {
  it("AC-E2.1 — concluído não é arrastável: sem stepper e sem alça", () => {
    render(<JourneyBuilder context={ctxAlunoReal()} />)
    // 8 módulos, 4 concluídos → só 4 steppers "+"
    expect(screen.getAllByRole("button", { name: /^Alongar o Módulo/ })).toHaveLength(4)
    for (const n of [1, 2, 3, 5]) {
      expect(screen.queryByLabelText(`Alongar o Módulo ${n} em 1 semana`)).toBeNull()
    }
    const track = screen.getByTestId("jornada-timeline")
    expect(track.querySelectorAll('[data-frozen="true"]')).toHaveLength(4)
  })

  it("AC-E2.1 — nenhum pointermove altera a duração de um módulo concluído", () => {
    const onConfirm = vi.fn()
    render(<JourneyBuilder context={ctxAlunoReal()} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole("button", { name: "Começar minha jornada" }))
    const before = onConfirm.mock.calls[0][0].moduleDurations as number[]

    const track = screen.getByTestId("jornada-timeline")
    const dot0 = track.querySelector('[data-idx="0"]') as HTMLElement
    fireEvent.pointerDown(dot0)
    fireEvent.pointerMove(window, { clientX: 900, clientY: 10 })
    fireEvent.pointerUp(window)

    fireEvent.click(screen.getByRole("button", { name: "Começar minha jornada" }))
    const after = onConfirm.mock.calls[1][0].moduleDurations as number[]
    expect(after).toEqual(before)
    expect(after[0]).toBe(0)
  })

  it("AC-E2.2 — buraco no meio: o módulo 4 é editável ENTRE concluídos", () => {
    render(<JourneyBuilder context={ctxAlunoReal()} />)
    const rows = moduleRows()
    expect(rows).toHaveLength(8)
    // ordem visual preservada: 1..8 na coluna #
    rows.forEach((row, i) => {
      expect(within(row).getByText(String(i + 1))).toBeInTheDocument()
    })
    // quais linhas têm stepper: exatamente as vivas (índices 3,5,6,7 → 4,6,7,8)
    const withStepper = rows.map((row) => within(row).queryAllByRole("button").length > 0)
    expect(withStepper).toEqual([false, false, false, true, false, true, true, true])
    // o módulo 5 (índice 4) aparece CONCLUÍDO depois do 4 (índice 3, editável)
    expect(rows[3].getAttribute("data-frozen")).toBeNull()
    expect(rows[4].getAttribute("data-frozen")).toBe("true")
  })

  it("AC-E2.3 — a partida trava os concluídos em 0 e cabe na janela restante", () => {
    const onConfirm = vi.fn()
    render(<JourneyBuilder context={ctxAlunoReal()} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole("button", { name: "Começar minha jornada" }))
    const d = onConfirm.mock.calls[0][0].moduleDurations as number[]
    expect(d).toHaveLength(8)
    for (const i of [0, 1, 2, 4]) expect(d[i]).toBe(0)
    for (const i of [3, 5, 6, 7]) expect(d[i]).toBeGreaterThanOrEqual(MIN_DAYS_PER_MODULE)
    expect(d.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(67)
  })

  it("AC-E2.3 — o stepper repetido no último módulo nunca fura o teto duro", () => {
    const onConfirm = vi.fn()
    render(<JourneyBuilder context={ctxAlunoReal()} onConfirm={onConfirm} />)
    for (let k = 0; k < 30; k++) {
      fireEvent.click(screen.getByLabelText("Alongar o Módulo 8 em 1 semana"))
    }
    fireEvent.click(screen.getByRole("button", { name: "Começar minha jornada" }))
    const d = onConfirm.mock.calls[0][0].moduleDurations as number[]
    expect(d.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(67)
    for (const i of [0, 1, 2, 4]) expect(d[i]).toBe(0)
  })

  it("AC-E2.3 — nenhum preset devolve dia para concluído nem fura o teto", () => {
    const onConfirm = vi.fn()
    render(<JourneyBuilder context={ctxAlunoReal()} onConfirm={onConfirm} />)
    for (const label of ["Tranquilo", "Moderado", "Intenso"]) {
      fireEvent.click(screen.getByRole("button", { name: "✨ Sugerir jornada" }))
      fireEvent.click(screen.getByRole("menuitem", { name: new RegExp(`^${label}`) }))
      fireEvent.click(screen.getByRole("button", { name: "Começar minha jornada" }))
    }
    for (const call of onConfirm.mock.calls) {
      const d = call[0].moduleDurations as number[]
      for (const i of [0, 1, 2, 4]) expect(d[i]).toBe(0)
      expect(d.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(67)
    }
  })

  it("AC-E2.4 — 'Voltar ao ponto de partida' mantém o progresso travado", () => {
    const onConfirm = vi.fn()
    render(<JourneyBuilder context={ctxAlunoReal()} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByLabelText("Alongar o Módulo 4 em 1 semana"))
    fireEvent.click(screen.getByRole("button", { name: "↺ Voltar ao ponto de partida" }))
    fireEvent.click(screen.getByRole("button", { name: "Começar minha jornada" }))
    const d = onConfirm.mock.calls[0][0].moduleDurations as number[]
    for (const i of [0, 1, 2, 4]) expect(d[i]).toBe(0)
    expect(d.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(67)
  })

  it("AC-E2.5 — a timeline começa HOJE: nenhuma data de módulo vivo é passada", () => {
    // matrícula 60 dias atrás; a âncora é hoje, não o T0
    render(<JourneyBuilder context={ctxAlunoReal()} />)
    const rows = moduleRows()
    const dates = rows
      .filter((r) => r.getAttribute("data-frozen") == null)
      .map((r) => r.textContent ?? "")
    // toda linha viva mostra um período com dia/mês; nenhuma mostra "concluído"
    for (const text of dates) expect(text).not.toContain("concluído")
    // as 4 linhas travadas mostram "concluído" e "não consome prazo" na tabela,
    // e os 4 marcos travados mostram "concluído" na timeline (4 + 4 = 8)
    const table = screen.getByRole("table")
    expect(within(table).getAllByText("concluído")).toHaveLength(4)
    expect(within(table).getAllByText("não consome prazo")).toHaveLength(4)
    const track = screen.getByTestId("jornada-timeline")
    expect(within(track).getAllByText("concluído")).toHaveLength(4)
  })

  it("AC-E2.5 — o teto duro exibido é o de COORTE (matrícula + prazo), não hoje + prazo", () => {
    render(<JourneyBuilder context={ctxAlunoReal()} />)
    // 2026-05-07 = matrícula 2026-01-01 + 126 dias. Se fosse "hoje + 126",
    // seria 5 jul — o bug que o commit d60ec27 matou.
    expect(screen.getAllByText("7 mai").length).toBeGreaterThan(0)
  })

  it("honestidade — a tabela mostra feito/esperado, sem maquiar o estado esquisito", () => {
    render(<JourneyBuilder context={ctxAlunoReal()} />)
    const rows = moduleRows()
    // módulo 1: "done" com 1 sessão e 0 de 2 reflexões — o número aparece cru
    expect(within(rows[0]).getByText("1/1")).toBeInTheDocument()
    expect(within(rows[0]).getByText("0/2")).toBeInTheDocument()
    // módulo 4: 4 de 4 reflexões, 0 interações, e ainda assim editável
    expect(within(rows[3]).getByText("0/1")).toBeInTheDocument()
    expect(within(rows[3]).getByText("4/4")).toBeInTheDocument()
    expect(within(rows[3]).queryAllByRole("button").length).toBeGreaterThan(0)
  })

  it("AC-E2.7 — teto vencido é honesto: estado explícito e CTA vivo", () => {
    const expired = ctxAlunoReal({
      planningAnchorDate: "2026-06-01", // depois do teto 2026-05-07
      remainingWindowDays: 0,
    })
    const onConfirm = vi.fn()
    render(<JourneyBuilder context={expired} onConfirm={onConfirm} />)
    expect(screen.getAllByText(/prazo vencido/i).length).toBeGreaterThan(0)
    expect(screen.getByTestId("jornada-summary").textContent).toContain("venceu")
    const cta = screen.getByRole("button", { name: "Começar minha jornada" })
    expect(cta).not.toBeDisabled()
    fireEvent.click(cta)
    const d = onConfirm.mock.calls[0][0].moduleDurations as number[]
    // janela impossível: os vivos ficam no mínimo, os concluídos em 0
    for (const i of [3, 5, 6, 7]) expect(d[i]).toBe(MIN_DAYS_PER_MODULE)
    for (const i of [0, 1, 2, 4]) expect(d[i]).toBe(0)
  })

  it("AC-E2.8 — sem meta do gestor não renderiza chip nem frase de meta", () => {
    const semMeta = ctxAlunoReal({
      managerDeadlineDays: null,
      cohortManagerDeadlineDate: null,
    })
    render(<JourneyBuilder context={semMeta} />)
    expect(screen.queryByText(/Meta do gestor/)).toBeNull()
    expect(screen.getByTestId("jornada-summary").textContent).not.toContain("meta do gestor")
  })
})

describe("JourneyReview — revisar (active)", () => {
  it("renderiza badge, 'Salvar alterações' desabilitado sem mudança e 'Voltar'", () => {
    render(<JourneyReview context={ctx()} plan={plan()} />)
    expect(screen.getByText("Jornada ativa")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Revisar jornada" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Voltar" })).toBeInTheDocument()
  })

  it("um ajuste habilita 'Salvar alterações' (mudança real vs snapshot)", () => {
    render(<JourneyReview context={ctx()} plan={plan()} />)
    fireEvent.click(screen.getByLabelText("Alongar o Módulo 1 em 1 semana"))
    expect(screen.getByRole("button", { name: "Salvar alterações" })).not.toBeDisabled()
  })

  it("'Voltar' chama onBack (descarta)", () => {
    const onBack = vi.fn()
    render(<JourneyReview context={ctx()} plan={plan()} onBack={onBack} />)
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it("AC-E2.6 — revisar trava o que concluiu desde a montagem e não move o teto", () => {
    const onSave = vi.fn()
    render(<JourneyReview context={ctxAlunoReal()} plan={plan()} onSave={onSave} />)
    // os 4 concluídos perderam o stepper
    expect(screen.getAllByRole("button", { name: /^Alongar o Módulo/ })).toHaveLength(4)
    // teto duro exibido continua sendo 7 mai (coorte), mesmo revisando hoje
    expect(screen.getAllByText(/7 mai/).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByLabelText("Alongar o Módulo 8 em 1 semana"))
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }))
    const d = onSave.mock.calls[0][0].moduleDurations as number[]
    for (const i of [0, 1, 2, 4]) expect(d[i]).toBe(0)
    expect(d.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(67)
  })
})
