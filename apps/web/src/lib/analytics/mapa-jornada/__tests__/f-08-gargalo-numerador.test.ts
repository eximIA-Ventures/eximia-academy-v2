import { describe, expect, it } from "vitest"
import { CAPS_A, CAP_ANCORA, calcular, darAtividadeHoje, entradaBase } from "./contrato"

/**
 * F-08 · Numerador do gargalo (§24: "paradas, atrasadas ou sem avanço").
 *
 * INVARIÂNCIA: pessoa `sustentando` no módulo 4 NÃO conta como gargalo do 4;
 *   pessoa parada no módulo 6 conta.
 * ANTI-VACUIDADE (obrigatória): a fixture produz pelo menos DOIS módulos com
 *   contagens DIFERENTES. Uma lista em que todo módulo dá o mesmo número é
 *   satisfeita por qualquer função — inclusive por uma constante.
 * VARIÂNCIA: atividade de hoje a uma das pessoas paradas no módulo 6 baixa o
 *   numerador do 6 em 1 e NÃO mexe nos outros módulos.
 */
describe("F-08 · numerador do gargalo", () => {
  it("ANTI-VACUIDADE — há pelo menos 2 módulos com contagens diferentes", async () => {
    const r = await calcular(entradaBase())
    const contagens = r.gargalos.linhas.map((g) => g.pessoas)
    expect(contagens.length).toBeGreaterThanOrEqual(2)
    expect(new Set(contagens).size, `contagens: ${contagens.join(" · ")}`).toBeGreaterThanOrEqual(2)
  })

  it("INVARIÂNCIA — quem sustenta não entra no gargalo do próprio módulo", async () => {
    const r = await calcular(entradaBase())
    // P07 e P08 estão no módulo 4, sustentando: o módulo 4 não pode aparecer.
    const modulo4 = r.gargalos.linhas.find((g) => g.moduloId === CAPS_A[3])
    expect(modulo4, "P07/P08 sustentam; o módulo 4 não é gargalo").toBeUndefined()
  })

  it("INVARIÂNCIA — quem está parado no módulo 6 entra", async () => {
    const r = await calcular(entradaBase())
    const ancora = r.gargalos.linhas.find((g) => g.moduloId === CAP_ANCORA)
    expect(ancora?.pessoas).toBe(4)
  })

  it("VARIÂNCIA — atividade de hoje baixa só o módulo mexido", async () => {
    const antes = await calcular(entradaBase())
    const depois = await calcular(darAtividadeHoje(entradaBase(), "P05", CAP_ANCORA))

    const ancoraAntes = antes.gargalos.linhas.find((g) => g.moduloId === CAP_ANCORA)?.pessoas ?? 0
    const ancoraDepois = depois.gargalos.linhas.find((g) => g.moduloId === CAP_ANCORA)?.pessoas ?? 0
    expect(ancoraDepois).toBe(ancoraAntes - 1)

    const outrosAntes = antes.gargalos.linhas
      .filter((g) => g.moduloId !== CAP_ANCORA)
      .map((g) => `${g.moduloId}=${g.pessoas}`)
    const outrosDepois = depois.gargalos.linhas
      .filter((g) => g.moduloId !== CAP_ANCORA)
      .map((g) => `${g.moduloId}=${g.pessoas}`)
    expect(outrosDepois).toEqual(outrosAntes)
  })
})
