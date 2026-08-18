import { describe, expect, it } from "vitest"
import { SERIE_SEMANAS_MAX, bucketizarSemanas, semanasDaSerie } from "../index"
import { AGORA_MS, DIA_MS, SEMANA_MS } from "./cenario"

/**
 * F-10 · Bucketização semanal UTC.
 *
 * INVARIÂNCIA: 30 dias produzem 8 baldes de exatamente 7 dias, sem
 *   sobreposição e sem furo, cobrindo [fim − 56d, fim). Semiaberto à direita:
 *   carimbo nenhum cai em dois baldes.
 * VARIÂNCIA: 7 dias produzem 2 baldes, 90 dias produzem 12 (teto ativo).
 *
 * DIVERGÊNCIA CONSCIENTE COM O MOCKUP: o PNG desenha 10 pontos sob o filtro de
 * 30 dias, e nenhuma regra da spec produz 10. Registrada, não resolvida aqui.
 */

describe("F-10 · baldes semanais", () => {
  it("INVARIÂNCIA — 30 dias dão 8 baldes contíguos de 7 dias", () => {
    const n = semanasDaSerie(30 * DIA_MS)
    expect(n).toBe(8)
    const baldes = bucketizarSemanas(AGORA_MS, n)
    expect(baldes).toHaveLength(8)
    for (const b of baldes) expect(b.fimMs - b.inicioMs).toBe(SEMANA_MS)
    for (let i = 1; i < baldes.length; i++) {
      expect(baldes[i]?.inicioMs).toBe(baldes[i - 1]?.fimMs)
    }
    expect(baldes[0]?.inicioMs).toBe(AGORA_MS - 56 * DIA_MS)
    expect(baldes[baldes.length - 1]?.fimMs).toBe(AGORA_MS)
    expect(baldes.map((b) => b.indice)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it("VARIÂNCIA — 7 e 90 dias mudam a contagem de baldes", () => {
    expect(semanasDaSerie(7 * DIA_MS)).toBe(2)
    expect(semanasDaSerie(90 * DIA_MS)).toBe(SERIE_SEMANAS_MAX)
    expect(bucketizarSemanas(AGORA_MS, semanasDaSerie(7 * DIA_MS))).toHaveLength(2)
  })

  it("INVARIÂNCIA — o teto de 12 impede 24 pontos ilegíveis em 90 dias", () => {
    expect(semanasDaSerie(90 * DIA_MS)).toBeLessThan(2 * 12)
  })
})
