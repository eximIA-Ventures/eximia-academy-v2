import { describe, expect, it } from "vitest"
import { apenas, calcular, entradaBase } from "./contrato"

/**
 * F-29b · O insight do gargalo não afirma um gargalo de NINGUÉM.
 *
 * ═══ O DEFEITO, MEDIDO ══════════════════════════════════════════════════════
 * Num recorte de três pessoas o card emitiu, literalmente:
 *
 *   "0 de 3 pessoas travam no mesmo ponto: "Executar as Ações Corretivas".
 *    É o maior gargalo da jornada."
 *
 * Zero pessoas travando, e a frase mesmo assim conclui que ali é o maior
 * gargalo. Não é erro de conta: é o achado A-3 mordendo pela ponta que ninguém
 * tinha olhado. A ÂNCORA vem de `travados.ts` e é escolhida sobre a população do
 * GARGALO (parados **ou** atrasados); a frase conta a população de TRAVADOS (só
 * quem sumiu há mais de 14 dias). As duas são diferentes de propósito — e a
 * interseção pode ser VAZIA. Basta que a concentração do módulo seja feita de
 * gente atrasada-mas-ativa: há âncora, e não há um único travado nela.
 *
 * Emitir "0 de N" é pior que calar. O gestor lê uma afirmação sobre um problema
 * que não existe, no card de maior destaque da aba, e o custo é a confiança em
 * tudo que está em volta — o padrão dos instrumentos mentirosos desta casa: o
 * instrumento responde com precisão a pergunta que não é a pergunta.
 *
 * INVARIÂNCIA: com âncora presente e nenhum travado nela, o item não sai.
 * VARIÂNCIA: pôr UMA pessoa travada no mesmo módulo faz o item voltar. Sem este
 *   par, `montarInsights` poderia devolver lista vazia sempre e passar — a
 *   função constante satisfaz toda invariância.
 */

/**
 * P03 está no módulo âncora com atividade recente e contínua (atrasada, ativa,
 * logo NÃO travada); P07 e P08 estão em andamento no módulo 4. Resultado: a
 * âncora existe, porque P03 concentra 1 de 3 no módulo 6 (33% ≥ 20%), e a
 * contagem de travados nela é ZERO.
 */
const ANCORA_SEM_TRAVADOS = ["P03", "P07", "P08"]

/** O mesmo recorte mais P05, que tem evidência no âncora há 90 dias. */
const ANCORA_COM_UM_TRAVADO = ["P03", "P05", "P07", "P08"]

const contagemDaFrase = (texto: string | undefined): number | null => {
  const m = /(\d+) de \d+/.exec(texto ?? "")
  return m?.[1] === undefined ? null : Number(m[1])
}

describe("F-29b · gargalo de ninguém não é gargalo", () => {
  it("INVARIÂNCIA — com âncora e zero travados, o item NÃO é emitido", async () => {
    const r = await calcular(apenas(entradaBase(), ANCORA_SEM_TRAVADOS))

    // ═══ CONTROLE POSITIVO, ancorado no defeito ═══════════════════════════
    // Sem âncora o item nem nasceria, e este teste ficaria verde numa tela em
    // que a guarda nunca rodou. As duas linhas abaixo provam que o caminho
    // exercitado é o do defeito: há âncora E não há travado nenhum.
    expect(r.travados.presente, "sem âncora o teste seria vácuo").toBe(true)
    expect(
      r.distribuicao.tiles.find((t) => t.id === "travados")?.valor,
      "com travados > 0 o teste mediria outra coisa",
    ).toBe(0)

    const frase = r.insights.itens.find((i) => i.id === "gargalo")
    expect(frase?.texto, "o card afirmou um gargalo de zero pessoa").toBeUndefined()

    // O bloco não emudece por causa da guarda: a dispersão continua lá.
    expect(r.insights.estado).toBe("ok")
    expect(r.insights.itens.map((i) => i.id)).toEqual(["em-andamento"])
  })

  it("VARIÂNCIA — uma pessoa travada no mesmo módulo faz o item VOLTAR", async () => {
    const r = await calcular(apenas(entradaBase(), ANCORA_COM_UM_TRAVADO))

    expect(r.travados.presente).toBe(true)
    const frase = r.insights.itens.find((i) => i.id === "gargalo")
    expect(frase, "a guarda engoliu um gargalo real").toBeDefined()
    expect(contagemDaFrase(frase?.texto) ?? 0).toBeGreaterThan(0)
  })
})
