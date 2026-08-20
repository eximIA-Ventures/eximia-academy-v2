// USO: node scripts/gauntlet-medir.mjs [rota] [larguras separadas por virgula]
//   node scripts/gauntlet-medir.mjs mapa-jornada 1366,1440,1512
//   node scripts/gauntlet-medir.mjs "mapa-jornada?fonte=fixture" 1366
//
// ---------------------------------------------------------------------------
// gauntlet-medir — MEDE, não fotografa. Existe porque `gauntlet-shot.mjs` não
// serve para medir defeito de largura, por duas razões estruturais:
//
//   1. Ele fixa a captura em 1672×941 e RECUSA outro tamanho (o contrato dele é
//      comparar com um PNG de referência 1672×941, e isso é legítimo). Só que a
//      janela real do dono está entre 1366 e 1440, e vários defeitos de largura
//      simplesmente NÃO EXISTEM a 1672 — medir só ali é medir onde não dói.
//   2. As rotas `/gauntlet-preview/*` pinam o conteúdo em `w-[1672px]`. Mesmo
//      que se mudasse o viewport, o conteúdo continuaria com 1672px de largura
//      e a página só ganharia rolagem horizontal. A rota REAL `/analytics` não
//      tem pin nenhum: ela é fluida.
//
// Por isso este script NEUTRALIZA O PIN em runtime (`w-[1672px]` → `width:100%`)
// antes de medir. Isso não é um truque: é o que reproduz a rota de produção
// dentro do harness de preview, sem tocar no harness (que serve ao gauntlet de
// 1672 e não pode mudar de comportamento).
//
// O QUE ELE MEDE, e por que cada coisa precisa de instrumento próprio:
//
//   • CORTE VERTICAL (`overflowPx`). A barra de rolagem do Chromium nesta
//     moldura é OVERLAY: ela não ocupa largura e não aparece na foto. Uma tela
//     cortada é fotograficamente idêntica a uma tela inteira. Logo, corte se
//     mede por `scrollHeight - clientHeight` do container rolável, NUNCA pelo
//     olho e nunca pela imagem.
//
//   • CORTE HORIZONTAL (`overflowX`, `foraDaViewport`). Mesmo cegamento, outro
//     eixo, e pior: aqui o `overflowPx` vertical não ajuda em NADA. A "Visão
//     geral" a 1366 punha a linha 1 inteira 29px para fora da janela e o CTA
//     "Ver detalhes ›" 11,09px fora da área visível — e passava em tudo: a foto
//     de 1672 não tem o defeito, o `overflowPx` é 0 nesse eixo, a suíte não
//     mede layout e a barra horizontal do Chromium também é overlay. Por isso a
//     medição registra `scrollWidth - clientWidth` do `<main>` E enumera todo
//     elemento cuja caixa cruza a borda direita da viewport. O segundo é o que
//     importa para o dono: 29px de estouro do container é abstrato, "o botão
//     está 11px fora da tela" não é.
//
//   • COLISÃO DE RÓTULO (`colisoes`). Aqui está a sutileza que derruba uma
//     medição ingênua: `getBoundingClientRect()` do <span> devolve a CAIXA do
//     elemento, e o defeito é justamente a TINTA saindo da caixa. Num rótulo
//     centrado que transborda, a caixa pode estar perfeitamente dentro da
//     coluna enquanto a palavra pinta por cima da vizinha. Por isso a medição
//     usa `Range.getClientRects()` sobre o nó de texto, que devolve os retângulos
//     das LINHAS DE TEXTO renderizadas — a tinta de verdade. Duas colunas
//     colidem quando esses retângulos se sobrepõem em x E em y.
//
// Saída: JSON no stdout (uma linha por largura, mais um resumo), e exit 1 se
// qualquer largura tiver colisão ou corte — este script É um gate, ao contrário
// do `gauntlet-shot`, cujo corte é dado informativo.
// ---------------------------------------------------------------------------

import { chromium } from "@playwright/test"

