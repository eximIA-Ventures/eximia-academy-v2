// ---------------------------------------------------------------------------
// D3 — O RODAPÉ ABSOLUTO NÃO INVADE O MIOLO DO CARD, EM ESTADO NENHUM.
// ---------------------------------------------------------------------------
// DEFEITO MEDIDO (2026-08-19, captura ampliada do dono, `?fonte=motor`, janela
// estreita): no card "O que mudou" em ESTADO VAZIO, o link "Ver detalhes ›"
// renderizava na mesma faixa horizontal da frase "…para identificar uma
// tendência.", encostado nela. Medido no navegador com tinta real (não com a
// caixa do elemento): 6,45px de sobreposição em x por 3,62px em y a 1366px.
// E o card não acompanhava a altura do irmão: 184px no "Placar da jornada"
// contra 154px em "O que mudou", 30px de base fora de sincronia — em TODA
// largura medida, inclusive 1512 e 1672.
//
// SÃO DUAS CAUSAS, e uma sem a outra não fecha o defeito:
//
//   1. `LinkRodape` é `position: absolute` dentro de uma caixa de ALTURA ZERO.
//      Altura zero não empurra nada: o conteúdo em fluxo desce livremente até
//      por baixo do link. Enquanto o card está cheio, o conteúdo por acaso
//      termina antes da faixa e o defeito não aparece — é o pior tipo de
//      ausência de defeito, a que depende do dado.
//   2. os dois cards da linha 1 traziam `h-full` (`height: 100%`) dentro de um
//      contêiner `min-h-[185px]`. `align-self: stretch` SÓ se aplica quando a
//      medida cruzada é `auto` (CSS Flexbox §7.4); com `height` declarado, o
//      stretch não roda, e `100%` contra um pai de altura indefinida resolve
//      como `auto` — ou seja, altura de conteúdo. O `h-full` que parecia
//      garantir a altura era exatamente o que a impedia.
//
// ═══ POR QUE ESTE ARQUIVO NÃO MEDE CAIXAS ═════════════════════════════════
// O ambiente desta suíte é jsdom, que NÃO tem motor de layout:
// `getBoundingClientRect()` devolve 0×0 para todo elemento. Um teste que
// afirmasse "a caixa do link não intersecta a caixa do texto" passaria aqui com
// o defeito intacto — duas caixas de área zero nunca se cruzam. Seria um gate
// cujo PASS é a própria falha, e o segundo teste deste arquivo prova que é esse
// o caso, medindo as caixas e exigindo que elas sejam degeneradas.
//
// O que este arquivo mede é a ARITMÉTICA que produz a geometria, com os números
// reais lidos do DOM renderizado (nada de literal reescrito aqui):
//
//     reserva em fluxo do miolo  ≥  bottom da faixa + altura da faixa
//
// Essa é a condição necessária E suficiente para o texto não alcançar a faixa,
// dada a ancoragem do rodapé. A prova geométrica de verdade — tinta contra
// tinta, com Chromium — vive em `scripts/medir-visao-geral.mjs`, que roda com
// layout real e traz o próprio controle positivo.
// ---------------------------------------------------------------------------

import type { VisaoGeralDados } from "@/lib/analytics/visao-geral/tipos"
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { VISAO_GERAL_COMPLETA } from "../fixture"
import { VisaoGeralTab } from "../visao-geral-tab"

afterEach(cleanup)

/** Os três estados que `estado-bloco.tsx` despacha, por bloco. */
type Situacao = "ok" | "vazio" | "erro"

/**
 * A tela com UM bloco forçado a uma situação. O resto vem da fixture, intacto:
 * o defeito é o cruzamento de "estado vazio" com "link de rodapé", e trocar a
 * tela inteira esconderia qual bloco falhou.
 */
function telaCom(bloco: keyof VisaoGeralDados, situacao: Situacao): HTMLElement {
  const base = VISAO_GERAL_COMPLETA as unknown as Record<string, unknown>
  const alvo = base[bloco] as Record<string, unknown>
  const dados = {
    ...base,
    [bloco]: {
      ...alvo,
      estado: situacao,
      ...(situacao === "vazio"
        ? {
            textoVazio:
              "Precisamos de pelo menos dois períodos de atividade para identificar uma tendência.",
          }
        : {}),
      ...(situacao === "erro" ? { erro: { codigo: "PGRST301", mensagem: "JWT expired" } } : {}),
    },
  } as unknown as VisaoGeralDados
  const { container } = render(<VisaoGeralTab data={dados} />)
  return container
}

/** Número de um estilo inline (`"36px"` → 36). Ausente ⇒ 0, que é o defeito. */
function px(valor: string): number {
  const n = Number.parseFloat(valor)
  return Number.isFinite(n) ? n : 0
}

interface FaixaMedida {
  titulo: string
  bottom: number
  altura: number
  reserva: number
}

/**
 * Toda faixa de rodapé absoluta da tela, com a reserva que o miolo do card dela
 * declara. Lê do DOM renderizado — nenhum número é reescrito no teste.
 */
