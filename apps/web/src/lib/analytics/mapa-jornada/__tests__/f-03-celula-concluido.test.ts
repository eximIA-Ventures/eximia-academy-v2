import { describe, expect, it } from "vitest"
import { CAPS_A, CAP_ANCORA, type SaidaMapa, apenas, calcular, entradaUmCurso } from "./contrato"

/**
 * F-03 · Estado da célula — CONCLUÍDO (verde).
 *
 * INVARIÂNCIA 1: linha com `reached_last_slide_at` preenchido é verde mesmo que
 *   o capítulo tenha ganhado slides depois (curto-circuito de
 *   `view-progress.ts:46` — conteúdo novo não rebaixa quem já concluiu).
 * INVARIÂNCIA 2: evidência no módulo 6 ⇒ módulos 1..5 verdes, por piso
 *   cumulativo (decisão do Senhor, 2026-08-04, 287 pares / 104 pessoas).
 * VARIÂNCIA: apagar a evidência do módulo 6 derruba os módulos 1..5 de verde
 *   para cinza. Uma matriz que pinta verde por padrão não se move aqui.
 */
function celulas(r: SaidaMapa, alunoId: string): readonly string[] {
  return r.mapa.linhas.find((l) => l.alunoId === alunoId)?.celulas ?? []
}

describe("F-03 · célula concluída", () => {
  it("INVARIÂNCIA — `chegouAoFim` vence o total de slides de HOJE", async () => {
    const base = apenas(entradaUmCurso(), ["P01"])
    // O capítulo ganhou 4 slides depois da passagem: o percentual cru daria
    // 4/8 = 50%, mas o carimbo de chegada ao fim curto-circuita em 100%.
    const comSlidesNovos = {
      ...base,
      slides: [
        ...base.slides,
        ...[4, 5, 6, 7].map((i) => ({
          id: `${CAPS_A[0]}-extra${i}`,
          capituloId: CAPS_A[0] as string,
          ordem: i,
        })),
      ],
    }
    const r = await calcular(comSlidesNovos)
    expect(celulas(r, "P01")[0]).toBe("concluido")
  })

  it("INVARIÂNCIA — evidência no módulo 6 torna 1..5 verdes (piso cumulativo)", async () => {
    const r = await calcular(apenas(entradaUmCurso(), ["P01", "P05"]))
    const c = celulas(r, "P05")
    expect(c.slice(0, 5)).toEqual(["concluido", "concluido", "concluido", "concluido", "concluido"])
    expect(c[5], "o capítulo do TETO recebe só o piso, não a conclusão").toBe("em-andamento")
  })

  it("VARIÂNCIA — sem a evidência do módulo 6, os módulos 1..5 deixam de ser verdes", async () => {
    const base = apenas(entradaUmCurso(), ["P01", "P05"])
    const semEvidencia = {
      ...base,
      sessoes: (base.sessoes ?? []).filter((s) => s.capituloId !== CAP_ANCORA),
    }
    const r = await calcular(semEvidencia)
    expect(celulas(r, "P05").every((c) => c === "nao-iniciado")).toBe(true)
  })

  it("VARIÂNCIA — pessoa sem evidência alguma é CINZA, nunca verde", async () => {
    const r = await calcular(apenas(entradaUmCurso(), ["P01", "P09"]))
    expect(celulas(r, "P09")).not.toContain("concluido")
  })
})
