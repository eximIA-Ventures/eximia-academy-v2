#!/usr/bin/env node
// ===========================================================================
// gauntlet-autogestao-shot — fotografa as 3 telas da Autogestão da minha
// Jornada, de forma DETERMINÍSTICA, para o crítico cego comparar contra as
// referências do dono.
//
// USO:
//   node scripts/gauntlet-autogestao-shot.mjs [rodada] [aluno]
//     rodada  número da rodada do loop (default 0)
//     aluno   "a" (com plano, default) ou "b" (sem plano)
//
//   GAUNTLET_PERIODO=7|30|90 (default 30) — a janela do `?periodo=` das 3
//   rotas. 30 é o que o aluno vê (mesmo default do produto real); 7 é a
//   janela que a prova do elo 4 usa e continua alcançável explicitamente.
//   Um valor fora do conjunto cai no default, nunca quebra.
//
// Exige o dev server DE PÉ em :3000 e o cenário semeado
// (`node apps/web/scripts/gauntlet/semear.mjs --agora 2026-08-21T12:00:00Z`).
// Este script não sobe nem semeia nada: quem roda o loop cuida disso.
//
// POR QUE A SUPERFÍCIE É `/gauntlet-preview/`, E NÃO `/jornada`
// ---------------------------------------------------------------------------
// A tela de produção vive atrás de auth e devolve 307 sem sessão. Mais
// importante: a Lei 5 do gauntlet-2 proíbe o crítico de julgar dado VIVO. Um
// crítico apontado para dado que se move não está medindo o artefato, está
// medindo o dia — ele reprova acerto e aprova erro, nas duas direções, sem
// emitir sinal.
//
// A rota de preview renderiza o MESMO componente de produção, com relógio
// FIXO (`?agora=`) sobre um cenário semeado e congelado. Não é um mock da
// tela: é a tela, servida numa superfície onde a medição é possível.
//
// DETERMINISMO, PONTO A PONTO (herdado de scripts/gauntlet-shot.mjs)
// ---------------------------------------------------------------------------
//   • viewport 1440×1080, deviceScaleFactor 1 — a dimensão MEDIDA dos três
//     PNGs de referência do dono, não um número escolhido;
//   • colorScheme "light" — o app é dark-default e o ThemeProvider resolve
//     "system"; sem isto o screenshot dependeria do tema do sistema
//     operacional de quem roda, e o mesmo código daria dois pixels;
//   • reducedMotion "reduce" — animação de entrada não pode mover o pixel;
//   • `?agora=` fixo — sem ele, "há 3 dias" vira "há 4 dias" à meia-noite e o
//     loop nunca converge, porque o alvo se move debaixo do crítico.
// ===========================================================================

import { mkdirSync } from "node:fs"
// `@playwright/test`, não `playwright`: é o pacote que este monorepo de fato
// declara (medido — nem a raiz nem apps/web têm `node_modules/playwright`), e é
// o mesmo import que o `gauntlet-shot.mjs` irmão usa. Importar o nome errado
// falha com ERR_MODULE_NOT_FOUND, e o script sai com código 0 por causa do
// pipe — ou seja, um capturador quebrado que se anuncia como bem-sucedido.
import { chromium } from "@playwright/test"

const RAIZ = process.env.GAUNTLET_RAIZ ?? "/tmp/gauntlet-autogestao"
const BASE = process.env.GAUNTLET_BASE ?? "http://localhost:3000"
const AGORA = process.env.GAUNTLET_AGORA ?? "2026-08-21T12:00:00Z"
// 30 dias por padrão — o que o aluno vê (mesmo default do produto real,
// `PERIODO_PADRAO_DIAS`). O 7 (a janela que a prova do elo 4 usa) continua
// alcançável via `GAUNTLET_PERIODO=7`, mas não é mais o que este capturador
// fotografa por padrão — ver o comentário de topo de cada `leitura-real.ts`.
const PERIODO_VALIDOS = new Set(["7", "30", "90"])
const PERIODO_BRUTO = process.env.GAUNTLET_PERIODO ?? "30"
const PERIODO = PERIODO_VALIDOS.has(PERIODO_BRUTO) ? PERIODO_BRUTO : "30"

