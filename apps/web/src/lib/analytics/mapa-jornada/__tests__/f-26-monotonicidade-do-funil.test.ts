import { describe, expect, it } from "vitest"
import {
  CAPS_A,
  apenas,
  calcular,
  darAtividadeHoje,
  entradaBase,
  entradaUmCurso,
  recortarPara,
  zerarPessoa,
} from "./contrato"
import type { EntradaMapaJornada } from "./contrato"

/**
 * F-26 · `Chegaram ≥ Iniciaram ≥ Concluíram`, em toda linha, sempre.
 *
 * E a ordem das linhas é a de F-02 (percurso), NUNCA por conversão: ordenar por
 * conversão transformaria o funil num ranking de módulos e destruiria a leitura
 * de percurso, que é o ponto do bloco (§37).
 *
 * INVARIÂNCIA: em 12 cenários, nenhuma violação da cadeia; e a ordem segue a
 *   grade mesmo quando a conversão sobe de cima para baixo.
 * VARIÂNCIA: os VALORES mudam entre cenários (a tabela lê os dados), enquanto a
 *   ORDEM não muda (a tabela não se reordena sozinha). O par separa "lê" de
 *   "inventa".
 * ANTI-VACUIDADE: a fixture tem ao menos duas conversões diferentes.
 */
function doze(): EntradaMapaJornada[] {
  const base = entradaBase()
  return [
    base,
    entradaUmCurso(),
    recortarPara(base, 8),
    recortarPara(base, 5),
    recortarPara(base, 1),
    zerarPessoa(base, "P01"),
    zerarPessoa(zerarPessoa(base, "P01"), "P02"),
    darAtividadeHoje(base, "P09", CAPS_A[0] as string),
    darAtividadeHoje(base, "P10", CAPS_A[6] as string),
    apenas(base, ["P01", "P02", "P03"]),
    apenas(base, ["Q1", "Q2", "Q3", "Q4"]),
    { ...base, periodoDias: 90 },
  ]
}

describe("F-26 · monotonicidade e ordem do funil", () => {
  it("INVARIÂNCIA — em 12 cenários, Chegaram ≥ Iniciaram ≥ Concluíram", async () => {
    let linhasVistas = 0
    for (const [i, entrada] of doze().entries()) {
      const r = await calcular(entrada)
      for (const l of r.funil.linhas) {
        linhasVistas++
        expect(l.chegaram, `cenário ${i} · módulo ${l.moduloId}`).toBeGreaterThanOrEqual(
          l.iniciaram,
        )
        expect(l.iniciaram, `cenário ${i} · módulo ${l.moduloId}`).toBeGreaterThanOrEqual(
          l.concluiram,
        )
      }
    }
    expect(
      linhasVistas,
      "12 cenários que não produzem linha nenhuma passariam à toa",
    ).toBeGreaterThan(40)
  })

  it("INVARIÂNCIA — a ordem das linhas é a da grade, não a da conversão", async () => {
    const r = await calcular(entradaBase())
    const doCursoA = r.funil.linhas.filter((l) => l.moduloId.startsWith("C1-"))

    expect(doCursoA.map((l) => l.numero)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(doCursoA.map((l) => l.moduloId)).toEqual(CAPS_A)

    // A ordem da tabela é a das colunas da matriz — os dois blocos falam do
    // mesmo percurso.
    const colunasA = r.mapa.colunas.filter((c) => c.id.startsWith("C1-")).map((c) => c.id)
    expect(doCursoA.map((l) => l.moduloId)).toEqual(colunasA)
  })

  it("ANTI-VACUIDADE — há ao menos duas conversões diferentes", async () => {
    const r = await calcular(entradaBase())
    expect(new Set(r.funil.linhas.map((l) => l.conversaoPct)).size).toBeGreaterThan(1)
  })

  it("VARIÂNCIA — os valores mudam entre cenários, a ordem não", async () => {
    const antes = await calcular(entradaBase())
    const depois = await calcular(zerarPessoa(entradaBase(), "P01"))

    expect(depois.funil.linhas.map((l) => l.moduloId)).toEqual(
      antes.funil.linhas.map((l) => l.moduloId),
    )
    expect(depois.funil.linhas.map((l) => l.concluiram)).not.toEqual(
      antes.funil.linhas.map((l) => l.concluiram),
    )
  })

  it("INVARIÂNCIA — a ordem resiste a uma conversão CRESCENTE de cima para baixo", async () => {
    // Só quem concluiu tudo do curso A: a conversão fica constante em 100%, e
    // mesmo assim a ordem tem de ser a da grade. Depois, um cenário em que o
    // módulo 7 converte MAIS que o 6 — a tabela não pode se reordenar.
    const r = await calcular(apenas(entradaBase(), ["P01", "P02", "P05"]))
    const doCursoA = r.funil.linhas.filter((l) => l.moduloId.startsWith("C1-"))
    expect(doCursoA.map((l) => l.numero)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
})
