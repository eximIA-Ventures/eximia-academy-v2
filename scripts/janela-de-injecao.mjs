#!/usr/bin/env node
// USO: node scripts/janela-de-injecao.mjs <comando> [opções]
//
//   instalar                                          liga o hook nesta cópia do repo
//   abrir --motivo="..." --arquivo=X [--arquivo=Y]    abre a janela (declara os alvos)
//         [--quem="..."]
//   fechar                                            confere sha256 e fecha
//   estado                                            0=fechada 1=aberta 2=ilegível
//   abandonar --confirmo=ASSUMO-O-RISCO --motivo="…"  escape para janela órfã
//
// ---------------------------------------------------------------------------
// A janela de injeção — o estado externo que o disco não consegue declarar.
// ---------------------------------------------------------------------------
// Um defeito injetado de propósito e um defeito real SÃO O MESMO BYTE no disco.
// Nada no conteúdo do arquivo distingue os dois. Logo, nenhuma inspeção de
// código protege: a proteção só pode vir de um estado externo DECLARADO, e é
// isso que o sentinela `.janela-de-injecao.json` é.
//
// O incidente (2026-08-20, eximia-academy-v2, ver `.githooks/pre-commit`): uma
// varredura de mutação em voo e um commit de outro agente na mesma janela de
// ~7s. Passou por coincidência de escopo. O agente que abriu a janela tinha
// ANUNCIADO — e o diagnóstico dele é o motivo deste arquivo existir:
//
//     "Anunciar não é o mesmo que a árvore ficar imóvel. O mecanismo teria que
//      ser um arquivo-sentinela na raiz que se cheque antes de commitar, não um
//      recado."
//
// TRÊS INVARIANTES, e nenhum é conveniência:
//
//   1. NÃO SE ABRE JANELA SEM GUARDA. `abrir` recusa se o hook não estiver
//      instalado e ativo. É a defesa contra a vacuidade do próprio mecanismo:
//      sem isso, um sentinela poderia existir com o hook desligado, e o
//      sentinela viraria decoração — pior que nada, porque dá sensação de
//      proteção.
//   2. NÃO SE FECHA JANELA COM MUTANTE DENTRO. `fechar` recomputa o sha256 de
//      cada alvo e recusa se algum divergir do estado de abertura. Uma janela
//      fechada com mutante dentro é PIOR que uma janela aberta: a aberta barra
//      commits, a fechada com mutante libera o defeito com carimbo de limpo.
//   3. O ESCAPE EXISTE E É BARULHENTO. Agente morre no meio (aconteceu duas
//      vezes no dia do incidente: queda de conexão e travamento), e o sentinela
//      fica órfão travando a árvore inteira. `abandonar` resolve — exigindo
//      confirmação literal, motivo, e deixando registro. Nunca em silêncio.
//
// CÓDIGOS DE SAÍDA
//   0 ok   1 uso errado   2 guarda não instalado   3 estado incompatível
//   4 alvo inexistente    5 restauração divergente 6 sentinela ilegível
//   (exceto `estado`, que usa o código como resposta: 0/1/2)
// ---------------------------------------------------------------------------

import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  constants,
  accessSync,
  appendFileSync,
  chmodSync,
  existsSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { hostname, userInfo } from "node:os"
import { isAbsolute, relative, resolve } from "node:path"

const MARCA_SENTINELA = "JANELA-DE-INJECAO-V1"
const MARCA_HOOK = "JANELA-DE-INJECAO-GUARDA-V1"
const HOOKS_PATH_ESPERADO = ".githooks"
const CONFIRMACAO = "ASSUMO-O-RISCO"
const LINHA = "═".repeat(79)

// --- primitivas -------------------------------------------------------------

function git(...args) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim()
  } catch {
    return ""
  }
}

const raiz = (() => {
  const r = git("rev-parse", "--show-toplevel")
  if (!r) {
    console.error("janela-de-injecao: isto não é um repositório git.")
    process.exit(1)
  }
  return realpathSync(r)
})()

const SENTINELA = `${raiz}/.janela-de-injecao.json`
const LOG_ABANDONOS = `${raiz}/.janela-de-injecao-abandonos.log`

