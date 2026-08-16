// ---------------------------------------------------------------------------
// A trinca vive na URL — e a troca de aba não pode apagar o recorte.
// ---------------------------------------------------------------------------
// Os dois defeitos que estes testes existem para pegar:
//
//   1. `?tab=` desconhecido caindo no PAINEL ANTERIOR. Um parâmetro digitado
//      errado (ou um link velho) não pode decidir qual produto o gestor está
//      vendo. O default é a aba de ENTRADA, sempre.
//
//   2. A troca de aba levando o gestor de volta com OUTRO recorte. Um
//      `href="?tab=padroes"` cru substitui a query inteira: quem estava lendo
//      `?periodo=7&curso=X&escopo=hierarquia` volta para 30 dias, todos os
//      cursos e diretos — números diferentes, sem nada na tela dizendo isso.
//      É a §3.4 da spec ("os filtros devem permanecer selecionados") como
//      asserção, não como intenção.
//
// CONTROLE POSITIVO (o 3º teste): o mesmo cenário resolvido pela forma INGÊNUA
// (`?tab=padroes` literal) tem que FALHAR a asserção do 2º. Sem isso, o 2º teste
// passaria mesmo que `hrefDaAba` fosse uma função que devolve qualquer coisa
// contendo o `tab` certo.
// ---------------------------------------------------------------------------

import { hrefDaAba } from "@/components/analytics/visao-geral/nav-abas"
import { describe, expect, it } from "vitest"
import { TRINCA, abasComAtiva, lerAba } from "../abas"

describe("a trinca de abas vive na URL", () => {
  it("`?tab=` ausente, vazio ou desconhecido cai na aba de ENTRADA, nunca no painel anterior", () => {
    expect(lerAba(undefined)).toBe("visao-geral")
    expect(lerAba("")).toBe("visao-geral")
    expect(lerAba("uso")).toBe("visao-geral")
    expect(lerAba("LEGADO")).toBe("visao-geral")
    expect(lerAba("visao-geral")).toBe("visao-geral")
  })

  it("as três abas da trinca são reconhecidas, e `legado` é um destino separado", () => {
    expect(lerAba("padroes")).toBe("padroes")
    expect(lerAba("mapa")).toBe("mapa")
    expect(lerAba("legado")).toBe("legado")
  })

  it("exatamente uma aba fica ativa, e a caixa de sentença é a medida (C-03)", () => {
    for (const alvo of TRINCA) {
      const abas = abasComAtiva(alvo.id)
      expect(abas.filter((a) => a.ativa).map((a) => a.id)).toEqual([alvo.id])
    }
    expect(TRINCA.map((a) => a.rotulo)).toEqual([
      "Visão geral",
      "Padrões e tendências",
      "Mapa da jornada",
    ])
  })

  it("trocar de aba PRESERVA período, curso e escopo (§3.4)", () => {
    const query = "periodo=7&curso=8f14e45f-ceea-467a-9f4e-4d3c2b1a0000&escopo=hierarquia"
    const destino = hrefDaAba({ pathname: "/analytics", query }, "padroes")
    const lido = new URLSearchParams(destino.slice(destino.indexOf("?") + 1))

    expect(lido.get("tab")).toBe("padroes")
    expect(lido.get("periodo")).toBe("7")
    expect(lido.get("curso")).toBe("8f14e45f-ceea-467a-9f4e-4d3c2b1a0000")
    expect(lido.get("escopo")).toBe("hierarquia")
  })

  it("CONTROLE POSITIVO — o href ingênuo `?tab=X` perde os filtros, e é isso que o teste acima pega", () => {
    const ingenuo = "?tab=padroes"
    const lido = new URLSearchParams(ingenuo.slice(1))

    expect(lido.get("tab")).toBe("padroes")
    // O mesmo trio que o teste anterior exige ter sobrevivido some inteiro aqui.
    expect(lido.get("periodo")).toBeNull()
    expect(lido.get("curso")).toBeNull()
    expect(lido.get("escopo")).toBeNull()
  })

  it("um `tab` já presente na query é SUBSTITUÍDO, nunca duplicado", () => {
    const destino = hrefDaAba(
      { pathname: "/analytics", query: "tab=mapa&periodo=90" },
      "visao-geral",
    )
    const lido = new URLSearchParams(destino.slice(destino.indexOf("?") + 1))

    expect(lido.getAll("tab")).toEqual(["visao-geral"])
    expect(lido.get("periodo")).toBe("90")
  })
})
