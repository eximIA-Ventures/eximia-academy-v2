import { describe, expect, it } from "vitest"
import {
  VAZIO_NINGUEM_INICIOU,
  VAZIO_SEM_ESCOPO,
  VAZIO_TENDENCIA,
  computePadroesTendencias,
} from "../index"
import { cenario, cenarioAtivosMais3, contemDigito, serializar } from "./cenario"

/**
 * F-09 · §16 em estado vazio — texto da §32, e ZERO numeral no corpo.
 *
 * INVARIÂNCIA: sem candidato relevante, o bloco sai em `vazio`, com o literal
 *   da §32, e a lista de itens não contém dígito algum. "0 mudanças" e "não dá
 *   para comparar" são mensagens opostas a partir do mesmo dado ausente.
 * VARIÂNCIA: acrescentar atividade nas duas janelas troca o estado para `ok` e
 *   o texto some.
 *
 * O SUBTÍTULO permanece visível e contém "30" de propósito (F-02): ele é a
 * régua da comparação, não uma afirmação sobre a equipe. Por isso a asserção de
 * "zero dígitos" mira os itens e o texto vazio, não o cabeçalho.
 */

const SEM_CANDIDATO = cenario({
  pessoas: [
    { id: "a", sessoes: [2] },
    { id: "b", sessoes: [3] },
  ],
})

describe("F-09 · §16 estado vazio", () => {
  it("INVARIÂNCIA — sem candidato, o texto é o da §32 e não há numeral", () => {
    const bloco = computePadroesTendencias(SEM_CANDIDATO).mudancas
    expect(bloco.estado).toBe("vazio")
    expect(bloco.textoVazio).toBe(VAZIO_TENDENCIA)
    expect(bloco.itens).toHaveLength(0)
    expect(contemDigito(`${serializar(bloco.itens)}${bloco.textoVazio}`)).toBe(false)
  })

  it("INVARIÂNCIA — recorte sem ninguém e recorte sem início têm textos DIFERENTES", () => {
    expect(computePadroesTendencias(cenario({ pessoas: [] })).mudancas.textoVazio).toBe(
      VAZIO_SEM_ESCOPO,
    )
    const ninguemIniciou = cenario({
      pessoas: [
        { id: "a", matricula: { progresso: 0 } },
        { id: "b", matricula: { progresso: 0 } },
      ],
    })
    expect(computePadroesTendencias(ninguemIniciou).mudancas.textoVazio).toBe(VAZIO_NINGUEM_INICIOU)
  })

  it("VARIÂNCIA — com candidato, o estado vira ok e o texto some", () => {
    const bloco = computePadroesTendencias(cenarioAtivosMais3()).mudancas
    expect(bloco.estado).toBe("ok")
    expect(bloco.textoVazio).toBeNull()
    expect(bloco.itens.length).toBeGreaterThan(0)
  })
})
