import { describe, expect, it } from "vitest"
import {
  classifySlideInteraction,
  extractBlockquotes,
  isReflectionBlock,
} from "../interaction-points"
import { type AnsweredPoints, type InteractionPoint, courseProgression } from "../progression"

/**
 * Percorrido x Progressão §3.3 — os casos que definem a medida.
 */

function answers(reflected: string[] = [], socratic: string[] = []): AnsweredPoints {
  return {
    reflectedSlideIds: new Set(reflected),
    completedSocraticChapterIds: new Set(socratic),
  }
}

describe("courseProgression", () => {
  it("capítulo SEM pontos não entra no denominador", () => {
    // cap-A tem 2 pontos; cap-B (sem pontos) não pode punir ninguém.
    const points: InteractionPoint[] = [
      { chapterId: "cap-A", slideId: "s1", type: "reflection" },
      { chapterId: "cap-A", slideId: "s2", type: "reflection" },
    ]
    const r = courseProgression(points, answers(["s1", "s2"]), ["cap-A", "cap-B"])

    expect(r.total).toBe(2) // e NÃO 3, nem inflado por cap-B
    expect(r.pct).toBe(100) // respondeu tudo que existia
    expect(r.chaptersWithoutPoints).toEqual(["cap-B"])
  })

  it("curso SEM nenhum ponto devolve null — nunca 0%, nunca 100%", () => {
    const r = courseProgression([], answers(), ["cap-A", "cap-B", "cap-C"])

    expect(r.pct).toBeNull()
    expect(r.pct).not.toBe(0)
    expect(r.pct).not.toBe(100)
    expect(r.chaptersWithoutPoints).toHaveLength(3)
  })

  it("progressão PARCIAL conta só o que foi respondido", () => {
    const points: InteractionPoint[] = [
      { chapterId: "cap-A", slideId: "s1", type: "reflection" },
      { chapterId: "cap-A", slideId: "s2", type: "reflection" },
      { chapterId: "cap-A", slideId: "s3", type: "reflection" },
      { chapterId: "cap-A", slideId: "s4", type: "reflection" },
    ]
    const r = courseProgression(points, answers(["s1", "s3"]), ["cap-A"])

    expect(r.answered).toBe(2)
    expect(r.total).toBe(4)
    expect(r.pct).toBe(50)
  })

  it("progressão COMPLETA exige TODOS os pontos, inclusive a socrática", () => {
    const points: InteractionPoint[] = [
      { chapterId: "cap-A", slideId: "s1", type: "reflection" },
      { chapterId: "cap-A", slideId: null, type: "socratic" },
    ]

    // Só a reflexão: não é progressão completa.
    expect(courseProgression(points, answers(["s1"]), ["cap-A"]).pct).toBe(50)

    // Reflexão + socrática concluída: aí sim.
    expect(courseProgression(points, answers(["s1"], ["cap-A"]), ["cap-A"]).pct).toBe(100)
  })

  it("documenta a invariante: progressão ≤ percorrido", () => {
    // Um aluno não pode responder um ponto sem ter estado no slide dele — a
    // etapa 1 garante isso na ESCRITA (record-slide-presence). Aqui o teste
    // documenta a relação: quem respondeu 2 de 4 pontos esteve, no mínimo, nos
    // slides desses 2 pontos, logo o percorrido é sempre ≥ a progressão.
    const points: InteractionPoint[] = [
      { chapterId: "cap-A", slideId: "s1", type: "reflection" },
      { chapterId: "cap-A", slideId: "s2", type: "reflection" },
      { chapterId: "cap-A", slideId: "s3", type: "reflection" },
      { chapterId: "cap-A", slideId: "s4", type: "reflection" },
    ]
    const progressao = courseProgression(points, answers(["s1", "s2"]), ["cap-A"]).pct ?? 0
    // Percorrido mínimo implicado: esteve em s1 e s2 de 4 slides = 50%.
    const percorridoImplicado = 50

    expect(progressao).toBeLessThanOrEqual(percorridoImplicado)
  })

  it("responder ponto inexistente não infla o resultado", () => {
    const points: InteractionPoint[] = [{ chapterId: "cap-A", slideId: "s1", type: "reflection" }]
    const r = courseProgression(points, answers(["s1", "s99", "s100"]), ["cap-A"])

    expect(r.answered).toBe(1)
    expect(r.pct).toBe(100)
  })
})

describe("interaction-points — heurística extraída sem mudar comportamento", () => {
  it("reconhece os cinco padrões originais", () => {
    expect(isReflectionBlock("## 🔎 Reflexão")).toBe(true)
    expect(isReflectionBlock("Agora reflita sobre o caso")).toBe(true)
    expect(isReflectionBlock("reflita por um momento")).toBe(true)
    expect(isReflectionBlock("🤔 O que você faria?")).toBe(true)
    expect(isReflectionBlock("Como isso se aplica? pense nisso")).toBe(true)
  })

  it("não confunde texto comum com ponto de interação", () => {
    expect(isReflectionBlock("O processo tem cinco etapas.")).toBe(false)
    expect(isReflectionBlock("Qual o prazo?")).toBe(false) // pergunta sem gatilho
  })

  it("agrupa linhas > consecutivas num único blockquote, como o react-markdown", () => {
    const md = "texto\n> Agora reflita\n> por um momento\n> sobre isso\noutro texto"
    const blocks = extractBlockquotes(md)

    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toContain("Agora reflita")
    expect(blocks[0]).toContain("sobre isso")
  })

  it("classifica o slide pelo conteúdo do blockquote", () => {
    expect(classifySlideInteraction("intro\n> **🔎 Agora reflita por um momento...**")).toBe(
      "reflection",
    )
    expect(classifySlideInteraction("só conteúdo, sem citação")).toBeNull()
    expect(classifySlideInteraction(null)).toBeNull()
  })
})
