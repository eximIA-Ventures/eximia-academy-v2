#!/usr/bin/env node
// ===========================================================================
// GATE D17 — ROTAS DE MARCA NÃO PODEM SAIR PRÉ-RENDERIZADAS ESTATICAMENTE.
//
// Substitui os dois gates da marca por build-arg (D18): agora a marca vem do
// BANCO em runtime (`tenants.brand`, D4), não mais de `NEXT_PUBLIC_TENANT_*`
// inlinadas em build-time. Isso muda o defeito que precisa de gate: o risco
// deixou de ser "o bundle saiu com a marca errada" e passou a ser "o Next
// decidiu pré-renderizar a rota como HTML estático no BUILD", porque nesse
// caso o HTML gerado carrega a marca de QUEM QUER QUE tenha resolvido durante
// o build (tipicamente NEUTRO, ou o tenant do primeiro request de warm-up) — e
// esse HTML é servido para TODO mundo depois, em produção, sem olhar o host da
// requisição. Um servidor único atendendo `n` tenants por host (D1/D2) não
// pode ter isso em nenhuma rota que a marca alcança.
//
// A correção em código é `export const dynamic = "force-dynamic"` nos
// layouts/páginas que consomem `getTenantConfig()` (D17). Este arquivo é o
// CHECKER: mede o que o `next build` de fato produziu, não a intenção. Igual
// doutrina dos gates antigos (`verificar-marca-no-artefato.mjs`): declaração
// sem medição do artefato não prova nada.
//
// FAIL-CLOSED: A AUSÊNCIA DE INFORMAÇÃO É REPROVAÇÃO, NUNCA "OK".
// -------------------------------------------------------------------------
// Artefato ausente, ou presente sem `prerender-manifest.json`, reprova: "não
// achei o que medir" nunca pode virar "está tudo bem".
//
// COMO O NEXT DECLARA UMA ROTA COMO ESTÁTICA
// -------------------------------------------------------------------------
// `.next/prerender-manifest.json` tem a forma
//   { "routes": { "/login": {...} }, "dynamicRoutes": {...}, ... }
// Toda entrada em `routes` foi renderizada em HTML no MOMENTO DO BUILD e é
// servida como arquivo estático depois — é exatamente o que `force-dynamic`
// impede. Uma rota dinâmica (SSR por requisição, o estado exigido aqui)
// simplesmente NÃO aparece em `routes`. Por isso a régua é: nenhuma das rotas
// de marca pode ser uma CHAVE de `routes`.
//
// USO
//   node apps/web/scripts/verificar-rotas-de-marca-dinamicas.mjs
//   node apps/web/scripts/verificar-rotas-de-marca-dinamicas.mjs <dir-do-.next>
// ===========================================================================

import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = resolve(AQUI, "../../..")
const ARTEFATO_PADRAO = resolve(RAIZ, "apps/web/.next")

/**
 * As rotas que consomem marca (`getTenantConfig()`), direta ou indiretamente
 * pelo layout raiz. Lista fechada e nomeada — se uma rota nova passar a
 * depender de marca, ela entra aqui junto com o `force-dynamic` no código.
 */
export const ROTAS_DE_MARCA = [
  "/",
  "/login",
  "/entrar",
  "/workspace",
  "/onboarding",
  "/dashboard",
  "/_not-found",
]

/**
 * Mede o manifesto de pré-render. `manifest.routes` é o único sinal que
 * importa: cada chave ali é uma rota que o Next já renderizou em HTML durante
 * o build. `dynamicRoutes` e o resto do manifesto não indicam nada sobre
 * ESTAS rotas — elas não têm segmento dinâmico ([slug]) — então não entram na
 * régua para não produzir reprovação (ou aprovação) por um sinal que não fala
 * delas.
 */
export function verificar(manifest) {
  const erros = []
  const rotasEstaticas = manifest && typeof manifest === "object" ? (manifest.routes ?? {}) : {}

  for (const rota of ROTAS_DE_MARCA) {
    if (Object.prototype.hasOwnProperty.call(rotasEstaticas, rota)) {
      erros.push(
        `rota de marca "${rota}" saiu do build como HTML ESTÁTICO (presente em prerender-manifest.json → routes). Ela é servida para qualquer host depois, sem olhar o tenant da requisição: o cliente que bater nesse arquivo em cache vê a marca de quem quer que tenha sido resolvido durante o BUILD, não a própria. Corrija com \`export const dynamic = "force-dynamic"\` no layout/página desta rota.`,
      )
    }
  }

  return { erros }
}

// --- CLI -------------------------------------------------------------------
const ehCLI =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (ehCLI) {
  const dirArtefato = resolve(process.argv[2] ?? ARTEFATO_PADRAO)
  const caminhoManifesto = resolve(dirArtefato, "prerender-manifest.json")

  if (!existsSync(dirArtefato)) {
    console.error(
      `[rotas-de-marca] REPROVADO: o artefato ${dirArtefato} nao existe. Este gate roda DEPOIS do build; sem artefato nao ha o que medir, e "nada a verificar" nunca vira OK.`,
    )
    process.exit(1)
  }

  if (!existsSync(caminhoManifesto)) {
    console.error(
      `[rotas-de-marca] REPROVADO: ${caminhoManifesto} nao existe. O \`next build\` sempre produz este arquivo (mesmo com zero rotas estaticas); a ausencia dele indica que o caminho do artefato mudou ou que o build nao terminou.`,
    )
    process.exit(1)
  }

  let manifest
  try {
    manifest = JSON.parse(readFileSync(caminhoManifesto, "utf8"))
  } catch (erro) {
    console.error(
      `[rotas-de-marca] REPROVADO: ${caminhoManifesto} nao e um JSON valido: ${erro.message}`,
    )
    process.exit(1)
  }

  const { erros } = verificar(manifest)

  if (erros.length > 0) {
    console.error(`[rotas-de-marca] REPROVADO (${erros.length} erro(s)):`)
    for (const e of erros) console.error(`  - ${e}`)
    process.exit(1)
  }

  console.log(
    `[rotas-de-marca] OK — nenhuma das ${ROTAS_DE_MARCA.length} rotas de marca saiu estática do build.`,
  )
}
