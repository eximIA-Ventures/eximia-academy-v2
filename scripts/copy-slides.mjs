import { readFileSync } from 'fs'

const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf-8')
for (const line of envFile.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

async function query(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  return res.json()
}

async function insert(table, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(rows),
  })
  return res.json()
}

// Source → Target chapter mappings
const SOURCE = [
  '28537f54-86a5-40fe-a2f8-f0710ed683c4',
  'e31d3795-df0d-4c32-9f1d-d7ce492d59c3',
  '026ade58-3cc7-4098-bbc0-fe9d529aefe6',
  '570e9280-1b45-4e94-9d4c-7aed5dea6f51',
  '4d8a4007-1390-4de8-bb57-cdc0145f1198',
  '929dfbfd-5de2-4b02-b469-b9d9b8bd95e1',
  'e7375edf-483e-4e82-97e3-79e5afb92543',
  '255ead85-ae94-4417-853c-32d3c313b1df',
]

const RP = [
  '02f189fd-11ad-4911-9a03-eb08c1dc4b65',
  'c7a78db7-979d-4d5e-891f-fb5b71c10289',
  '7323d653-9c01-4772-a3f7-dd8d0dc3e15b',
  'b7ec1024-347f-4fdc-ac13-f32f3bcfc85e',
  'bd2c150a-b82b-4446-a735-52a7aa49d304',
  '6a5e2849-9c0c-4c3b-bcf4-d8a5a7f38b06',
  '88e95e7d-38ad-4192-af67-12774789e7ad',
  'd65cdf14-0b1e-40cb-b00f-28d467794f18',
]

const MG = [
  '5d9356a3-aa78-4434-b528-9c0bf3ad2317',
  '787dc336-1987-49e4-ac4c-702f194cca7c',
  'c34e29c8-5a4d-4e2e-a401-afdb9aca5a44',
  '0f5068b8-dc97-4f7f-80ae-86eff84789b9',
  '902f080a-cd76-4054-9120-68a9aba08620',
  '2cc966f1-abb6-4c7d-bba9-6ed242fe2fcc',
  '0cea9b0d-8bb8-4cce-bf7c-19cb2ef9792a',
  '57845288-e7e3-4ec8-be30-eb22b43cfee3',
]

async function main() {
  for (let i = 0; i < SOURCE.length; i++) {
    const srcId = SOURCE[i]
    const rpId = RP[i]
    const mgId = MG[i]

    console.log(`[${i + 1}/8] Copying slides from ${srcId.slice(0, 8)}...`)

    const slides = await query(
      `chapter_slides?chapter_id=eq.${srcId}&select=order,image_url,text_content,audio_start_ms,audio_end_ms&order=order`
    )

    if (!slides.length) {
      console.log(`  SKIP — no slides`)
      continue
    }

    const CORY_TENANT = 'a9d56b85-ee0e-4295-8db2-5fbcb3fd7a32'

    // Copy to RP
    const rpSlides = slides.map(s => ({ ...s, chapter_id: rpId, tenant_id: CORY_TENANT }))
    const rpResult = await insert('chapter_slides', rpSlides)
    console.log(`  RP: ${Array.isArray(rpResult) ? rpResult.length : JSON.stringify(rpResult).slice(0,100)} slides`)

    // Copy to MG
    const mgSlides = slides.map(s => ({ ...s, chapter_id: mgId, tenant_id: CORY_TENANT }))
    const mgResult = await insert('chapter_slides', mgSlides)
    console.log(`  MG: ${Array.isArray(mgResult) ? mgResult.length : JSON.stringify(mgResult).slice(0,100)} slides`)
  }

  console.log('\nDone!')
}

main().catch(console.error)