// `GAUNTLET_TENANT` / `GAUNTLET_ESTUDANTE` — override opcional para apontar o
// harness a um tenant e aluno REAIS (ex.: "cory-alimentos" + o id de um aluno
// real dele), em vez do cenário sintético "gauntlet-descartavel" + `?aluno=`.
// Ausentes, o comportamento é o ORIGINAL: nenhum `?tenant=`/`?estudante=` é
// anexado à URL, e as 3 rotas caem nos próprios defaults.
const TENANT = process.env.GAUNTLET_TENANT
const ESTUDANTE = process.env.GAUNTLET_ESTUDANTE

const LARGURA = 1440
const ALTURA = 1080

const rodada = Number(process.argv[2] ?? 0)
const aluno = (process.argv[3] ?? "a").toLowerCase()

if (!["a", "b"].includes(aluno)) {
  console.error(`[shot] aluno inválido: "${aluno}". Use "a" (com plano) ou "b" (sem plano).`)
  process.exit(2)
}

/** As 3 telas. O `prefixo` é o que o painel do gauntlet usa para agrupar séries. */
const TELAS = [
  { id: "visao-geral", rota: "autogestao-visao-geral", prefixo: "visao-geral" },
  { id: "padroes", rota: "autogestao-padroes", prefixo: "padroes" },
  { id: "mapa", rota: "autogestao-mapa", prefixo: "mapa" },
]

mkdirSync(RAIZ, { recursive: true })

const navegador = await chromium.launch()
const contexto = await navegador.newContext({
  viewport: { width: LARGURA, height: ALTURA },
  deviceScaleFactor: 1,
  colorScheme: "light",
  reducedMotion: "reduce",
})

let falhas = 0

for (const tela of TELAS) {
  let url = `${BASE}/gauntlet-preview/${tela.rota}?agora=${encodeURIComponent(AGORA)}&aluno=${aluno}&periodo=${PERIODO}`
  if (TENANT) url += `&tenant=${encodeURIComponent(TENANT)}`
  if (ESTUDANTE) url += `&estudante=${encodeURIComponent(ESTUDANTE)}`
  const pagina = await contexto.newPage()
  try {
    const resposta = await pagina.goto(url, { waitUntil: "networkidle", timeout: 60_000 })
    const status = resposta?.status() ?? 0
    if (status !== 200) {
      console.error(`[shot] ${tela.id}: HTTP ${status} em ${url} — NÃO fotografado.`)
      falhas++
      continue
    }

    // Piso de não-vacuidade (G3 do pré-voo): a tela vazia passa em quase todo
    // critério de acabamento sem renderizar nada. Um artefato com menos texto
    // que isto não é uma tela, é uma casca — e fotografá-la produziria um PNG
    // que o crítico poderia até aprovar.
    const texto = (await pagina.locator("body").innerText()).trim()
    if (texto.length < 200) {
      console.error(
        `[shot] ${tela.id}: apenas ${texto.length} caracteres renderizados. ` +
          `Cenário provavelmente não semeado. NÃO fotografado (G3).`,
      )
      falhas++
      continue
    }

    const sufixoAluno = aluno === "b" ? "-sem-plano" : ""
    const nome = `${tela.prefixo}${sufixoAluno}-r${rodada}.png`
    await pagina.screenshot({
      path: `${RAIZ}/${nome}`,
      clip: { x: 0, y: 0, width: LARGURA, height: ALTURA },
    })
    console.log(`[shot] ${nome}  (${texto.length} chars de conteúdo)`)
  } catch (erro) {
    console.error(`[shot] ${tela.id}: ${erro.message}`)
    falhas++
  } finally {
    await pagina.close()
  }
}

await navegador.close()

if (falhas > 0) {
  console.error(`[shot] ${falhas} de ${TELAS.length} telas NÃO foram fotografadas.`)
  process.exit(1)
}
console.log(`[shot] ${TELAS.length} telas em ${RAIZ} (rodada ${rodada}, aluno ${aluno}).`)