const sha = (arquivo) => createHash("sha256").update(readFileSync(arquivo)).digest("hex")

const argv = process.argv.slice(3)
const comando = process.argv[2] ?? "ajuda"
const opcao = (nome) => {
  const achado = argv.find((a) => a.startsWith(`--${nome}=`))
  return achado === undefined ? undefined : achado.slice(nome.length + 3)
}
const opcoes = (nome) =>
  argv.filter((a) => a.startsWith(`--${nome}=`)).map((a) => a.slice(nome.length + 3))

/** Lê o sentinela. `null` = não existe. `{ ilegivel: true }` = existe e não dá para ler. */
function leSentinela() {
  if (!existsSync(SENTINELA)) return null
  let cru
  try {
    cru = readFileSync(SENTINELA, "utf8")
  } catch (e) {
    return { ilegivel: true, cru: `<erro de leitura: ${e.message}>` }
  }
  if (cru.trim() === "") return { ilegivel: true, cru: "<vazio>" }
  try {
    const j = JSON.parse(cru)
    if (j?.guarda !== MARCA_SENTINELA || !Array.isArray(j.arquivos)) {
      return { ilegivel: true, cru }
    }
    return j
  } catch {
    return { ilegivel: true, cru }
  }
}

/**
 * O guarda está de fato instalado e vivo?
 * Esta função É a defesa contra a vacuidade do mecanismo. Se ela afrouxar, o
 * sentinela vira enfeite: existe, não protege, e ninguém percebe.
 */
function guarda() {
  const configurado = git("config", "core.hooksPath")
  if (!configurado) {
    return {
      ok: false,
      motivo: `core.hooksPath não está configurado neste repo — o hook versionado em ${HOOKS_PATH_ESPERADO}/ está inerte`,
    }
  }
  const dir = isAbsolute(configurado) ? configurado : resolve(raiz, configurado)
  const hook = `${dir}/pre-commit`
  if (!existsSync(hook)) {
    return {
      ok: false,
      motivo: `core.hooksPath aponta para ${configurado}, e não há pre-commit lá`,
    }
  }
  try {
    accessSync(hook, constants.X_OK)
  } catch {
    return { ok: false, motivo: `${relative(raiz, hook)} existe mas não é executável (chmod +x)` }
  }
  if (!readFileSync(hook, "utf8").includes(MARCA_HOOK)) {
    return {
      ok: false,
      motivo: `${relative(raiz, hook)} não é o guarda desta janela (falta o marcador ${MARCA_HOOK})`,
    }
  }
  return { ok: true, hook }
}

function comoInstalar() {
  return [
    "",
    "  INSTALE O GUARDA (uma linha, na raiz do repo):",
    `      git config core.hooksPath ${HOOKS_PATH_ESPERADO}`,
    "  ou, equivalente:",
    "      node scripts/janela-de-injecao.mjs instalar",
    "",
  ].join("\n")
}

/** Confere cada alvo contra o sha256 do momento da abertura. */
function confere(dados) {
  return dados.arquivos.map((a) => {
    const abs = isAbsolute(a.caminho) ? a.caminho : resolve(raiz, a.caminho)
    if (!existsSync(abs)) return { ...a, situacao: "SUMIU", agora: "<arquivo não existe>" }
    const agora = sha(abs)
    return { ...a, agora, situacao: agora === a.sha256 ? "idêntico" : "DIVERGE" }
  })
}

const duracao = (iso) => {
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000)
  return Number.isFinite(s) ? (s < 120 ? `${s}s` : `${Math.round(s / 60)}min`) : "?"
}

// --- comandos ---------------------------------------------------------------

