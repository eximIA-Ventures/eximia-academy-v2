// USO: node scripts/medir-visao-geral.mjs [fonte] [larguras separadas por virgula]
//   node scripts/medir-visao-geral.mjs motor 1180,1280,1366,1440,1512
//   node scripts/medir-visao-geral.mjs fixture 1180-1512:4
//
// ---------------------------------------------------------------------------
// medir-visao-geral — o instrumento dos QUATRO defeitos de texto da aba
// "Visão geral", fotografados pelo dono numa janela estreita:
//
//   D1  rótulo de métrica quebrando NO MEIO DA PALAVRA ("Participaçã" / "o")
//   D2  "sem comparação" em duas linhas, desalinhando a base do tile
//   D3  "Ver detalhes ›" PINTANDO POR CIMA do texto do card "O que mudou"
//   D4  o H1 "Ativação da Jornada" em duas linhas
//
// POR QUE NÃO SERVE O `gauntlet-medir.mjs`: ele mede a aba "Mapa da jornada" —
// colisão entre rótulos de coluna de UMA tabela específica (a que tem "Pessoa"
// no 1º cabeçalho), corte vertical e estouro horizontal. Nenhum dos quatro
// defeitos acima cai nesses detectores:
//   • quebra no meio da palavra NÃO é corte, NÃO é estouro e NÃO é colisão: a
//     tinta fica perfeitamente dentro da caixa. Um detector de caixa é cego a
//     ela por construção;
//   • "Ver detalhes" por cima do parágrafo é colisão, mas entre um elemento
//     ABSOLUTO e um parágrafo — não entre dois `<th>` irmãos de uma tabela.
// O que ele TEM e este herda literalmente é a NEUTRALIZAÇÃO DO PIN
// (`w-[1672px]` → `width:100%`): sem ela toda medição responde como se a janela
// tivesse 1672px, que é exatamente a largura em que os quatro defeitos somem.
//
// COMO ELE MEDE — três instrumentos, um por natureza de defeito:
//
//   1. LINHAS DE TEXTO POR CARACTERE. `getClientRects()` sobre o nó devolve um
//      retângulo por linha renderizada, mas NÃO diz onde a string foi partida.
//      Para saber se a quebra caiu no meio da palavra é preciso o índice: um
//      `Range` por caractere, agrupado pelo `top` do retângulo, reconstrói a
//      string de cada linha. A quebra é MID-WORD quando o último caractere de
//      uma linha e o primeiro da seguinte são adjacentes na string original e
//      nenhum dos dois é espaço nem hífen. Contar `rects.length` sozinho não
//      distingue "Partici-/pação" de "sem / comparação": os dois dão 2.
//
//   2. SOBREPOSIÇÃO DE TINTA ENTRE ELEMENTOS. Percorre todos os nós de texto de
//      `#main-content`, toma os retângulos de LINHA de cada um (a tinta, não a
//      caixa) e acusa todo par cuja tinta se cruza em x E em y — descartando
//      pares em relação ancestral/descendente, que se sobrepõem por definição.
//      É assim que "Ver detalhes ›" por cima do parágrafo aparece como número.
//
//   3. GEOMETRIA DE APOIO. Largura da caixa e da tinta de cada rótulo (quanto
//      falta para caber), altura de cada tile (a base desalinhada de D2 é
//      diferença de altura entre irmãos) e o `scrollWidth` do H1.
//
// CONTROLE POSITIVO (MEDIR_CONTROLE=1) — ancorado nos defeitos REAIS, não numa
// avaria inventada: o modo repõe em runtime exatamente o estado de antes da
// correção (o `overflow-wrap: anywhere` do rótulo, o rodapé absoluto sem
// reserva, o H1 sem piso de largura) e EXIGE que os três detectores acusem. Se o
// controle sair limpo, uma medição verde não prova ausência de defeito — prova
// que o instrumento está cego.
//
// Saída: uma linha por largura no stdout, JSON completo com MEDIR_JSON=1, e
// exit 1 se qualquer largura tiver qualquer um dos quatro defeitos.
// ---------------------------------------------------------------------------

