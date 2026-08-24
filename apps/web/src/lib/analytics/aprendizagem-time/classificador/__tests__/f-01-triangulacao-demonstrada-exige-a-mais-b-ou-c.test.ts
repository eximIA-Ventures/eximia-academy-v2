import { describe, expect, it } from "vitest"
import { avaliarMaturidade } from "../agregador"
import { CRITERIOS_USO_DE_EVIDENCIA, evidenciaClassificada } from "./contrato"

/**
 * F-01 · §30 da spec — capacidade só vira "demonstrated" com A+B ou A+C.
 *
 * INVARIÂNCIA: muitas evidências cognitivas (A) sozinhas nunca bastam.
 * VARIÂNCIA: acrescentar evidência de aplicação (B) muda o veredito para
 *   demonstrated quando A já está presente.
 */
describe("F-01 · triangulação exige A+B ou A+C para demonstrated", () => {
  it("INVARIÂNCIA — só A (cognitiva), mesmo com muitas evidências, nunca chega a demonstrated", () => {
    const evidencias = Array.from({ length: 6 }, () =>
      evidenciaClassificada({ evidenceCategory: "cognitive", comprehension: "evidenced" }),
    )
    const r = avaliarMaturidade(evidencias, CRITERIOS_USO_DE_EVIDENCIA)
    expect(r.novoEstado).not.toBe("demonstrated")
    expect(r.triangulacaoOk).toBe(false)
  })

  it("VARIÂNCIA — A + B (aplicação) suficiente vira demonstrated", () => {
    const evidencias = [
      evidenciaClassificada({ evidenceCategory: "cognitive", comprehension: "evidenced" }),
      evidenciaClassificada({ evidenceCategory: "cognitive", comprehension: "evidenced" }),
      evidenciaClassificada({
        evidenceCategory: "application",
        comprehension: "evidenced",
        applicationLevel: "simulated",
      }),
      evidenciaClassificada({
        evidenceCategory: "application",
        comprehension: "evidenced",
        applicationLevel: "contextualized",
      }),
    ]
    const r = avaliarMaturidade(evidencias, CRITERIOS_USO_DE_EVIDENCIA)
    expect(r.triangulacaoOk).toBe(true)
    expect(r.novoEstado).toBe("demonstrated")
  })

  it("VARIÂNCIA — A + C (contexto real) suficiente também vira demonstrated", () => {
    const evidencias = [
      evidenciaClassificada({ evidenceCategory: "cognitive", comprehension: "evidenced" }),
      evidenciaClassificada({ evidenceCategory: "cognitive", comprehension: "partial" }),
      evidenciaClassificada({
        evidenceCategory: "real_context",
        comprehension: "evidenced",
        applicationLevel: "applied_real",
      }),
      evidenciaClassificada({
        evidenceCategory: "real_context",
        comprehension: "evidenced",
        applicationLevel: "applied_real",
      }),
    ]
    const r = avaliarMaturidade(evidencias, CRITERIOS_USO_DE_EVIDENCIA)
    expect(r.triangulacaoOk).toBe(true)
    expect(r.novoEstado).toBe("demonstrated")
  })

  it("VARIÂNCIA — B sem A (nenhuma evidência cognitiva) também não basta", () => {
    const evidencias = [
      evidenciaClassificada({
        evidenceCategory: "application",
        comprehension: "evidenced",
        applicationLevel: "simulated",
      }),
      evidenciaClassificada({
        evidenceCategory: "application",
        comprehension: "evidenced",
        applicationLevel: "contextualized",
      }),
    ]
    const r = avaliarMaturidade(evidencias, CRITERIOS_USO_DE_EVIDENCIA)
    expect(r.triangulacaoOk).toBe(false)
    expect(r.novoEstado).not.toBe("demonstrated")
  })
})
