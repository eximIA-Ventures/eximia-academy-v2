// =============================================================================
// DEMO TENANT SEED — Phase 5+6 RESUME
// =============================================================================
// Phases 1-4 of demo-tenant-vertice-seed.mjs completed successfully (tenant,
// areas, departments, 128 users + Hugo demo account, manager_groups, course
// copy). That run crashed in Phase 5 on a TDZ bug (REFLECTION_TEXTS used
// before its const declaration). This script RESUMES against the already-
// created tenant by re-querying its state (no re-creation, fully idempotent
// reads), then performs Phase 5 (movement/numbers) + Phase 6 (verification).
// =============================================================================

import { readFileSync, writeFileSync } from "node:fs"

const envFile = readFileSync(new URL("../apps/web/.env.local", import.meta.url), "utf-8")
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.+)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const CORY_TENANT_ID = "a9d56b85-ee0e-4295-8db2-5fbcb3fd7a32"
const TENANT_ID = "ec814e94-0a84-48ec-ae2a-4f46c8ef21c4"
const HUGO_DEMO_EMAIL = "hugocapitelli+demo@gmail.com"
const HUGO_DEMO_PASSWORD = "Hugo@@171227@@"

async function rest(method, path, body) {
  const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" }
  if (method !== "GET") headers.Prefer = "return=representation"
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`)
  return json
}

async function pMap(items, fn, concurrency = 8) {
  const results = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      results[idx] = await fn(items[idx], idx)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}
function daysAgoISO(days, jitterHours = 12) {
  const ms = Date.now() - days * 86_400_000 + (Math.random() - 0.5) * jitterHours * 3_600_000
  return new Date(ms).toISOString()
}

const REFLECTION_TEXTS = [
  "Percebi que o maior gargalo aqui não é a ferramenta, é a disciplina de registrar o problema antes de sair resolvendo.",
  "Fez sentido separar sintoma de causa raiz — na nossa linha a gente costuma corrigir o sintoma e o problema volta em duas semanas.",
  "Vou aplicar isso na próxima reunião de qualidade: descrever o problema em uma frase, sem já sugerir a solução junto.",
  "O ponto do 5 Porquês me lembrou de um caso real na manutenção, onde paramos no terceiro porquê e não resolvemos de verdade.",
  "Achei importante o alerta de não pular direto para a ação corretiva sem confirmar a causa com dado, não com opinião.",
  "Isso muda como eu vou conduzir a próxima análise de não conformidade — quero levar essa estrutura pro time.",
  "Fiquei pensando em como medir se a ação corretiva realmente funcionou, não só se foi implementada.",
  "A parte de padronização é a que mais falha aqui na prática — documentamos, mas ninguém revisita depois de um mês.",
  "Bom gancho pra próxima reunião com o time de produção: usar a mesma linguagem pra descrever desvios.",
  "Gostei de ver isso separado por etapas, ajuda a não pular direto pra 'conclusão' sem provar com dado.",
  "Quero testar esse método no meu turno essa semana e comparar com o jeito que a gente já faz hoje.",
  "A reflexão me fez perceber que muita vez o 'problema' que registramos já é a nossa hipótese de causa, não o fato observado.",
]

function levelForXp(xp) {
  const thresholds = [0, 500, 1500, 3000, 5000, 8000, 12000, 17000, 23000, 30000]
  let level = 1
  for (let i = 0; i < thresholds.length; i++) if (xp >= thresholds[i]) level = i + 1
  return level
}

function tierProfile(tier) {
  switch (tier) {
    case "adiantado":
      return { progress: 85 + Math.random() * 15, sessions: 12 + Math.floor(Math.random() * 8), lastActivityDays: Math.random() * 3, enrolledDaysAgo: 20 + Math.random() * 10, xp: 3000 + Math.random() * 6000, streak: 10 + Math.floor(Math.random() * 20), status: Math.random() < 0.4 ? "completed" : "active" }
    case "no_ritmo":
      return { progress: 40 + Math.random() * 35, sessions: 5 + Math.floor(Math.random() * 6), lastActivityDays: Math.random() * 5, enrolledDaysAgo: 12 + Math.random() * 10, xp: 800 + Math.random() * 2200, streak: 3 + Math.floor(Math.random() * 12), status: "active" }
    case "atrasado":
      return { progress: 5 + Math.random() * 20, sessions: 1 + Math.floor(Math.random() * 3), lastActivityDays: Math.random() * 6, enrolledDaysAgo: 32 + Math.random() * 12, xp: 100 + Math.random() * 500, streak: Math.floor(Math.random() * 3), status: "active" }
    case "sem_acesso":
      return { progress: 25 + Math.random() * 35, sessions: 3 + Math.floor(Math.random() * 5), lastActivityDays: 16 + Math.random() * 24, enrolledDaysAgo: 28 + Math.random() * 20, xp: 500 + Math.random() * 1800, streak: 0, status: "active" }
    default:
      return { progress: 0, sessions: 0, lastActivityDays: null, enrolledDaysAgo: 5 + Math.random() * 8, xp: 0, streak: 0, status: "active" }
  }
}

async function main() {
  const t0 = Date.now()
  console.log(`Resuming Phase 5+6 for tenant ${TENANT_ID}`)

  const roster = await rest("GET", `users?tenant_id=eq.${TENANT_ID}&select=id,email,role`)
  console.log(`  Loaded ${roster.length} users from tenant`)
  const hugo = roster.find((u) => u.email === HUGO_DEMO_EMAIL)
  if (!hugo) throw new Error("Hugo demo account not found in tenant — Phase 3 did not complete")

  const courses = await rest("GET", `courses?tenant_id=eq.${TENANT_ID}&select=id,title`)
  const course1 = courses.find((c) => c.title === "Análise e Solução de Problemas")
  const course2 = courses.find((c) => c.title.startsWith("Onboarding Vértice"))
  if (!course1 || !course2) throw new Error(`Expected 2 courses, found: ${JSON.stringify(courses)}`)

  const course1Chapters = await rest("GET", `chapters?course_id=eq.${course1.id}&select=id`)
  const course2Chapters = await rest("GET", `chapters?course_id=eq.${course2.id}&select=id`)
  const course1ChapterIds = course1Chapters.map((c) => c.id)

  const course1SlidesByChapter = new Map()
  for (const ch of course1Chapters) {
    const slides = await rest("GET", `chapter_slides?chapter_id=eq.${ch.id}&select=id`)
    if (slides.length) course1SlidesByChapter.set(ch.id, slides)
  }
  const allCourse1Slides = [...course1SlidesByChapter.values()].flat()
  console.log(`  course1 chapters=${course1Chapters.length} slides=${allCourse1Slides.length}; course2 chapters=${course2Chapters.length} (shell, no slides)`)

  // Check idempotency: if enrollments already exist for this tenant, Phase 5 already ran
  const existingEnrollments = await rest("GET", `enrollments?tenant_id=eq.${TENANT_ID}&select=id&limit=1`)
  if (existingEnrollments.length > 0) {
    console.log("  Phase 5 already ran (enrollments exist) — skipping to verification only.")
  } else {
    // Tiers: adiantado 15%, no_ritmo 40%, atrasado 15%, sem_acesso 20%, nunca 10%
    const tierOf = new Map()
    const shuffled = [...roster].sort(() => Math.random() - 0.5)
    const n = shuffled.length
    const bounds = { adiantado: Math.round(n * 0.15), no_ritmo: Math.round(n * 0.4), atrasado: Math.round(n * 0.15), sem_acesso: Math.round(n * 0.2) }
    let cursor = 0
    for (const tier of ["adiantado", "no_ritmo", "atrasado", "sem_acesso"]) {
      for (let i = 0; i < bounds[tier] && cursor < n; i++, cursor++) tierOf.set(shuffled[cursor].id, tier)
    }
    for (; cursor < n; cursor++) tierOf.set(shuffled[cursor].id, "nunca")
    tierOf.set(hugo.id, "no_ritmo")

    const enrollmentRows = []
    const sessionRows = []
    const reflectionRows = []
    const gamificationRows = []
    const lastSeenUpdates = []

    for (const person of roster) {
      const tier = tierOf.get(person.id)
      const profile = tierProfile(tier)

      const totalChapters1 = course1Chapters.length
      const completedChapters1 = Math.round((profile.progress / 100) * totalChapters1)
      enrollmentRows.push({
        student_id: person.id,
        course_id: course1.id,
        tenant_id: TENANT_ID,
        status: profile.status,
        progress: { percentage: Math.round(profile.progress), total_chapters: totalChapters1, completed_chapters: completedChapters1 },
        created_at: daysAgoISO(profile.enrolledDaysAgo),
      })

      if (tier !== "nunca" || Math.random() < 0.2) {
        const pct2 = Math.round(Math.random() * (tier === "nunca" ? 5 : 60))
        const totalChapters2 = course2Chapters.length
        enrollmentRows.push({
          student_id: person.id,
          course_id: course2.id,
          tenant_id: TENANT_ID,
          status: "active",
          progress: { percentage: pct2, total_chapters: totalChapters2, completed_chapters: Math.round((pct2 / 100) * totalChapters2) },
          created_at: daysAgoISO(profile.enrolledDaysAgo * 0.8),
        })
      }

      for (let i = 0; i < profile.sessions; i++) {
        const chapterId = pick(course1ChapterIds)
        const daysBack = profile.lastActivityDays === null ? 0 : profile.lastActivityDays + i * (2 + Math.random() * 3)
        const status = Math.random() < 0.75 ? "completed" : Math.random() < 0.5 ? "active" : "abandoned"
        sessionRows.push({
          student_id: person.id,
          chapter_id: chapterId,
          question_id: null,
          tenant_id: TENANT_ID,
          status,
          interactions_remaining: Math.floor(Math.random() * 15),
          turn_number: 3 + Math.floor(Math.random() * 10),
          created_at: daysAgoISO(daysBack),
          updated_at: daysAgoISO(Math.max(0, daysBack - 0.1)),
          completed_at: status === "completed" ? daysAgoISO(Math.max(0, daysBack - 0.1)) : null,
        })
      }

      if (tier !== "nunca") {
        lastSeenUpdates.push({ id: person.id, last_seen_at: daysAgoISO(Math.max(0, (profile.lastActivityDays ?? 0) - Math.random())) })
      }

      if ((tier === "adiantado" || tier === "no_ritmo") && allCourse1Slides.length > 0) {
        const numReflections = tier === "adiantado" ? 5 + Math.floor(Math.random() * 5) : 2 + Math.floor(Math.random() * 4)
        const chosen = [...allCourse1Slides].sort(() => Math.random() - 0.5).slice(0, Math.min(numReflections, allCourse1Slides.length))
        for (const slide of chosen) {
          reflectionRows.push({
            student_id: person.id,
            slide_id: slide.id,
            tenant_id: TENANT_ID,
            response: pick(REFLECTION_TEXTS),
            created_at: daysAgoISO(profile.lastActivityDays ?? 1),
          })
        }
      }

      gamificationRows.push({
        user_id: person.id,
        tenant_id: TENANT_ID,
        xp: Math.round(profile.xp),
        level: levelForXp(profile.xp),
        current_streak: profile.streak,
        max_streak: profile.streak + Math.floor(Math.random() * 8),
        last_activity_date: profile.lastActivityDays === null ? null : new Date(Date.now() - profile.lastActivityDays * 86_400_000).toISOString().slice(0, 10),
        badges: [],
      })
    }

    console.log(`  Prepared: ${enrollmentRows.length} enrollments, ${sessionRows.length} sessions, ${reflectionRows.length} reflections, ${gamificationRows.length} gamification rows`)

    async function batchInsert(table, rows, size = 300) {
      for (let i = 0; i < rows.length; i += size) {
        await rest("POST", table, rows.slice(i, i + size))
      }
    }

    await batchInsert("enrollments", enrollmentRows)
    console.log("  Inserted enrollments")
    await batchInsert("sessions", sessionRows)
    console.log("  Inserted sessions")
    await batchInsert("slide_reflections", reflectionRows)
    console.log("  Inserted slide_reflections")
    await batchInsert("user_gamification", gamificationRows)
    console.log("  Inserted user_gamification")
    await pMap(lastSeenUpdates, (u) => rest("PATCH", `users?id=eq.${u.id}`, { last_seen_at: u.last_seen_at }), 8)
    console.log(`  Updated last_seen_at for ${lastSeenUpdates.length} users`)
  }

  // ---------------------------------------------------------------------------
  // Phase 6 — verification
  // ---------------------------------------------------------------------------
  console.log("\nPhase 6: verification")
  const coryCountAfter = await rest("GET", `users?tenant_id=eq.${CORY_TENANT_ID}&select=id`)
  console.log(`  Cory tenant user count AFTER: ${coryCountAfter.length} (expected 51, unchanged)`)

  const vUsers = await rest("GET", `users?tenant_id=eq.${TENANT_ID}&select=id,role`)
  const vEnrollments = await rest("GET", `enrollments?tenant_id=eq.${TENANT_ID}&select=id,course_id`)
  const vSessions = await rest("GET", `sessions?tenant_id=eq.${TENANT_ID}&select=id`)
  const vReflections = await rest("GET", `slide_reflections?tenant_id=eq.${TENANT_ID}&select=id`)
  const vGamification = await rest("GET", `user_gamification?tenant_id=eq.${TENANT_ID}&select=user_id,xp`)
  const vManagerGroups = await rest("GET", `manager_groups?tenant_id=eq.${TENANT_ID}&select=id,name`)

  const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: HUGO_DEMO_EMAIL, password: HUGO_DEMO_PASSWORD }),
  })

  const summary = {
    tenantId: TENANT_ID,
    users: vUsers.length,
    byRole: vUsers.reduce((acc, u) => ({ ...acc, [u.role]: (acc[u.role] ?? 0) + 1 }), {}),
    enrollments: vEnrollments.length,
    sessions: vSessions.length,
    reflections: vReflections.length,
    gamification: vGamification.length,
    managerGroups: vManagerGroups.length,
    xpRange: { min: Math.min(...vGamification.map((g) => g.xp)), max: Math.max(...vGamification.map((g) => g.xp)) },
    coryUnchanged: coryCountAfter.length === 51,
    hugoLoginOk: loginRes.status === 200,
    elapsedSeconds: Math.round((Date.now() - t0) / 1000),
  }
  console.log("\n=== SUMMARY ===")
  console.log(JSON.stringify(summary, null, 2))

  writeFileSync(
    new URL("../.demo-tenant-vertice-inventory.json", import.meta.url),
    JSON.stringify({ tenantId: TENANT_ID, course1, course2, summary }, null, 2),
  )
  console.log("\nInventory written to .demo-tenant-vertice-inventory.json")
}

main().catch((err) => {
  console.error("\nFATAL:", err)
  process.exit(1)
})
