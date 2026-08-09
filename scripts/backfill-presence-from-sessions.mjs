import { readFileSync } from "node:fs"

/**
 * BACKFILL de PRESENÇA a partir de SESSÕES CONCLUÍDAS.
 *
 * Fecha um buraco do backfill anterior. O primeiro
 * (`backfill-chapter-view-progress.mjs`) derivou presença apenas de
 * `slide_reflections`. Resultado: em capítulo SEM nenhum ponto de reflexão no
 * conteúdo, não havia como provar nada — e o percorrido ficava vazio mesmo para
 * quem claramente terminou o capítulo.
 *
 * O sinal que faltava: **sessão socrática concluída**. A socrática só é
 * oferecida no ÚLTIMO slide do capítulo, então concluí-la prova ter alcançado o
 * fim. É exatamente o que `recordChapterEndPresence` faz AO VIVO desde a etapa
 * 1 — este script aplica a mesma regra ao histórico, que nunca foi reprocessado.
 *
 * O defeito que isto corrige, visível na tela: Caio Pinheiro aparecia com
 * Percorrido 62% e Progresso 100%, violando a invariante `progresso ≤
 * percorrido`. Ele respondeu TODOS os pontos existentes, mas os capítulos 2, 4 e
 * 5 não têm ponto algum — e ele tem sessão concluída nos três.
 *
 * IDEMPOTENTE: o trigger `chapter_view_progress_invariants` garante que
 * `reached_last_slide_at` nunca volta a nulo e que a marca d'água não decresce.
 * Rodar duas vezes não corrompe nada.
 *
 * USO:
 *   node scripts/backfill-presence-from-sessions.mjs           # dry-run
 *   node scripts/backfill-presence-from-sessions.mjs --apply   # escreve
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
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }

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

async function upsert(rows) {
  // on_conflict é OBRIGATÓRIO aqui: merge-duplicates sozinho não sabe em qual
  // constraint resolver, e o PostgREST devolve 409 (23505) na primeira linha
  // que já existir. O backfill anterior não sofreu disso porque só inseria
  // linhas novas; este ATUALIZA linhas existentes que estavam sem o carimbo.
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/chapter_view_progress?on_conflict=student_id,chapter_id`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    },
  )
  if (!res.ok) throw new Error(`UPSERT -> ${res.status} ${await res.text()}`)
}

async function main() {
  console.log(APPLY ? "MODO: APLICANDO" : "MODO: DRY-RUN (nada será escrito)")

  const [sessions, slides, existing] = await Promise.all([
    getAll(
      "sessions?select=student_id,chapter_id,status&status=eq.completed&chapter_id=not.is.null",
    ),
    getAll("chapter_slides?select=chapter_id,order,tenant_id"),
    getAll("chapter_view_progress?select=student_id,chapter_id,reached_last_slide_at"),
  ])

  // Denominador e último slide por capítulo.
  const byChapter = new Map()
  for (const s of slides) {
    const cur = byChapter.get(s.chapter_id) ?? { total: 0, maxOrder: -1, tenantId: s.tenant_id }
    cur.total += 1
    if (s.order > cur.maxOrder) cur.maxOrder = s.order
    byChapter.set(s.chapter_id, cur)
  }

  // Quem JÁ tem o fim carimbado não precisa de nada.
  const alreadyReached = new Set(
    existing
      .filter((e) => e.reached_last_slide_at !== null)
      .map((e) => `${e.student_id}|${e.chapter_id}`),
  )

  const now = new Date().toISOString()
  const seen = new Set()
  const rows = []
  let semSlides = 0

  for (const s of sessions) {
    const key = `${s.student_id}|${s.chapter_id}`
    if (seen.has(key)) continue
    seen.add(key)
    if (alreadyReached.has(key)) continue

    const chapter = byChapter.get(s.chapter_id)
    // Capítulo sem slides: não há percurso a registrar.
    if (!chapter || chapter.total === 0 || !chapter.tenantId) {
      semSlides += 1
      continue
    }

    rows.push({
      student_id: s.student_id,
      chapter_id: s.chapter_id,
      tenant_id: chapter.tenantId,
      max_slide_index: chapter.maxOrder,
      slides_total_at_last_view: chapter.total,
      last_viewed_at: now,
      reached_last_slide_at: now,
    })
  }

  console.log("")
  console.log(`  sessões concluídas (pares únicos) .. ${seen.size}`)
  console.log(`  já tinham o fim carimbado .......... ${seen.size - rows.length - semSlides}`)
  console.log(`  capítulo sem slides (ignorados) .... ${semSlides}`)
  console.log(`  a escrever ......................... ${rows.length}`)
  console.log("")

  if (!APPLY) {
    console.log("DRY-RUN encerrado. Para aplicar: --apply")
    return
  }

  for (let i = 0; i < rows.length; i += 500) {
    await upsert(rows.slice(i, i + 500))
    console.log(`  escrito ${Math.min(i + 500, rows.length)}/${rows.length}`)
  }
  console.log("Backfill de presença aplicado.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
