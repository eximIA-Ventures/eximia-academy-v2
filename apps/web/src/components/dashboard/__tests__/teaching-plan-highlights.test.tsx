import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { TeachingPlanHighlights } from "../teaching-plan-highlights"

const AHEAD = {
  studentName: "João Marcos",
  courseTitle: "Curso A",
  status: "ahead" as const,
  progressPct: 88,
  daysLeft: 10,
  daysAhead: 5,
}
const BEHIND = {
  studentName: "Monique Martins",
  courseTitle: "Curso B",
  status: "behind" as const,
  progressPct: 0,
  daysLeft: 3,
  daysAhead: -31,
}

describe("TeachingPlanHighlights, modo 3 colunas (S8 + S12 fidelidade visual)", () => {
  it("renders the 'Sem acesso' column with details and lg:grid-cols-3 when noAccess is provided", () => {
    const { container } = render(
      <TeachingPlanHighlights
        highlights={[AHEAD, BEHIND]}
        noAccess={[
          { studentName: "Artur", detail: "Nunca acessou" },
          { studentName: "Erica", detail: "17d sem acesso" },
        ]}
      />,
    )

    expect(screen.getByText("Sem acesso recente")).toBeInTheDocument()
    expect(screen.getByText("nunca acessou")).toBeInTheDocument()
    expect(screen.getByText("último acesso há 17 dias")).toBeInTheDocument()
    expect(container.querySelector(".lg\\:grid-cols-3")).not.toBeNull()
  })

  it("caps the 'Sem acesso' column at 5 items", () => {
    const noAccess = Array.from({ length: 7 }, (_, i) => ({
      studentName: `Aluno ${i}`,
      detail: "Nunca acessou",
    }))
    render(<TeachingPlanHighlights highlights={[]} noAccess={noAccess} />)

    for (let i = 0; i < 5; i++) {
      expect(screen.getByText(`Aluno ${i}`)).toBeInTheDocument()
    }
    expect(screen.queryByText("Aluno 5")).not.toBeInTheDocument()
    expect(screen.queryByText("Aluno 6")).not.toBeInTheDocument()
  })

  it("noAccess: [] with highlights populated shows column 3's own empty state, columns 1/2 empty states when their partition is empty", () => {
    render(<TeachingPlanHighlights highlights={[AHEAD]} noAccess={[]} />)

    // empty states específicos por coluna (pente fino 2026-07-07)
    expect(screen.getByText("Ninguém atrasado.")).toBeInTheDocument()
    expect(screen.getByText("Todos acessando.")).toBeInTheDocument()
  })

  it("highlights: [] with noAccess populated does NOT fall into the global empty state", () => {
    render(
      <TeachingPlanHighlights
        highlights={[]}
        noAccess={[{ studentName: "Artur", detail: "Nunca acessou" }]}
      />,
    )

    expect(
      screen.queryByText("Nenhum aluno com plano de ensino ativo neste recorte."),
    ).not.toBeInTheDocument()
    expect(screen.getByText("Artur")).toBeInTheDocument()
    // colunas 1 e 2 vazias (nenhum highlight), coluna 3 tem o Artur
    expect(screen.getByText("Ninguém no ritmo neste recorte.")).toBeInTheDocument()
    expect(screen.getByText("Ninguém atrasado.")).toBeInTheDocument()
  })

  it("global empty state: highlights [] + noAccess [] + showEmptyState=true", () => {
    render(<TeachingPlanHighlights highlights={[]} noAccess={[]} showEmptyState />)

    expect(
      screen.getByText("Nenhum aluno com plano de ensino ativo neste recorte."),
    ).toBeInTheDocument()
  })

  it("global empty state: highlights [] + noAccess [] + showEmptyState absent renders null", () => {
    const { container } = render(<TeachingPlanHighlights highlights={[]} noAccess={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("without noAccess (instructor mode): lg:grid-cols-2, no 'Sem acesso' column, conditional columns unchanged", () => {
    const { container } = render(<TeachingPlanHighlights highlights={[AHEAD]} />)

    expect(container.querySelector(".lg\\:grid-cols-2")).not.toBeNull()
    expect(container.querySelector(".lg\\:grid-cols-3")).toBeNull()
    expect(screen.queryByText(/Sem acesso/)).not.toBeInTheDocument()
    // BEHIND partition absent and highlights has no behind row => column 2 doesn't render at all (legacy conditional)
    expect(screen.queryByText("Atenção — atrasados")).not.toBeInTheDocument()
    expect(screen.queryByText("Nenhum aluno atrasado neste recorte.")).not.toBeInTheDocument()
  })

  it("renders the mandatory subtitle and item detail format ('X% concluído · Yd ...') in triage mode", () => {
    render(<TeachingPlanHighlights highlights={[AHEAD, BEHIND]} noAccess={[]} />)

    expect(
      screen.getByText(
        "Lista de ação calculada pelo progresso esperado para hoje vs. progresso real do aluno.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByText("88% concluído · 10d restantes")).toBeInTheDocument()
    expect(screen.getByText("0% concluído · 31d atrasado")).toBeInTheDocument()
  })

  it("S12-fix: renders the fixed 'concluído' subtitle for a synthetic completed-student entry (concluido: true), in column 1", () => {
    const CONCLUIDO = {
      studentName: "Neusa",
      courseTitle: "",
      status: "ahead" as const,
      progressPct: 100,
      daysLeft: 0,
      daysAhead: 0,
      concluido: true,
    }
    render(<TeachingPlanHighlights highlights={[CONCLUIDO]} noAccess={[]} />)

    expect(screen.getByText("Neusa")).toBeInTheDocument()
    expect(screen.getByText("curso concluído")).toBeInTheDocument()
    expect(screen.queryByText("100% concluído · 0d restantes")).not.toBeInTheDocument()
  })
})
