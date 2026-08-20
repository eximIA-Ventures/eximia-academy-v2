// ---------------------------------------------------------------------------
// §17 · O EIXO X: INTERVALO COMPLETO, EM RÓTULOS ALTERNADOS.
// ---------------------------------------------------------------------------
// ESCOLHA DO DONO (2026-08-20): "24 jun – 1 jul" em vez de "24 jun", mostrado a
// cada N semanas, sem sobreposição e sem rotação. O `N` é DERIVADO da largura
// disponível — não é um número escolhido a dedo — e as semanas sem rótulo
// continuam marcadas no eixo.
//
// ═══ POR QUE ESTE ARQUIVO NÃO MEDE CAIXAS DE TEXTO ═════════════════════════
// jsdom não tem motor de layout: `getBoundingClientRect()` devolve 0×0 para todo
// elemento, e `SVGTextElement.getComputedTextLength()` nem existe. Um teste que
// afirmasse "a caixa de um rótulo não intersecta a do vizinho" passaria com o
// defeito intacto — duas caixas de área zero nunca se cruzam. O último teste
// deste arquivo prova que é esse o caso, medindo as caixas e exigindo que elas
// sejam degeneradas.
//
// O que este arquivo mede é a ARITMÉTICA da geometria, com os números lidos do
// DOM renderizado (posição e corpo da fonte saem dos atributos, nada de literal
// reescrito aqui), e a largura do glifo pela MESMA estimativa que o componente
// usa — importada dele, nunca copiada. A prova de tinta contra tinta é do
// trilho de screenshot, com Chromium.
//
// ═══ POR QUE O VEREDITO NÃO MUDA ENTRE 1100 E 1672 ═════════════════════════
// O `<svg>` tem viewBox fixo e `preserveAspectRatio="none"`: quando a coluna
// mede menos, TUDO dentro dela encolhe pelo mesmo fator — o rótulo e a fatia da
// semana juntos. Então "cabe" é invariante de escala, e derivar o passo em
// unidades do viewBox É derivar da largura disponível. Isto não é uma desculpa
// para não medir: o teste percorre TODA largura de janela de 1100 a 1672 (o dono
// trabalha em janela estreita, e um defeito recente nascia por volta de 1175 e
// passou despercebido porque as medições começavam em 1180), converte para
// pixels por DOIS modelos de largura — um MEDIDO no Chromium sobre a moldura
// real, outro deliberadamente hostil — e exige folga positiva nos dois. E traz o
// CONTROLE POSITIVO junto: com o passo forçado em 1, a mesma conta acusa
// sobreposição em todas as 573 larguras.
// ---------------------------------------------------------------------------

import type { EixoY, EntradaLegenda, PontoSerie } from "@/lib/analytics/padroes-tendencias"
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import {
  EIXO_X,
  FIM_X,
  GraficoRitmo,
  LARGURA,
  inicioDoRotulo,
  larguraDoTexto,
  passoDosRotulos,
} from "../grafico-ritmo"

afterEach(cleanup)

const LEGENDA: readonly EntradaLegenda[] = [
  { id: "ativos", rotulo: "Alunos ativos", tom: "green" },
  { id: "sessoes", rotulo: "Sessões realizadas", tom: "amber" },
]
const EIXO_6: EixoY = { passo: 1, topo: 6, ticks: [0, 1, 2, 3, 4, 5, 6] }

/** Os rótulos REAIS do tenant: 8 semanas, com as duas formas de intervalo. */
const OITO_SEMANAS: readonly string[] = [
  "24 – 30 jun",
  "1 – 7 jul",
  "8 – 14 jul",
  "15 – 21 jul",
  "22 – 28 jul",
  "29 jul – 4 ago",
  "5 – 11 ago",
  "12 – 18 ago",
]

const DOZE_SEMANAS: readonly string[] = Array.from(
  { length: 12 },
  (_, i) => `${i + 1} – ${i + 7} jul`,
)

function pontosDe(rotulos: readonly string[]): PontoSerie[] {
  return rotulos.map((rotulo, i) => ({
    indice: i,
    rotulo,
    inicioISO: new Date(Date.UTC(2026, 5, 24) + i * 7 * 86_400_000).toISOString(),
    fimISO: new Date(Date.UTC(2026, 5, 24) + (i + 1) * 7 * 86_400_000).toISOString(),
    ativos: i % 2,
    sessoes: i % 2,
  }))
}

