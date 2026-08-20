// USO: node scripts/mutacao.mjs [--somente=ROTULO,ROTULO] [--suite=caminho,caminho]
//      Sem argumento roda os 30 mutantes da área "Padrões e tendências".
//      TEMPO: ~5s de baseline + ~6s por mutante. 30 mutantes ≈ 3min30. 7 ≈ 50s.
//
// ---------------------------------------------------------------------------
// mutacao — a varredura que pega o que teste de invariância NÃO pega.
// ---------------------------------------------------------------------------
// O QUE ELA FAZ: para cada constante ou trecho estrutural da lista `MUTANTES`,
// perturba o código, roda a suíte, REVERTE, e compara o conjunto de testes
// vermelhos com o do baseline. Constante cuja perturbação não vira nada é
// achado, e o relatório tem que dizer QUAL dos dois casos é, porque a ação é
// oposta: a MORTA (não chega à saída) some do código; a NÃO COBERTA (chega, e
// nenhum teste olha) ganha teste.
//
// POR QUE ELA EXISTE. Três detectores comuns são cegos para a mesma família:
//
//   • `tsc --noUnusedLocals --noUnusedParameters` pega declarado-e-nunca-lido,
//     e NÃO pega valor lido e depois aniquilado (`x * 0 + 1` devolvendo sempre 1);
//   • contar ocorrência do identificador pega local morto, e NÃO pega constante
//     lida cuja variação não muda saída nenhuma;
//   • teste de invariância NÃO pega nada disso por construção — a função
//     constante satisfaz TODA invariância.
//
// O CASO QUE ORIGINOU ISTO (2026-08-20, §17 "Evolução do ritmo"): três asserções
// escritas de boa-fé eram TAUTOLÓGICAS —
//
//     expect(marcador.cy).toBe(BASE)   // BASE importado do MÓDULO SOB TESTE
//
// Mutar `BASE` de 162 para 120 movia o `cy` e movia a expectativa JUNTO. Verde
// sempre. Uma asserção que não pode falhar é pior que asserção nenhuma, porque
// ocupa a vaga: um buraco declarado se fecha, um buraco com carimbo de PASS por
// cima dorme até a produção. A correção não foi somar asserção, foi TROCAR A
// ÂNCORA — comparar com um fato EXTERNO (lido do DOM, do contrato, da camada de
// dados) em vez de comparar o módulo consigo mesmo.
//
// E o critério "importa constante do módulo" NÃO serve para achar tautologia:
// no mesmo arquivo, `PASSO_DE_DESLOCAMENTO` e `RAIO_MARCA` são importados e
// usados em asserção, e os dois ACUSAM. O que decide é se os dois lados da
// comparação se movem juntos, e só a mutação responde isso. Ler não responde.
//
// ═══ DUAS REGRAS DE OPERAÇÃO, E NENHUMA É OPCIONAL ═════════════════════════
//
//   1. INJEÇÃO NUNCA ACONTECE EM ÁRVORE COMPARTILHADA SEM AVISO. Um defeito
//      injetado e um defeito real são o mesmo byte no disco: quem lê de fora não
//      tem como distinguir. Ou clone isolado, ou uma janela ANUNCIADA — avisada
//      ao abrir e ao fechar, com ninguém commitando nem lendo a árvore como
//      verdade enquanto ela estiver aberta. Nesta casa um verificador quase
//      julgou uma injeção em voo como defeito esquecido.
//
//   2. BASELINE COM ZERO FALHA. Com baseline sujo a leitura vira ambígua; com
//      zero, todo vermelho depois de uma mutação É a mutação. O script recusa
//      rodar se o baseline tiver falha.
//
// SEGURANÇA: cada arquivo alvo é copiado para `.mutacao-backup` antes da
// primeira injeção e restaurado ao final, com conferência de sha256. Se o
// processo morrer no meio, o backup fica em disco e a restauração é
// `cp arquivo.mutacao-backup arquivo`.
//
// CLONE ISOLADO E BARATO (o caminho preferido): não copie o repo inteiro.
//   ORIG=$PWD; CL=/tmp/mut-alvo
//   rsync -a --exclude node_modules --exclude .next "$ORIG/apps/web/src/" "$CL/apps/web/src/"
//   for f in package.json tsconfig.json vitest.config.ts; do cp "$ORIG/apps/web/$f" "$CL/apps/web/$f"; done
//   ln -s "$ORIG/node_modules" "$CL/node_modules"; ln -s "$ORIG/apps/web/node_modules" "$CL/apps/web/node_modules"
// O alias `@` do vitest.config.ts resolve para o `src` do CLONE.
// ---------------------------------------------------------------------------

