// ---------------------------------------------------------------------------
// Comentário de código NÃO é conteúdo — e este teste é o que prova isso.
// ---------------------------------------------------------------------------
// DEFEITO REAL, encontrado em 2026-08-18 no `mapa-jornada-tab.tsx`: quinze
// linhas iniciadas por `//` estavam entre `<ProvedorGaveta>` e a `<div>` raiz.
// Dentro de JSX, `//` não abre comentário — é TEXTO. O React imprimia o bloco
// inteiro ("// ═══ OS 23px QUE FECHAM A DOBRA…") no topo da aba do gestor.
//
// O QUE NÃO PEGOU, e é o motivo de este arquivo existir:
//   • `tsc --noEmit` saiu 0 — é JSX válido, só que renderizando texto;
//   • o formatador do biome saiu limpo — indentação estava consistente;
//   • os 1073 testes da suíte passaram, INCLUSIVE a ponte de render do Mapa,
//     que afirma presença de textos esperados mas nunca ausência de lixo;
//   • a foto do gauntlet mostraria — se alguém tivesse refotografado depois.
// Quem pegou foi `lint/suspicious/noCommentText`, uma regra que é fácil alguém
// silenciar por parecer cosmética. Este teste torna o defeito uma falha de
// COMPORTAMENTO, e não uma opinião de linter.
//
// A VARREDURA É POR SINTOMA, não pelo texto específico daquele bloco. Assertar
// a ausência da string "OS 23px" fixaria este defeito e deixaria o próximo
// comentário vazado passar — que é a diferença entre travar a causa e travar a
// anedota.
// ---------------------------------------------------------------------------

import { entradaMapaFixture } from "@/components/analytics/mapa-jornada/fixture"
import { MapaJornadaTab } from "@/components/analytics/mapa-jornada/mapa-jornada-tab"
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { computeMapaJornada } from "../index"

afterEach(cleanup)

function textoDaTela(): string {
  const { container } = render(<MapaJornadaTab dados={computeMapaJornada(entradaMapaFixture())} />)
  return container.textContent ?? ""
}

describe("nenhum comentário de código chega à tela", () => {
  it("CONTROLE POSITIVO — a varredura acusa o sintoma quando ele existe", () => {
    // Sem isto, os testes abaixo são satisfeitos por uma tela vazia. Aqui a
    // regra roda contra um texto que TEM o defeito, e precisa reprovar.
    const comDefeito = "// ═══ OS 23px QUE FECHAM A DOBRA (2026-08-18) ═══ Chegaram"
    expect(temMarcaDeComentario(comDefeito)).toBe(true)
    expect(temMarcaDeComentario("Chegaram 35 pessoas · 62% de regularidade")).toBe(false)
  })

  it("a aba renderizada não contém marca de comentário de código", () => {
    expect(temMarcaDeComentario(textoDaTela())).toBe(false)
  })

  it("a aba renderizada não contém as bordas de bloco `/*` nem `*/`", () => {
    const texto = textoDaTela()
    expect(texto).not.toContain("/*")
    expect(texto).not.toContain("*/")
  })
})

/**
 * O sintoma: `//` seguido de espaço ou de um filete de caixa.
 *
 * Não é `texto.includes("//")` puro porque uma URL legítima ("https://…")
 * carregaria `//` sem ser comentário — a regra tem que separar o defeito do
 * conteúdo válido, senão vira ruído e alguém a desliga.
 */
function temMarcaDeComentario(texto: string): boolean {
  return /(^|[^:])\/\/[\s═─-]/.test(texto)
}
