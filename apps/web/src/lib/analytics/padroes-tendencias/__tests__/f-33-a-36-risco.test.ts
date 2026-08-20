import { describe, expect, it } from "vitest"
import { fonteDaEntrada } from "../entrada"
import { computePadroesTendencias, montarBasePadroes } from "../index"
import type { IdCategoriaRisco } from "../index"
import { DIAS_REGULARES, PONTE_SEM_PAUSA, cenario } from "./cenario"

/**
 * F-33 · F-34 · F-35 · F-36 — as quatro categorias da §21.
 *
 * No mesmo arquivo pelo mesmo motivo de F-26..F-29: a propriedade a provar é
 * "conta AQUI e zero nas outras três", e isso não é verificável uma categoria
 * por vez.
 *
 * O par de variância de cada uma é o MESMO eixo do mundo real: dias desde a
 * última atividade. Mover o carimbo move a pessoa de categoria, e a fronteira
 * exata (14 dias) é medida, não presumida.
 */

/** Uma pessoa ativa e em dia, para o bloco nunca cair em estado vazio. */
const ANCORA = { id: "ancora", sessoes: [...DIAS_REGULARES, ...PONTE_SEM_PAUSA] }

function categoriaDe(alvo: Parameters<typeof cenario>[0]["pessoas"][number]): IdCategoriaRisco {
  const com = computePadroesTendencias(cenario({ pessoas: [ANCORA, alvo] })).risco
  const sem = computePadroesTendencias(cenario({ pessoas: [ANCORA] })).risco
  expect(com.estado).toBe("ok")
  const ganhou = com.categorias.filter((c) => {
    const antes = sem.categorias.find((g) => g.id === c.id)?.pessoas ?? 0
    return c.pessoas - antes === 1
  })
  expect(ganhou, "o alvo não entrou em nenhuma das quatro categorias").toHaveLength(1)
  const id = ganhou[0]?.id
  if (id === undefined) throw new Error("categoria indefinida")
  return id
}

describe("F-33 a F-36 · as quatro categorias de risco", () => {
  it("F-33 INVARIÂNCIA — pessoa ativa e em dia conta em 'Sustentando'", () => {
    expect(categoriaDe({ id: "alvo", sessoes: [1, 3, 8] })).toBe("sustentando")
  })

  it("F-35 VARIÂNCIA — empurrar o último carimbo para 20 dias atrás move para 'Parados'", () => {
    expect(categoriaDe({ id: "alvo", sessoes: [20, 22] })).toBe("parados")
  })

  it("F-35 INVARIÂNCIA — a fronteira dos 14 dias é exata, não aproximada", () => {
    // 13 dias ainda não é parado; 16 já é. Se a fronteira escorregasse um dia, o
    // par abaixo denunciaria — é o que um limiar "±1 dia" nunca revelaria.
    expect(categoriaDe({ id: "alvo", sessoes: [13, 15] })).not.toBe("parados")
    expect(categoriaDe({ id: "alvo", sessoes: [16, 18] })).toBe("parados")
  })

  it("F-36 INVARIÂNCIA — pausa longa com retorno na janela conta em 'Retomando'", () => {
    // Retomar GANHA de parado: quem voltou é notícia melhor que o motivo pelo
    // qual tinha sumido.
    expect(categoriaDe({ id: "alvo", sessoes: [40, 2] })).toBe("retomando")
  })

  it("F-36 VARIÂNCIA — mover o retorno para fora da janela devolve a pessoa a 'Parados'", () => {
    expect(categoriaDe({ id: "alvo", sessoes: [60, 40] })).toBe("parados")
  })

  it("F-34 INVARIÂNCIA — 'Desacelerando' conta exatamente o estado 'perdendo-ritmo'", () => {
    // Asserção CRUZADA: a categoria da §21 e o estado da §4 são o mesmo conjunto
    // com dois rótulos, não duas contagens que por acaso batem.
    const pessoas = [
      ANCORA,
      { id: "atrasada", sessoes: [1, 2], matricula: { progresso: 1, cursoId: "curto" } },
      { id: "parada", sessoes: [30] },
    ]
    const entrada = cenario({ pessoas, cursos: [{ id: "curto", deadlineDays: 7 }] })
    const base = montarBasePadroes(fonteDaEntrada(entrada))
    let perdendoRitmo = 0
    for (const estado of base.visao.estadoPorAluno.values()) {
      if (estado === "perdendo-ritmo") perdendoRitmo++
    }
    const { risco } = computePadroesTendencias(entrada)
    const desacelerando = risco.categorias.find((c) => c.id === "desacelerando")?.pessoas ?? -1
    expect(desacelerando).toBe(perdendoRitmo)
  })

  it("INVARIÂNCIA — as 4 categorias existem sempre, na ordem da §21, com percentual", () => {
    const { risco } = computePadroesTendencias(
      cenario({ pessoas: [ANCORA, { id: "b", sessoes: [30] }] }),
    )
    expect(risco.categorias.map((c) => c.id)).toEqual([
      "sustentando",
      "desacelerando",
      "parados",
      "retomando",
    ])
    expect(risco.categorias.map((c) => c.rotulo)).toEqual([
      "Sustentando",
      "Desacelerando",
      "Parados",
      "Retomando",
    ])
    for (const c of risco.categorias) {
      expect(Number.isInteger(c.percentual)).toBe(true)
      expect(c.percentual).toBeGreaterThanOrEqual(0)
    }
  })

  it("INVARIÂNCIA — categoria com zero pessoas continua na tela", () => {
    // A §21 exige as quatro sempre. Sumir com a de zero faria o leitor concluir
    // que a categoria não se aplica, quando o fato é que ela vale zero.
    const { risco } = computePadroesTendencias(cenario({ pessoas: [ANCORA] }))
    expect(risco.categorias).toHaveLength(4)
    expect(risco.categorias.some((c) => c.pessoas === 0)).toBe(true)
  })
})
