import type { EixoY, EntradaLegenda, PontoSerie } from "@/lib/analytics/padroes-tendencias"
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { TINTA_FAIXA } from "../design-padroes"
import { GraficoRitmo } from "../grafico-ritmo"

/**
 * §17 · o DESENHO de "Evolução do ritmo" (rodada vermelha).
 *
 * O defeito medido na tela do dono: a legenda promete duas séries e o gráfico
 * mostra uma. A verde NÃO estava faltando — era desenhada primeiro, com os
 * MESMOS valores (com no máximo 1 sessão por pessoa por semana, `ativos` e
 * `sessoes` são numericamente idênticos), e a laranja era pintada por cima com
 * marcador `fill="#FFFFFF"` opaco nas MESMAS coordenadas. Legenda que promete o
 * que o gráfico não entrega é mentira visual.
 *
 * A asserção abaixo é DESIGN-AGNÓSTICA de propósito: ela não exige barra, nem
 * linha, nem marcador. Ela exige que nenhuma marca de uma série ocupe
 * exatamente a mesma geometria de outra. Um desenho em que a oclusão é
 * estruturalmente impossível passa; o desenho atual, não.
 */

const TINTA_ATIVOS = TINTA_FAIXA["2x-ou-mais"]
const TINTA_SESSOES = TINTA_FAIXA["1x"]

const LEGENDA: readonly EntradaLegenda[] = [
  { id: "ativos", rotulo: "Alunos ativos", tom: "green" },
  { id: "sessoes", rotulo: "Sessões realizadas", tom: "amber" },
]

/** A forma REAL do tenant: 8 semanas, valores 0/1, as duas séries coincidindo. */
const SEMANAS: readonly { rotulo: string; v: number }[] = [
  { rotulo: "24 – 30 jun", v: 0 },
  { rotulo: "1 – 7 jul", v: 1 },
  { rotulo: "8 – 14 jul", v: 1 },
  { rotulo: "15 – 21 jul", v: 0 },
  { rotulo: "22 – 28 jul", v: 1 },
  { rotulo: "29 jul – 4 ago", v: 0 },
  { rotulo: "5 – 11 ago", v: 1 },
  { rotulo: "12 – 18 ago", v: 1 },
]

const PONTOS: readonly PontoSerie[] = SEMANAS.map((s, i) => ({
  indice: i,
  rotulo: s.rotulo,
  inicioISO: new Date(Date.UTC(2026, 5, 24) + i * 7 * 86_400_000).toISOString(),
  fimISO: new Date(Date.UTC(2026, 5, 24) + (i + 1) * 7 * 86_400_000).toISOString(),
  ativos: s.v,
  sessoes: s.v,
}))

/** O eixo ancorado no recorte de 6 pessoas do tenant. */
const EIXO: EixoY = { passo: 1, topo: 6, ticks: [0, 1, 2, 3, 4, 5, 6] }

/**
 * `readonly string[]` e não o tipo inferido: `TINTA_FAIXA` é `as const`, então o
 * array nasceria com tipo literal `("#2E9E6B" | "#E07104")[]` e o `.includes(fill)`
 * abaixo — que compara com um atributo de DOM, sempre `string` — não compilava
 * (TS2345, duas ocorrências). É anotação de tipo: nenhuma asserção desta rubrica
 * foi tocada.
 */
const CORES_DE_SERIE: readonly string[] = [TINTA_ATIVOS, TINTA_SESSOES]

const ATRIBUTOS_DE_GEOMETRIA = [
  "points",
  "d",
  "x",
  "y",
  "width",
  "height",
  "cx",
  "cy",
  "r",
  "x1",
  "y1",
  "x2",
  "y2",
]

/** A assinatura GEOMÉTRICA de uma marca: onde ela está, não de que cor é. */
function assinatura(el: Element): string {
  return `${el.tagName}|${ATRIBUTOS_DE_GEOMETRIA.map((a) => el.getAttribute(a) ?? "").join(",")}`
}

