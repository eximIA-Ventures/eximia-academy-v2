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

async function patch(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function main() {
  // Get completed sessions grouped by student
  const sessions = await query(`sessions?tenant_id=eq.${CORY}&status=eq.completed&select=student_id,chapter_id`)

  const byStudent = {}
  for (const s of sessions) {
    if (!byStudent[s.student_id]) byStudent[s.student_id] = new Set()
    byStudent[s.student_id].add(s.chapter_id)
  }

  // Get all chapters count per course
  const rpChapters = await query('chapters?course_id=eq.4711c03e-6f91-4b28-80cf-047cd607d04b&select=id')
  const mgChapters = await query('chapters?course_id=eq.d948fea5-840e-40b5-91f0-6005e81cda55&select=id')
  const rpIds = new Set(rpChapters.map(c => c.id))
  const mgIds = new Set(mgChapters.map(c => c.id))

  // Get user names
  const users = await query(`users?tenant_id=eq.${CORY}&select=id,full_name`)
  const nameMap = Object.fromEntries(users.map(u => [u.id, u.full_name]))

  // Get enrollments
  const enrollments = await query(`enrollments?tenant_id=eq.${CORY}&select=id,student_id,course_id,progress`)

  console.log(`Students with completed sessions: ${Object.keys(byStudent).length}\n`)

  for (const [studentId, completedChapters] of Object.entries(byStudent)) {
    const name = nameMap[studentId] || studentId.slice(0, 8)
    const chapters = [...completedChapters]

    // Find which course this student's chapters belong to
    const rpCompleted = chapters.filter(c => rpIds.has(c))
    const mgCompleted = chapters.filter(c => mgIds.has(c))

    for (const [courseChapters, totalCount, courseId, label] of [
      [rpCompleted, rpChapters.length, '4711c03e-6f91-4b28-80cf-047cd607d04b', 'RP'],
      [mgCompleted, mgChapters.length, 'd948fea5-840e-40b5-91f0-6005e81cda55', 'MG'],
    ]) {
      if (courseChapters.length === 0) continue

      const pct = Math.round((courseChapters.length / totalCount) * 100)
      const enrollment = enrollments.find(e => e.student_id === studentId && e.course_id === courseId)

      if (!enrollment) {
        console.log(`  ${name}: no enrollment for ${label} — skipping`)
        continue
      }

      const progress = { percentage: pct, completed_chapters: courseChapters }
      await patch(`enrollments?id=eq.${enrollment.id}`, { progress })
      console.log(`  ✓ ${name.padEnd(40)} ${label}: ${courseChapters.length}/${totalCount} (${pct}%)`)
    }
  }

  console.log('\nDone!')
}

main().catch(console.error)
