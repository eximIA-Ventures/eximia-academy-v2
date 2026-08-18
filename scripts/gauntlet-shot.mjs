// USO: node scripts/gauntlet-shot.mjs [caminho-de-saida.png]   (default: /tmp/gauntlet/visao-geral.png)
// Exige o dev server JÁ DE PÉ em http://localhost:3000 — este script não sobe nada; quem roda o loop cuida disso.

// ---------------------------------------------------------------------------
// gauntlet-shot — fotografa a aba "Visão geral" do Analytics do gestor de forma
// determinística, para comparação com o PNG de referência (1672×941).
//
// Determinismo, ponto a ponto:
//   • viewport 1672×941, deviceScaleFactor 1 (o PNG de referência é DPR 1);
//   • colorScheme "light" no contexto — o app é dark-default e o ThemeProvider
//     resolve "system"; sem isto o screenshot dependeria do tema do SO;
//   • reducedMotion "reduce" — animação de entrada não pode mudar o pixel;
//   • clip explícito em (0,0,1672,941) em vez de confiar no tamanho do viewport:
//     se aparecer scrollbar, o clip continua entregando 1672×941 E a scrollbar
//     fica VISÍVEL na foto, que é exatamente o que o crítico precisa ver
//     (CRITERIOS.md A-15/D-17). Esconder overflow aqui cegaria o gate.
//
// INSTRUMENTAÇÃO DO CORTE (por que este script mede antes de fotografar):
//   desde que o preview passou a montar a moldura REAL da Academy, o conteúdo
//   vive dentro de um <main> com `overflow-auto`. O Chromium usa OVERLAY
//   SCROLLBAR: quando o conteúdo estoura a caixa, a barra NÃO ocupa espaço e NÃO
//   aparece na foto. Ou seja, a premissa acima ("a scrollbar fica VISÍVEL")
//   deixou de valer para esta moldura — a foto sai cortada SEM NENHUMA evidência
//   visual, e um avaliador que julgue só a imagem aprova uma tela truncada
//   achando que está inteira.
//   A correção NÃO é encolher o shell nem esconder overflow (isso mexeria em
//   layout que serve outras telas, e cegaria o gate). A correção é MEDIR: antes
//   do screenshot, o script lê a geometria do container rolável no próprio
//   navegador, grava um `.meta.json` irmão do PNG e imprime um aviso inequívoco
//   quando há corte. O corte é um DADO do processo, não um erro do trilho —
//   por isso ele NÃO derruba o exit code.
//
// O script FALHA (exit != 0) apenas se: o servidor não responder, a rota não
// devolver 200, ou o PNG gravado não tiver exatamente 1672×941. A checagem final
// lê o header IHDR do arquivo em disco — não confia na promessa do Playwright.
// Corte de conteúdo NUNCA falha: o PNG é salvo e o exit é 0.
// ---------------------------------------------------------------------------

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { chromium } from "@playwright/test"

// A rota do tiro. O default é a aba "Visão geral", para nenhum uso existente
// mudar de comportamento; as demais abas se fotografam com
//   GAUNTLET_ROTA=padroes-tendencias node scripts/gauntlet-shot.mjs saida.png
// O valor pode incluir query string (ex.: "padroes-tendencias?fonte=fixture").
const ROTA = process.env.GAUNTLET_ROTA ?? "visao-geral"
const URL_ALVO = `http://localhost:3000/gauntlet-preview/${ROTA}`
const LARGURA = 1672
const ALTURA = 941

const saida = resolve(process.argv[2] ?? "/tmp/gauntlet/visao-geral.png")
// Meta é IRMÃO do PNG: /tmp/gauntlet/x.png → /tmp/gauntlet/x.meta.json
const saidaMeta = `${saida.replace(/\.png$/i, "")}.meta.json`

function morrer(mensagem) {
  console.error(`\n[gauntlet-shot] FALHOU: ${mensagem}\n`)
  process.exit(1)
}

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

/** Lê largura/altura direto do header IHDR do PNG em disco. */
async function dimensoesPng(caminho) {
  const buf = await readFile(caminho)
  const assinatura = buf.subarray(0, 8).toString("hex")
  if (assinatura !== "89504e470d0a1a0a") throw new Error("arquivo gravado não é um PNG válido")
  return { largura: buf.readUInt32BE(16), altura: buf.readUInt32BE(20) }
}

if (!(await servidorDePe())) {
  morrer(
    "o dev server não respondeu em http://localhost:3000.\n" +
      "  Suba antes, em outro terminal:  pnpm --filter @eximia/web dev\n" +
      "  Este script NÃO sobe o servidor de propósito.",
  )
}

await mkdir(dirname(saida), { recursive: true })

const navegador = await chromium.launch()
const contexto = await navegador.newContext({
  viewport: { width: LARGURA, height: ALTURA },
  deviceScaleFactor: 1,
  colorScheme: "light",
  reducedMotion: "reduce",
})
const pagina = await contexto.newPage()

/** Geometria do container rolável, preenchida no navegador antes do screenshot. */
let medidas = null

