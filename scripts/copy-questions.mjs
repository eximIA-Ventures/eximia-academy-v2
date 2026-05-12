import { readFileSync } from 'fs'

const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf-8')
for (const line of envFile.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CORY = 'a9d56b85-ee0e-4295-8db2-5fbcb3fd7a32'

async function query(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  return res.json()
}

async function insert(table, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(rows),
  })
  return res.json()
}

async function main() {
  const questions = await query('questions?tenant_id=eq.8d45bcf4-ed2f-408d-a1af-0ee1fc6a3bea&select=chapter_id,text,question_type,options,correct_answer,explanation,skill,status,intention,expected_depth&order=chapter_id')
  console.log(`Source questions: ${questions.length}`)

  const srcChapters = await query('chapters?course_id=eq.ecb3d796-e862-4c01-9b9b-2f92df950adc&select=id,order')
  const rpChapters = await query('chapters?course_id=eq.4711c03e-6f91-4b28-80cf-047cd607d04b&select=id,order')
  const mgChapters = await query('chapters?course_id=eq.d948fea5-840e-40b5-91f0-6005e81cda55&select=id,order')

  const srcMap = Object.fromEntries(srcChapters.map(c => [c.id, c.order]))
  const rpMap = Object.fromEntries(rpChapters.map(c => [c.order, c.id]))
  const mgMap = Object.fromEntries(mgChapters.map(c => [c.order, c.id]))

  const rpQ = []
  const mgQ = []

  for (const q of questions) {
    const order = srcMap[q.chapter_id]
    if (order === undefined) continue
    const { chapter_id, ...base } = q
    base.tenant_id = CORY

    if (rpMap[order]) rpQ.push({ ...base, chapter_id: rpMap[order] })
    if (mgMap[order]) mgQ.push({ ...base, chapter_id: mgMap[order] })
  }

  console.log(`RP: ${rpQ.length}, MG: ${mgQ.length}`)

  if (rpQ.length) {
    const r = await insert('questions', rpQ)
    console.log(`RP inserted: ${Array.isArray(r) ? r.length : JSON.stringify(r).slice(0,100)}`)
  }
  if (mgQ.length) {
    const r = await insert('questions', mgQ)
    console.log(`MG inserted: ${Array.isArray(r) ? r.length : JSON.stringify(r).slice(0,100)}`)
  }

  console.log('Done!')
}

main().catch(console.error)