function desenhar(rotulos: readonly string[]) {
  return render(<GraficoRitmo pontos={pontosDe(rotulos)} eixo={EIXO_6} legenda={LEGENDA} />)
    .container
}

interface RotuloMedido {
  texto: string
  /** Centro do rótulo, em unidades do viewBox. */
  x: number
  /** Largura estimada, pela MESMA função que o componente usa para decidir. */
  largura: number
}

/** Só os rótulos com texto. As vagas vazias existem no DOM e não desenham nada. */
function rotulosVisiveis(container: HTMLElement): RotuloMedido[] {
  return [...container.querySelectorAll('[data-eixo="x"]')]
    .map((el) => ({
      texto: el.textContent ?? "",
      x: Number(el.getAttribute("x")),
      largura: larguraDoTexto(el.textContent ?? "", Number(el.getAttribute("font-size"))),
    }))
    .filter((r) => r.texto !== "")
}

// ===========================================================================
// A moldura real, em pixels — MEDIDA, não estimada
// ===========================================================================
/**
 * A caixa do gráfico em px, MEDIDA no Chromium sobre a moldura real da Academy
 * (`/gauntlet-preview/padroes-tendencias`, `getBoundingClientRect().width` do
 * `<svg>` de viewBox `0 0 432 190`), varrendo a janela de 1100 a 1672:
 *
 *     1100 · 1175 · 1280 · 1366 · 1440 · 1535  →  446,91px
 *     1536 · 1672                              →  431,95px
 *
 * O degrau em 1536 é o `2xl:pr-[56px]` do recuo da coluna: acima do breakpoint
 * a folga direita sobe de 16 para 56px, a coluna estreita 40px e o card do meio
 * perde 40 × 36,6/98 ≈ 14,9px — que é exatamente a diferença medida.
 *
 * Estes números descrevem a moldura do harness, que fixa a página em 1672px. No
 * app a coluna é FLUIDA e a caixa encolheria junto com a janela, então o segundo
 * modelo abaixo existe para não confiar só no que dá para medir aqui.
 */
function larguraMedidaPx(janela: number): number {
  return janela < 1536 ? 446.91 : 431.95
}

/**
 * O modelo HOSTIL: e se a coluna encolhesse na mesma proporção que a janela?
 *
 * A 1100px isso dá 284px de caixa — 36% menos que a medida real. Rodar a mesma
 * asserção sob os dois modelos é o que impede este arquivo de aprovar por causa
 * de uma escala escolhida a dedo: o veredito tem que ser o mesmo nos dois,
 * porque rótulo e fatia encolhem pelo MESMO fator.
 */
function larguraHostilPx(janela: number): number {
  return LARGURA * (janela / 1672)
}

/** A menor folga entre dois rótulos vizinhos, em unidades do viewBox. */
function menorFolga(rotulos: readonly RotuloMedido[]): number {
  let menor = Number.POSITIVE_INFINITY
  for (let i = 1; i < rotulos.length; i++) {
    const anterior = rotulos[i - 1]
    const atual = rotulos[i]
    if (!anterior || !atual) continue
    menor = Math.min(menor, atual.x - atual.largura / 2 - (anterior.x + anterior.largura / 2))
  }
  return menor
}