import { chromium } from "@playwright/test"

const FONTE = process.argv[2] ?? "motor"

/** `1180-1512:4` vira a faixa de 4 em 4; `1180,1440` vira a lista literal. */
function larguras(spec) {
  const faixa = /^(\d+)-(\d+):(\d+)$/.exec(spec)
  if (faixa) {
    const [, de, ate, passo] = faixa.map(Number)
    const saida = []
    for (let w = de; w <= ate; w += passo) saida.push(w)
    if (saida[saida.length - 1] !== ate) saida.push(ate)
    return saida
  }
  return spec.split(",").map((n) => Number.parseInt(n, 10))
}

const LARGURAS = larguras(process.argv[3] ?? "1180-1512:4")
const ALTURA = Number.parseInt(process.env.MEDIR_ALTURA ?? "941", 10)

async function servidorDePe() {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const res = await fetch("http://localhost:3000/", {
      signal: controller.signal,
      redirect: "manual",
    })
    clearTimeout(timer)
    return res.status > 0
  } catch {
    return false
  }
}

if (!(await servidorDePe())) {
  console.error("[medir-visao-geral] FALHOU: dev server não respondeu em http://localhost:3000")
  process.exit(1)
}

const navegador = await chromium.launch()
const resultados = []

try {
  for (const largura of LARGURAS) {
    const contexto = await navegador.newContext({
      viewport: { width: largura, height: ALTURA },
      deviceScaleFactor: 1,
      colorScheme: "light",
      reducedMotion: "reduce",
    })
    const pagina = await contexto.newPage()
    const resposta = await pagina.goto(
      `http://localhost:3000/gauntlet-preview/visao-geral?fonte=${FONTE}`,
      { waitUntil: "networkidle", timeout: 60_000 },
    )
    if (!resposta || resposta.status() !== 200) {
      console.error(`[medir-visao-geral] FALHOU: HTTP ${resposta?.status()}`)
      process.exit(1)
    }

    // NEUTRALIZAÇÃO DO PIN — ver cabeçalho.
    await pagina.evaluate(() => {
      for (const el of document.querySelectorAll('[class*="w-[1672px]"]')) {
        el.style.width = "100%"
      }
    })

    // ── CONTROLE POSITIVO ────────────────────────────────────────────────────
    // Repõe o estado exato de antes da correção, defeito por defeito.
    if (process.env.MEDIR_CONTROLE === "1") {
      await pagina.evaluate(() => {
        // D1 — o rótulo volta a poder quebrar em qualquer letra.
        for (const tile of document.querySelectorAll("[data-tile]")) {
          const rotulo = tile.querySelector("[data-rotulo-tile]") ?? tile.querySelector("span")
          if (rotulo instanceof HTMLElement) {
            rotulo.style.overflowWrap = "anywhere"
            rotulo.style.hyphens = "none"
          }
        }
        // D3 — o rodapé volta a ser absoluto sem reserva embaixo do conteúdo.
        for (const card of document.querySelectorAll("section")) {
          const rodape = card.querySelector("[data-rodape-card]")
          if (!(rodape instanceof HTMLElement)) continue
          card.style.paddingBottom = "0px"
          rodape.style.position = "absolute"
          rodape.style.left = "0px"
          rodape.style.right = "0px"
          rodape.style.bottom = "20px"
          rodape.style.marginTop = "0px"
        }
        // D4 — o bloco de título volta a poder encolher abaixo do próprio texto.
        const h1 = document.querySelector("h1")
        const bloco = h1?.parentElement
        if (bloco instanceof HTMLElement) {
          bloco.style.minWidth = "0px"
          bloco.style.flexShrink = "1"
        }
      })
      await pagina.waitForTimeout(150)
    }

    await pagina.evaluate(() => document.fonts.ready)
    await pagina.waitForTimeout(400)

    const medida = await pagina.evaluate(() => {
      const arred = (v) => Math.round(v * 100) / 100

      // ── 1. LINHAS DE TEXTO, CARACTERE A CARACTERE ───────────────────────────
      // Devolve as linhas RENDERIZADAS de um elemento com um único nó de texto,
      // com a substring de cada uma e o índice em que a linha começa. É o que
      // permite dizer ONDE a string foi partida.
      function linhasDe(el) {
        if (!el) return null
        const no = [...el.childNodes].find(
          (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim() !== "",
        )
        if (!no) return null
        const texto = no.textContent ?? ""
        const faixa = document.createRange()
        const linhas = []
        let topoAtual = null
        for (let i = 0; i < texto.length; i++) {
          faixa.setStart(no, i)
          faixa.setEnd(no, i + 1)
          const r = faixa.getBoundingClientRect()
          // Espaço no fim de linha tem retângulo degenerado; herda a linha atual.
          if (r.width === 0 && r.height === 0) {
            if (linhas.length) linhas[linhas.length - 1].fim = i + 1
            continue
          }
          const topo = Math.round(r.top)
          if (topoAtual === null || Math.abs(topo - topoAtual) > 2) {
            topoAtual = topo
            linhas.push({ inicio: i, fim: i + 1, topo, x0: r.left, x1: r.right })
          } else {
            const atual = linhas[linhas.length - 1]
            atual.fim = i + 1
            atual.x0 = Math.min(atual.x0, r.left)
            atual.x1 = Math.max(atual.x1, r.right)
          }
        }
        return {
          texto,
          linhas: linhas.map((l) => ({
            texto: texto.slice(l.inicio, l.fim),
            inicio: l.inicio,
            fim: l.fim,
            largura: arred(l.x1 - l.x0),
          })),
        }
      }

      /**
       * Quebra MID-WORD: a linha seguinte começa no caractere imediatamente
       * posterior ao fim da anterior, e nenhum dos dois é espaço ou hífen. Um
       * `-` no fim (hifenização de verdade) NÃO conta — a palavra continua
       * legível. Contar linhas não distingue os dois casos; o índice sim.
       */
      function quebrasNoMeioDaPalavra(medida) {
        if (!medida) return []
        const { texto, linhas } = medida
        const achados = []
        for (let i = 0; i < linhas.length - 1; i++) {
          const fim = linhas[i].fim
          const inicio = linhas[i + 1].inicio
          if (inicio !== fim) continue // houve espaço consumido entre as linhas
          const anterior = texto[fim - 1]
          const proximo = texto[inicio]
          if (/\s/.test(anterior) || /\s/.test(proximo)) continue
          if (anterior === "-" || anterior === "­" || anterior === "/") continue
          achados.push({
            antes: linhas[i].texto,
            depois: linhas[i + 1].texto,
            entre: `${anterior}|${proximo}`,
          })
        }
        return achados
      }

      // ── 2. TINTA SOBREPOSTA ENTRE ELEMENTOS DIFERENTES ──────────────────────
      // A caixa do elemento mente (o texto pinta onde a caixa não está e a caixa
      // existe onde não há tinta). Os retângulos de LINHA do nó de texto são a
      // tinta de verdade.
      function tintaDosTextos(raiz) {
        const saida = []
        const passeador = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT)
        let no = passeador.nextNode()
        while (no) {
          const conteudo = (no.textContent ?? "").trim()
          if (conteudo) {
            const faixa = document.createRange()
            faixa.selectNodeContents(no)
            const rects = [...faixa.getClientRects()].filter((r) => r.width > 0 && r.height > 0)
            if (rects.length) {
              saida.push({
                el: no.parentElement,
                texto: conteudo.slice(0, 60),
                rects: rects.map((r) => ({
                  x0: r.left,
                  x1: r.right,
                  // A caixa de linha é mais alta que a tinta; encolher 22% em
                  // cima e embaixo evita acusar duas linhas VIZINHAS (que se
                  // tocam pela entrelinha) como sobreposição.
                  y0: r.top + r.height * 0.22,
                  y1: r.bottom - r.height * 0.22,
                })),
              })
            }
          }
          no = passeador.nextNode()
        }
        return saida
      }

      const raiz = document.querySelector("#main-content") ?? document.body
      const textos = tintaDosTextos(raiz)
      const sobreposicoes = []
      for (let i = 0; i < textos.length; i++) {
        for (let j = i + 1; j < textos.length; j++) {
          const a = textos[i]
          const b = textos[j]
          if (!a.el || !b.el) continue
          if (a.el.contains(b.el) || b.el.contains(a.el)) continue
          let pior = { px: 0, dx: 0, dy: 0 }
          for (const ra of a.rects) {
            for (const rb of b.rects) {
              const dx = Math.min(ra.x1, rb.x1) - Math.max(ra.x0, rb.x0)
              const dy = Math.min(ra.y1, rb.y1) - Math.max(ra.y0, rb.y0)
              // A ÁREA é o que separa "tinta em cima de tinta" de "duas linhas
              // se roçando": um par cujo dx é 40px e dy 0,6 encosta; um cujo dx
              // é 40 e dy 8 pinta por cima. Guardar só `min(dx,dy)` colapsa os
              // dois no mesmo número e faz o pior caso parecer o melhor.
              const area = dx > 0.5 && dy > 0.5 ? dx * dy : 0
              if (area > pior.px * 1) pior = { px: arred(area), dx: arred(dx), dy: arred(dy) }
            }
          }
          if (pior.px > 0) {
            sobreposicoes.push({ a: a.texto, b: b.texto, ...pior })
          }
        }
      }

      // ── 3. TILES DO PLACAR ─────────────────────────────────────────────────
      const tiles = []
      for (const tile of document.querySelectorAll("[data-tile]")) {
        const caixaTile = tile.getBoundingClientRect()
        const rotuloEl = tile.querySelector("[data-rotulo-tile]") ?? tile.querySelector("span")
        const variacaoEl = tile.querySelector("[data-variacao-tile]")
        const mRotulo = linhasDe(rotuloEl)
        const mVariacao = linhasDe(variacaoEl)
        const caixaRotulo = rotuloEl?.getBoundingClientRect()
        tiles.push({
          id: tile.getAttribute("data-tile"),
          altura: arred(caixaTile.height),
          largura: arred(caixaTile.width),
          rotulo: mRotulo?.texto ?? null,
          rotuloLinhas: mRotulo?.linhas.length ?? 0,
          rotuloCaixa: caixaRotulo ? arred(caixaRotulo.width) : null,
          rotuloTinta: mRotulo ? arred(Math.max(...mRotulo.linhas.map((l) => l.largura), 0)) : null,
          rotuloMidWord: quebrasNoMeioDaPalavra(mRotulo),
          variacao: mVariacao?.texto ?? null,
          variacaoLinhas: mVariacao?.linhas.length ?? 0,
          variacaoMidWord: quebrasNoMeioDaPalavra(mVariacao),
        })
      }
      const alturas = tiles.map((t) => t.altura)
      const desalinhoTiles = alturas.length ? arred(Math.max(...alturas) - Math.min(...alturas)) : 0

      // ── 3b. LARGURA NATURAL DE CADA PEÇA DO TILE ───────────────────────────
      // O número honesto só sai de um CLONE FORA DO FLUXO: ler `scrollWidth` de
      // um elemento que já está dentro da grade devolve a largura da TRILHA (o
      // filho estica), não o que ele precisaria. É o erro que a rodada anterior
      // cometeu e que deixou "Sem acesso" 0,4px curto.
      function larguraNatural(el, comQuebra) {
        if (!el) return null
        const clone = el.cloneNode(true)
        clone.style.position = "absolute"
        clone.style.left = "-99999px"
        clone.style.top = "0"
        clone.style.width = "auto"
        clone.style.maxWidth = "none"
        clone.style.marginLeft = "0"
        if (!comQuebra) clone.style.whiteSpace = "nowrap"
        document.body.appendChild(clone)
        const w = arred(clone.getBoundingClientRect().width)
        clone.remove()
        return w
      }
      /** `width: min-content` — o PISO real da peça, o menor que ela cabe sem
       *  quebrar palavra. Para a coluna de texto do tile é `max(maior palavra do
       *  rótulo, maior parte indivisível do valor)`. É o número que decide até
       *  onde a trilha pode ceder sem produzir o defeito D1. */
      function larguraMinima(el) {
        if (!el) return null
        const clone = el.cloneNode(true)
        clone.style.position = "absolute"
        clone.style.left = "-99999px"
        clone.style.top = "0"
        clone.style.width = "min-content"
        clone.style.maxWidth = "none"
        clone.style.marginLeft = "0"
        document.body.appendChild(clone)
        const w = arred(clone.getBoundingClientRect().width)
        clone.remove()
        return w
      }
      const perfil = []
      for (const tile of document.querySelectorAll("[data-tile]")) {
        const rotuloEl = tile.querySelector("[data-rotulo-tile]")
        const variacaoEl = tile.querySelector("[data-variacao-tile]")
        // A linha do valor é a irmã seguinte do rótulo dentro da coluna de texto.
        const valorEl = rotuloEl?.nextElementSibling ?? null
        const colunaEl = rotuloEl?.parentElement ?? null
        perfil.push({
          id: tile.getAttribute("data-tile"),
          rotuloMax: larguraNatural(rotuloEl, false),
          rotuloMin: larguraMinima(rotuloEl),
          valorMax: larguraNatural(valorEl, false),
          valorMin: larguraMinima(valorEl),
          colunaMin: larguraMinima(colunaEl),
          colunaMax: larguraNatural(colunaEl, false),
          variacaoMax: larguraNatural(variacaoEl, false),
        })
      }

      // ── 4. H1 ──────────────────────────────────────────────────────────────
      const h1 = document.querySelector("#main-content h1")
      const mTitulo = linhasDe(h1)
      const caixaH1 = h1?.getBoundingClientRect()

      // ── 5. CARTÕES IRMÃOS: topo e base coincidentes ────────────────────────
      // Os cards de uma linha da grade são `section` filhas diretas do mesmo
      // contêiner flex. Topo/base fora de sincronia é o sintoma que D2 produz.
      const linhasDaGrade = []
      for (const container of raiz.querySelectorAll("div.flex")) {
        const cards = [...container.children].filter((c) => c.tagName === "SECTION")
        if (cards.length < 2) continue
        const caixas = cards.map((c) => c.getBoundingClientRect())
        linhasDaGrade.push({
          cards: cards.map(
            (c) =>
              `${(c.querySelector("h2")?.textContent ?? "?").slice(0, 22)}=${arred(c.getBoundingClientRect().height)}`,
          ),
          deltaTopo: arred(
            Math.max(...caixas.map((c) => c.top)) - Math.min(...caixas.map((c) => c.top)),
          ),
          deltaBase: arred(
            Math.max(...caixas.map((c) => c.bottom)) - Math.min(...caixas.map((c) => c.bottom)),
          ),
        })
      }

      // ── 6. CORTE / ESTOURO (herdado do gauntlet-medir) ─────────────────────
      const rolavel = document.querySelector("#main-content") ?? document.scrollingElement
      const overflowPx = Math.max(0, rolavel.scrollHeight - rolavel.clientHeight)
      const overflowX = Math.max(0, rolavel.scrollWidth - rolavel.clientWidth)
      const larguraJanela = document.documentElement.clientWidth
      const foraDaViewport = []
      for (const el of rolavel.querySelectorAll("*")) {
        const cx = el.getBoundingClientRect()
        if (cx.width === 0 && cx.height === 0) continue
        if (cx.right <= larguraJanela + 0.5) continue
        if ([...el.children].some((f) => f.getBoundingClientRect().right >= cx.right - 0.5))
          continue
        foraDaViewport.push({
          foraPx: arred(cx.right - larguraJanela),
          tag: el.tagName.toLowerCase(),
          texto: (el.textContent ?? "").trim().slice(0, 44),
        })
      }
      foraDaViewport.sort((a, b) => b.foraPx - a.foraPx)

      return {
        tiles,
        perfil,
        desalinhoTiles,
        titulo: {
          texto: mTitulo?.texto ?? null,
          linhas: mTitulo?.linhas.length ?? 0,
          caixa: caixaH1 ? arred(caixaH1.width) : null,
          tinta: mTitulo ? arred(Math.max(...mTitulo.linhas.map((l) => l.largura), 0)) : null,
          midWord: quebrasNoMeioDaPalavra(mTitulo),
        },
        sobreposicoes,
        linhasDaGrade,
        overflowPx,
        overflowX,
        foraDaViewport: foraDaViewport.slice(0, 6),
      }
    })

    resultados.push({ largura, ...medida })
    await contexto.close()
  }
} finally {
  await navegador.close()
}