function cmdInstalar() {
  const hook = `${raiz}/${HOOKS_PATH_ESPERADO}/pre-commit`
  if (!existsSync(hook)) {
    console.error(`não achei o hook versionado em ${relative(raiz, hook)} — repo incompleto?`)
    process.exit(2)
  }
  try {
    chmodSync(hook, statSync(hook).mode | 0o111)
  } catch {
    /* sem permissão para ajustar o bit; o teste abaixo dirá se ficou usável */
  }
  git("config", "core.hooksPath", HOOKS_PATH_ESPERADO)
  const g = guarda()
  if (!g.ok) {
    console.error(`instalação NÃO ficou válida: ${g.motivo}`)
    process.exit(2)
  }
  console.log(`guarda instalado: core.hooksPath = ${HOOKS_PATH_ESPERADO}`)
  console.log(`  ${relative(raiz, g.hook)} está executável e tem o marcador ${MARCA_HOOK}`)
  console.log("\n  Cuidado conhecido: core.hooksPath SUBSTITUI .git/hooks por inteiro.")
  console.log("  Se algum dia este repo ganhar outros hooks locais, eles precisam")
  console.log(`  mudar para ${HOOKS_PATH_ESPERADO}/ para continuarem rodando.`)
}

function cmdAbrir() {
  const motivo = opcao("motivo")
  const alvos = opcoes("arquivo")
  const quem = opcao("quem") || `${userInfo().username}@${hostname()} pid ${process.pid}`

  if (!motivo || alvos.length === 0) {
    console.error('uso: abrir --motivo="..." --arquivo=CAMINHO [--arquivo=CAMINHO ...]')
    console.error("     o motivo e ao menos um arquivo são obrigatórios: quem esbarrar no")
    console.error("     bloqueio precisa entender em cinco segundos o que está acontecendo.")
    process.exit(1)
  }

  const jaAberta = leSentinela()
  if (jaAberta) {
    console.error(`${LINHA}\n  JÁ HÁ UMA JANELA ABERTA — não vou sobrescrever\n${LINHA}`)
    if (jaAberta.ilegivel) {
      console.error("  (e o sentinela existente está ilegível — veja `estado`)")
    } else {
      console.error(`  quem  : ${jaAberta.quem}`)
      console.error(`  motivo: ${jaAberta.motivo}`)
      console.error(`  desde : ${jaAberta.aberta_em} (${duracao(jaAberta.aberta_em)})`)
    }
    console.error("\n  Duas varreduras na mesma árvore embaralham a leitura de qual mutante")
    console.error("  é de quem. Espere a outra fechar, ou use `abandonar` se ela é órfã.")
    process.exit(3)
  }

  const g = guarda()
  if (!g.ok) {
    console.error(`${LINHA}\n  RECUSANDO ABRIR A JANELA — o guarda não está ativo\n${LINHA}`)
    console.error(`\n  ${g.motivo}`)
    console.error("\n  Abrir janela sem hook seria o pior dos mundos: o sentinela na raiz")
    console.error("  daria a impressão de que a árvore está protegida, e qualquer commit")
    console.error("  passaria batido. Sentinela sem guarda é decoração.")
    console.error(comoInstalar())
    process.exit(2)
  }

  const arquivos = []
  for (const a of alvos) {
    const abs = isAbsolute(a) ? a : resolve(raiz, a)
    if (!existsSync(abs)) {
      console.error(`arquivo alvo não existe: ${a}`)
      console.error("declare os alvos pelo caminho REAL — é por eles que `fechar` confere sha256.")
      process.exit(4)
    }
    arquivos.push({ caminho: relative(raiz, abs), sha256: sha(abs) })
  }

  const dados = {
    guarda: MARCA_SENTINELA,
    aberta_em: new Date().toISOString(),
    quem,
    motivo,
    pid: process.pid,
    arquivos,
  }
  writeFileSync(SENTINELA, `${JSON.stringify(dados, null, 2)}\n`)

  if (existsSync(LOG_ABANDONOS)) {
    const linhas = readFileSync(LOG_ABANDONOS, "utf8").trim().split("\n").filter(Boolean)
    if (linhas.length > 0) {
      console.log(`AVISO: ${linhas.length} abandono(s) já registrado(s) neste repo.`)
      console.log(`  último: ${linhas.at(-1)}`)
      console.log("  Uma janela abandonada pode ter deixado mutante na árvore.\n")
    }
  }

  console.log(`${LINHA}\n  JANELA DE INJEÇÃO ABERTA — nenhum commit passa até fechar\n${LINHA}`)
  console.log(`  quem  : ${quem}`)
  console.log(`  motivo: ${motivo}`)
  for (const a of arquivos) console.log(`  alvo  : ${a.caminho}\n          ${a.sha256}`)
  console.log("\n  Ao terminar:  node scripts/janela-de-injecao.mjs fechar")
  console.log("  (fechar confere os sha256 acima e RECUSA se algum mutante sobreviveu)")
  console.log(LINHA)
}

