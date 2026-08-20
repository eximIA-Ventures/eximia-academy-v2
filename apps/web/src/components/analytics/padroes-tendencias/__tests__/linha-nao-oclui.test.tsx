// ---------------------------------------------------------------------------
// §17 · A LINHA DE VOLTA, COM A OCLUSÃO RESOLVIDA DENTRO DA LINGUAGEM DE LINHA.
// ---------------------------------------------------------------------------
// DECISÃO DO DONO (2026-08-20), literal: "volta para linha, só melhora o
// visual". A rodada anterior tinha trocado linha por barra agrupada para
// resolver a oclusão fotografada — a legenda promete duas séries e o desenho
// entregava uma, porque no tenant real `ativos` e `sessoes` coincidem em valor.
// A barra resolvia por construção e custava a instrução do dono.
//
// Voltar para linha SEM tratar a oclusão restaura o defeito original. Este
// arquivo é a prova de que ela foi tratada, e mede as QUATRO cues, uma a uma:
//
//   1. deslocamento óptico horizontal — os marcadores das duas séries não têm
//      como se tocar, porque o passo (8) é maior que o diâmetro (6,4);
//   2. exatamente UMA série é tracejada — onde os trajetos coincidem em y, a de
//      cima é feita de vãos e a de baixo aparece por eles;
//   3. formas de marcador distintas — losango contra círculo, legível em
//      monocromático;
//   4. espessuras distintas.
//
// ═══ ESTE ARQUIVO TAMBÉM CARREGA A INTENÇÃO DE TRÊS TRAVAS DA BARRA ═════════
// `grafico-ritmo-acabamento.test.tsx` foi escrito JUNTO com a barra e três das
// asserções dele medem `getAttribute("height")` de um retângulo ou exigem a data
// de INÍCIO no eixo x. Nenhuma das três sobrevive a um gráfico de linha, e
// nenhuma delas foi tocada (a rubrica é imutável durante o ciclo). O que estava
// certo naquelas travas — "valor pequeno não desaparece", "zero continua sendo
// nada" e "o desenho LÊ o eixo" — está reescrito aqui na linguagem da linha, e
// os três últimos testes deste arquivo são exatamente isso.
// ---------------------------------------------------------------------------

import type { EixoY, EntradaLegenda, PontoSerie } from "@/lib/analytics/padroes-tendencias"
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { BASE, GraficoRitmo, PASSO_DE_DESLOCAMENTO, RAIO_MARCA } from "../grafico-ritmo"

afterEach(cleanup)

const LEGENDA: readonly EntradaLegenda[] = [
  { id: "ativos", rotulo: "Alunos ativos", tom: "green" },
  { id: "sessoes", rotulo: "Sessões realizadas", tom: "amber" },
]

/** O eixo ancorado no recorte de 6 pessoas do tenant real. */
const EIXO_6: EixoY = { passo: 1, topo: 6, ticks: [0, 1, 2, 3, 4, 5, 6] }

function pontosDe(defs: readonly { rotulo: string; a: number; s: number }[]): PontoSerie[] {
  return defs.map((d, i) => ({
    indice: i,
    rotulo: d.rotulo,
    inicioISO: new Date(Date.UTC(2026, 5, 24) + i * 7 * 86_400_000).toISOString(),
    fimISO: new Date(Date.UTC(2026, 5, 24) + (i + 1) * 7 * 86_400_000).toISOString(),
    ativos: d.a,
    sessoes: d.s,
  }))
}

/**
 * A FORMA REAL DO TENANT: 8 semanas, valores 0/1, as duas séries coincidindo em
 * TODA semana. É o pior caso possível para oclusão — e é o caso que o dono
 * fotografou, não um caso de laboratório.
 */
const COINCIDENTES = pontosDe([
  { rotulo: "24 – 30 jun", a: 0, s: 0 },
  { rotulo: "1 – 7 jul", a: 1, s: 1 },
  { rotulo: "8 – 14 jul", a: 1, s: 1 },
  { rotulo: "15 – 21 jul", a: 0, s: 0 },
  { rotulo: "22 – 28 jul", a: 1, s: 1 },
  { rotulo: "29 jul – 4 ago", a: 0, s: 0 },
  { rotulo: "5 – 11 ago", a: 1, s: 1 },
  { rotulo: "12 – 18 ago", a: 1, s: 1 },
])

interface Marca {
  forma: string
  cx: number
  cy: number
}

/**
 * O centro de um marcador, seja ele círculo ou losango.
 *
 * O losango é um `<polygon>` cujo primeiro vértice é o de cima: `x` dele é o
 * centro horizontal e `y + raio` é o centro vertical. Ler o centro dos DOIS
 * jeitos é o que permite comparar as séries sem que o teste dependa da forma
 * escolhida por cada uma.
 */