function defeitosDe(r) {
  const d = []
  const midWord = r.tiles.flatMap((t) => [
    ...t.rotuloMidWord.map((q) => ({ onde: `rótulo "${t.rotulo}"`, ...q })),
    ...t.variacaoMidWord.map((q) => ({ onde: `variação "${t.variacao}"`, ...q })),
  ])
  if (r.titulo.midWord.length) midWord.push(...r.titulo.midWord.map((q) => ({ onde: "H1", ...q })))
  if (midWord.length) d.push({ id: "D1", detalhe: midWord })
  const variacaoMulti = r.tiles.filter((t) => t.variacaoLinhas > 1)
  if (variacaoMulti.length)
    d.push({
      id: "D2",
      detalhe: variacaoMulti.map((t) => `${t.id}: "${t.variacao}" em ${t.variacaoLinhas} linhas`),
    })
  if (r.sobreposicoes.length) d.push({ id: "D3", detalhe: r.sobreposicoes })
  if (r.titulo.linhas > 1)
    d.push({ id: "D4", detalhe: [`"${r.titulo.texto}" em ${r.titulo.linhas} linhas`] })
  return d
}

let reprovado = false
for (const r of resultados) {
  const d = defeitosDe(r)
  if (d.length) reprovado = true
  const rotulosMulti = r.tiles.filter((t) => t.rotuloLinhas > 1).map((t) => t.id)
  console.log(
    `visao-geral(${FONTE}) @ ${r.largura}px → defeitos=[${d.map((x) => x.id).join(",") || "nenhum"}] · h1=${r.titulo.linhas}L (tinta ${r.titulo.tinta} em caixa ${r.titulo.caixa}) · rótulos>1L=[${rotulosMulti.join(",") || "-"}] · desalinhoTiles=${r.desalinhoTiles}px · overflowY=${r.overflowPx} · overflowX=${r.overflowX} · fora=${r.foraDaViewport.length}`,
  )
  for (const item of d) {
    for (const linha of item.detalhe) {
      console.log(
        `    ${item.id}: ${typeof linha === "string" ? linha : JSON.stringify(linha, null, 0)}`,
      )
    }
  }
  for (const l of r.linhasDaGrade) {
    if (l.deltaTopo > 0.5 || l.deltaBase > 0.5)
      console.log(
        `    IRMÃOS [${l.cards.join(" | ")}] · Δtopo ${l.deltaTopo}px · Δbase ${l.deltaBase}px`,
      )
  }
  for (const f of r.foraDaViewport) {
    console.log(`    FORA DA VIEWPORT ${f.foraPx}px: <${f.tag}> "${f.texto}"`)
  }
}

if (process.env.MEDIR_JSON === "1") console.log(JSON.stringify(resultados, null, 2))

// No modo CONTROLE a lógica inverte: o instrumento tem que ACUSAR. Sair limpo
// significa que ele está cego, e uma medição verde não vale nada.
if (process.env.MEDIR_CONTROLE === "1") {
  if (reprovado) {
    console.log("\n[controle positivo] OK — o detector ACUSOU o defeito reposto.")
    process.exit(0)
  }
  console.error("\n[controle positivo] FALHOU — o detector ficou CEGO ao defeito reposto.")
  process.exit(1)
}

process.exit(reprovado ? 1 : 0)