describe("§17 · o eixo x mostra o intervalo completo, alternado", () => {
  it("o rótulo é o INTERVALO COMPLETO, não a data de início", () => {
    const visiveis = desenhar(OITO_SEMANAS)
    const textos = rotulosVisiveis(visiveis).map((r) => r.texto)

    expect(textos.length).toBeGreaterThan(0)
    for (const t of textos) {
      // Cada rótulo tem que ser um dos intervalos originais, e NÃO a forma
      // encurtada que a versão de barra usava.
      expect(OITO_SEMANAS).toContain(t)
      expect(t).not.toBe(inicioDoRotulo(t))
    }
    // A semana MAIS RECENTE sempre tem rótulo: é a que o gestor procura
    // primeiro, e a âncora do passo é o fim da série exatamente por isso.
    expect(textos[textos.length - 1]).toBe(OITO_SEMANAS[OITO_SEMANAS.length - 1])
  })

  it("o passo é DERIVADO da largura, e muda quando a largura por semana muda", () => {
    const oito = rotulosVisiveis(desenhar(OITO_SEMANAS))
    const doze = rotulosVisiveis(desenhar(DOZE_SEMANAS))
    const duas = rotulosVisiveis(desenhar(OITO_SEMANAS.slice(0, 2)))

    const fatiaDe = (n: number) => (FIM_X - EIXO_X) / n
    // O número de rótulos bate com o passo que a REGRA calcula a partir das
    // mesmas medidas. Não há literal de passo em lugar nenhum desta asserção.
    const esperado = (rotulos: readonly string[]) => {
      const passo = passoDosRotulos(rotulos, fatiaDe(rotulos.length))
      return Math.floor((rotulos.length - 1) / passo) + 1
    }
    expect(oito).toHaveLength(esperado(OITO_SEMANAS))
    expect(doze).toHaveLength(esperado(DOZE_SEMANAS))
    expect(duas).toHaveLength(esperado(OITO_SEMANAS.slice(0, 2)))

    // VARIÂNCIA, com os MESMOS rótulos nos dois lados — comparar 8 semanas
    // curtas com 12 semanas longas mediria o comprimento do texto, não a
    // largura por semana. Aqui só a fatia muda: mais semanas, fatia menor,
    // passo maior. Se o passo fosse constante, os dois seriam iguais.
    const mesmosRotulos = OITO_SEMANAS
    expect(passoDosRotulos(mesmosRotulos, fatiaDe(8))).toBeLessThan(
      passoDosRotulos(mesmosRotulos, fatiaDe(24)),
    )
    // E com 2 semanas a fatia é larga o bastante para rotular todas.
    expect(duas).toHaveLength(2)
    // O texto também pesa, e na direção certa: rótulo mais largo, passo maior,
    // com a fatia idêntica nos dois lados.
    expect(passoDosRotulos(DOZE_SEMANAS, fatiaDe(12))).toBeLessThan(
      passoDosRotulos(
        DOZE_SEMANAS.map((r) => `${r} de 2026`),
        fatiaDe(12),
      ),
    )
  })

  it("TODA semana continua marcada no eixo, e cada uma tem UMA vaga de rótulo", () => {
    const container = desenhar(DOZE_SEMANAS)
    // Pular o rótulo não pode virar pular a semana.
    expect(container.querySelectorAll('[data-tick="x"]')).toHaveLength(DOZE_SEMANAS.length)
    // Uma vaga por semana; as vazias são a prova de que ninguém sumiu.
    expect(container.querySelectorAll('[data-eixo="x"]')).toHaveLength(DOZE_SEMANAS.length)
    expect(rotulosVisiveis(container).length).toBeLessThan(DOZE_SEMANAS.length)
  })

  it("nenhum rótulo é rotacionado, e nenhum ocupa duas linhas", () => {
    for (const rotulos of [OITO_SEMANAS, DOZE_SEMANAS]) {
      const container = desenhar(rotulos)
      for (const el of container.querySelectorAll('[data-eixo="x"]')) {
        expect(el.getAttribute("transform")).toBeNull()
        expect(el.querySelectorAll("tspan")).toHaveLength(0)
        expect(el.textContent ?? "").not.toContain("\n")
      }
    }
  })

  it("nenhum rótulo sobrepõe o vizinho em NENHUMA largura de 1100 a 1672", () => {
    for (const rotulos of [OITO_SEMANAS, DOZE_SEMANAS]) {
      const visiveis = rotulosVisiveis(desenhar(rotulos))
      const folga = menorFolga(visiveis)
      expect(visiveis.length).toBeGreaterThan(1)

      const sobrepostas: string[] = []
      for (const modelo of [larguraMedidaPx, larguraHostilPx]) {
        for (let janela = 1100; janela <= 1672; janela++) {
          const folgaPx = folga * (modelo(janela) / LARGURA)
          if (folgaPx <= 0) {
            sobrepostas.push(`${rotulos.length} semanas a ${janela}px: ${folgaPx.toFixed(2)}px`)
          }
        }
      }
      expect(sobrepostas).toEqual([])
      // As duas escalas são positivas e DIFERENTES entre si em toda a faixa,
      // então o laço acima não passou por a largura ter degenerado a zero nem
      // por os dois modelos serem o mesmo modelo com outro nome.
      expect(larguraHostilPx(1100)).toBeGreaterThan(0)
      expect(larguraHostilPx(1100)).toBeLessThan(larguraMedidaPx(1100))
      expect(larguraMedidaPx(1535)).toBeGreaterThan(larguraMedidaPx(1536))
    }
  })

  it("CONTROLE POSITIVO — com o passo forçado em 1, a mesma conta ACUSA sobreposição", () => {
    // Sem isto, o teste acima poderia estar aprovando qualquer coisa. Aqui a
    // rotulagem de TODAS as 8 semanas (o que o passo 1 faria) é medida pela
    // MESMA função, e a folga sai negativa em toda a faixa de largura.
    const fatia = (FIM_X - EIXO_X) / OITO_SEMANAS.length
    const corpo = Number(
      desenhar(OITO_SEMANAS).querySelector('[data-eixo="x"]')?.getAttribute("font-size"),
    )
    const todas: RotuloMedido[] = OITO_SEMANAS.map((texto, i) => ({
      texto,
      x: EIXO_X + (i + 0.5) * fatia,
      largura: larguraDoTexto(texto, corpo),
    }))
    const folga = menorFolga(todas)
    expect(folga).toBeLessThan(0)
    for (const janela of [1100, 1175, 1366, 1536, 1672]) {
      expect(folga * (larguraMedidaPx(janela) / LARGURA)).toBeLessThan(0)
      expect(folga * (larguraHostilPx(janela) / LARGURA)).toBeLessThan(0)
    }
    // E o passo que a regra escolhe para esta mesma configuração é maior que 1,
    // ou seja: a regra recusa exatamente o arranjo que o controle reprova.
    expect(passoDosRotulos(OITO_SEMANAS, fatia)).toBeGreaterThan(1)
  })

  it("nada sai da caixa, e o rótulo continua cobrindo a marca da própria semana", () => {
    for (const rotulos of [OITO_SEMANAS, DOZE_SEMANAS]) {
      const container = desenhar(rotulos)
      const fatia = (FIM_X - EIXO_X) / rotulos.length
      const fora: string[] = []
      for (const [i, el] of [...container.querySelectorAll('[data-eixo="x"]')].entries()) {
        const texto = el.textContent ?? ""
        if (texto === "") continue
        const x = Number(el.getAttribute("x"))
        const meia = larguraDoTexto(texto, Number(el.getAttribute("font-size"))) / 2
        if (x - meia < 0 || x + meia > LARGURA) fora.push(`${texto} vaza a caixa`)
        // O rótulo é, por construção, mais largo que uma fatia; o que ele NÃO
        // pode é deixar de cobrir o tique que descreve, senão aponta para a
        // semana errada.
        const tique = EIXO_X + (i + 0.5) * fatia
        if (tique < x - meia || tique > x + meia) fora.push(`${texto} não cobre o próprio tique`)
      }
      expect(fora).toEqual([])
    }
  })

  it("DEGRADAÇÃO — rótulo maior que a área inteira cai para a data de início", () => {
    // Não é o caso de hoje (o intervalo cabe com folga em toda largura desta
    // tela), e é justamente por isso que precisa de teste: sem ele o ramo seria
    // código que nunca roda, e `inicioDoRotulo` viraria função órfã.
    // Mais largo que a área de plotagem inteira: ~400 unidades de viewBox
    // divididas pela largura de um caractere dão o limite, e estes o cruzam.
    const enormes = Array.from(
      { length: 3 },
      (_, i) =>
        `semana de ${i + 1} de julho de 2026 – ${i + 7} de julho de 2026, contada em dias inteiros de fuso zero`,
    )
    expect(larguraDoTexto(enormes[0] ?? "", 8.6)).toBeGreaterThan(FIM_X - EIXO_X)
    const textos = rotulosVisiveis(desenhar(enormes)).map((r) => r.texto)
    expect(textos.length).toBeGreaterThan(0)
    for (const t of textos) {
      expect(enormes).not.toContain(t)
      expect(enormes.map(inicioDoRotulo)).toContain(t)
    }
  })

  it("CONTROLE — jsdom não tem layout, então medir caixa aqui aprovaria o defeito", () => {
    // Este teste existe para o arquivo não mentir sobre o que prova. Se um dia a
    // suíte ganhar motor de layout, ele passa a FALHAR e a asserção geométrica
    // de verdade deve migrar para cá.
    const el = desenhar(OITO_SEMANAS).querySelector('[data-eixo="x"]')
    const caixa = el?.getBoundingClientRect()
    expect(caixa?.width ?? 0).toBe(0)
    expect(caixa?.height ?? 0).toBe(0)
  })
})
