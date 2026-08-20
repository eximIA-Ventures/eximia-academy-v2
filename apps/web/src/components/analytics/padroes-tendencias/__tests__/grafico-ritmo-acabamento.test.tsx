import type { EixoY, EntradaLegenda, PontoSerie } from "@/lib/analytics/padroes-tendencias"
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { GraficoRitmo, inicioDoRotulo } from "../grafico-ritmo"

/**
 * §17 · travas de ACABAMENTO do desenho — escritas JUNTO com a correção.
 *
 * A prova da rodada é `grafico-ritmo.test.tsx` (reprovava, passa agora). Este
 * arquivo trava o que aquele não mede e o que, se regredir, volta a produzir um
 * gráfico bonito e ilegível: o rótulo de uma linha que não perde o mês, a
 * informação que MUDOU DE LUGAR em vez de sumir, o número impresso só quando
 * cabe, o valor pequeno que não desaparece e o zero que continua sendo nada.
 *
 * A última é a mais importante: prova que o desenho LÊ o eixo. Um componente que
 * ignorasse `eixo.topo` passaria em toda invariância de forma e desenharia a
 * mesma figura para qualquer régua.
 *
 * ═══ ESTADO DESTE ARQUIVO APÓS A REVERSÃO PARA LINHA (auditoria 2026-08-20) ══
 * O texto acima descreve o mundo da BARRA AGRUPADA, que o dono reverteu em
 * 2026-08-20 ("volta para linha, só melhora o visual"). Três asserções deste
 * arquivo codificavam esse mundo e foram APOSENTADAS, não deletadas — cada uma
 * traz, no lugar, o que media, por que saiu e qual teste herda a intenção.
 *
 * A aposentadoria foi julgada por MUTAÇÃO DIRIGIDA, uma intenção por vez: o
 * defeito correspondente foi injetado no componente e o herdeiro teve que
 * ACUSAR. Duas passaram (piso do valor pequeno + zero, e leitura do eixo). A
 * terceira NÃO passou inteira: a trava do rótulo tinha duas partes, e só a de
 * render envelheceu — o contrato de `inicioDoRotulo` continua VIVO, verde e sem
 * nenhum substituto, então ficou ativo. Ver a nota lá.
 *
 * O que este arquivo ainda mede de verdade: a informação do intervalo que MUDOU
 * DE LUGAR em vez de sumir, a alternativa textual acessível, o número impresso
 * só quando cabe, e a geometria contida no viewBox (V-40).
 */

const LEGENDA: readonly EntradaLegenda[] = [
  { id: "ativos", rotulo: "Alunos ativos", tom: "green" },
  { id: "sessoes", rotulo: "Sessões realizadas", tom: "amber" },
]

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

/** As duas formas que `rotuloSemana` produz: cruzando o mês e dentro do mês. */
const DUAS_FORMAS = pontosDe([
  { rotulo: "29 jun – 4 ago", a: 1, s: 2 },
  { rotulo: "2 – 8 jun", a: 0, s: 0 },
])

function alturasDaSerie(raiz: HTMLElement, serie: string): number[] {
  return [...raiz.querySelectorAll(`[data-serie="${serie}"]`)].map((el) =>
    Number(el.getAttribute("height")),
  )
}

