import { describe, expect, it } from "vitest"
import { computePadroesTendencias } from "../index"
import { cenarioModulos, cenarioRegularidadeCai, cenarioRegularidadeSobe } from "./cenario"

/**
 * F-19 · O selo do sinal: recorrente (âmbar) · alta (verde) · queda (vermelho).
 *
 * INVARIÂNCIA: cada tipo recebe o par (rótulo, tom) da §31.
 * VARIÂNCIA: trocar o tipo do sinal troca o par — o mapa não é constante.
 */

/** Módulo com 6 pessoas há três semanas, caindo desde então. */
function cenarioModuloEmQuedaRecorrente() {
  return cenarioModulos([
    { id: "m1", titulo: "Executar Ações Corretivas", antes: 6, agora: 2 },
    { id: "m2", titulo: "Monitoramento dos Resultados", antes: 5, agora: 4 },
  ])
}

describe("F-19 · selo de classificação do sinal", () => {
  it("INVARIÂNCIA — sinal de queda recebe 'Tendência de queda' em vermelho", () => {
    const d = computePadroesTendencias(cenarioRegularidadeCai(4))
    const sinal = d.sinais.itens.find((i) => i.tipo === "limiar")
    expect(sinal?.badgeRotulo).toBe("Tendência de queda")
    expect(sinal?.badgeTom).toBe("red")
  })

  it("VARIÂNCIA — sinal de subida recebe 'Tendência de alta' em verde", () => {
    const d = computePadroesTendencias(cenarioRegularidadeSobe(4))
    const sinal = d.sinais.itens.find((i) => i.tipo === "limiar")
    expect(sinal?.badgeRotulo).toBe("Tendência de alta")
    expect(sinal?.badgeTom).toBe("green")
  })

  it("INVARIÂNCIA — sinal de recorrência recebe 'Padrão recorrente' em âmbar", () => {
    const d = computePadroesTendencias(cenarioModuloEmQuedaRecorrente())
    const sinal = d.sinais.itens.find((i) => i.tipo === "recorrencia")
    expect(sinal?.badgeRotulo).toBe("Padrão recorrente")
    expect(sinal?.badgeTom).toBe("amber")
  })

  it("INVARIÂNCIA — todo sinal tem selo e ícone preenchidos", () => {
    for (const entrada of [cenarioRegularidadeCai(4), cenarioModuloEmQuedaRecorrente()]) {
      for (const item of computePadroesTendencias(entrada).sinais.itens) {
        expect(item.badgeRotulo.length).toBeGreaterThan(0)
        expect(item.icone.length).toBeGreaterThan(0)
        expect(["red", "green", "amber", "blue", "neutral"]).toContain(item.badgeTom)
      }
    }
  })
})
