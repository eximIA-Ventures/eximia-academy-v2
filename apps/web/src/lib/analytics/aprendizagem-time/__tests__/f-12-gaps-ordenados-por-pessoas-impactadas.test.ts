import { describe, expect, it } from "vitest"
import { montarVisaoGeralAprendizagem } from "../montagem"
import {
  AGORA_MS,
  CONTEXTO_DE_TELA,
  DIA_MS,
  avaliacao,
  capacidade,
  entradaBase,
  evidencia,
} from "./contrato"

/**
 * F-12 · §12 — "ordenar considerando: número de pessoas impactadas [...] Não
 * ordenar apenas pelo menor percentual." Uma capacidade com MAIS gente
 * afetada em termos absolutos fica à frente de outra com percentual
 * (irrelevante aqui) mas contagem absoluta menor.
 */
describe("F-12 · gaps ordenados por pessoas impactadas, não só por percentual", () => {
  it("VARIÂNCIA — capacidade com 5 pessoas em atenção vem antes de uma com 3", () => {
    const capMaisImpacto = capacidade({ id: "cap-mais", title: "Uso de evidência" })
    const capMenosImpacto = capacidade({ id: "cap-menos", title: "Pensamento causal" })
    const alunos5 = ["a1", "a2", "a3", "a4", "a5"]
    const alunos3 = ["b1", "b2", "b3"]

    const evidencias = [
      ...alunos5.map((id) =>
        evidencia({ studentId: id, capabilityId: "cap-mais", occurredAtMs: AGORA_MS - 3 * DIA_MS }),
      ),
      ...alunos3.map((id) =>
        evidencia({
          studentId: id,
          capabilityId: "cap-menos",
          occurredAtMs: AGORA_MS - 3 * DIA_MS,
        }),
      ),
    ]
    const avaliacoes = [
      ...alunos5.map((id) =>
        avaliacao({ studentId: id, capabilityId: "cap-mais", newState: "emerging" }),
      ),
      ...alunos3.map((id) =>
        avaliacao({ studentId: id, capabilityId: "cap-menos", newState: "emerging" }),
      ),
    ]

    const fonte = entradaBase({
      capacidades: [capMaisImpacto, capMenosImpacto],
      evidencias,
      avaliacoes,
    })
    const r = montarVisaoGeralAprendizagem(fonte, CONTEXTO_DE_TELA)
    expect(r.atencao.itens[0]?.capacidadeId).toBe("cap-mais")
    expect(r.atencao.itens[1]?.capacidadeId).toBe("cap-menos")
  })
})
