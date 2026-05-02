import type { AILearningProfile } from "@eximia/shared"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AIProfileSection } from "../ai-profile-section"
import { getConfidenceLabel } from "../profile-summary-card"

const mockProfile: AILearningProfile = {
  preferred_question_types: ["clarificacao", "aplicacao"],
  engagement_style: "reflective",
  detail_orientation: "verbose",
  reasoning_style: "analytical",
  avg_depth_achieved: 3.5,
  comprehension_trend: "improving",
  avg_qa_score: 0.82,
  strengths: ["Pensamento critico", "Conexoes interdisciplinares"],
  growth_areas: ["Aprofundamento de argumentos"],
  adaptation_hints: ["Use exemplos praticos"],
  summary:
    "Aluno reflexivo com forte pensamento analitico. Demonstra capacidade de fazer conexoes entre conceitos e prefere abordagens detalhadas.",
  sessions_analyzed: 5,
  last_updated: "2026-02-10T14:30:00Z",
  confidence: 0.65,
  version: 1,
}

describe("AIProfileSection", () => {
  it("renders placeholder when profile is null", () => {
    render(<AIProfileSection profile={null} />)
    expect(screen.getByText(/Complete pelo menos 2 sessoes socraticas/)).toBeInTheDocument()
  })

  it("renders summary when profile is present", () => {
    render(<AIProfileSection profile={mockProfile} />)
    expect(screen.getByText(/Aluno reflexivo com forte pensamento analitico/)).toBeInTheDocument()
  })

  it("renders learning style cards translated to PT-BR", () => {
    render(<AIProfileSection profile={mockProfile} />)
    expect(screen.getByText("Reflexivo")).toBeInTheDocument()
    expect(screen.getByText("Detalhista")).toBeInTheDocument()
    expect(screen.getByText("Analitico")).toBeInTheDocument()
  })

  it("renders strengths and growth areas", () => {
    render(<AIProfileSection profile={mockProfile} />)
    expect(screen.getByText("Pensamento critico")).toBeInTheDocument()
    expect(screen.getByText("Conexoes interdisciplinares")).toBeInTheDocument()
    expect(screen.getByText("Aprofundamento de argumentos")).toBeInTheDocument()
  })

  it("renders disclaimer", () => {
    render(<AIProfileSection profile={mockProfile} />)
    expect(
      screen.getByText(/Este perfil e baseado em suas interacoes com o tutor/),
    ).toBeInTheDocument()
  })

  it("renders sessions count and last updated", () => {
    render(<AIProfileSection profile={mockProfile} />)
    expect(screen.getByText(/Baseado em 5 sessoes/)).toBeInTheDocument()
    expect(screen.getByText(/Atualizado em 10\/02\/2026/)).toBeInTheDocument()
  })

  it("renders singular session text", () => {
    render(<AIProfileSection profile={{ ...mockProfile, sessions_analyzed: 1 }} />)
    expect(screen.getByText(/Baseado em 1 sessao/)).toBeInTheDocument()
  })
})

describe("getConfidenceLabel", () => {
  it("returns 'Conhecendo você...' for confidence < 0.3", () => {
    expect(getConfidenceLabel(0.1).label).toBe("Conhecendo você...")
    expect(getConfidenceLabel(0.29).label).toBe("Conhecendo você...")
  })

  it("returns 'Perfil em formacao' for confidence 0.3-0.6", () => {
    expect(getConfidenceLabel(0.3).label).toBe("Perfil em formacao")
    expect(getConfidenceLabel(0.4).label).toBe("Perfil em formacao")
    expect(getConfidenceLabel(0.59).label).toBe("Perfil em formacao")
  })

  it("returns 'Perfil consistente' for confidence 0.6-0.8", () => {
    expect(getConfidenceLabel(0.6).label).toBe("Perfil consistente")
    expect(getConfidenceLabel(0.7).label).toBe("Perfil consistente")
    expect(getConfidenceLabel(0.79).label).toBe("Perfil consistente")
  })

  it("returns 'Perfil consolidado' for confidence >= 0.8", () => {
    expect(getConfidenceLabel(0.8).label).toBe("Perfil consolidado")
    expect(getConfidenceLabel(0.9).label).toBe("Perfil consolidado")
    expect(getConfidenceLabel(1.0).label).toBe("Perfil consolidado")
  })
})
