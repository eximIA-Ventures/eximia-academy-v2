import { describe, expect, it } from "vitest"
import {
  CAPS_A,
  TITULOS_A,
  calcular,
  despublicar,
  embaralharCapitulos,
  entradaBase,
  entradaUmCurso,
  trocarOrdem,
} from "./contrato"

/**
 * F-02 · Colunas = módulos, na ordem, numerados 1-based.
 *
 * INVARIÂNCIA: embaralhar a ordem de CHEGADA das linhas de `chapters` não muda
 *   a sequência de colunas; o capítulo de `order:0` tem rótulo `1`.
 * VARIÂNCIA: trocar o `order` de dois capítulos troca posição E numerais;
 *   despublicar um capítulo remove a coluna e renumera as seguintes.
 */
describe("F-02 · colunas ordenadas e numeradas", () => {
  it("INVARIÂNCIA — `order:0` vira o rótulo 1, não 0", async () => {
    const r = await calcular(entradaUmCurso())
    expect(r.mapa.colunas.map((c) => c.numero)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(r.mapa.colunas[0]?.titulo).toBe(TITULOS_A[0])
  })

  it("INVARIÂNCIA — a ordem de chegada do banco não muda a sequência", async () => {
    const normal = await calcular(entradaBase())
    const embaralhado = await calcular(embaralharCapitulos(entradaBase()))
    expect(embaralhado.mapa.colunas.map((c) => c.id)).toEqual(normal.mapa.colunas.map((c) => c.id))
  })

  it("VARIÂNCIA — trocar o `order` de dois capítulos troca posição e numeral", async () => {
    const primeiro = CAPS_A[0] as string
    const terceiro = CAPS_A[2] as string
    const r = await calcular(trocarOrdem(entradaUmCurso(), primeiro, terceiro))

    expect(r.mapa.colunas[0]?.id).toBe(terceiro)
    expect(r.mapa.colunas[2]?.id).toBe(primeiro)
    expect(r.mapa.colunas.find((c) => c.id === primeiro)?.numero).toBe(3)
  })

  it("VARIÂNCIA — despublicar remove a coluna", async () => {
    const antes = await calcular(entradaUmCurso())
    const depois = await calcular(despublicar(entradaUmCurso(), CAPS_A[1] as string))

    expect(depois.mapa.colunas).toHaveLength(antes.mapa.colunas.length - 1)
    expect(depois.mapa.colunas.map((c) => c.id)).not.toContain(CAPS_A[1])
  })

  it("VAZIO — curso sem módulo publicado não renderiza matriz", async () => {
    let e = entradaUmCurso()
    for (const capituloId of CAPS_A) e = despublicar(e, capituloId)
    const r = await calcular(e)

    expect(r.mapa.estado).toBe("vazio")
    expect(r.mapa.motivoVazio).toBe("sem-base")
    expect(r.mapa.textoVazio).toBe("Este curso ainda não tem módulos publicados.")
  })
})
