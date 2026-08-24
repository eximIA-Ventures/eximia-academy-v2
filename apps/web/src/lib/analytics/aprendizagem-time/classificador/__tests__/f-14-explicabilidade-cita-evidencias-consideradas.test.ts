import { describe, expect, it } from "vitest"
import { avaliarMaturidade } from "../agregador"
import { CRITERIOS_USO_DE_EVIDENCIA, evidenciaClassificada } from "./contrato"

/**
 * F-14 · §40 da spec — toda classificação precisa ser auditável: "Foram
 * consideradas N evidências: X reflexões, Y cenários...". O rationale
 * agregado NUNCA fica vazio quando há evidência avaliável, e sempre cita a
 * contagem — nunca é caixa-preta.
 */
describe("F-14 · explicabilidade sempre cita as evidências consideradas", () => {
  it("INVARIÂNCIA — rationale cita a contagem total e a decomposição por fonte", () => {
    const evidencias = [
      evidenciaClassificada({ sourceType: "reflection", evidenceCategory: "cognitive" }),
      evidenciaClassificada({ sourceType: "reflection", evidenceCategory: "cognitive" }),
      evidenciaClassificada({
        sourceType: "scenario",
        evidenceCategory: "application",
        applicationLevel: "simulated",
      }),
    ]
    const r = avaliarMaturidade(evidencias, CRITERIOS_USO_DE_EVIDENCIA)
    expect(r.rationale).toContain("Foram consideradas 3 evidências")
    expect(r.rationale).toContain("reflexões")
    expect(r.rationale).toContain("cenário")
  })

  it("INVARIÂNCIA — evidenciasConsideradas lista os ids reais usados na avaliação", () => {
    const evidencias = [
      evidenciaClassificada({ id: "ev-a" }),
      evidenciaClassificada({ id: "ev-b" }),
    ]
    const r = avaliarMaturidade(evidencias, CRITERIOS_USO_DE_EVIDENCIA)
    expect(r.evidenciasConsideradas.sort()).toEqual(["ev-a", "ev-b"])
  })

  it("VAZIO — evidência com comprehension null (classificação ainda não rodou) não entra na conta", () => {
    const evidencias = [
      evidenciaClassificada({ id: "ev-pronta", comprehension: "evidenced" }),
      evidenciaClassificada({ id: "ev-pendente", comprehension: null }),
    ]
    const r = avaliarMaturidade(evidencias, CRITERIOS_USO_DE_EVIDENCIA)
    expect(r.evidenciasConsideradas).toEqual(["ev-pronta"])
    expect(r.rationale).toContain("Foram consideradas 1 evidências")
  })
})
