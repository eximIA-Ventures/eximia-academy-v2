import { describe, expect, it } from "vitest"
import { montarVisaoGeralAprendizagem } from "../montagem"
import { CONTEXTO_DE_TELA, entradaBase } from "./contrato"

/**
 * F-05 · §7 — "só declarar tendência quando existirem pelo menos 2 períodos
 * comparáveis". `entradaBase()` só tem evidência no período ATUAL — sem
 * período anterior, "O que mudou" e "Capacidades com maior evolução" saem
 * vazios com o texto literal, nunca "0 p.p." inventado.
 */
describe("F-05 · sem período anterior comparável, nenhum bloco de tendência inventa 0 p.p.", () => {
  it("VAZIO — mudancas sai vazio com motivo sem-tendencia", () => {
    const r = montarVisaoGeralAprendizagem(entradaBase(), CONTEXTO_DE_TELA)
    expect(r.mudancas.estado).toBe("vazio")
    expect(r.mudancas.motivoVazio).toBe("sem-tendencia")
    expect(r.mudancas.textoVazio).toBe(
      "Ainda não há histórico suficiente para identificar uma tendência.",
    )
  })

  it("VAZIO — capacidadesEvolucao sai vazio com motivo sem-tendencia", () => {
    const r = montarVisaoGeralAprendizagem(entradaBase(), CONTEXTO_DE_TELA)
    expect(r.capacidadesEvolucao.estado).toBe("vazio")
    expect(r.capacidadesEvolucao.motivoVazio).toBe("sem-tendencia")
  })

  it("INVARIÂNCIA — o placar (não é bloco de tendência) continua ok mesmo sem período anterior", () => {
    const r = montarVisaoGeralAprendizagem(entradaBase(), CONTEXTO_DE_TELA)
    expect(r.placar.estado).toBe("ok")
    // deltaPp nulo é honesto aqui — não há base de comparação.
    expect(r.placar.evolucao.deltaPp).toBeNull()
  })
})
