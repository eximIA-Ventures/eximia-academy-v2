import { readFileSync } from "node:fs"

/**
 * RECÁLCULO de `chapter_slides.interaction_type`.
 *
 * Contrato: docs/architecture/percorrido-progressao-conclusao.md §3.2.
 *
 * A migration 20260731000000 materializou duas colunas e um trigger que ZERA
 * `interaction_computed_at` sempre que `text_content` muda. Este script é a
 * outra metade: ele percorre a fila de STALE (`interaction_computed_at IS NULL`)
 * e preenche o tipo.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ A heurística NÃO é reimplementada aqui. Ela é a MESMA que a tela usa,    │
 * │ replicada linha a linha de `lib/analytics/interaction-points.ts`.        │
 * │                                                                          │
 * │ Por que replicar em vez de importar: este script é `.mjs` puro, rodado   │
 * │ por `node` sem bundler nem resolução de paths do Next. Importar o módulo │
 * │ TS exigiria pipeline de build só para um utilitário de manutenção.       │
 * │                                                                          │
 * │ O risco de divergência é REAL e está mitigado assim: qualquer mudança na │
 * │ heurística precisa ser refletida aqui, e o teste                         │
 * │ `progression.test.ts` cobre os cinco padrões do lado TypeScript. Se um   │
 * │ dia isto virar mais que uma função, o certo é extrair para um pacote     │
 * │ compartilhado — não deixar duas cópias crescerem.                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * IDEMPOTENTE: só toca linhas stale. Rodar duas vezes seguidas não escreve nada
 * na segunda.
 *
 * USO:
 *   node scripts/recompute-interaction-points.mjs           # dry-run (default)
 *   node scripts/recompute-interaction-points.mjs --apply   # escreve
 */

const envFile = readFileSync(new URL("../apps/web/.env.local", import.meta.url), "utf-8")
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.+)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APPLY = process.argv.includes("--apply")

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY em apps/web/.env.local",
  )
  process.exit(1)
}

const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }

// ---------------------------------------------------------------------------
// Heurística — espelho fiel de lib/analytics/interaction-points.ts
// ---------------------------------------------------------------------------

function isReflectionBlock(text) {
  if (/reflex[ãa]o/i.test(text)) return true
  if (/agora\s+(refli[tj]a|pense|imagine|considere)/i.test(text)) return true
  if (/refli[tj]a\s+por\s+um\s+momento/i.test(text)) return true
  if (/[🔍🔎💡🤔🪞💬🧠✨🎯📝]/u.test(text) && /\?/.test(text)) return true
  if (/\?/.test(text) && /pense|imagine|considere|momento/i.test(text)) return true
  return false
}

/** Agrupa linhas `>` consecutivas, como o react-markdown entrega ao componente. */
function extractBlockquotes(markdown) {
  const blocks = []
  let current = []
  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trimStart()
    if (line.startsWith(">")) {
      current.push(line.replace(/^>\s?/, ""))
      continue
    }
    if (current.length > 0) {
      blocks.push(current.join("\n"))
      current = []
    }
  }
  if (current.length > 0) blocks.push(current.join("\n"))
  return blocks
}

function classifySlideInteraction(textContent) {
  if (!textContent) return null
  for (const block of extractBlockquotes(textContent)) {
    if (isReflectionBlock(block)) return "reflection"
  }
  return null
}

// ---------------------------------------------------------------------------

async function getAll(path) {
  const out = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { ...headers, Range: `${from}-${from + pageSize - 1}` },
    })
    if (!res.ok) throw new Error(`GET ${path} -> ${res.status} ${await res.text()}`)
    const page = await res.json()
    out.push(...page)
    if (page.length < pageSize) return out
  }
}

async function patchSlide(id, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/chapter_slides?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`PATCH ${id} -> ${res.status} ${await res.text()}`)
}

async function main() {
  console.log(APPLY ? "MODO: APLICANDO (escreve no banco)" : "MODO: DRY-RUN (nada será escrito)")

  // A fila de stale. O trigger da migration é quem repõe linhas aqui quando
  // alguém edita um slide.
  const stale = await getAll(
    "chapter_slides?select=id,text_content,interaction_type&interaction_computed_at=is.null",
  )

  const now = new Date().toISOString()
  const updates = []
  let virariamPonto = 0
  let mudariamDeValor = 0

  for (const slide of stale) {
    const type = classifySlideInteraction(slide.text_content)
    if (type) virariamPonto += 1
    if (type !== slide.interaction_type) mudariamDeValor += 1
    updates.push({ id: slide.id, interaction_type: type, interaction_computed_at: now })
  }

  console.log("")
  console.log(`  slides na fila (stale) ......... ${stale.length}`)
  console.log(`  viram PONTO de interação ....... ${virariamPonto}`)
  console.log(`  não são ponto .................. ${stale.length - virariamPonto}`)
  console.log(`  mudam de valor ................. ${mudariamDeValor}`)
  console.log("")

  if (!APPLY) {
    console.log(
      "DRY-RUN encerrado. Para aplicar: node scripts/recompute-interaction-points.mjs --apply",
    )
    return
  }

  let done = 0
  for (const u of updates) {
    await patchSlide(u.id, {
      interaction_type: u.interaction_type,
      interaction_computed_at: u.interaction_computed_at,
    })
    done += 1
    if (done % 100 === 0) console.log(`  ${done}/${updates.length}`)
  }
  console.log(`  ${done}/${updates.length}`)
  console.log("Recálculo aplicado.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
