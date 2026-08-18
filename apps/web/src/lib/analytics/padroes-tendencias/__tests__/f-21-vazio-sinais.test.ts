import { describe, expect, it } from "vitest"
import type { CapituloBruto } from "../entrada"
import { VAZIO_SINAIS, computePadroesTendencias } from "../index"
import type { PessoaCenario } from "./cenario"
import { DIA_NA_JANELA_ANTERIOR, capitulo, cenario, cenarioModulos, contemDigito } from "./cenario"

/**
 * F-21 · §18 estado vazio, com silêncio EXPLICADO.
 *
 * "Nenhum sinal" pode ser time saudável OU dois terços do recorte sem histórico
 * comparável. São mensagens diferentes, e a tela precisa dizer qual das duas é.
 *
 * INVARIÂNCIA: sem padrão → texto da §32 e nenhum dígito solto no corpo.
 * VARIÂNCIA: um módulo em queda recorrente → estado `ok`.
 */

describe("F-21 · sinais vazios", () => {
  it("INVARIÂNCIA — sem padrão, o texto da §32 e zero itens", () => {
    const { sinais } = computePadroesTendencias(
      cenario({
        pessoas: [
          { id: "a", sessoes: [1, 8, 15, 22] },
          { id: "b", sessoes: [2, 9, 16, 23] },
        ],
      }),
    )
    expect(sinais.estado).toBe("vazio")
    expect(sinais.textoVazio).toBe(VAZIO_SINAIS)
    expect(sinais.itens).toHaveLength(0)
  })

  it("INVARIÂNCIA — o corpo do bloco vazio não carrega numeral solto", () => {
    const { sinais } = computePadroesTendencias(
      cenario({ pessoas: [{ id: "a", sessoes: [1, 8] }] }),
    )
    expect(sinais.textoVazio === null || contemDigito(sinais.textoVazio)).toBe(false)
  })

  it("INVARIÂNCIA — base rasa recebe o complemento que explica o silêncio", () => {
    // Ninguém tem carimbo na janela anterior: o silêncio é falta de base, não
    // saúde. A frase cita quantas pessoas ainda não têm histórico.
    const { sinais } = computePadroesTendencias(
      cenario({
        pessoas: [
          { id: "a", sessoes: [1, 8] },
          { id: "b", sessoes: [2, 9] },
        ],
      }),
    )
    expect(sinais.textoComplementar).not.toBeNull()
    expect(sinais.textoComplementar).toContain("de 2 pessoas do recorte")
  })

  it("VARIÂNCIA — um módulo em queda recorrente acende o bloco", () => {
    const { sinais } = computePadroesTendencias(
      cenarioModulos([{ id: "m1", titulo: "Executar Ações Corretivas", antes: 6, agora: 1 }]),
    )
    expect(sinais.estado).toBe("ok")
    expect(sinais.itens.length).toBeGreaterThan(0)
    expect(sinais.textoVazio).toBeNull()
  })

  // -------------------------------------------------------------------------
  // Silêncio PARCIAL. O bloco que fala menos do que caberia deixa espaço vazio,
  // e espaço vazio é lido como "não há mais nada acontecendo" — quando pode ser
  // que boa parte do recorte não tenha janela anterior com que se comparar. A
  // frase existe para essa diferença não depender de adivinhação.
  // -------------------------------------------------------------------------

  it("INVARIÂNCIA — bloco parcialmente cheio também explica o que não disse", () => {
    const { sinais } = computePadroesTendencias(mundoParcial(1))
    expect(sinais.estado).toBe("ok")
    expect(sinais.itens.length).toBeLessThan(3)
    expect(sinais.textoComplementar).toContain("3 de 9 pessoas do recorte")
  })

  it("VARIÂNCIA — com o bloco cheio o complemento some, mesmo com a mesma base rasa", () => {
    // As mesmas 3 pessoas sem histórico continuam ali: o que muda é o bloco
    // encher. Sem este par, a frase poderia ser uma constante sempre ligada, e
    // ela mentiria — com 3 itens o corte é do teto, não da falta de base.
    const { sinais } = computePadroesTendencias(mundoParcial(3))
    expect(sinais.itens).toHaveLength(3)
    expect(sinais.textoComplementar).toBeNull()
  })
})

/**
 * Um mundo com `quantosModulos` capítulos em queda recorrente e sempre 3
 * pessoas que só existem na janela atual — logo sem histórico comparável.
 *
 * Com 1 módulo o bloco fala 1 vez e sobra espaço; com 3 ele enche. A base rasa
 * é idêntica nos dois, que é o ponto do par.
 */
function mundoParcial(quantosModulos: number) {
  const pessoas: PessoaCenario[] = []
  const capitulos: CapituloBruto[] = []

  for (let k = 0; k < quantosModulos; k++) {
    const id = `m${k + 1}`
    capitulos.push(capitulo(id, `Módulo ${k + 1}`, k + 1))
    // Só na janela anterior: 6 pessoas somem e a série do módulo cai a zero.
    for (let i = 0; i < 6; i++) {
      pessoas.push({ id: `${id}-p${i}`, porCapitulo: { [id]: [DIA_NA_JANELA_ANTERIOR] } })
    }
  }
  for (let i = 0; i < 3; i++) {
    pessoas.push({ id: `novo-${i}`, sessoes: [2] })
  }

  return cenario({ pessoas, capitulos, periodoDias: 30 })
}