try {
  const resposta = await pagina.goto(URL_ALVO, { waitUntil: "networkidle", timeout: 60_000 })
  if (!resposta) morrer(`sem resposta HTTP de ${URL_ALVO}`)
  if (resposta.status() !== 200) {
    morrer(
      `${URL_ALVO} devolveu HTTP ${resposta.status()}.
  A rota é DEV-ONLY (404 quando NODE_ENV === 'production'). Rode em dev.`,
    )
  }

  await pagina.evaluate(() => document.fonts.ready)
  await pagina.waitForTimeout(400)

  medidas = await pagina.evaluate(() => {
    // O container rolável é o <main id="main-content"> do shell real. O fallback
    // existe para o dia em que o shell mudar: procura o primeiro elemento que de
    // fato rola (overflow-y auto/scroll E scrollHeight > clientHeight).
    const acharRolavel = () => {
      const principal = document.querySelector("#main-content")
      if (principal) return { elemento: principal, seletor: "#main-content" }
      const raiz = document.querySelector("[data-gauntlet-root]") ?? document.body
      const candidatos = [raiz, ...raiz.querySelectorAll("*")]
      const achado = candidatos.find((el) => {
        const estilo = getComputedStyle(el)
        const rola = estilo.overflowY === "auto" || estilo.overflowY === "scroll"
        return rola && el.scrollHeight > el.clientHeight
      })
      if (achado) return { elemento: achado, seletor: "fallback:overflow-y-rolando" }
      const doc = document.scrollingElement ?? document.documentElement
      return { elemento: doc, seletor: "fallback:scrollingElement" }
    }

    const { elemento, seletor } = acharRolavel()
    const caixa = elemento.getBoundingClientRect()
    const estilo = getComputedStyle(elemento)
    const n = (v) => Number.parseFloat(v) || 0
    const arred = (v) => Math.round(v * 100) / 100

    const bordaEsquerda = n(estilo.borderLeftWidth)
    const bordaTopo = n(estilo.borderTopWidth)
    const padEsquerda = n(estilo.paddingLeft)
    const padDireita = n(estilo.paddingRight)
    const padTopo = n(estilo.paddingTop)
    const padBase = n(estilo.paddingBottom)

    const bordaDireita = n(estilo.borderRightWidth)
    const scrollHeight = elemento.scrollHeight
    const clientHeight = elemento.clientHeight
    // Largura que a barra de rolagem tira do conteúdo. Zero significa barra
    // OVERLAY: ela não empurra nada e não deixa rastro na foto.
    const larguraDaBarra =
      elemento.offsetWidth - elemento.clientWidth - bordaEsquerda - bordaDireita
    // Nunca negativo: sem estouro, overflowPx é 0 cravado.
    const overflowPx = Math.max(0, scrollHeight - clientHeight)

    return {
      seletor,
      scrollHeight,
      clientHeight,
      scrollWidth: elemento.scrollWidth,
      clientWidth: elemento.clientWidth,
      overflowPx,
      // Caixa de CONTEÚDO: já descontados borda e padding do container.
      conteudoX0: arred(caixa.left + bordaEsquerda + padEsquerda),
      conteudoY0: arred(caixa.top + bordaTopo + padTopo),
      conteudoLargura: arred(elemento.clientWidth - padEsquerda - padDireita),
      conteudoAltura: arred(elemento.clientHeight - padTopo - padBase),
      padding: {
        topo: padTopo,
        direita: padDireita,
        base: padBase,
        esquerda: padEsquerda,
      },
      cortado: overflowPx > 0,
      // Barra que não consome largura é overlay: é por isso que o corte não
      // deixa rastro na foto.
      scrollbarOverlay: larguraDaBarra <= 0,
      larguraDaBarra: arred(larguraDaBarra),
    }
  })

  await pagina.screenshot({
    path: saida,
    fullPage: false,
    clip: { x: 0, y: 0, width: LARGURA, height: ALTURA },
    animations: "disabled",
    caret: "hide",
  })
} finally {
  await contexto.close()
  await navegador.close()
}

// O meta é gravado ANTES da validação de dimensão: mesmo num PNG reprovado, a
// geometria medida é o dado que explica o que aconteceu.
await writeFile(
  saidaMeta,
  `${JSON.stringify({ png: saida, viewport: { largura: LARGURA, altura: ALTURA }, ...medidas }, null, 2)}\n`,
  "utf8",
)

const { largura, altura } = await dimensoesPng(saida)
if (largura !== LARGURA || altura !== ALTURA) {
  morrer(`PNG gravado tem ${largura}×${altura}, e o contrato exige ${LARGURA}×${ALTURA}.`)
}

console.log(`[gauntlet-shot] OK — ${saida} (${largura}×${altura})`)
console.log(`[gauntlet-shot] meta — ${saidaMeta}`)

if (medidas?.cortado) {
  // Linha inequívoca, e NÃO fatal: o corte é dado do processo, não erro do trilho.
  console.log(
    `[gauntlet-shot] ATENÇÃO: conteúdo estoura a caixa em ${medidas.overflowPx}px — a foto está cortada e a barra de rolagem é overlay (invisível na imagem)`,
  )
  console.log(
    `[gauntlet-shot] detalhe — ${medidas.seletor}: scrollHeight ${medidas.scrollHeight} contra clientHeight ${medidas.clientHeight}; caixa de conteúdo ${medidas.conteudoLargura}×${medidas.conteudoAltura} em (${medidas.conteudoX0},${medidas.conteudoY0})`,
  )
} else {
  console.log(
    `[gauntlet-shot] sem corte — ${medidas?.seletor}: scrollHeight ${medidas?.scrollHeight} cabe em clientHeight ${medidas?.clientHeight}`,
  )
}
