import { describe, expect, it } from "vitest"
import { avaliarMaturidade } from "../agregador"
import { CRITERIOS_USO_DE_EVIDENCIA, evidenciaClassificada } from "./contrato"

/**
 * F-06 · Regra 4 da spec — "Compreensão → Profundidade → Aplicação →
 * Capacidade demonstrada". Boa compreensão sem NENHUMA aplicação nunca sobe
 * além de "emerging": entender não é o mesmo que aplicar.
 */
describe("F-06 · compreensão alta sem aplicação nunca vira developing/demonstrated", () => {
  it("INVARIÂNCIA — 5 evidências cognitivas 'evidenced', zero aplicação → emerging", () => {
    const evidencias = Array.from({ length: 5 }, () =>
      evidenciaClassificada({
        evidenceCategory: "cognitive",
        comprehension: "evidenced",
        applicationLevel: "not_evidenced",
      }),
    )
    const r = avaliarMaturidade(evidencias, CRITERIOS_USO_DE_EVIDENCIA)
    expect(r.novoEstado).toBe("emerging")
  })
})
