/**
 * Generate narration audio for all Cory chapters via ElevenLabs TTS.
 * Run: node scripts/generate-narrations.mjs
 */

import { readFileSync } from 'fs'

// Parse .env.local manually
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf-8')
for (const line of envFile.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY
const VOICE_ID = process.env.ELEVENLABS_VOICE_NARRATOR_MALE || 'cjVigY5qzO86Huf0OWal'
const TENANT_ID = 'a9d56b85-ee0e-4295-8db2-5fbcb3fd7a32'

async function supabase(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  })
  return res.json()
}

async function generateSpeech(text) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': ELEVENLABS_KEY },
    body: JSON.stringify({
      text: text.slice(0, 10000),
      model_id: 'eleven_multilingual_v2',
      language_code: 'pt',
      voice_settings: { stability: 0.6, similarity_boost: 0.75, style: 0.3, speed: 0.95, use_speaker_boost: true },
    }),
  })
  if (!res.ok) throw new Error(`ElevenLabs error: ${res.status} ${await res.text()}`)
  return Buffer.from(await res.arrayBuffer())
}

async function uploadToStorage(path, buffer) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/chapter-assets/${path}`, {
    method: 'PUT',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'audio/mpeg', 'x-upsert': 'true' },
    body: buffer,
  })
  if (!res.ok) throw new Error(`Upload error: ${res.status}`)
  return `${SUPABASE_URL}/storage/v1/object/public/chapter-assets/${path}`
}

async function main() {
  // Get first course chapters only (we'll copy URLs to the second course after)
  const chapters = await supabase(`chapters?course_id=eq.4711c03e-6f91-4b28-80cf-047cd607d04b&select=id,title,content,course_id,tenant_id,order&order=order`)

  console.log(`Found ${chapters.length} chapters to process\n`)

  const results = []

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i]
    const content = ch.content?.replace(/[#*_`>|[\](){}]/g, ' ').replace(/\s+/g, ' ').trim()

    if (!content || content.length < 50) {
      console.log(`[${i+1}/${chapters.length}] SKIP ${ch.title} — no content`)
      continue
    }

    console.log(`[${i+1}/${chapters.length}] ${ch.title} (${content.length} chars)...`)

    try {
      const audio = await generateSpeech(content)
      const filename = `narration-${ch.id}.mp3`
      const storagePath = `${ch.tenant_id}/${ch.course_id}/${filename}`
      const publicUrl = await uploadToStorage(storagePath, audio)

      // Update chapter audio_url
      await fetch(`${SUPABASE_URL}/rest/v1/chapters?id=eq.${ch.id}`, {
        method: 'PATCH',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_url: publicUrl }),
      })

      console.log(`  ✓ ${(audio.length / 1024).toFixed(0)}KB — ${publicUrl.split('/').pop()}`)
      results.push({ order: ch.order, title: ch.title, url: publicUrl })
    } catch (err) {
      console.error(`  ✗ ${err.message}`)
    }

    // Small delay to avoid rate limiting
    if (i < chapters.length - 1) await new Promise(r => setTimeout(r, 2000))
  }

  // Copy narration URLs to second course (MG) by matching order
  console.log('\n=== Copying URLs to MG course ===')
  const mgChapters = await supabase(`chapters?course_id=eq.d948fea5-840e-40b5-91f0-6005e81cda55&select=id,order&order=order`)

  for (const mg of mgChapters) {
    const src = results.find(r => r.order === mg.order)
    if (!src) continue
    await fetch(`${SUPABASE_URL}/rest/v1/chapters?id=eq.${mg.id}`, {
      method: 'PATCH',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio_url: src.url }),
    })
    console.log(`  ✓ MG order:${mg.order} → ${src.url.split('/').pop()}`)
  }

  console.log('\nDone!')
}

main().catch(console.error)