function faixasDaTela(container: HTMLElement): FaixaMedida[] {
  const saida: FaixaMedida[] = []
  for (const faixa of container.querySelectorAll<HTMLElement>("[data-rodape-card]")) {
    const card = faixa.closest("section")
    const miolo = card?.querySelector<HTMLElement>("[data-miolo-card]") ?? null
    saida.push({
      titulo: card?.querySelector("h2")?.textContent?.trim() ?? "(sem título)",
      bottom: px(faixa.style.bottom),
      altura: px(faixa.style.height),
      reserva: miolo ? px(miolo.style.paddingBottom) : 0,
    })
  }
  return saida
}

describe("D3 · o rodapé absoluto não invade o miolo do card", () => {
  // O bloco do defeito fotografado, nos três estados. `vazio` primeiro porque é
  // o estado da captura: é nele que o card encolhe e o absoluto se ancora numa
  // base que subiu.
  for (const situacao of ["vazio", "erro", "ok"] as const) {
    it(`"O que mudou" reserva a faixa do rodapé no estado ${situacao}`, () => {
      const faixas = faixasDaTela(telaCom("mudancas", situacao))
      const alvo = faixas.find((f) => f.titulo.includes("mudou"))

      // A faixa TEM de existir e TEM de publicar a própria geometria: sem
      // `bottom` e `altura` legíveis, a desigualdade abaixo comparia 0 com 0 e
      // aprovaria qualquer coisa.
      expect(alvo, `nenhuma faixa de rodapé encontrada (estado ${situacao})`).toBeDefined()
      if (!alvo) return
      expect(alvo.altura).toBeGreaterThan(0)
      expect(alvo.bottom).toBeGreaterThan(0)

      expect(
        alvo.reserva,
        `"${alvo.titulo}" (${situacao}): o miolo reserva ${alvo.reserva}px, e a faixa do rodapé ocupa ${alvo.bottom + alvo.altura}px (bottom ${alvo.bottom} + altura ${alvo.altura}). O texto desce por baixo do link.`,
      ).toBeGreaterThanOrEqual(alvo.bottom + alvo.altura)
    })
  }

  it("TODA faixa de rodapé da tela reserva o próprio espaço, não só a do defeito", () => {
    // Um card corrigido e três esquecidos passariam no teste acima. A varredura
    // é o que impede a correção pontual de se passar por invariante.
    const faixas = faixasDaTela(telaCom("mudancas", "ok"))
    // A tela tem TRÊS cards com link de rodapé: "O que mudou", "Quem precisa da
    // minha atenção agora?" e "Sinais fora do padrão". Fixar o número impede que
    // um seletor quebrado transforme a varredura numa lista vazia — que passaria
    // por vacuidade, exatamente como este teste passava antes de exigir isto.
    expect(faixas.map((f) => f.titulo).sort()).toHaveLength(3)
    const mudos = faixas.filter((f) => f.bottom <= 0 || f.altura <= 0)
    expect(
      mudos.map((f) => `${f.titulo} não publica a própria faixa`),
      "faixa sem geometria legível compara 0 com 0 e aprova qualquer coisa",
    ).toEqual([])
    const devedores = faixas.filter((f) => f.reserva < f.bottom + f.altura)
    expect(
      devedores.map((f) => `${f.titulo}: reserva ${f.reserva} < faixa ${f.bottom + f.altura}`),
    ).toEqual([])
  })

  it("os dois cards da linha 1 esticam juntos — nenhum deles fixa a própria altura", () => {
    // A segunda causa. `h-full` é `height: 100%`, e medida cruzada declarada
    // DESLIGA o `align-self: stretch`: o card passa a valer o próprio conteúdo e
    // a base sai de sincronia com a do irmão. O contrato é explícito nos dois,
    // para não depender de o default do contêiner nunca mudar.
    const container = telaCom("mudancas", "vazio")
    const secoes = [...container.querySelectorAll<HTMLElement>("section")]
    const placar = secoes.find((s) => s.querySelector("h2")?.textContent?.includes("Placar"))
    const mudou = secoes.find((s) => s.querySelector("h2")?.textContent?.includes("mudou"))
    expect(placar).toBeDefined()
    expect(mudou).toBeDefined()
    for (const card of [placar, mudou]) {
      if (!card) continue
      const titulo = card.querySelector("h2")?.textContent?.trim() ?? "?"
      expect(card.style.alignSelf, `"${titulo}" não declara o esticamento`).toBe("stretch")
      expect(card.className, `"${titulo}" ainda fixa a própria altura com h-full`).not.toMatch(
        /(^|\s)h-full(\s|$)/,
      )
    }
  })

  it("CONTROLE — jsdom não tem layout, então medir caixa aqui aprovaria o defeito", () => {
    // Este teste existe para o arquivo não mentir sobre o que prova. Se um dia
    // a suíte ganhar motor de layout, ele passa a FALHAR e a asserção
    // geométrica de verdade deve migrar para cá.
    const container = telaCom("mudancas", "vazio")
    const faixa = container.querySelector<HTMLElement>("[data-rodape-card]")
    const caixa = faixa?.getBoundingClientRect()
    expect(caixa?.width ?? 0).toBe(0)
    expect(caixa?.height ?? 0).toBe(0)
  })
})