function marcasDaSerie(raiz: HTMLElement, serie: string): Marca[] {
  return [...raiz.querySelectorAll(`[data-serie="${serie}"]`)].map((el) => {
    if (el.tagName.toLowerCase() === "circle") {
      return {
        forma: "circle",
        cx: Number(el.getAttribute("cx")),
        cy: Number(el.getAttribute("cy")),
      }
    }
    const [topo] = (el.getAttribute("points") ?? "").split(" ")
    const [x, y] = (topo ?? "0,0").split(",").map(Number)
    return { forma: el.tagName.toLowerCase(), cx: x ?? 0, cy: (y ?? 0) + RAIO_MARCA }
  })
}

function desenhar(pontos: readonly PontoSerie[], eixo: EixoY = EIXO_6) {
  return render(<GraficoRitmo pontos={pontos} eixo={eixo} legenda={LEGENDA} />).container
}

describe("§17 · nenhuma série some sob a outra quando os valores empatam", () => {
  it("os marcadores das duas séries NÃO TÊM COMO se sobrepor, mesmo com valores idênticos", () => {
    const container = desenhar(COINCIDENTES)
    const ativos = marcasDaSerie(container, "ativos")
    const sessoes = marcasDaSerie(container, "sessoes")

    expect(ativos).toHaveLength(COINCIDENTES.length)
    expect(sessoes).toHaveLength(COINCIDENTES.length)

    // Semana a semana: o y é IDÊNTICO (é o mesmo valor, e o desenho não
    // distorce grandeza), e a separação vem toda do x.
    const encostados = COINCIDENTES.map((p, i) => {
      const a = ativos[i]
      const s = sessoes[i]
      if (!a || !s) return `${p.rotulo}: marcador faltando`
      const distancia = Math.abs(a.cx - s.cx)
      return distancia >= 2 * RAIO_MARCA
        ? null
        : `${p.rotulo}: marcadores a ${distancia.toFixed(2)} de distância, diâmetro ${2 * RAIO_MARCA}`
    }).filter((m): m is string => m !== null)

    expect(encostados).toEqual([])
    // E a separação é a do CONTRATO, não um número que sobrou: o passo é maior
    // que o diâmetro, então a folga é estrutural.
    expect(PASSO_DE_DESLOCAMENTO).toBeGreaterThan(2 * RAIO_MARCA)
    // O valor continua exato: os dois marcadores da mesma semana ficam na MESMA
    // altura quando os valores empatam. Um deslocamento vertical mentiria aqui.
    for (const [i, p] of COINCIDENTES.entries()) {
      if (p.ativos !== p.sessoes) continue
      expect(ativos[i]?.cy).toBe(sessoes[i]?.cy)
    }
  })

  it("as duas séries têm formas de marcador distintas — legível sem cor", () => {
    const container = desenhar(COINCIDENTES)
    const formasAtivos = new Set(marcasDaSerie(container, "ativos").map((m) => m.forma))
    const formasSessoes = new Set(marcasDaSerie(container, "sessoes").map((m) => m.forma))

    expect(formasAtivos.size).toBe(1)
    expect(formasSessoes.size).toBe(1)
    expect([...formasAtivos][0]).not.toBe([...formasSessoes][0])
  })

  it("exatamente UMA das duas linhas é tracejada — a de cima não apaga a de baixo", () => {
    const container = desenhar(COINCIDENTES)
    const linhas = [...container.querySelectorAll("[data-linha]")]
    expect(linhas).toHaveLength(LEGENDA.length)

    const tracejadas = linhas.filter((l) => (l.getAttribute("stroke-dasharray") ?? "") !== "")
    // Duas contínuas: a de cima apaga a de baixo no trecho coincidente.
    // Duas tracejadas: os vãos podem coincidir e o trecho fica vazio.
    expect(tracejadas).toHaveLength(1)

    // E a tracejada é a ÚLTIMA no DOM, ou seja, a pintada por cima. Fosse a
    // contínua por cima, o tracejado embaixo não apareceria pelos vãos.
    expect(linhas[linhas.length - 1]?.getAttribute("stroke-dasharray") ?? "").not.toBe("")
  })

  it("as duas linhas têm traçados DIFERENTES mesmo com os valores idênticos", () => {
    const container = desenhar(COINCIDENTES)
    const trajetos = [...container.querySelectorAll("[data-linha]")].map((l) => l.getAttribute("d"))

    expect(trajetos).toHaveLength(2)
    expect(trajetos[0]).toBeTruthy()
    // Sem o deslocamento, os dois `d` seriam a MESMA string — que é a assinatura
    // exata da marca invisível: existe no DOM e não existe na tela.
    expect(trajetos[0]).not.toBe(trajetos[1])
  })

  it("as espessuras das duas séries diferem — a quarta cue, e ela é independente", () => {
    const container = desenhar(COINCIDENTES)
    const espessuras = [...container.querySelectorAll("[data-linha]")].map((l) =>
      Number(l.getAttribute("stroke-width")),
    )
    expect(new Set(espessuras).size).toBe(2)
  })

  it("o desenho nunca inverte a ordem real das séries", () => {
    // `ativos ≤ sessoes` é estrutural na camada de dados (F-46). O desenho não
    // pode desmentir isso: em SVG o y CRESCE para baixo, então a série menor tem
    // que ficar no mesmo y ou ABAIXO. Se o deslocamento fosse vertical, a série
    // de pessoas apareceria acima da de sessões quando as duas empatassem — o
    // desenho afirmaria "mais gente que sessão", que é impossível.
    const container = desenhar(
      pontosDe([
        { rotulo: "1 – 7 jul", a: 1, s: 1 },
        { rotulo: "8 – 14 jul", a: 1, s: 4 },
        { rotulo: "15 – 21 jul", a: 0, s: 0 },
        { rotulo: "22 – 28 jul", a: 2, s: 6 },
      ]),
    )
    const ativos = marcasDaSerie(container, "ativos")
    const sessoes = marcasDaSerie(container, "sessoes")
    const invertidas = ativos
      .map((a, i) => (a.cy >= (sessoes[i]?.cy ?? 0) ? null : `semana ${i}`))
      .filter((m): m is string => m !== null)
    expect(invertidas).toEqual([])
  })

  it("V-20 — nenhuma área preenchida sob as curvas, nenhum gradiente", () => {
    const container = desenhar(COINCIDENTES)
    for (const linha of container.querySelectorAll("[data-linha]")) {
      expect(linha.getAttribute("fill")).toBe("none")
    }
    expect(container.querySelectorAll("defs")).toHaveLength(0)
    expect(container.querySelectorAll("linearGradient, radialGradient")).toHaveLength(0)
    const comVeu = [...container.querySelectorAll("*")].filter((el) =>
      (el.getAttribute("fill") ?? "").includes("url("),
    )
    expect(comVeu).toEqual([])
  })
})

