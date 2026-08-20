#!/usr/bin/env node
// USO: node scripts/janela-de-injecao.test.mjs
//
// ---------------------------------------------------------------------------
// O teste do guarda da janela de injeção.
// ---------------------------------------------------------------------------
// TODO commit deste teste acontece em REPO TEMPORÁRIO DESCARTÁVEL (`/tmp`).
// Testar um bloqueio de commit commitando de verdade no repo de trabalho é
// exatamente o acidente que o mecanismo existe para impedir.
//
// Cada cenário monta um repo git novo, copia para dentro dele os DOIS artefatos
// REAIS deste repo (`.githooks/pre-commit` e `scripts/janela-de-injecao.mjs`) e
// o `.gitignore` REAL — o que passa aqui é o que está versionado, não uma cópia
// didática que diverge na primeira manutenção.
//
// O que ele prova, em três blocos:
//
//   CONTROLE POSITIVO  o hook RECUSA com a janela aberta e ACEITA com ela
//                      fechada. Um guarda que nunca barrou ninguém é decoração.
//   VACUIDADE          hook ausente, `core.hooksPath` ausente, sentinela vazio
//                      e sentinela malformado. Em todos, o sistema falha FECHADO
//                      (recusa) — nunca passa em silêncio.
//   INTEGRIDADE        fechar confere sha256 e recusa fechar com mutante dentro;
//                      o sentinela é impossível de commitar; o escape existe mas
//                      exige confirmação literal e deixa registro.
// ---------------------------------------------------------------------------

import { spawnSync } from "node:child_process"
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { chmodSync, mkdirSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const HOOK_FONTE = `${RAIZ}/.githooks/pre-commit`
const CLI_FONTE = `${RAIZ}/scripts/janela-de-injecao.mjs`
const IGNORE_FONTE = `${RAIZ}/.gitignore`

const CONTEUDO_ALVO = "export const TOPO = 12\n"
const CONTEUDO_MUTANTE = "export const TOPO = 60\n"

// --- utilidades -------------------------------------------------------------

/** Roda um comando e devolve `{ codigo, saida }`. Nunca lança: o código É o dado. */
function roda(cmd, args, cwd, env) {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
  })
  return { codigo: r.status, saida: `${r.stdout ?? ""}${r.stderr ?? ""}` }
}

const git = (cwd, ...args) => roda("git", args, cwd)
const cli = (cwd, ...args) => roda("node", ["scripts/janela-de-injecao.mjs", ...args], cwd)

/** Repo de mentira, descartável, com os artefatos REAIS deste repo dentro. */
function repoDeMentira() {
  const dir = mkdtempSync(`${tmpdir()}/janela-teste-`)
  git(dir, "init", "-q", "-b", "main")
  git(dir, "config", "user.email", "teste@exemplo.invalido")
  git(dir, "config", "user.name", "Teste")
  git(dir, "config", "commit.gpgsign", "false")

  mkdirSync(`${dir}/.githooks`, { recursive: true })
  mkdirSync(`${dir}/scripts`, { recursive: true })
  copyFileSync(HOOK_FONTE, `${dir}/.githooks/pre-commit`)
  copyFileSync(CLI_FONTE, `${dir}/scripts/janela-de-injecao.mjs`)
  copyFileSync(IGNORE_FONTE, `${dir}/.gitignore`)

  writeFileSync(`${dir}/alvo.txt`, CONTEUDO_ALVO)
  writeFileSync(`${dir}/outro.txt`, "arquivo sem relação nenhuma com o alvo\n")
  git(dir, "config", "core.hooksPath", ".githooks")
  git(dir, "add", ".gitignore", ".githooks/pre-commit", "scripts/janela-de-injecao.mjs", "alvo.txt")
  const inicial = git(dir, "commit", "-q", "-m", "commit inicial")
  if (inicial.codigo !== 0) throw new Error(`commit inicial falhou: ${inicial.saida}`)
  return dir
}

/** Tenta commitar `outro.txt` — o arquivo SEM RELAÇÃO com o que está sob injeção. */
function tentaCommitar(dir, marca = String(Date.now())) {
  writeFileSync(`${dir}/outro.txt`, `mexido ${marca}\n`)
  git(dir, "add", "outro.txt")
  return git(dir, "commit", "-m", `commit de teste ${marca}`)
}