function cmdFechar() {
  const dados = leSentinela()
  if (!dados) {
    console.error("não há janela aberta (o sentinela não existe).")
    process.exit(3)
  }
  if (dados.ilegivel) {
    console.error(`${LINHA}\n  NÃO DÁ PARA FECHAR — o sentinela está ilegível\n${LINHA}`)
    console.error("\n  Sem os sha256 de abertura, não há como afirmar que a árvore voltou")
    console.error("  ao estado original. Apagar o sentinela agora seria carimbar de limpo")
    console.error("  uma árvore que ninguém verificou.")
    console.error(`\n  conteúdo cru:\n${dados.cru.slice(0, 400)}`)
    console.error("\n  Confira os arquivos na mão e, decidindo assumir, use o escape:")
    console.error(
      `      node scripts/janela-de-injecao.mjs abandonar --confirmo=${CONFIRMACAO} --motivo="..."`,
    )
    process.exit(6)
  }

  const conferido = confere(dados)
  const ruins = conferido.filter((c) => c.situacao !== "idêntico")
  if (ruins.length > 0) {
    console.error(
      `${LINHA}\n  RECUSANDO FECHAR — ${ruins.length} arquivo(s) NÃO voltaram\n${LINHA}`,
    )
    for (const c of ruins) {
      console.error(`\n  ${c.situacao}  ${c.caminho}`)
      console.error(`     na abertura: ${c.sha256}`)
      console.error(`     agora      : ${c.agora}`)
      console.error(`     restaure:    cp ${c.caminho}.mutacao-backup ${c.caminho}`)
    }
    console.error("\n  Janela fechada com mutante dentro é PIOR que janela aberta: a aberta")
    console.error("  barra commits, a fechada libera o defeito com carimbo de limpo.")
    console.error(`\n${LINHA}`)
    process.exit(5)
  }

  rmSync(SENTINELA)
  console.log(
    `janela fechada. ${conferido.length} arquivo(s) conferido(s) por sha256, todos idênticos ao estado de abertura (${duracao(dados.aberta_em)} aberta).`,
  )
}

function cmdEstado() {
  const dados = leSentinela()
  if (!dados) {
    console.log("janela FECHADA — a árvore não está sob injeção declarada.")
    const g = guarda()
    console.log(g.ok ? "guarda ATIVO (pre-commit instalado)." : `guarda INATIVO: ${g.motivo}`)
    if (!g.ok) console.log(comoInstalar())
    process.exit(0)
  }
  if (dados.ilegivel) {
    console.log("sentinela ILEGÍVEL — o hook barra commits por precaução (falha fechado).")
    console.log(`conteúdo cru:\n${dados.cru.slice(0, 400)}`)
    process.exit(2)
  }
  console.log(`janela ABERTA há ${duracao(dados.aberta_em)}`)
  console.log(`  quem  : ${dados.quem}`)
  console.log(`  motivo: ${dados.motivo}`)
  console.log(`  pid   : ${dados.pid}`)
  for (const c of confere(dados)) console.log(`  ${c.situacao.padEnd(9)} ${c.caminho}`)
  // O guarda pode ter sumido DEPOIS da abertura (alguém desligou o hooksPath, ou
  // o arquivo foi removido). Git não deixa falhar fechado nesse caso — o hook
  // simplesmente não roda. Dá para não deixar passar calado.
  const g = guarda()
  if (!g.ok) {
    console.log(`\n  ⚠ guarda INATIVO: ${g.motivo}`)
    console.log("  ⚠ A janela está aberta e NADA está barrando commits agora.")
    console.log(comoInstalar())
  } else {
    console.log("\n  guarda ATIVO — commits barrados enquanto esta janela existir.")
  }
  process.exit(1)
}

