import { describe, expect, it } from "vitest"
import { FAIXA_FOCO, MOLDURA_TEXTO, MOLDURA_TITULO, computePadroesTendencias } from "../index"
import { cenario, cenarioAtivosMais3 } from "./cenario"

/**
 * F-01 · Os três literais da moldura (§15 + rodapé de foco).
 *
 * INVARIÂNCIA: as três strings saem byte a byte iguais às constantes, inclusive
 *   num recorte vazio — literal de moldura não depende de dado.
 * VARIÂNCIA (anti-vacuidade): entre os MESMOS dois cenários, a saída do bloco
 *   §16 muda. Sem este par, uma função constante satisfaria a invariância.
 */

// 5 pessoas ativas agora, 2 delas também antes: Δ = +3, acima do limiar.
const CHEIO = cenarioAtivosMais3()
const VAZIO = cenario({ pessoas: [] })

describe("F-01 · literais da moldura", () => {
  it("INVARIÂNCIA — os 3 literais saem das constantes, com e sem dado", () => {
    for (const entrada of [CHEIO, VAZIO]) {
      const dados = computePadroesTendencias(entrada)
      expect(dados.moldura.titulo).toBe(MOLDURA_TITULO)
      expect(dados.moldura.texto).toBe(MOLDURA_TEXTO)
      expect(dados.faixaFoco).toBe(FAIXA_FOCO)
    }
  })

  it("INVARIÂNCIA — o texto da §15 não usa travessão (marcador banido na casa)", () => {
    expect(MOLDURA_TEXTO).not.toContain("—")
  })

  it("VARIÂNCIA — o mesmo par de cenários muda o bloco §16", () => {
    const cheio = computePadroesTendencias(CHEIO)
    const vazio = computePadroesTendencias(VAZIO)
    expect(cheio.mudancas.estado).not.toBe(vazio.mudancas.estado)
  })
})
