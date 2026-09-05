// AUDITORIA INDEPENDENTE — mede a DOBRA DA ROTA REAL a partir do preview.
//
// O preview NÃO desenha duas peças que /analytics desenha:
//   • PlatformFooter — irmão do <main>, portanto ROUBA altura útil do <main>.
//   • MolduraAba — título+subtítulo+filtros+abas — só em Padrões e Mapa.
// Este script mede as duas em runtime em vez de aceitar o número de ninguém:
//   • o rodapé é medido pela caixa real do <footer> quando presente; quando
//     ausente (preview), é reconstruído em runtime com as MESMAS classes.
//   • a moldura é medida pelo cabeçalho REAL da Visão geral (h1 + subtítulo +
//     filtros + NavAbas), que moldura.tsx declara copiar medida a medida.
//
// USO: node scripts/auditoria-dobra-real.mjs <largura> <altura>
import { chromium } from "@playwright/test"

const L = Number.parseInt(process.argv[2] ?? "1366", 10)
const A = Number.parseInt(process.argv[3] ?? "768", 10)
const ROTAS = ["visao-geral", "padroes-tendencias", "mapa-jornada"]

const nav = await chromium.launch()
const out = []

// 1) mede o rodapé real, reconstruído com as classes literais do componente
const ctx0 = await nav.newContext({ viewport: { width: L, height: A }, colorScheme: "light" })
const p0 = await ctx0.newPage()
await p0.goto("http://localhost:3000/gauntlet-preview/visao-geral?fonte=motor", {
  waitUntil: "networkidle",
})
const rodapePx = await p0.evaluate(() => {
  const f = document.createElement("footer")
  f.className = "px-6 py-3"
  f.innerHTML =
    '<div class="flex items-center justify-between"><p class="text-xs text-text-muted">© 2026 exímIA Academy by exímIA</p><a class="text-xs">suporte@x.com</a></div>'
  document.body.appendChild(f)
  const h = f.getBoundingClientRect().height
  f.remove()
  return Math.round(h * 100) / 100
})
// 2) mede a moldura pelo cabeçalho real da Visão geral
const molduraPx = await p0.evaluate(() => {
  const main = document.querySelector("#main-content")
  const h1 = main?.querySelector("h1")
  // NavAbas: o container do <nav>/lista de abas — procura pelo texto das 3 abas
  const cands = [...main.querySelectorAll("*")].filter((e) => {
    const t = (e.textContent ?? "").replace(/\s+/g, " ").trim()
    return (
      t.includes("Visão geral") &&
      t.includes("Padrões") &&
      t.includes("Mapa") &&
      t.length < 90
    )
  })
  const abas = cands[cands.length - 1]
  if (!h1 || !abas) return null
  const topo = h1.getBoundingClientRect().top
  const base = abas.getBoundingClientRect().bottom
  return {
    doH1AteAsAbas: Math.round((base - topo) * 100) / 100,
    textoAbas: (abas.textContent ?? "").replace(/\s+/g, " ").trim(),
  }
})
await ctx0.close()

for (const rota of ROTAS) {
  const ctx = await nav.newContext({
    viewport: { width: L, height: A },
    colorScheme: "light",
    reducedMotion: "reduce",
  })
  const pg = await ctx.newPage()
  await pg.goto(`http://localhost:3000/gauntlet-preview/${rota}?fonte=motor`, {
    waitUntil: "networkidle",
    timeout: 60000,
  })
  await pg.evaluate(() => {
    for (const el of document.querySelectorAll('[class*="w-[1672px]"]')) el.style.width = "100%"
  })
  await pg.evaluate(() => document.fonts.ready)
  await pg.waitForTimeout(400)
  const m = await pg.evaluate(() => {
    const r = document.querySelector("#main-content")
    const cs = getComputedStyle(r)
    const padV =
      (Number.parseFloat(cs.paddingTop) || 0) + (Number.parseFloat(cs.paddingBottom) || 0)
    const conteudo = r.firstElementChild
    return {
      clientHeight: r.clientHeight,
      scrollHeight: r.scrollHeight,
      padV,
      alturaConteudo: Math.round(conteudo.getBoundingClientRect().height * 100) / 100,
    }
  })
  await ctx.close()
  out.push({ rota, ...m })
}
await nav.close()

const precisaMoldura = (r) => r !== "visao-geral"
console.log(`\n=== ${L}x${A} ===`)
console.log(`rodapé real medido: ${rodapePx}px   moldura (h1→abas): ${JSON.stringify(molduraPx)}`)
for (const r of out) {
  const alturaUtilReal = r.clientHeight - rodapePx
  const molduraCusto = precisaMoldura(r.rota) ? (molduraPx?.doH1AteAsAbas ?? 0) + 12 : 0
  const precisa = r.alturaConteudo + r.padV + molduraCusto
  const corte = Math.round((precisa - alturaUtilReal) * 100) / 100
  console.log(
    `${r.rota}: conteudo=${r.alturaConteudo} + pad=${r.padV} + moldura=${molduraCusto} = ${Math.round(precisa * 100) / 100}  vs  útil real ${alturaUtilReal} (preview ${r.clientHeight} - rodapé ${rodapePx})  →  ${corte > 0 ? `CORTE ${corte}px` : `folga ${-corte}px`}`,
  )
}