function cmdAbandonar() {
  const dados = leSentinela()
  if (!dados) {
    console.error("não há janela aberta para abandonar.")
    process.exit(3)
  }
  const confirmo = opcao("confirmo")
  const motivo = opcao("motivo")
  if (confirmo !== CONFIRMACAO || !motivo) {
    console.error(`${LINHA}\n  ABANDONO RECUSADO — falta confirmação explícita\n${LINHA}`)
    console.error("\n  Abandonar apaga o sentinela SEM conferir que os arquivos voltaram.")
    console.error("  Se um mutante ficou em disco, a próxima pessoa a commitar leva o")
    console.error("  defeito junto — e a suíte vermelha vai parecer teste frágil.")
    console.error("\n  Existe porque janela órfã acontece (no dia do incidente, duas vezes:")
    console.error("  queda de conexão e travamento). Mas é escape, não atalho.")
    console.error("\n  Antes: `estado` mostra quais arquivos divergem. Prefira restaurar")
    console.error("  pelo backup e usar `fechar`, que confere de verdade.")
    console.error("\n  Para abandonar mesmo assim, os DOIS são obrigatórios:")
    console.error(`      --confirmo=${CONFIRMACAO}`)
    console.error('      --motivo="por que a janela ficou órfã"')
    console.error(`\n${LINHA}`)
    process.exit(1)
  }

  const conferido = dados.ilegivel ? [] : confere(dados)
  const ruins = conferido.filter((c) => c.situacao !== "idêntico")

  console.log(`${LINHA}\n  JANELA ABANDONADA — sem conferência de restauração\n${LINHA}`)
  console.log(`  motivo do abandono: ${motivo}`)
  if (dados.ilegivel) {
    console.log("  o sentinela estava ILEGÍVEL — nada a conferir, nada a garantir.")
    console.log(`  conteúdo cru: ${dados.cru.slice(0, 200)}`)
  } else {
    console.log(`  aberta por        : ${dados.quem}`)
    console.log(`  aberta em         : ${dados.aberta_em} (${duracao(dados.aberta_em)})`)
    console.log("\n  ARQUIVOS QUE ESTAVAM SOB INJEÇÃO:")
    for (const c of conferido) console.log(`    ${c.situacao.padEnd(9)} ${c.caminho}`)
    if (ruins.length > 0) {
      console.log(`\n  ⚠ ${ruins.length} arquivo(s) DIVERGEM do estado de abertura.`)
      console.log("  ⚠ ISTO PODE SER UM MUTANTE DEIXADO NA ÁRVORE. Confira antes de commitar:")
      for (const c of ruins) console.log(`      git diff -- ${c.caminho}`)
      for (const c of ruins) console.log(`      cp ${c.caminho}.mutacao-backup ${c.caminho}`)
    } else {
      console.log("\n  Todos idênticos ao estado de abertura — o abandono foi barato desta vez.")
    }
  }

  const registro = `${new Date().toISOString()} | motivo=${motivo} | quem=${dados.quem ?? "?"} | aberta_em=${dados.aberta_em ?? "?"} | divergentes=${ruins.map((c) => c.caminho).join(",") || "nenhum"}`
  appendFileSync(LOG_ABANDONOS, `${registro}\n`)
  rmSync(SENTINELA)
  console.log(`\n  registrado em ${relative(raiz, LOG_ABANDONOS)}`)
  console.log("  a árvore voltou a aceitar commits — a responsabilidade agora é sua.")
  console.log(LINHA)
}

function cmdAjuda() {
  console.log(
    readFileSync(new URL(import.meta.url), "utf8")
      .split("\n")
      .slice(1, 9)
      .join("\n"),
  )
  console.log(`\nestado atual do guarda: ${guarda().ok ? "ATIVO" : "INATIVO"}`)
}

const COMANDOS = {
  instalar: cmdInstalar,
  abrir: cmdAbrir,
  fechar: cmdFechar,
  estado: cmdEstado,
  abandonar: cmdAbandonar,
  ajuda: cmdAjuda,
}

const executa = COMANDOS[comando]
if (!executa) {
  console.error(`comando desconhecido: ${comando}`)
  cmdAjuda()
  process.exit(1)
}
executa()
