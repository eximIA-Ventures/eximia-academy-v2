import { describe, expect, it } from "vitest"
import { calcular, entradaBase, zerarPessoa } from "./contrato"

/**
 * F-27 · O insight "concluiu a jornada" MORREU. Este arquivo agora prova isso.
 *
 * ═══ O QUE ESTE TESTE AFIRMAVA ANTES, E POR QUE MUDOU ═══════════════════════
 * O contrato original era: "o percentual da frase é IDÊNTICO ao do tile,
 * provado por identidade na mesma montagem". A frase emitida era
 * `${pct}% da equipe já concluiu a jornada.` e o teste travava a igualdade byte
 * a byte com o tile `Concluídos` (F-12).
 *
 * A identidade resolvia um defeito real (tile `72%` e frase `71%` sobre a mesma
 * população, medido em 2026-08-18) e criava outro, maior: o PRIMEIRO item de um
 * card chamado "Insights do mapa" passava a ser, por contrato escrito, o número
 * do tile que está ao lado dele na mesma tela. Redundância documentada é
 * AGRAVANTE, não isenção — um comentário dizendo "o MESMO percentual, por
 * identidade" transforma um defeito de produto em compromisso arquitetural que
 * o próximo mantenedor vai defender. Com 6 pessoas, "66%" são 4 pessoas que o
 * tile já mostrou como 4.
 *
 * Três lentes independentes julgaram a frase em 2026-08-19; o veredito foi
 * MATAR. O invariante que sobra, e que este arquivo passa a medir:
 *
 * INVARIÂNCIA: o número de concluintes continua publicado — e por UM caminho
 *   só, o tile. Nenhum insight o reimprime.
 * VARIÂNCIA: tirar 1 concluinte move o tile, o que prova que a fonte continua
 *   viva e que este teste não está aplaudindo um card morto.
 */
describe("F-27 · o eco do tile morreu, o tile permanece", () => {
  it("INVARIÂNCIA — nenhum insight reimprime o percentual de um tile", async () => {
    const r = await calcular(entradaBase())
    const pcts = new Set(r.distribuicao.tiles.map((t) => `${t.pct}%`))

    const ecos = r.insights.itens
      .flatMap((i) => [...i.texto.matchAll(/(\d+)%/g)].map((m) => m[0]))
      .filter((token) => pcts.has(token))

    expect(ecos, `insight reimprimindo tile: ${ecos.join(", ")}`).toHaveLength(0)
    expect(r.insights.itens.map((i) => i.id)).not.toContain("concluiu")
  })

  it("ANTI-VACUIDADE — o tile de concluídos existe, e não é 0 nem 100", async () => {
    const r = await calcular(entradaBase())
    const pct = r.distribuicao.tiles.find((t) => t.id === "concluidos")?.pct ?? 0
    expect(pct).toBeGreaterThan(0)
    expect(pct).toBeLessThan(100)
  })

  it("VARIÂNCIA — tirar 1 concluinte move o tile (a fonte segue viva)", async () => {
    const antes = await calcular(entradaBase())
    const depois = await calcular(zerarPessoa(entradaBase(), "P01"))

    const tileAntes = antes.distribuicao.tiles.find((t) => t.id === "concluidos")
    const tileDepois = depois.distribuicao.tiles.find((t) => t.id === "concluidos")

    expect(tileDepois?.valor).toBe((tileAntes?.valor ?? 0) - 1)
    expect(tileDepois?.pct).not.toBe(tileAntes?.pct)
  })
})
