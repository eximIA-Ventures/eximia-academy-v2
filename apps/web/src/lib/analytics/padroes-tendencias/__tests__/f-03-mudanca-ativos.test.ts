import { describe, expect, it } from "vitest"
import { computePadroesTendencias, crescimentoConsistente } from "../index"
import {
  DIAS_REGULARES,
  DIA_NA_JANELA_ANTERIOR,
  PONTE_SEM_PAUSA,
  cenario,
  cenarioAtivosMais3,
} from "./cenario"

/**
 * F-03 · "Mais alunos ativos +N" — contagem com sinal, nunca percentual.
 *
 * INVARIÂNCIA: 5 ativos agora contra 2 antes produzem o item com valor "+3".
 * VARIÂNCIA: mover UMA atividade da janela atual para a anterior derruba o
 *   item (4 contra 3 é +1, abaixo do limiar de 3 pessoas) — o item some, não
 *   vira "+1" nem "+0".
 * SEGUNDA VARIÂNCIA: a frase de consistência só aparece quando a série das 3
 *   últimas semanas realmente sobe. Afirmar consistência sem verificá-la é a
 *   tela dizendo o que o dado não diz.
 */

function itemAtivos(entrada: ReturnType<typeof cenarioAtivosMais3>) {
  return computePadroesTendencias(entrada).mudancas.itens.find((i) => i.id === "ativos")
}

describe("F-03 · mudança de pessoas ativas", () => {
  it("INVARIÂNCIA — 5 agora contra 2 antes é +3, em contagem", () => {
    const item = itemAtivos(cenarioAtivosMais3())
    expect(item?.valorTexto).toBe("+3")
    expect(item?.tom).toBe("positivo")
    expect(item?.titulo).toBe("Mais alunos ativos")
    // Contagem, nunca percentual: 3 em 8 seria "+38%" e alarmaria sem base.
    expect(item?.valorTexto).not.toContain("%")
  })

  it("VARIÂNCIA — mover uma pessoa para a janela anterior derruba o item", () => {
    const movido = cenario({
      pessoas: [
        { id: "a", sessoes: [...DIAS_REGULARES, ...PONTE_SEM_PAUSA, DIA_NA_JANELA_ANTERIOR] },
        { id: "b", sessoes: [2, 5, ...PONTE_SEM_PAUSA, DIA_NA_JANELA_ANTERIOR] },
        // "c" deixa de estar ativa agora e passa a estar antes.
        { id: "c", sessoes: [38] },
        { id: "d", sessoes: [3] },
        { id: "e", sessoes: [4] },
      ],
    })
    expect(itemAtivos(movido)).toBeUndefined()
  })

  it("VARIÂNCIA — a frase de consistência exige série não decrescente", () => {
    expect(crescimentoConsistente([2, 4, 6], 3)).toBe(true)
    expect(crescimentoConsistente([2, 6, 4], 3)).toBe(false)
    // Série constante não é crescimento.
    expect(crescimentoConsistente([5, 5, 5], 3)).toBe(false)
  })

  it("INVARIÂNCIA — série que sobe nas 3 últimas semanas ganha a frase de consistência", () => {
    // Série de ativos: … 2 · 2 · 5 — não decrescente e com ponta maior.
    expect(itemAtivos(cenarioAtivosMais3())?.subtexto).toBe(
      "Crescimento consistente nas últimas 3 semanas",
    )
  })

  it("VARIÂNCIA — série que oscila NÃO ganha a frase; o subtexto vira a régua", () => {
    // Série de ativos: … 2 · 5 · 1 — sobe e desce. A tela não pode afirmar
    // consistência sobre isso.
    const oscilante = cenario({
      pessoas: [
        { id: "a", sessoes: [DIA_NA_JANELA_ANTERIOR, ...PONTE_SEM_PAUSA] },
        { id: "b", sessoes: [DIA_NA_JANELA_ANTERIOR, ...PONTE_SEM_PAUSA] },
        { id: "c", sessoes: [10] },
        { id: "d", sessoes: [10] },
        { id: "e", sessoes: [10] },
        { id: "f", sessoes: [1] },
      ],
    })
    const item = itemAtivos(oscilante)
    expect(item?.valorTexto).toBe("+4")
    expect(item?.subtexto).toBe("Comparado ao período anterior.")
  })
})