/** Toda marca pintada com uma das duas cores de série, qualquer que seja a forma. */
function marcasDeSerie(raiz: HTMLElement): Element[] {
  return [...raiz.querySelectorAll("*")].filter((el) => {
    const fill = el.getAttribute("fill") ?? ""
    const stroke = el.getAttribute("stroke") ?? ""
    return CORES_DE_SERIE.includes(fill) || CORES_DE_SERIE.includes(stroke)
  })
}

function desenhar() {
  return render(<GraficoRitmo pontos={PONTOS} eixo={EIXO} legenda={LEGENDA} />)
}

describe("§17 · desenho da evolução do ritmo", () => {
  it("REPROVA HOJE — nenhuma marca de série ocupa a geometria de outra", () => {
    const { container } = desenhar()
    const marcas = marcasDeSerie(container)

    expect(marcas.length).toBeGreaterThan(0)

    const assinaturas = marcas.map(assinatura)
    const repetidas = assinaturas.filter((a, i) => assinaturas.indexOf(a) !== i)
    // Cada repetição é uma marca invisível: existe no DOM e não existe na tela.
    expect(repetidas).toEqual([])
  })

  it("REPROVA HOJE — as duas séries são identificáveis e têm uma marca por semana", () => {
    const { container } = desenhar()
    expect(container.querySelectorAll('[data-serie="ativos"]')).toHaveLength(PONTOS.length)
    expect(container.querySelectorAll('[data-serie="sessoes"]')).toHaveLength(PONTOS.length)
  })

  it("REPROVA HOJE — cada semana tem UM rótulo de eixo x, em uma linha só", () => {
    const { container } = desenhar()
    expect(container.querySelectorAll('[data-eixo="x"]')).toHaveLength(PONTOS.length)
  })

  it("REPROVA HOJE — há alternativa textual com os números, legível sem enxergar", () => {
    const { container } = desenhar()
    const tabela = container.querySelector("table")
    expect(tabela).not.toBeNull()
    const linhas = tabela?.querySelectorAll("tbody tr") ?? []
    expect(linhas).toHaveLength(PONTOS.length)
    expect(tabela?.textContent).toContain("24 – 30 jun")
    expect(tabela?.textContent).toContain("Alunos ativos")
    expect(tabela?.textContent).toContain("Sessões realizadas")
  })

  it("REPROVA HOJE — cada semana tem tooltip com o intervalo e os dois valores", () => {
    const { container } = desenhar()
    const titulos = [...container.querySelectorAll("svg title")].map((t) => t.textContent ?? "")
    const daSemana = titulos.filter((t) => t.includes("1 – 7 jul"))
    expect(daSemana).toHaveLength(1)
    expect(daSemana[0]).toContain("Alunos ativos: 1")
    expect(daSemana[0]).toContain("Sessões realizadas: 1")
  })

  it("VARIÂNCIA — mover um valor move a marca daquela semana, e só a dela", () => {
    const { container: antes } = desenhar()
    const alterados = PONTOS.map((p, i) => (i === 2 ? { ...p, ativos: 4 } : p))
    const { container: depois } = render(
      <GraficoRitmo pontos={alterados} eixo={EIXO} legenda={LEGENDA} />,
    )

    const antesAtivos = [...antes.querySelectorAll('[data-serie="ativos"]')].map(assinatura)
    const depoisAtivos = [...depois.querySelectorAll('[data-serie="ativos"]')].map(assinatura)

    expect(antesAtivos).toHaveLength(PONTOS.length)
    expect(depoisAtivos).toHaveLength(PONTOS.length)
    const diferentes = antesAtivos.filter((a, i) => a !== depoisAtivos[i])
    expect(diferentes).toHaveLength(1)
  })

  it("INVARIÂNCIA — série vazia não desenha eixo: gráfico vazio parece dado e é ausência", () => {
    const { container } = render(<GraficoRitmo pontos={[]} eixo={EIXO} legenda={LEGENDA} />)
    expect(container.querySelector("svg")).toBeNull()
    expect(container.textContent).toBe("")
  })
})
