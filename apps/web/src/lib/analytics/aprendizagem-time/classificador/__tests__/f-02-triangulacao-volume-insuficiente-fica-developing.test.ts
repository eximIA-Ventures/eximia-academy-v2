import { describe, expect, it } from "vitest"
import { avaliarMaturidade } from "../agregador"
import { CRITERIOS_USO_DE_EVIDENCIA, evidenciaClassificada } from "./contrato"

/**
 * F-02 · §30 — A+B com volume ABAIXO do limiar por categoria fica em
 * "developing", não "demonstrated". Uma única evidência isolada de aplicação
 * não é prova suficiente de triangulação, mesmo estando presente.
 */
describe("F-02 · volume insuficiente numa categoria não triangula", () => {
  it("VARIÂNCIA — A forte + B com 1 única evidência não chega a demonstrated", () => {
    const evidencias = [
      evidenciaClassificada({ evidenceCategory: "cognitive", comprehension: "evidenced" }),
      evidenciaClassificada({ evidenceCategory: "cognitive", comprehension: "evidenced" }),
      evidenciaClassificada({
        evidenceCategory: "application",
        comprehension: "evidenced",
        applicationLevel: "simulated",
      }),
    ]
    const r = avaliarMaturidade(evidencias, CRITERIOS_USO_DE_EVIDENCIA)
    expect(r.triangulacaoOk).toBe(false)
    expect(r.novoEstado).toBe("developing")
  })

  it("VARIÂNCIA — cruzar o limiar (2ª evidência de aplicação) muda para demonstrated", () => {
    const base = [
      evidenciaClassificada({ evidenceCategory: "cognitive", comprehension: "evidenced" }),
      evidenciaClassificada({ evidenceCategory: "cognitive", comprehension: "evidenced" }),
      evidenciaClassificada({
        evidenceCategory: "application",
        comprehension: "evidenced",
        applicationLevel: "simulated",
      }),
    ]
    const antes = avaliarMaturidade(base, CRITERIOS_USO_DE_EVIDENCIA)
    const depois = avaliarMaturidade(
      [
        ...base,
        evidenciaClassificada({
          evidenceCategory: "application",
          comprehension: "evidenced",
          applicationLevel: "contextualized",
        }),
      ],
      CRITERIOS_USO_DE_EVIDENCIA,
    )
    expect(antes.novoEstado).toBe("developing")
    expect(depois.novoEstado).toBe("demonstrated")
  })
})