const ROTA = process.argv[2] ?? "mapa-jornada"
const LARGURAS = (process.argv[3] ?? "1366,1440,1512").split(",").map((n) => Number.parseInt(n, 10))
// A altura é a MESMA do contrato do gauntlet (941). Manter a altura fixa e
// variar só a largura isola a variável em teste: o que muda entre 1366 e 1512 é
// a largura, não a área. Se a altura variasse junto, um corte a mais em 1366
// não distinguiria "layout mais alto" de "janela mais baixa".
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
  console.error("[gauntlet-medir] FALHOU: dev server não respondeu em http://localhost:3000")
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
    const resposta = await pagina.goto(`http://localhost:3000/gauntlet-preview/${ROTA}`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    })
    if (!resposta || resposta.status() !== 200) {
      console.error(`[gauntlet-medir] FALHOU: HTTP ${resposta?.status()} em ${ROTA}`)
      process.exit(1)
    }

    // NEUTRALIZAÇÃO DO PIN — ver cabeçalho. Sem isto a medição responde sempre
    // como se a janela tivesse 1672px, que é exatamente onde o defeito some.
    await pagina.evaluate(() => {
      for (const el of document.querySelectorAll('[class*="w-[1672px]"]')) {
        el.style.width = "100%"
      }
    })

    // ── CONTROLE POSITIVO (MEDIR_CONTROLE=1) ──────────────────────────────────
    // Um detector de colisão que nunca viu uma colisão não é um detector, é um
    // carimbo de "passou". Este modo RECRIA o defeito em runtime — desliga o
    // `overflow-wrap: anywhere` e devolve a fonte ao tier de 9,5px, que é o
    // estado exato de antes da correção — e exige que o detector ACUSE. Se o
    // controle sair limpo, a medição normal não prova ausência de colisão:
    // prova apenas que o instrumento está cego.
    if (process.env.MEDIR_CONTROLE === "1") {
      await pagina.evaluate(() => {
        const tabelas = [...document.querySelectorAll("table")]
        const matriz = tabelas.find(
          (t) => (t.querySelector("thead th")?.textContent ?? "").trim() === "Pessoa",
        )
        if (!matriz) return
        for (const th of [...matriz.querySelectorAll("thead th")].slice(1)) {
          const spans = [...th.querySelectorAll("span")]
          const alvo = spans[spans.length - 1]
          if (!alvo) continue
          alvo.style.overflowWrap = "normal"
          alvo.style.wordBreak = "normal"
          alvo.style.hyphens = "none"
          alvo.style.fontSize = "9.5px"
          alvo.style.letterSpacing = "normal"
        }
      })
      await pagina.waitForTimeout(120)
    }
    // ── CONTROLE POSITIVO DO EIXO X (MEDIR_CONTROLE_X=1) ─────────────────────
    // Ancorado no defeito REAL de 2026-08-19, não numa colisão inventada: o
    // estouro de 29px a 1366 nascia de `shrink-[0.12]` no placar somado aos 47px
    // de recuo decorativo da raiz. Este modo REPÕE exatamente esses dois valores
    // e exige que o detector ACUSE. Se sair limpo, uma medição verde no eixo x
    // não prova ausência de estouro — prova que o instrumento está cego.
    if (process.env.MEDIR_CONTROLE_X === "1") {
      await pagina.evaluate(() => {
        const raiz = document.querySelector("#main-content")?.firstElementChild
        if (!raiz) return
        raiz.style.paddingLeft = "31px"
        raiz.style.paddingRight = "16px"
        // O placar é o 1º filho da 1ª linha da grade de cards.
        const placar = raiz.children[2]?.children[0]?.children[0]
        if (placar instanceof HTMLElement) placar.style.flexShrink = "0.12"
      })
      await pagina.waitForTimeout(120)
    }
    await pagina.evaluate(() => document.fonts.ready)
    await pagina.waitForTimeout(500)

    const medida = await pagina.evaluate(() => {
      const arred = (v) => Math.round(v * 100) / 100

      // ── corte vertical ────────────────────────────────────────────────────
      const rolavel = document.querySelector("#main-content") ?? document.scrollingElement
      const overflowPx = Math.max(0, rolavel.scrollHeight - rolavel.clientHeight)

      // FOLGA — o número que `overflowPx` não sabe dizer. `scrollHeight` nunca
      // é menor que `clientHeight`, então uma tela que sobra 2px e uma que
      // sobra 60 reportam o MESMO `overflowPx == 0`. Sem a folga, "passou" não
      // distingue "cabe" de "cabe por um fio", e a próxima linha de texto que
      // um tenant escrever um pouco mais longa reabre o defeito sem aviso.
      const estiloRolavel = getComputedStyle(rolavel)
      const padV =
        (Number.parseFloat(estiloRolavel.paddingTop) || 0) +
        (Number.parseFloat(estiloRolavel.paddingBottom) || 0)
      const conteudo = rolavel.firstElementChild
      const alturaReal = conteudo ? conteudo.getBoundingClientRect().height : rolavel.scrollHeight
      const folgaPx = arred(rolavel.clientHeight - padV - alturaReal)

      // ── corte horizontal ──────────────────────────────────────────────────
      // `overflowX` é a medida do container; `foraDaViewport` é o que o dono
      // enxerga. Os dois porque um estouro menor que o recuo lateral fica
      // escondido dentro do padding e some do primeiro número sem sumir da tela.
      const overflowX = Math.max(0, rolavel.scrollWidth - rolavel.clientWidth)
      const larguraJanela = document.documentElement.clientWidth
      const foraDaViewport = []
      for (const el of rolavel.querySelectorAll("*")) {
        const cx = el.getBoundingClientRect()
        if (cx.width === 0 && cx.height === 0) continue
        if (cx.right <= larguraJanela + 0.5) continue
        // Descarta o ancestral que só aparece por arrasto — mas SÓ quando um
        // filho sangra TANTO QUANTO ele. Filtrar por "tem filho sangrando" era o
        // erro: o <span> do "Ver detalhes ›" sangra 11,09px e o <path> do
        // chevron dentro dele sangra 6,22, então o filtro ingênuo apagava
        // justamente a linha que nomeia o defeito e deixava um `<path>` anônimo
        // no lugar.
        if ([...el.children].some((f) => f.getBoundingClientRect().right >= cx.right - 0.5))
          continue
        foraDaViewport.push({
          foraPx: arred(cx.right - larguraJanela),
          tag: el.tagName.toLowerCase(),
          texto: (el.textContent ?? "").trim().slice(0, 44),
        })
      }
      foraDaViewport.sort((a, b) => b.foraPx - a.foraPx)

      // ── colisão de tinta nos rótulos de coluna da matriz ──────────────────
      // A matriz é a tabela cujo cabeçalho tem o rótulo "Pessoa" na 1ª coluna.
      const tabelas = [...document.querySelectorAll("table")]
      const matriz = tabelas.find(
        (t) => (t.querySelector("thead th")?.textContent ?? "").trim() === "Pessoa",
      )

      const colisoes = []
      const rotulos = []
      if (matriz) {
        const ths = [...matriz.querySelectorAll("thead th")].slice(1) // pula "Pessoa"
        for (let i = 0; i < ths.length; i++) {
          const th = ths[i]
          // O rótulo é o último <span> (o primeiro é o numeral da coluna).
          const spans = [...th.querySelectorAll("span")]
          const alvo = spans[spans.length - 1]
          if (!alvo) continue
          const faixa = document.createRange()
          faixa.selectNodeContents(alvo)
          // getClientRects() sobre o conteúdo devolve UM retângulo por linha de
          // texto renderizada: é a tinta, não a caixa do elemento.
          const rects = [...faixa.getClientRects()].map((r) => ({
            x0: arred(r.left),
            x1: arred(r.right),
            y0: arred(r.top),
            y1: arred(r.bottom),
          }))
          const caixa = th.getBoundingClientRect()
          rotulos.push({
            indice: i + 1,
            texto: (alvo.textContent ?? "").trim(),
            colunaX0: arred(caixa.left),
            colunaX1: arred(caixa.right),
            larguraColuna: arred(caixa.width),
            tintaLargura: arred(Math.max(...rects.map((r) => r.x1 - r.x0), 0)),
            linhas: rects.length,
            rects,
          })
        }

        // Colidem quando a tinta de dois rótulos se sobrepõe em x E em y.
        for (let i = 0; i < rotulos.length - 1; i++) {
          for (const a of rotulos[i].rects) {
            for (const b of rotulos[i + 1].rects) {
              const sobrepoeX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)
              const sobrepoeY = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)
              if (sobrepoeX > 0.05 && sobrepoeY > 0.05) {
                colisoes.push({
                  entre: [rotulos[i].texto, rotulos[i + 1].texto],
                  colunas: [rotulos[i].indice, rotulos[i + 1].indice],
                  sobreposicaoPx: arred(sobrepoeX),
                })
              }
            }
          }
        }
      }

      // ── menor fonte renderizada dentro da matriz (piso de 11px NÃO se aplica
      //    ao cabeçalho de coluna, que já nasceu menor; medido para registro) ──
      const fontes = matriz
        ? [...new Set([...matriz.querySelectorAll("*")].map((e) => getComputedStyle(e).fontSize))]
        : []

      // ── RITMO VERTICAL contra as faixas da rubrica ────────────────────────
      // Comprimir ritmo para fechar a dobra é legítimo ATÉ o piso que a régua
      // declara. Sem esta medição, "overflowPx == 0" pode ter sido comprado
      // violando V-13/V-19/V-25/V-27 — trocar um defeito medido por outro não
      // medido. Cada faixa abaixo é literal de CRITERIOS-mapa.md.
      const passoDe = (linhas) => {
        if (linhas.length < 2) return null
        const tops = linhas.map((l) => l.getBoundingClientRect().top)
        const passos = tops.slice(1).map((t, i) => t - tops[i])
        return arred(passos.reduce((a, b) => a + b, 0) / passos.length)
      }
      const tabelaPorCabecalho = (primeiro) =>
        tabelas.find((t) => (t.querySelector("thead th")?.textContent ?? "").trim() === primeiro)

      const ritmo = {}
      if (matriz)
        ritmo.matriz = { passo: passoDe([...matriz.querySelectorAll("tbody tr")]), faixa: [24, 32] }
      const tFunil = tabelaPorCabecalho("Módulo")
      if (tFunil)
        ritmo.funil = { passo: passoDe([...tFunil.querySelectorAll("tbody tr")]), faixa: [18, 28] }
      // `travados` é a OUTRA tabela cujo 1º cabeçalho também é "Pessoa".
      const travados = tabelas.filter(
        (t) => (t.querySelector("thead th")?.textContent ?? "").trim() === "Pessoa" && t !== matriz,
      )[0]
      if (travados)
        ritmo.travados = {
          passo: passoDe([...travados.querySelectorAll("tbody tr")]),
          faixa: [18, 28],
        }

      // V-11 · o rótulo de coluna aceita ATÉ 3 linhas. Comprimir a dobra não
      // pode empurrar um rótulo para a 4ª linha sem que alguém veja.
      const maxLinhasRotulo = rotulos.reduce((m, r) => Math.max(m, r.linhas), 0)

      return {
        overflowPx,
        folgaPx,
        overflowX,
        foraDaViewport: foraDaViewport.slice(0, 8),
        alturaConteudoReal: arred(alturaReal),
        scrollHeight: rolavel.scrollHeight,
        clientHeight: rolavel.clientHeight,
        colisoes,
        ritmo,
        maxLinhasRotulo,
        rotulos: rotulos.map(({ rects, ...r }) => r),
        fontesNaMatriz: fontes.sort(),
        alturaConteudo: arred(document.querySelector("[data-gauntlet-root]")?.scrollHeight ?? 0),
      }
    })

    resultados.push({ largura, ...medida })
    await contexto.close()
  }
} finally {
  await navegador.close()
}

