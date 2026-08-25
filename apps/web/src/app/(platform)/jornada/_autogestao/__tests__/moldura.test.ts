// ---------------------------------------------------------------------------
// `lerPeriodoAutogestao` — o default do filtro de período da Autogestão.
// ---------------------------------------------------------------------------
// Espec. §4.2: o padrão do filtro é 30 dias. `recorte.ts` tem a MESMA leitura
// (`lerPeriodo`, não exportada) — este teste cobre a versão exportada em
// `moldura.tsx`, reescrita nas 3 abas a partir da mesma URL. Achado da revisão
// adversarial (Annie Duke, 2026-08-21): com a janela em 7 dias não há uma
// segunda semana para "frequência média" comparar (ver `rotuloFrequenciaMedia`
// em `montagem.ts`) — por isso o piso do filtro importa, não é só estética.
// ---------------------------------------------------------------------------
import { describe, expect, it } from "vitest"
import { lerPeriodoAutogestao } from "../moldura"

describe("lerPeriodoAutogestao — default do período", () => {
  it("sem `?periodo=` na URL, o default é 30 dias, nunca 7", () => {
    expect(lerPeriodoAutogestao(undefined)).toBe(30)
  })

  it("PAR VERMELHO: `?periodo=7` é honrado quando EXPLICITAMENTE pedido — o piso é só o default", () => {
    expect(lerPeriodoAutogestao("7")).toBe(7)
  })

  it("valor inválido/fora do enum cai no mesmo default de 30, nunca em 7", () => {
    expect(lerPeriodoAutogestao("999")).toBe(30)
    expect(lerPeriodoAutogestao("abc")).toBe(30)
  })

  it("90 é honrado", () => {
    expect(lerPeriodoAutogestao("90")).toBe(90)
  })
})