describe("§17 · acabamento do desenho", () => {
  it("o rótulo de uma linha carrega o mês nas DUAS formas de intervalo", () => {
    // ═══ LEIA ANTES DE MEXER: ESTA TRAVA TEM DUAS PARTES, DE IDADES DIFERENTES.
    //
    // A auditoria de 2026-08-20 recebeu ordem de aposentar esta asserção inteira,
    // junto com as outras duas do arquivo, porque a reversão de barra para linha
    // as teria tornado obsoletas em bloco. Ao medir uma a uma, ela NÃO era uma
    // unidade:
    //
    //   • PARTE 1 (estas duas linhas) — o CONTRATO de `inicioDoRotulo`. Estava
    //     VERDE, cobre código VIVO, e não tem substituto. FICOU.
    //   • PARTE 2 (o render, comentado logo abaixo) — o eixo imprimindo a forma
    //     encurtada. Essa sim morreu com a decisão do dono. SAIU.
    //
    // Aposentar em bloco teria deixado um ramo de código vivo sem cobertura
    // nenhuma, e o buraco só apareceria quando ele quebrasse em produção.
    //
    // ─── POR QUE ESTAS DUAS LINHAS SÃO A ÚNICA COBERTURA DAQUELE CAMINHO ──────
    // `inicioDoRotulo` continua sendo código VIVO: é a degradação do eixo, o
    // ramo de `rotulosDoEixo` que age quando nem um intervalo inteiro cabe na
    // área de plotagem. E a recuperação do mês ("2 – 8 jun" → "2 jun", não "2"
    // solto) é o que separa essa função de um `split` no traço.
    //
    // MEDIDO por mutação dirigida (auditoria de 2026-08-20): matando a
    // recuperação do mês em `inicioDoRotulo`, os 1188 testes verdes de
    // `src/components/analytics` + `src/lib/analytics` passam TODOS. Nenhum
    // substituto cobre isto — nem `eixo-x-intervalo-alternado.test.tsx`, cujo
    // teste de DEGRADAÇÃO usa `inicioDoRotulo` como o próprio oráculo
    // (`expect(enormes.map(inicioDoRotulo)).toContain(t)`) e por isso não
    // consegue acusar a função quando ela é quem está errada. Some daí que os
    // rótulos daquele teste começam por LETRA, então tomam o retorno antecipado
    // e nunca exercitam o ramo do mês.
    //
    // Portanto: estas duas asserções FICAM ATIVAS. Aposentá-las junto com a
    // asserção de render abaixo abriria um buraco cego.
    expect(inicioDoRotulo("29 jun – 4 ago")).toBe("29 jun")
    expect(inicioDoRotulo("2 – 8 jun")).toBe("2 jun")

    // ─── APOSENTADA (2026-08-20) ────────────────────────────────────────────
    // O QUE MEDIA: que o eixo x imprimisse a forma ENCURTADA do rótulo — só a
    // data de início ("29 jun", "2 jun") em vez do intervalo completo.
    //
    // POR QUE FOI APOSENTADA: decisão do dono em 2026-08-20, revertendo a
    // versão de barras agrupadas — "volta para linha, só melhora o visual" —, e
    // junto com ela a escolha do eixo x: INTERVALO COMPLETO em rótulos
    // alternados. Esta asserção reprovava o componente por ele obedecer ao
    // dono, e é o formato encurtado que virou a DEGRADAÇÃO, não o padrão.
    //
    // QUEM HERDA A INTENÇÃO (o eixo imprime o rótulo certo):
    //   `eixo-x-intervalo-alternado.test.tsx`
    //     › "o rótulo é o INTERVALO COMPLETO, não a data de início"
    //     › "DEGRADAÇÃO — rótulo maior que a área inteira cai para a data de início"
    //
    // const { container } = render(
    //   <GraficoRitmo pontos={DUAS_FORMAS} eixo={EIXO_6} legenda={LEGENDA} />,
    // )
    // const rotulos = [...container.querySelectorAll('[data-eixo="x"]')].map((el) => el.textContent)
    // expect(rotulos).toEqual(["29 jun", "2 jun"])
  })

  it("a informação do intervalo completo MUDOU DE LUGAR, não sumiu", () => {
    const { container } = render(
      <GraficoRitmo pontos={DUAS_FORMAS} eixo={EIXO_6} legenda={LEGENDA} />,
    )
    const tooltips = [...container.querySelectorAll("svg title")].map((t) => t.textContent ?? "")
    expect(tooltips.some((t) => t.includes("29 jun – 4 ago"))).toBe(true)
    expect(container.querySelector("table")?.textContent).toContain("29 jun – 4 ago")
  })

  it("a alternativa textual está na árvore de acessibilidade, e o SVG sai dela", () => {
    const { container } = render(
      <GraficoRitmo pontos={DUAS_FORMAS} eixo={EIXO_6} legenda={LEGENDA} />,
    )
    // `aria-hidden` no desenho: o rótulo antigo não continha um algarismo, e
    // quem não enxerga ouvia o título e nada do conteúdo.
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true")
    const tabela = container.querySelector("table")
    expect(tabela?.className).toContain("sr-only")
    expect(tabela?.querySelector("caption")?.textContent).toBeTruthy()
    // Os números da tabela são os MESMOS do desenho: 1 e 2 na primeira semana.
    const primeira = tabela?.querySelectorAll("tbody tr")[0]
    expect([...(primeira?.querySelectorAll("td") ?? [])].map((c) => c.textContent)).toEqual([
      "1",
      "2",
    ])
  })

  it("o valor é impresso quando CABE e some quando não cabe — nunca sobreposto", () => {
    const oitoSemanas = pontosDe(
      Array.from({ length: 8 }, (_, i) => ({ rotulo: `${i + 1} – ${i + 7} jul`, a: 1, s: 2 })),
    )
    const { container: cabe } = render(
      <GraficoRitmo pontos={oitoSemanas} eixo={EIXO_6} legenda={LEGENDA} />,
    )
    expect(cabe.querySelectorAll("[data-valor]")).toHaveLength(16)

    // 12 semanas com valores de 4 algarismos: o rótulo é mais largo que o passo
    // entre as duas barras da semana, e aí ele não é desenhado.
    const dozeSemanas = pontosDe(
      Array.from({ length: 12 }, (_, i) => ({
        rotulo: `${i + 1} – ${i + 7} jul`,
        a: 900,
        s: 1200,
      })),
    )
    const eixoGrande: EixoY = { passo: 400, topo: 2000, ticks: [0, 400, 800, 1200, 1600, 2000] }
    const { container: naoCabe } = render(
      <GraficoRitmo pontos={dozeSemanas} eixo={eixoGrande} legenda={LEGENDA} />,
    )
    expect(naoCabe.querySelectorAll("[data-valor]")).toHaveLength(0)
    // E o número continua alcançável, sem hover e sem gaveta: está na tabela.
    expect(naoCabe.querySelector("table")?.textContent).toContain("1200")
  })

  // ─── APOSENTADA (2026-08-20) ──────────────────────────────────────────────
  // O QUE MEDIA: que o valor 1 num eixo de topo 100 não sumisse (piso artificial
  // de 2 unidades na ALTURA do retângulo) e que o valor 0 não ganhasse barra de
  // consolação.
  //
  // POR QUE FOI APOSENTADA: mede `getAttribute("height")` de `<rect>`, grandeza
  // que só existe em barra agrupada. O dono reverteu a barra em 2026-08-20 —
  // "volta para linha, só melhora o visual" — e uma linha não tem altura de
  // retângulo. Satisfazê-la desenhando hastes verticais do zero até cada ponto
  // (barra fina com linha por cima) passaria no gate e trairia a instrução.
  //
  // QUEM HERDA A INTENÇÃO, na linguagem da linha:
  //   `linha-nao-oclui.test.tsx`
  //     › "valor pequeno não desaparece, e o zero continua sendo o zero"
  //   Lá a leitura é a posição do marcador: o 1 fica ACIMA da base e o 0 assenta
  //   EXATAMENTE nela.
  //
  // PROVA DE QUE O HERDEIRO TEM DENTES (mutação dirigida, 2026-08-20): grudando
  // valores pequenos na base (`y > BASE - 3 ? BASE : y`) o herdeiro acusa; dando
  // piso de consolação ao zero (`Math.max(2, …)`) o herdeiro acusa também. São
  // duas mutações, uma por sub-intenção, porque uma só deixaria a outra sem prova.
  it.skip("valor pequeno não desaparece, e zero continua desenhando nada", () => {
    const eixoCem: EixoY = { passo: 20, topo: 100, ticks: [0, 20, 40, 60, 80, 100] }
    const pontos = pontosDe([
      { rotulo: "1 – 7 jul", a: 1, s: 0 },
      { rotulo: "8 – 14 jul", a: 0, s: 0 },
    ])
    const { container } = render(<GraficoRitmo pontos={pontos} eixo={eixoCem} legenda={LEGENDA} />)
    const ativos = alturasDaSerie(container, "ativos")
    const sessoes = alturasDaSerie(container, "sessoes")

    // 1 em 100 daria 1,5 unidade e sumiria: o piso mantém a barra visível.
    expect(ativos[0]).toBeGreaterThanOrEqual(2)
    // Zero é zero: a ausência não ganha barra de consolação.
    expect(ativos[1]).toBe(0)
    expect(sessoes[0]).toBe(0)
  })

  // ─── APOSENTADA (2026-08-20) ──────────────────────────────────────────────
  // O QUE MEDIA: a variância mais importante do arquivo — que o desenho LÊ
  // `eixo.topo`. Um componente que o ignorasse desenharia a MESMA figura para
  // qualquer régua e passaria em toda invariância de forma.
  //
  // POR QUE FOI APOSENTADA: mede `getAttribute("height")` de `<rect>`, e a
  // decisão do dono em 2026-08-20 ("volta para linha, só melhora o visual")
  // tirou o retângulo do desenho. A INTENÇÃO segue valendo integralmente; o que
  // morreu foi a grandeza usada para medi-la.
  //
  // QUEM HERDA A INTENÇÃO:
  //   `linha-nao-oclui.test.tsx`
  //     › "VARIÂNCIA — o desenho LÊ o eixo: trocar o topo move os marcadores"
  //     › "VARIÂNCIA — mover um valor move a marca daquela semana, e só a dela"
  //   Em SVG "mais alto" é y MENOR, então a leitura vira posição do marcador em
  //   vez de altura de barra.
  //
  // PROVA DE QUE O HERDEIRO TEM DENTES (mutação dirigida, 2026-08-20): trocando
  // `topo` por uma régua fixa em `yDoValor` (`/ 6` no lugar de `/ topo`), o
  // herdeiro acusa. Note que essa mutação preserva a ordenação dentro do mesmo
  // eixo — ou seja, ela sobrevive a qualquer teste que só compare valores entre
  // si, e só morre contra quem TROCA a régua. É por isso que a intenção precisa
  // de teste próprio e não sai de graça de outro.
  it.skip("VARIÂNCIA — o desenho LÊ o eixo: trocar o topo muda a altura das barras", () => {
    const pontos = pontosDe([
      { rotulo: "1 – 7 jul", a: 3, s: 3 },
      { rotulo: "8 – 14 jul", a: 1, s: 1 },
    ])
    const { container: comSeis } = render(
      <GraficoRitmo pontos={pontos} eixo={EIXO_6} legenda={LEGENDA} />,
    )
    const eixoDuzentos: EixoY = { passo: 40, topo: 200, ticks: [0, 40, 80, 120, 160, 200] }
    const { container: comDuzentos } = render(
      <GraficoRitmo pontos={pontos} eixo={eixoDuzentos} legenda={LEGENDA} />,
    )

    const seis = alturasDaSerie(comSeis, "ativos")
    const duzentos = alturasDaSerie(comDuzentos, "ativos")
    expect(seis).toHaveLength(2)
    expect(seis[0]).toBeGreaterThan(duzentos[0] ?? 0)
    // E dentro do mesmo eixo, valor maior desenha barra maior — a função não é
    // constante em nenhum dos dois eixos.
    expect(seis[0]).toBeGreaterThan(seis[1] ?? 0)
  })

  it("nada sai do viewBox — o corte silencioso da direita e de baixo (V-40)", () => {
    // A régua reprova texto ou marca cortado pela borda. Em jsdom não há layout,
    // então o que dá para provar é a GEOMETRIA declarada: nenhuma barra e nenhum
    // rótulo é ancorado fora da caixa. Com 12 semanas o aperto é máximo.
    const doze = pontosDe(
      Array.from({ length: 12 }, (_, i) => ({ rotulo: `${i + 1} – ${i + 7} jul`, a: 6, s: 6 })),
    )
    const { container } = render(<GraficoRitmo pontos={doze} eixo={EIXO_6} legenda={LEGENDA} />)
    const svg = container.querySelector("svg")
    expect(svg?.getAttribute("viewBox")).toBe("0 0 432 190")

    for (const r of svg?.querySelectorAll("rect") ?? []) {
      const x = Number(r.getAttribute("x"))
      const y = Number(r.getAttribute("y"))
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x + Number(r.getAttribute("width"))).toBeLessThanOrEqual(432)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y + Number(r.getAttribute("height"))).toBeLessThanOrEqual(190)
    }
    // O rótulo do eixo x é centrado no ponto: metade da largura estimada dele
    // (6 caracteres, o pior caso de "29 jun") tem que caber dos dois lados.
    for (const t of svg?.querySelectorAll('[data-eixo="x"]') ?? []) {
      const x = Number(t.getAttribute("x"))
      expect(x - 15).toBeGreaterThanOrEqual(0)
      expect(x + 15).toBeLessThanOrEqual(432)
      expect(Number(t.getAttribute("y"))).toBeLessThanOrEqual(186)
    }
  })
})