import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { copyFileSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const RAIZ_REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const APP = `${RAIZ_REPO}/apps/web`

const GRAFICO = `${APP}/src/components/analytics/padroes-tendencias/grafico-ritmo.tsx`
const BASE = `${APP}/src/lib/analytics/padroes-tendencias/base.ts`
const SERIE = `${APP}/src/lib/analytics/padroes-tendencias/serie.ts`

const SUITE_PADRAO = [
  "src/lib/analytics/padroes-tendencias",
  "src/components/analytics/padroes-tendencias",
]

/**
 * [rótulo, arquivo, trecho original, trecho mutado].
 *
 * É a ÚNICA coisa a trocar para apontar a varredura a outro alvo. O motor não
 * muda. Os 30 abaixo são os da rodada de origem, e servem de exemplo de calibre:
 * há mutante por constante numérica, por cor, por estrutura de mapa (trocar as
 * duas séries) e por ramo de função (degenerar o passo, remover a contenção).
 */
const MUTANTES = [
  ["LARGURA", GRAFICO, "export const LARGURA = 432", "export const LARGURA = 999"],
  ["ALTURA", GRAFICO, "const ALTURA = 190", "const ALTURA = 260"],
  ["TOPO", GRAFICO, "const TOPO = 12", "const TOPO = 60"],
  ["BASE", GRAFICO, "export const BASE = 162", "export const BASE = 120"],
  ["EIXO_X", GRAFICO, "export const EIXO_X = 30", "export const EIXO_X = 90"],
  ["FIM_X", GRAFICO, "export const FIM_X = 430", "export const FIM_X = 300"],
  ["GRADE", GRAFICO, 'const GRADE = "#EDE8E5"', 'const GRADE = "#112233"'],
  ["GRADE_ZERO", GRAFICO, 'const GRADE_ZERO = "#DCD5D1"', 'const GRADE_ZERO = "#445566"'],
  [
    "TINTA_ATIVOS",
    GRAFICO,
    'const TINTA_ATIVOS = TINTA_FAIXA["2x-ou-mais"]',
    'const TINTA_ATIVOS = "#123456"',
  ],
  [
    "TINTA_SESSOES",
    GRAFICO,
    'const TINTA_SESSOES = TINTA_FAIXA["1x"]',
    'const TINTA_SESSOES = "#654321"',
  ],
  [
    "TINTA_DA_SERIE",
    GRAFICO,
    "  ativos: TINTA_ATIVOS,\n  sessoes: TINTA_SESSOES,",
    "  ativos: TINTA_SESSOES,\n  sessoes: TINTA_ATIVOS,",
  ],
  ["VALOR_DA_SERIE", GRAFICO, "  sessoes: (p) => p.sessoes,", "  sessoes: (p) => p.ativos,"],
  [
    "PASSO_DE_DESLOCAMENTO",
    GRAFICO,
    "export const PASSO_DE_DESLOCAMENTO = 8",
    "export const PASSO_DE_DESLOCAMENTO = 0",
  ],
  ["RAIO_MARCA", GRAFICO, "export const RAIO_MARCA = 3.2", "export const RAIO_MARCA = 9"],
  [
    "ORDEM_DE_PINTURA",
    GRAFICO,
    'const ORDEM_DE_PINTURA: readonly IdSerie[] = ["sessoes", "ativos"]',
    'const ORDEM_DE_PINTURA: readonly IdSerie[] = ["ativos", "sessoes"]',
  ],
  ["ESPESSURA_DA_SERIE", GRAFICO, "{ ativos: 1.6, sessoes: 2.2 }", "{ ativos: 2.2, sessoes: 2.2 }"],
  [
    "TRACEJADO_DA_SERIE",
    GRAFICO,
    '{ ativos: "5 3.4", sessoes: null }',
    "{ ativos: null, sessoes: null }",
  ],
  ["FONTE_EIXO_Y", GRAFICO, "const FONTE_EIXO_Y = 9", "const FONTE_EIXO_Y = 22"],
  ["FONTE_ROTULO_X", GRAFICO, "const FONTE_ROTULO_X = 8.6", "const FONTE_ROTULO_X = 4"],
  ["FONTE_VALOR", GRAFICO, "const FONTE_VALOR = 8", "const FONTE_VALOR = 2"],
  [
    "LARGURA_CARACTERE",
    GRAFICO,
    "const LARGURA_CARACTERE = 0.56",
    "const LARGURA_CARACTERE = 0.05",
  ],
  ["VAO_ROTULO", GRAFICO, "const VAO_ROTULO = 6", "const VAO_ROTULO = 600"],
  ["VAO_VALOR", GRAFICO, "const VAO_VALOR = 2.5", "const VAO_VALOR = 40"],
  [
    "SEPARADOR_DE_INTERVALO",
    GRAFICO,
    "const SEPARADOR_DE_INTERVALO = /\\s[^\\p{L}\\p{N}]+\\s/u",
    "const SEPARADOR_DE_INTERVALO = /ZZZNUNCACASA/u",
  ],
  [
    "passoDosRotulos",
    GRAFICO,
    "  return Math.max(1, Math.ceil((maior + VAO_ROTULO) / fatia))",
    "  return Math.max(1, Math.ceil((maior + VAO_ROTULO) / fatia)) * 0 + 1",
  ],
  [
    "xDoRotulo",
    GRAFICO,
    "  return Math.min(Math.max(centro, meia + 1), LARGURA - meia - 1)",
    "  return centro + meia * 0",
  ],
  [
    "rotulosDoEixo",
    GRAFICO,
    'textos: usados.map((t, i) => ((n - 1 - i) % passo === 0 ? t : "")),',
    'textos: usados.map((t, i) => (i % passo === 0 ? t : "")),',
  ],
  [
    "base:so-created_at",
    BASE,
    "      if (i >= 0) semanasDaSessao.add(i)",
    "      if (i >= 0 && iso === s.created_at) semanasDaSessao.add(i)",
  ],
  [
    "base:sem-dedupe",
    BASE,
    "    for (const i of semanasDaSessao) sessoesPorSemana[i] = (sessoesPorSemana[i] ?? 0) + 1",
    "    for (const i of semanasDaSessao) sessoesPorSemana[i] = (sessoesPorSemana[i] ?? 0) + 2",
  ],
  [
    "base:ativos-sem-updated_at",
    BASE,
    "      lista.push(t)\n      const i = indiceDoBalde(semanas, t)",
    "      if (iso === s.created_at) lista.push(t)\n      const i = indiceDoBalde(semanas, t)",
  ],
  [
    "serie:eixo-no-pico",
    SERIE,
    "  if (pico > totalRecorte) return eixoY(pico)\n  return eixoAncorado(totalRecorte)",
    "  if (pico > totalRecorte) return eixoY(pico)\n  return eixoAncorado(Math.max(1, pico))",
  ],
]

const argv = process.argv.slice(2)
const arg = (nome) => argv.find((a) => a.startsWith(`--${nome}=`))?.split("=")[1]
const somente = arg("somente")
  ?.split(",")
  .map((s) => s.trim())
const suite =
  arg("suite")
    ?.split(",")
    .map((s) => s.trim()) ?? SUITE_PADRAO

const sha = (arquivo) => createHash("sha256").update(readFileSync(arquivo)).digest("hex")

function rodar() {
  try {
    return execFileSync("pnpm", ["exec", "vitest", "run", ...suite, "--reporter=basic"], {
      cwd: APP,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 600_000,
    })
  } catch (e) {
    return `${e.stdout ?? ""}${e.stderr ?? ""}`
  }
}

/** Nomes dos testes vermelhos. O CONJUNTO, não a contagem: o que importa é quais. */
function vermelhos(saida) {
  const nomes = new Set()
  for (const m of saida.matchAll(/^ FAIL {2}(.+?) > (.+)$/gm)) nomes.add(m[2].trim())
  return [...nomes]
}

const escolhidos = MUTANTES.filter(([r]) => !somente || somente.includes(r))
if (escolhidos.length === 0) {
  console.error(`nenhum mutante casa com --somente=${somente?.join(",")}`)
  process.exit(2)
}

// --- backup e conferência de integridade -----------------------------------
const arquivos = [...new Set(escolhidos.map(([, f]) => f))]
const shaAntes = new Map(arquivos.map((f) => [f, sha(f)]))
for (const f of arquivos) copyFileSync(f, `${f}.mutacao-backup`)
console.log(`backup de ${arquivos.length} arquivo(s) em *.mutacao-backup`)
for (const [f, h] of shaAntes) console.log(`  ${h}  ${f.replace(`${RAIZ_REPO}/`, "")}`)

const saidaBase = rodar()
console.log(`\nBASELINE  ${(saidaBase.match(/Tests {2}.*/)?.[0] ?? "?").trim()}`)
const base = vermelhos(saidaBase)
if (base.length > 0) {
  console.error(`\nBASELINE SUJO (${base.length} vermelho). Corrija antes: a leitura fica ambígua.`)
  for (const n of base) console.error(`  · ${n}`)
  process.exit(3)
}

const silenciosos = []
for (const [rotulo, arquivo, de, para] of escolhidos) {
  const original = readFileSync(arquivo, "utf8")
  if (!original.includes(de)) {
    console.log(`INVALIDO  ${rotulo}  —  trecho não encontrado (o código mudou de forma)`)
    silenciosos.push([rotulo, "mutante inválido: o trecho não existe mais"])
    continue
  }
  writeFileSync(arquivo, original.replace(de, para))
  const saida = rodar()
  writeFileSync(arquivo, original)
  const novas = vermelhos(saida).filter((n) => !base.includes(n))
  console.log(
    `${(novas.length > 0 ? "ACUSA" : "SILENCIO").padEnd(9)} ${rotulo}  →  ${novas.length}`,
  )
  for (const n of novas.slice(0, 3)) console.log(`            · ${n}`)
  if (novas.length === 0) silenciosos.push([rotulo, "nenhum teste virou"])
}

// --- restauração conferida --------------------------------------------------
let sujo = false
for (const f of arquivos) {
  if (sha(f) !== shaAntes.get(f)) {
    copyFileSync(`${f}.mutacao-backup`, f)
    if (sha(f) !== shaAntes.get(f)) {
      console.error(`ARQUIVO NÃO RESTAURADO: ${f}`)
      sujo = true
    }
  }
}
console.log(
  `\nrestauração conferida por sha256: ${sujo ? "FALHOU" : "ok, todos idênticos ao início"}`,
)

console.log("\n===== SILENCIOSOS (achado: morto ou não coberto — diga qual) =====")
if (silenciosos.length === 0) console.log("nenhum")
for (const [r, m] of silenciosos) console.log(`- ${r}: ${m}`)
process.exit(sujo ? 4 : 0)
