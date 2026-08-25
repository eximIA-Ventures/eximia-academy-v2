import { describe, expect, it } from "vitest"
import { avaliarMaturidade } from "../agregador"
import { CRITERIOS_USO_DE_EVIDENCIA } from "./contrato"

/**
 * F-10 · §29.1 da spec — "Não evidenciada ≠ incapaz. Significa apenas
 * ausência de evidência." O texto de explicabilidade nunca pode soar como
 * julgamento de incapacidade — nem quando não há evidência nenhuma.
 */
describe("F-10 · not_evidenced nunca é apresentado como incapacidade", () => {
  it("VAZIO — sem evidência nenhuma, o estado é not_evidenced e o texto é neutro", () => {
    const r = avaliarMaturidade([], CRITERIOS_USO_DE_EVIDENCIA)
    expect(r.novoEstado).toBe("not_evidenced")
    expect(r.rationale.toLowerCase()).not.toMatch(
      /incapaz|não consegue|fraco|ruim|incompetente|não sabe/,
    )
    expect(r.rationale).toBe("Nenhuma evidência avaliável ainda para esta capacidade.")
  })
})