describe("§17 · o que as travas da barra mediam, medido na linguagem da linha", () => {
  it("valor pequeno não desaparece, e o zero continua sendo o zero", () => {
    // A trava original (`grafico-ritmo-acabamento.test.tsx`) media a ALTURA do
    // retângulo: 1 em 100 daria 1,5 unidade de barra e sumiria, então a barra
    // precisava de um piso artificial. A linha não tem esse problema — o
    // marcador tem tamanho próprio e é desenhado inteiro em qualquer valor. O
    // que precisa continuar verdade é a LEITURA: 1 fica acima da linha do zero,
    // e 0 fica EM CIMA dela, nunca acima.
    const eixoCem: EixoY = { passo: 20, topo: 100, ticks: [0, 20, 40, 60, 80, 100] }
    const container = desenhar(
      pontosDe([
        { rotulo: "1 – 7 jul", a: 1, s: 0 },
        { rotulo: "8 – 14 jul", a: 0, s: 0 },
      ]),
      eixoCem,
    )
    const ativos = marcasDaSerie(container, "ativos")
    const sessoes = marcasDaSerie(container, "sessoes")

    // O marcador do 1 existe e está desenhado por inteiro (não é um traço de 1,5
    // unidade), e mesmo assim NÃO se confunde com o zero: está acima da base.
    expect(ativos).toHaveLength(2)
    expect(ativos[0]?.cy).toBeLessThan(BASE)
    // Zero é zero: assenta exatamente na linha do zero, sem consolação e sem
    // cair para baixo dela (o que se leria como número negativo).
    expect(ativos[1]?.cy).toBe(BASE)
    expect(sessoes[0]?.cy).toBe(BASE)
  })

  it("VARIÂNCIA — o desenho LÊ o eixo: trocar o topo move os marcadores", () => {
    // A outra trava da barra media altura de retângulo. O que ela provava é o
    // que importa: um componente que ignorasse `eixo.topo` desenharia a MESMA
    // figura para qualquer régua e passaria em toda invariância de forma.
    const pontos = pontosDe([
      { rotulo: "1 – 7 jul", a: 3, s: 3 },
      { rotulo: "8 – 14 jul", a: 1, s: 1 },
    ])
    const comSeis = marcasDaSerie(desenhar(pontos, EIXO_6), "ativos")
    const eixoDuzentos: EixoY = { passo: 40, topo: 200, ticks: [0, 40, 80, 120, 160, 200] }
    const comDuzentos = marcasDaSerie(desenhar(pontos, eixoDuzentos), "ativos")

    expect(comSeis).toHaveLength(2)
    // Com o topo em 6, o valor 3 sobe até a metade; com o topo em 200, ele mal
    // sai da base. Em SVG "mais alto" é y MENOR.
    expect(comSeis[0]?.cy ?? 0).toBeLessThan(comDuzentos[0]?.cy ?? 0)
    // E dentro do mesmo eixo, valor maior desenha ponto mais alto — a função não
    // é constante em nenhum dos dois eixos.
    expect(comSeis[0]?.cy ?? 0).toBeLessThan(comSeis[1]?.cy ?? 0)
  })

  it("VARIÂNCIA — mover um valor move a marca daquela semana, e só a dela", () => {
    const antes = marcasDaSerie(desenhar(COINCIDENTES), "ativos")
    const alterados = COINCIDENTES.map((p, i) => (i === 2 ? { ...p, ativos: 4 } : p))
    const depois = marcasDaSerie(desenhar(alterados), "ativos")

    const diferentes = antes.filter((m, i) => m.cy !== depois[i]?.cy)
    expect(diferentes).toHaveLength(1)
  })
})
