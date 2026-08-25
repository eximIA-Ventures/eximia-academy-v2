import { describe, expect, it } from "vitest"
import { classificarPorHeuristica } from "../heuristica"
import { evidenciaBruta } from "./contrato"

/**
 * Heurística de fallback (sem LLM) — §28/§41 da spec: nunca inventa
 * critério, nunca infere aplicação além do que a PRÓPRIA fonte já declara.
 */
describe("classificarPorHeuristica", () => {
  it("nunca preenche criteriaMet — sem leitura de texto, não há como saber qual critério foi atendido", () => {
    const r = classificarPorHeuristica(evidenciaBruta({ sinais: { depthReached: 6 } }))
    expect(r.criteriaMet).toEqual([])
  })

  it("usa depth_reached quando disponível, limitado a 1-7", () => {
    const r = classificarPorHeuristica(evidenciaBruta({ sinais: { depthReached: 6 } }))
    expect(r.depthLevel).toBe(6)
  })

  it("cai para bloom_target quando não há depth_reached", () => {
    const r = classificarPorHeuristica(
      evidenciaBruta({ sinais: { depthReached: null, bloomTarget: "analyzing" } }),
    )
    expect(r.depthLevel).toBe(5)
  })

  it("nunca sai fora da faixa 1-7 mesmo sem nenhum sinal", () => {
    const r = classificarPorHeuristica(evidenciaBruta())
    expect(r.depthLevel).toBeGreaterThanOrEqual(1)
    expect(r.depthLevel).toBeLessThanOrEqual(7)
  })

  it("applicationLevel só sobe a applied_real quando a FONTE já declara evidência real/validação — nunca por inferência", () => {
    const real = classificarPorHeuristica(evidenciaBruta({ sourceType: "real_evidence" }))
    const validacao = classificarPorHeuristica(evidenciaBruta({ sourceType: "manager_validation" }))
    const reflexao = classificarPorHeuristica(evidenciaBruta({ sourceType: "reflection" }))
    expect(real.applicationLevel).toBe("applied_real")
    expect(validacao.applicationLevel).toBe("applied_real")
    expect(reflexao.applicationLevel).toBe("not_evidenced")
  })

  it("cenário heurístico nunca passa de 'simulated' — distinguir contextualized exige leitura de texto (LLM)", () => {
    const r = classificarPorHeuristica(evidenciaBruta({ sourceType: "scenario" }))
    expect(r.applicationLevel).toBe("simulated")
  })

  it("confiança da heurística é sempre moderada (0.5) — nunca alta o bastante para parecer certeza", () => {
    const r = classificarPorHeuristica(evidenciaBruta())
    expect(r.confidence).toBe(0.5)
  })

  it("model é sempre identificável como heurístico, nunca confundido com saída de LLM", () => {
    const r = classificarPorHeuristica(evidenciaBruta())
    expect(r.model).toBe("heuristic-v1")
  })
})