for (const r of resultados) {
  console.log(
    `${ROTA} @ ${r.largura}px → overflowPx=${r.overflowPx} · folga=${r.folgaPx}px (conteudo ${r.alturaConteudoReal} em ${r.clientHeight}) · overflowX=${r.overflowX} · fora=${r.foraDaViewport.length} · colisoes=${r.colisoes.length}`,
  )
  for (const f of r.foraDaViewport) {
    console.log(`    FORA DA VIEWPORT ${f.foraPx}px: <${f.tag}> "${f.texto}"`)
  }
  for (const c of r.colisoes) {
    console.log(
      `    COLISÃO col ${c.colunas[0]}↔${c.colunas[1]}: "${c.entre[0]}" × "${c.entre[1]}" — ${c.sobreposicaoPx}px`,
    )
  }
  for (const [nome, v] of Object.entries(r.ritmo ?? {})) {
    const fora = v.passo !== null && (v.passo < v.faixa[0] || v.passo > v.faixa[1])
    console.log(
      `    ritmo ${nome}: passo ${v.passo} (faixa ${v.faixa[0]}–${v.faixa[1]})${fora ? "  ← FORA DA FAIXA" : ""}`,
    )
  }
  if (r.maxLinhasRotulo > 3)
    console.log(`    V-11: rótulo de coluna em ${r.maxLinhasRotulo} linhas (máx 3)`)
}

if (process.env.MEDIR_JSON === "1") console.log(JSON.stringify(resultados, null, 2))

const reprovado = resultados.some(
  (r) =>
    r.overflowPx > 0 || r.colisoes.length > 0 || r.overflowX > 0 || r.foraDaViewport.length > 0,
)
process.exit(reprovado ? 1 : 0)
