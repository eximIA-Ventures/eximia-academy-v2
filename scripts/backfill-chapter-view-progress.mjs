import { readFileSync } from "node:fs"

/**
 * BACKFILL do Percorrido a partir das reflexões já registradas.
 *
 * PREMISSA: `slide_reflections.slide_id` PROVA que o aluno esteve naquele slide.
 * Cruzando com `chapter_slides.order`, o maior order com reflexão é uma marca
 * d'água MÍNIMA COMPROVADA por (aluno, capítulo).
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ ISTO É UM PISO, NÃO A VERDADE. Leia antes de interpretar o número.      │
 * │                                                                         │
 * │ · SUBESTIMA sempre: quem refletiu no slide 5 de 20 pode ter visto os 20.│
 * │ · NÃO cobre quem passou os slides sem refletir — esses continuam        │
 * │   "sem dado", que é o rótulo honesto.                                   │
 * │ · NUNCA superestima, e é isso que o torna seguro de aplicar.            │
 * │                                                                         │
 * │ Ou seja: um aluno com 40% aqui pode ter percorrido 100%. O contrário    │
 * │ não acontece. Trate como limite inferior em qualquer decisão.           │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * IDEMPOTENTE: rodar duas vezes não corrompe nada. Dado real de telemetria
 * SEMPRE vence dado inferido — se já existe linha com `max_slide_index` maior,
 * o script não a rebaixa (e o trigger do banco é a segunda linha de defesa).
 *
 * USO:
 *   node scripts/backfill-chapter-view-progress.mjs              # dry-run (default)
 *   node scripts/backfill-chapter-view-progress.mjs --apply      # escreve de verdade
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
  const res = await fetch(`${SUPABASE_URL}/rest/v1/chapter_view_progress`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) throw new Error(`UPSERT -> ${res.status} ${await res.text()}`)
}

async function main() {
  console.log(APPLY ? "MODO: APLICANDO (escreve no banco)" : "MODO: DRY-RUN (nada será escrito)")

  const [reflections, slides, existing] = await Promise.all([
    getAll("slide_reflections?select=student_id,slide_id&slide_id=not.is.null"),
    getAll("chapter_slides?select=id,chapter_id,order,tenant_id"),
    getAll("chapter_view_progress?select=student_id,chapter_id,max_slide_index"),
  ])

  const slideById = new Map(slides.map((s) => [s.id, s]))

  // Total ATUAL de slides por capítulo (denominador móvel resolvido na leitura,
  // mas gravado aqui como snapshot do momento do backfill).
  const totalByChapter = new Map()
  const maxOrderByChapter = new Map()
  for (const s of slides) {
    totalByChapter.set(s.chapter_id, (totalByChapter.get(s.chapter_id) ?? 0) + 1)
    const cur = maxOrderByChapter.get(s.chapter_id)
    if (cur === undefined || s.order > cur) maxOrderByChapter.set(s.chapter_id, s.order)
  }

  // Marca d'água comprovada por (aluno, capítulo).
  const watermark = new Map()
  for (const r of reflections) {
    const slide = slideById.get(r.slide_id)
    if (!slide) continue
    const key = `${r.student_id}|${slide.chapter_id}`
    const cur = watermark.get(key)
    if (!cur || slide.order > cur.order) {
      watermark.set(key, {
        studentId: r.student_id,
        chapterId: slide.chapter_id,
        tenantId: slide.tenant_id,
        order: slide.order,
      })
    }
  }

  const existingMax = new Map(
    existing.map((e) => [`${e.student_id}|${e.chapter_id}`, e.max_slide_index]),
  )

  const rows = []
  let skippedRealData = 0
  let reachedEnd = 0

  for (const [key, w] of watermark) {
    if (!w.tenantId) continue

    // Dado REAL de telemetria sempre vence o inferido.
    const already = existingMax.get(key)
    if (already !== undefined && already >= w.order) {
      skippedRealData += 1
      continue
    }

    const isLast = w.order >= (maxOrderByChapter.get(w.chapterId) ?? Number.POSITIVE_INFINITY)
    if (isLast) reachedEnd += 1

    rows.push({
      student_id: w.studentId,
      chapter_id: w.chapterId,
      tenant_id: w.tenantId,
      max_slide_index: w.order,
      slides_total_at_last_view: totalByChapter.get(w.chapterId) ?? w.order + 1,
      // Só carimba o fim quando o último slide do capítulo foi PROVADO.
      ...(isLast ? { reached_last_slide_at: new Date().toISOString() } : {}),
    })
  }

  console.log("")
  console.log(`  reflexões lidas ................ ${reflections.length}`)
  console.log(`  pares (aluno, capítulo) ........ ${watermark.size}`)
  console.log(`  já cobertos por dado real ...... ${skippedRealData}`)
  console.log(`  a escrever ..................... ${rows.length}`)
  console.log(`  com último slide PROVADO ....... ${reachedEnd}`)
  console.log("")

  if (rows.length > 0) {
    console.log("  amostra (3 primeiras):")
    for (const r of rows.slice(0, 3)) {
      console.log(
        `    aluno ${r.student_id.slice(0, 8)} · cap ${r.chapter_id.slice(0, 8)} · slide ${r.max_slide_index} de ${r.slides_total_at_last_view}${r.reached_last_slide_at ? " · FIM PROVADO" : ""}`,
      )
    }
    console.log("")
  }

  if (!APPLY) {
    console.log(
      "DRY-RUN encerrado. Para aplicar: node scripts/backfill-chapter-view-progress.mjs --apply",
    )
    return
  }

  for (let i = 0; i < rows.length; i += 500) {
    await upsert(rows.slice(i, i + 500))
    console.log(`  escrito ${Math.min(i + 500, rows.length)}/${rows.length}`)
  }
  console.log("Backfill aplicado.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
