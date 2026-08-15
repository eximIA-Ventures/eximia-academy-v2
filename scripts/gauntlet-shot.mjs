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
// O script FALHA (exit != 0) se: o servidor não responder, a rota não devolver
// 200, ou o PNG gravado não tiver exatamente 1672×941. A checagem final lê o
// header IHDR do arquivo em disco — não confia na promessa do Playwright.
// ---------------------------------------------------------------------------

import { mkdir, readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { chromium } from "@playwright/test"

const URL_ALVO = "http://localhost:3000/gauntlet-preview/visao-geral"
const LARGURA = 1672
const ALTURA = 941

const saida = resolve(process.argv[2] ?? "/tmp/gauntlet/visao-geral.png")

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

const { largura, altura } = await dimensoesPng(saida)
if (largura !== LARGURA || altura !== ALTURA) {
  morrer(`PNG gravado tem ${largura}×${altura}, e o contrato exige ${LARGURA}×${ALTURA}.`)
}

console.log(`[gauntlet-shot] OK — ${saida} (${largura}×${altura})`)
