import { describe, expect, it } from "vitest"
import { countReflectionBlocks, isReflectionBlock } from "../reflection-potential"

// ---------------------------------------------------------------------------
// SH-F.5 (flag I1) — the reflection-block heuristic was extracted VERBATIM from
// aggregate/route.ts to lib/analytics/reflection-potential.ts. These tests pin
// the behavior (parity) so the extraction is provably byte-identical and reusable.
// ---------------------------------------------------------------------------

describe("isReflectionBlock — heurística de prompt de reflexão", () => {
  it("detecta a palavra 'reflexão'/'reflexao'", () => {
    expect(isReflectionBlock("Momento de reflexão: o que mudou?")).toBe(true)
    expect(isReflectionBlock("Uma reflexao rápida")).toBe(true)
  })
  it("detecta 'agora reflita/pense/imagine/considere'", () => {
    expect(isReflectionBlock("Agora reflita sobre o caso")).toBe(true)
    expect(isReflectionBlock("Agora pense no impacto")).toBe(true)
  })
  it("detecta emoji de reflexão + pergunta", () => {
    expect(isReflectionBlock("🤔 O que você faria?")).toBe(true)
  })
  it("detecta pergunta + verbo reflexivo", () => {
    expect(isReflectionBlock("Como você imagine isso? considere os dois lados")).toBe(true)
  })
  it("NÃO detecta texto comum sem sinal", () => {
    expect(isReflectionBlock("Este slide apresenta o conteúdo do módulo.")).toBe(false)
    expect(isReflectionBlock("Uma pergunta qualquer?")).toBe(false)
  })
})

describe("countReflectionBlocks — conta blockquotes de reflexão no markdown", () => {
  it("null/vazio → 0", () => {
    expect(countReflectionBlocks(null)).toBe(0)
    expect(countReflectionBlocks(undefined)).toBe(0)
    expect(countReflectionBlocks("")).toBe(0)
  })
  it("blockquote de reflexão conta 1", () => {
    expect(countReflectionBlocks("> Reflexão: o que você levou disso?")).toBe(1)
  })
  it("linhas '>' consecutivas colapsam em UM bloco (prompt multi-linha = 1)", () => {
    const md = "> Agora reflita\n> por um momento\n> sobre isso"
    expect(countReflectionBlocks(md)).toBe(1)
  })
  it("dois blockquotes de reflexão separados por conteúdo → 2", () => {
    const md = "> Reflexão inicial?\n\ntexto normal\n\n> Agora pense nisso também?"
    expect(countReflectionBlocks(md)).toBe(2)
  })
  it("blockquote que NÃO é reflexão não conta; texto fora de blockquote é ignorado", () => {
    const md = "> apenas uma citação neutra\n\nReflexão fora de blockquote não conta"
    expect(countReflectionBlocks(md)).toBe(0)
  })
})