const abrir = (dir, ...extra) =>
  cli(dir, "abrir", "--quem=teste", "--motivo=varredura de mutação", "--arquivo=alvo.txt", ...extra)

// --- harness ----------------------------------------------------------------

const resultados = []
function caso(nome, corpo) {
  try {
    const dir = repoDeMentira()
    try {
      corpo(dir, (condicao, detalhe) => {
        if (!condicao) throw new Error(detalhe)
      })
      resultados.push(["PASSA", nome, ""])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  } catch (e) {
    resultados.push(["REPROVA", nome, e.message.split("\n").slice(0, 4).join(" | ")])
  }
}

/** Caso que olha ESTE repo, sem repo de mentira. */
function casoDireto(nome, corpo) {
  try {
    corpo((condicao, detalhe) => {
      if (!condicao) throw new Error(detalhe)
    })
    resultados.push(["PASSA", nome, ""])
  } catch (e) {
    resultados.push(["REPROVA", nome, e.message.split("\n").slice(0, 4).join(" | ")])
  }
}

// ═══ ARTEFATO VERSIONADO ════════════════════════════════════════════════════

casoDireto("ART-1 o hook versionado existe, é executável e tem o marcador", (exige) => {
  exige(existsSync(HOOK_FONTE), `não existe: ${HOOK_FONTE}`)
  const modo = statSync(HOOK_FONTE).mode & 0o111
  exige(modo !== 0, `sem bit de execução (modo ${modo.toString(8)}) — git guardaria 100644`)
  const corpo = readFileSync(HOOK_FONTE, "utf8")
  exige(corpo.includes("JANELA-DE-INJECAO-GUARDA-V1"), "sem o marcador que o `abrir` confere")
})

// ═══ CONTROLE POSITIVO ══════════════════════════════════════════════════════

caso("CP-1  janela ABERTA: o commit é RECUSADO", (dir, exige) => {
  const a = abrir(dir)
  exige(a.codigo === 0, `abrir devia sair 0, saiu ${a.codigo}: ${a.saida}`)
  exige(existsSync(`${dir}/.janela-de-injecao.json`), "sentinela não foi criado")
  const c = tentaCommitar(dir)
  exige(c.codigo !== 0, `o commit passou com a janela aberta (codigo ${c.codigo})`)
})

caso("CP-1b a recusa EXPLICA (não é exit 1 mudo)", (dir, exige) => {
  abrir(dir)
  const c = tentaCommitar(dir)
  const s = c.saida.toLowerCase()
  exige(
    s.includes("janela de injeção") || s.includes("janela de injecao"),
    `sem o nome: ${c.saida}`,
  )
  exige(s.includes("fechar"), `não diz como sair: ${c.saida}`)
  exige(s.includes("alvo.txt"), `não diz qual arquivo está sob injeção: ${c.saida}`)
  exige(s.includes("teste"), `não diz quem abriu: ${c.saida}`)
})

caso("CP-2  janela FECHADA: o commit é ACEITO", (dir, exige) => {
  abrir(dir)
  const f = cli(dir, "fechar")
  exige(f.codigo === 0, `fechar devia sair 0, saiu ${f.codigo}: ${f.saida}`)
  exige(!existsSync(`${dir}/.janela-de-injecao.json`), "sentinela sobreviveu ao fechar")
  const c = tentaCommitar(dir)
  exige(c.codigo === 0, `o commit foi recusado com a janela fechada: ${c.saida}`)
  exige(git(dir, "log", "--oneline").saida.includes("commit de teste"), "o commit não entrou")
})

caso("CP-3  coincidência de ESCOPO não salva ninguém", (dir, exige) => {
  // O incidente: commitaram o arquivo de TESTE enquanto a injeção estava no de
  // COMPONENTE, e passou por sorte. Aqui o commit não toca `alvo.txt` — e ainda
  // assim tem que ser recusado.
  abrir(dir)
  const c = tentaCommitar(dir)
  exige(c.codigo !== 0, "commit de arquivo sem relação passou com a janela aberta")
  const idx = git(dir, "diff", "--cached", "--name-only").saida
  exige(!idx.includes("alvo.txt"), `o teste encenou errado, alvo.txt está no índice: ${idx}`)
})

// ═══ VACUIDADE ══════════════════════════════════════════════════════════════

caso("VAC-1 hook AUSENTE: abrir RECUSA (não abre janela sem guarda)", (dir, exige) => {
  rmSync(`${dir}/.githooks/pre-commit`)
  const a = abrir(dir)
  exige(a.codigo !== 0, `abriu janela sem hook instalado (codigo ${a.codigo}): ${a.saida}`)
  exige(!existsSync(`${dir}/.janela-de-injecao.json`), "criou sentinela mesmo recusando")
  exige(a.saida.includes("hooksPath"), `não diz como instalar: ${a.saida}`)
})

caso("VAC-2 core.hooksPath AUSENTE: abrir RECUSA", (dir, exige) => {
  git(dir, "config", "--unset", "core.hooksPath")
  const a = abrir(dir)
  exige(a.codigo !== 0, `abriu janela sem hooksPath (codigo ${a.codigo}): ${a.saida}`)
  exige(!existsSync(`${dir}/.janela-de-injecao.json`), "criou sentinela mesmo recusando")
})

caso("VAC-2b core.hooksPath apontando para OUTRO lugar: abrir RECUSA", (dir, exige) => {
  mkdirSync(`${dir}/.outro-lugar`, { recursive: true })
  git(dir, "config", "core.hooksPath", ".outro-lugar")
  const a = abrir(dir)
  exige(a.codigo !== 0, `abriu janela com hooksPath errado (codigo ${a.codigo}): ${a.saida}`)
})

caso("VAC-3 sentinela VAZIO: commit RECUSADO (falha fechado)", (dir, exige) => {
  writeFileSync(`${dir}/.janela-de-injecao.json`, "")
  const c = tentaCommitar(dir)
  exige(c.codigo !== 0, `commit passou com sentinela vazio (codigo ${c.codigo})`)
  exige(/ileg|malform|vazio|corromp/i.test(c.saida), `não avisa que está ilegível: ${c.saida}`)
})

caso("VAC-4 sentinela MALFORMADO: commit RECUSADO (falha fechado)", (dir, exige) => {
  writeFileSync(`${dir}/.janela-de-injecao.json`, "isto não é json {{{ ")
  const c = tentaCommitar(dir)
  exige(c.codigo !== 0, `commit passou com sentinela malformado (codigo ${c.codigo})`)
})

caso("VAC-5 sentinela ILEGÍVEL: fechar RECUSA e manda pelo escape", (dir, exige) => {
  writeFileSync(`${dir}/.janela-de-injecao.json`, "{ isto não fecha")
  const f = cli(dir, "fechar")
  exige(f.codigo !== 0, `fechou um sentinela ilegível (codigo ${f.codigo})`)
  exige(existsSync(`${dir}/.janela-de-injecao.json`), "apagou o sentinela que não conseguiu ler")
  exige(f.saida.includes("abandonar"), `não aponta o escape: ${f.saida}`)
})

caso("VAC-7 hook SEM bit de execução: abrir RECUSA", (dir, exige) => {
  // git não trata isto como erro: ele ignora o hook com um aviso e commita.
  // É a vacuidade mais silenciosa das cinco, porque o arquivo ESTÁ lá.
  chmodSync(`${dir}/.githooks/pre-commit`, 0o644)
  const a = abrir(dir)
  exige(a.codigo !== 0, `abriu janela com hook inerte (codigo ${a.codigo}): ${a.saida}`)
  exige(/execut/i.test(a.saida), `não diz que o problema é o bit de execução: ${a.saida}`)
})

caso("VAC-6 guarda removido DEPOIS de abrir: `estado` grita", (dir, exige) => {
  // Buraco residual honesto: git não tem como impedir que o hook suma no meio
  // da janela. Não dá para falhar fechado — dá para não deixar passar calado.
  abrir(dir)
  rmSync(`${dir}/.githooks/pre-commit`)
  const e = cli(dir, "estado")
  exige(e.codigo === 1, `janela aberta devia ser 1, foi ${e.codigo}`)
  exige(/guarda\s+INATIVO/i.test(e.saida), `não avisa que ficou sem guarda: ${e.saida}`)
})

// ═══ INTEGRIDADE ════════════════════════════════════════════════════════════

caso("INT-1 fechar com MUTANTE dentro é RECUSADO (sha256 divergente)", (dir, exige) => {
  abrir(dir)
  writeFileSync(`${dir}/alvo.txt`, CONTEUDO_MUTANTE)
  const f = cli(dir, "fechar")
  exige(f.codigo !== 0, `fechou a janela com o mutante em disco (codigo ${f.codigo})`)
  exige(existsSync(`${dir}/.janela-de-injecao.json`), "sentinela sumiu mesmo com a recusa")
  exige(f.saida.includes("alvo.txt"), `não diz qual arquivo divergiu: ${f.saida}`)
  const c = tentaCommitar(dir)
  exige(c.codigo !== 0, "com a recusa de fechar, o commit tinha que seguir barrado")
})

caso("INT-2 fechar DEPOIS de restaurar: aceito, e o commit volta", (dir, exige) => {
  abrir(dir)
  writeFileSync(`${dir}/alvo.txt`, CONTEUDO_MUTANTE)
  exige(cli(dir, "fechar").codigo !== 0, "devia recusar antes de restaurar")
  writeFileSync(`${dir}/alvo.txt`, CONTEUDO_ALVO)
  const f = cli(dir, "fechar")
  exige(f.codigo === 0, `recusou fechar com o arquivo restaurado: ${f.saida}`)
  exige(tentaCommitar(dir).codigo === 0, "commit segue barrado depois de fechar")
})

caso("INT-3 arquivo sob injeção que SUMIU conta como divergência", (dir, exige) => {
  abrir(dir)
  rmSync(`${dir}/alvo.txt`)
  const f = cli(dir, "fechar")
  exige(f.codigo !== 0, `fechou com o arquivo alvo ausente (codigo ${f.codigo})`)
})

caso("INT-4 o sentinela é IMPOSSÍVEL de commitar", (dir, exige) => {
  abrir(dir)
  const ig = git(dir, "check-ignore", "-q", ".janela-de-injecao.json")
  exige(ig.codigo === 0, "o sentinela NÃO está no .gitignore versionado")
  const st = git(dir, "status", "--porcelain", "-uall").saida
  exige(!st.includes(".janela-de-injecao.json"), `aparece no status: ${st}`)
  // e mesmo forçado ao índice, o hook barra
  git(dir, "add", "-f", ".janela-de-injecao.json")
  const c = git(dir, "commit", "-m", "tentando levar o sentinela junto")
  exige(c.codigo !== 0, "commitou o sentinela forçado ao índice")
})

caso("INT-6 sentinela no ÍNDICE mas já fora do disco: ainda recusado", (dir, exige) => {
  // O buraco que a varredura de mutação achou neste próprio teste: INT-4 deixa o
  // sentinela em disco, então a segunda barreira do hook (existência) responde
  // sozinha, e a primeira (índice) fica sem prova. É este o caso que a isola —
  // alguém força o sentinela ao índice e a janela fecha antes do commit.
  abrir(dir)
  git(dir, "add", "-f", ".janela-de-injecao.json")
  cli(dir, "fechar") // janela fecha, arquivo some do disco, mas segue no índice
  exige(!existsSync(`${dir}/.janela-de-injecao.json`), "encenação errada: o arquivo ficou em disco")
  const c = git(dir, "commit", "-m", "levando o sentinela sem ele existir")
  exige(c.codigo !== 0, `commitou o sentinela vindo só do índice (codigo ${c.codigo})`)
  exige(/índice|indice/i.test(c.saida), `não explica que o problema é o índice: ${c.saida}`)
})

caso("INT-5 abrir com janela JÁ ABERTA não sobrescreve", (dir, exige) => {
  abrir(dir)
  const antes = readFileSync(`${dir}/.janela-de-injecao.json`, "utf8")
  const a2 = cli(dir, "abrir", "--quem=outro", "--motivo=outra coisa", "--arquivo=outro.txt")
  exige(a2.codigo !== 0, `abriu por cima de uma janela aberta (codigo ${a2.codigo})`)
  exige(
    readFileSync(`${dir}/.janela-de-injecao.json`, "utf8") === antes,
    "sobrescreveu o sentinela",
  )
})

// ═══ INSTALAÇÃO ═════════════════════════════════════════════════════════════

caso("INS-1 instalar num repo SEM hooksPath deixa o guarda vivo", (dir, exige) => {
  git(dir, "config", "--unset", "core.hooksPath")
  const i = cli(dir, "instalar")
  exige(i.codigo === 0, `instalar falhou: ${i.saida}`)
  exige(git(dir, "config", "core.hooksPath").saida.trim() === ".githooks", "não configurou")
  exige(abrir(dir).codigo === 0, "depois de instalar, abrir ainda recusa")
  exige(tentaCommitar(dir).codigo !== 0, "instalou e mesmo assim o commit passou")
})

caso("INS-2 instalar com o hook AUSENTE recusa (não mente sucesso)", (dir, exige) => {
  rmSync(`${dir}/.githooks/pre-commit`)
  const i = cli(dir, "instalar")
  exige(i.codigo !== 0, `disse ter instalado sem hook nenhum (codigo ${i.codigo}): ${i.saida}`)
})

caso("INS-3 instalar com pre-commit ALHEIO recusa (falta o marcador)", (dir, exige) => {
  writeFileSync(`${dir}/.githooks/pre-commit`, "#!/bin/sh\n# outro hook qualquer\nexit 0\n", {
    mode: 0o755,
  })
  const i = cli(dir, "instalar")
  exige(i.codigo !== 0, `carimbou de instalado um hook que não é o guarda (codigo ${i.codigo})`)
  exige(/marcador/i.test(i.saida), `não diz por que recusou: ${i.saida}`)
})

// ═══ ESCAPE ═════════════════════════════════════════════════════════════════

caso("ESC-1 abandonar SEM confirmação literal é recusado", (dir, exige) => {
  abrir(dir)
  const a = cli(dir, "abandonar")
  exige(a.codigo !== 0, `abandonou sem confirmação (codigo ${a.codigo})`)
  const b = cli(dir, "abandonar", "--motivo=o agente morreu")
  exige(b.codigo !== 0, "abandonou só com motivo, sem a confirmação literal")
  const c = cli(dir, "abandonar", "--confirmo=ASSUMO-O-RISCO")
  exige(c.codigo !== 0, "abandonou sem motivo")
  exige(existsSync(`${dir}/.janela-de-injecao.json`), "sentinela sumiu numa recusa de abandono")
})

caso("ESC-2 abandonar COMPLETO some com o sentinela e deixa registro", (dir, exige) => {
  abrir(dir)
  writeFileSync(`${dir}/alvo.txt`, CONTEUDO_MUTANTE) // o pior caso: mutante em disco
  const a = cli(dir, "abandonar", "--confirmo=ASSUMO-O-RISCO", "--motivo=queda de conexão")
  exige(a.codigo === 0, `abandono completo recusado: ${a.saida}`)
  exige(!existsSync(`${dir}/.janela-de-injecao.json`), "sentinela sobreviveu ao abandono")
  exige(a.saida.includes("alvo.txt"), `não lista o arquivo em risco: ${a.saida}`)
  exige(/diverg|MUTANTE|difere/i.test(a.saida), `não grita a divergência: ${a.saida}`)
  const log = `${dir}/.janela-de-injecao-abandonos.log`
  exige(existsSync(log), "não deixou registro de auditoria")
  exige(readFileSync(log, "utf8").includes("queda de conexão"), "o registro não guarda o motivo")
  exige(tentaCommitar(dir).codigo === 0, "o commit segue barrado depois do abandono")
})

caso("ESC-3 o registro de abandono também não vai para o commit", (dir, exige) => {
  abrir(dir)
  cli(dir, "abandonar", "--confirmo=ASSUMO-O-RISCO", "--motivo=teste")
  const ig = git(dir, "check-ignore", "-q", ".janela-de-injecao-abandonos.log")
  exige(ig.codigo === 0, "o log de abandonos NÃO está no .gitignore versionado")
})

// ═══ ESTADO ═════════════════════════════════════════════════════════════════

caso("EST-1 `estado` responde por código de saída", (dir, exige) => {
  exige(cli(dir, "estado").codigo === 0, "fechada devia ser 0")
  abrir(dir)
  exige(cli(dir, "estado").codigo === 1, "aberta devia ser 1")
  writeFileSync(`${dir}/.janela-de-injecao.json`, "lixo")
  exige(cli(dir, "estado").codigo === 2, "ilegível devia ser 2")
})

// --- relatório --------------------------------------------------------------

let reprovou = 0
for (const [veredito, nome, detalhe] of resultados) {
  if (veredito === "REPROVA") reprovou++
  console.log(`${veredito.padEnd(8)} ${nome}${detalhe ? `\n         ↳ ${detalhe}` : ""}`)
}
console.log(`\n${resultados.length - reprovou} de ${resultados.length} passaram`)
process.exit(reprovou > 0 ? 1 : 0)
