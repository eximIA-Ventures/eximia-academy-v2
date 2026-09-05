// =============================================================================
// DEMO TENANT SEED — "Vértice Indústria"
// =============================================================================
// One-shot script for the 2026-07-29 mastermind demo. Creates an ISOLATED demo
// tenant inside the SAME production Supabase project (vaguswivhqnlbgqvnjch)
// that serves argos.eximiaacademy.com.br and the real Cory Alimentos tenant.
//
// SCOPE DISCIPLINE: every write below is scoped to the NEW tenant this script
// creates. The only reads against other tenants are SELECTs used to copy
// course/chapter/slide/question STRUCTURE from the exímIA Academy tenant
// (8d45bcf4-ed2f-408d-a1af-0ee1fc6a3bea) — never the Cory tenant, and never a
// write anywhere but the new tenant's own rows.
//
// Run: node scripts/demo-tenant-vertice-seed.mjs
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

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  console.error("Missing env vars in apps/web/.env.local")
  process.exit(1)
}

const CORY_TENANT_ID = "a9d56b85-ee0e-4295-8db2-5fbcb3fd7a32"
const EXIMIA_TENANT_ID = "8d45bcf4-ed2f-408d-a1af-0ee1fc6a3bea"
const SOURCE_COURSE_1 = "ecb3d796-e862-4c01-9b9b-2f92df950adc" // Análise e Solução de Problemas (rich slides+questions)
const SOURCE_COURSE_2 = "e435ef0c-858e-44fb-9af9-6393ad0a7eb4" // Trilha Demo: Fundamentos de Onboarding (title-only shells)

const NEW_TENANT_NAME = "Vértice Indústria"
const NEW_TENANT_SLUG = "vertice-industria"
const HUGO_DEMO_EMAIL = "hugocapitelli+demo@gmail.com"
const HUGO_DEMO_PASSWORD = "Hugo@@171227@@"

// -----------------------------------------------------------------------------
// HTTP helpers (mirrors scripts/copy-slides.mjs convention: raw fetch to
// PostgREST + GoTrue admin, no SDK import to avoid workspace resolution pain).
// -----------------------------------------------------------------------------
async function rest(method, path, body) {
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  }
  if (method !== "GET") headers.Prefer = "return=representation"
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`)
  }
  return json
}

async function authAdmin(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`${method} auth/admin/${path} -> ${res.status}: ${JSON.stringify(json)}`)
  return json
}

async function pMap(items, fn, concurrency = 6) {
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

function randomPassword() {
  return `Vx${Math.random().toString(36).slice(2, 10)}!${Math.floor(Math.random() * 1000)}Aa`
}

function daysAgoISO(days, jitterHours = 12) {
  const ms = Date.now() - days * 86_400_000 + (Math.random() - 0.5) * jitterHours * 3_600_000
  return new Date(ms).toISOString()
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// -----------------------------------------------------------------------------
// Brazilian name pools (no real/celebrity names) — 44 x 42 = 1848 combos.
// -----------------------------------------------------------------------------
const FIRST_NAMES = [
  "Ana", "Bruno", "Carla", "Diego", "Elaine", "Fábio", "Gabriela", "Heitor",
  "Isabela", "João", "Karina", "Lucas", "Marcela", "Nelson", "Otávio", "Patrícia",
  "Rafael", "Sandra", "Thiago", "Vanessa", "Wagner", "Yasmin", "André", "Beatriz",
  "Cláudio", "Débora", "Eduardo", "Fernanda", "Gustavo", "Helena", "Igor", "Juliana",
  "Kleber", "Larissa", "Mateus", "Natália", "Osvaldo", "Priscila", "Renato", "Simone",
  "Tiago", "Valentina", "William", "Ângela",
]
const LAST_NAMES = [
  "Almeida", "Barros", "Carvalho", "Duarte", "Esteves", "Ferraz", "Gouveia", "Henriques",
  "Iglesias", "Junqueira", "Kolln", "Lacerda", "Machado", "Nogueira", "Oliveira", "Pimenta",
  "Quirino", "Ramalho", "Siqueira", "Teixeira", "Uchôa", "Vasconcelos", "Xavier", "Zanetti",
  "Andrade", "Bezerra", "Cavalcante", "Dornelles", "Espíndola", "Freitas", "Guimarães", "Horta",
  "Ibrahim", "Jardim", "Koch", "Leal", "Marinho", "Neiva", "Ordonhes", "Peixoto",
  "Queiroga", "Rezende",
]

function generateUniqueNames(count) {
  const usedName = new Set()
  const usedEmail = new Set()
  const out = []
  while (out.length < count) {
    const first = pick(FIRST_NAMES)
    const last1 = pick(LAST_NAMES)
    const last2 = pick(LAST_NAMES)
    const fullName = last1 === last2 ? `${first} ${last1}` : `${first} ${last1} ${last2}`
    let emailLocal = `${first}.${last1}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z.]/g, "")
    // Disambiguate email collisions (different fullName can share first+last1)
    // by appending last2's initial, then a numeric suffix as a last resort —
    // fullName uniqueness alone is NOT sufficient, email uniqueness is separate.
    if (usedEmail.has(emailLocal)) {
      emailLocal = `${emailLocal}.${last2.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "")}`
    }
    let suffix = 0
    let candidateEmail = emailLocal
    while (usedEmail.has(candidateEmail)) {
      suffix++
      candidateEmail = `${emailLocal}${suffix}`
    }
    if (usedName.has(fullName)) continue
    usedName.add(fullName)
    usedEmail.add(candidateEmail)
    out.push({ fullName, emailLocal: candidateEmail })
  }
  return out
}

// =============================================================================
// MAIN
// =============================================================================
async function main() {
  const t0 = Date.now()
  const inventory = { tenant: null, areas: [], departments: [], users: [], courses: [] }

  // ---------------------------------------------------------------------------
  // PHASE 0 already answered by reconnaissance (recorded here for the record):
  // public.users.id REFERENCES auth.users(id) ON DELETE CASCADE -> every
  // fictitious user requires a real auth.users row via the Admin API.
  // ---------------------------------------------------------------------------
  console.log("Phase 0: public.users.id -> auth.users(id) FK CONFIRMED. Creating auth users for all identities.")

  // ---------------------------------------------------------------------------
  // PHASE 1 — tenant + areas + departments
  // ---------------------------------------------------------------------------
  console.log("\nPhase 1: tenant + areas + departments")

  const existingTenant = await rest("GET", `tenants?slug=eq.${NEW_TENANT_SLUG}&select=id`)
  let tenantId
  if (existingTenant.length > 0) {
    tenantId = existingTenant[0].id
    console.log(`  Tenant already exists (idempotent re-run): ${tenantId}`)
  } else {
    const [tenant] = await rest("POST", "tenants", {
      name: NEW_TENANT_NAME,
      slug: NEW_TENANT_SLUG,
      branding: {},
      settings: { demo: true, created_for: "mastermind-thiago-otto-2026-07-29" },
      plan: "standard", // live schema has no CHECK enforcing 'enterprise' as a valid value; 'standard' is proven live (Cory)
    })
    tenantId = tenant.id
    console.log(`  Created tenant ${NEW_TENANT_NAME}: ${tenantId}`)
  }
  inventory.tenant = { id: tenantId, name: NEW_TENANT_NAME, slug: NEW_TENANT_SLUG }

  const AREA_DEFS = [
    { name: "Ribeirão Preto", slug: "ribeirao-preto", description: "Planta matriz — Ribeirão Preto/SP", weight: 50 },
    { name: "Uberlândia", slug: "uberlandia", description: "Unidade industrial — Uberlândia/MG", weight: 35 },
    { name: "Curitiba", slug: "curitiba", description: "Unidade industrial — Curitiba/PR", weight: 25 },
    { name: "Recife", slug: "recife", description: "Unidade industrial — Recife/PE", weight: 10 },
  ]
  const areas = await rest(
    "POST",
    "areas",
    AREA_DEFS.map((a) => ({ tenant_id: tenantId, name: a.name, slug: a.slug, description: a.description })),
  )
  inventory.areas = areas
  console.log(`  Created ${areas.length} areas (unidades)`)

  const DEPT_DEFS = [
    { name: "Produção", slug: "producao" },
    { name: "Qualidade", slug: "qualidade" },
    { name: "Manutenção", slug: "manutencao" },
    { name: "Logística", slug: "logistica" },
    { name: "Administrativo", slug: "administrativo" },
  ]
  const departments = await rest(
    "POST",
    "departments",
    DEPT_DEFS.map((d) => ({ tenant_id: tenantId, name: d.name, slug: d.slug })),
  )
  inventory.departments = departments
  console.log(`  Created ${departments.length} departments`)

  const deptAreaRows = []
  for (const dept of departments) {
    for (const area of areas) {
      deptAreaRows.push({ department_id: dept.id, area_id: area.id, tenant_id: tenantId })
    }
  }
  await rest("POST", "department_areas", deptAreaRows)
  console.log(`  Linked ${deptAreaRows.length} department_areas rows (every department spans all 4 units)`)

  // ---------------------------------------------------------------------------
  // PHASE 2 — population: 120 students + 6 managers + 2 instructors
  // ---------------------------------------------------------------------------
  console.log("\nPhase 2: population")

  const NUM_STUDENTS = 120
  const NUM_MANAGERS = 6
  const NUM_INSTRUCTORS = 2
  const totalFictitious = NUM_STUDENTS + NUM_MANAGERS + NUM_INSTRUCTORS
  const names = generateUniqueNames(totalFictitious)

  // Weighted area assignment matching AREA_DEFS.weight (out of 120 total weight units)
  const totalWeight = AREA_DEFS.reduce((s, a) => s + a.weight, 0)
  function areaForIndex(i, n) {
    const frac = i / n
    let acc = 0
    for (let idx = 0; idx < AREA_DEFS.length; idx++) {
      acc += AREA_DEFS[idx].weight / totalWeight
      if (frac < acc) return areas[idx]
    }
    return areas[areas.length - 1]
  }

  const identities = []
  let ptr = 0
  for (let i = 0; i < NUM_INSTRUCTORS; i++) {
    identities.push({ ...names[ptr++], role: "instructor" })
  }
  for (let i = 0; i < NUM_MANAGERS; i++) {
    identities.push({ ...names[ptr++], role: "manager" })
  }
  for (let i = 0; i < NUM_STUDENTS; i++) {
    identities.push({ ...names[ptr++], role: "student" })
  }

  // Shuffle student area assignment so units get a mixed but weighted population
  const studentIdentities = identities.filter((x) => x.role === "student")
  studentIdentities.forEach((s, i) => {
    s.area = areaForIndex(i, studentIdentities.length)
  })
  // Managers/instructors: spread across areas round-robin (still need a home area)
  identities
    .filter((x) => x.role !== "student")
    .forEach((s, i) => {
      s.area = areas[i % areas.length]
    })

  console.log(`  Creating ${identities.length} auth.users + public.users (concurrency=6)...`)
  let created = 0
  await pMap(
    identities,
    async (person) => {
      const email = `${person.emailLocal}@vertice-industria.com.br`
      const authUser = await authAdmin("POST", "users", {
        email,
        password: randomPassword(),
        email_confirm: true,
        user_metadata: { full_name: person.fullName, demo_tenant: NEW_TENANT_SLUG },
      })
      person.id = authUser.id ?? authUser.user?.id
      person.email = email
      if (!person.id) throw new Error(`No id returned for ${email}: ${JSON.stringify(authUser)}`)

      await rest("POST", "users", {
        id: person.id,
        tenant_id: tenantId,
        email,
        full_name: person.fullName,
        report_name: person.fullName,
        role: person.role,
        onboarding_completed: true,
        profile: {},
        status: "active",
        learning_mode: "slide",
        is_test: true,
      })

      created++
      if (created % 20 === 0) console.log(`    ...${created}/${identities.length}`)
    },
    6,
  )
  console.log(`  Done: ${created} identities created`)

  // user_roles (multi-hat mirror of singular role)
  await rest(
    "POST",
    "user_roles",
    identities.map((p) => ({ user_id: p.id, tenant_id: tenantId, role: p.role })),
  )

  // user_areas (home unit)
  await rest(
    "POST",
    "user_areas",
    identities.map((p) => ({ user_id: p.id, area_id: p.area.id })),
  )

  // user_departments (round robin across the 5 departments)
  await rest(
    "POST",
    "user_departments",
    identities.map((p, i) => ({
      user_id: p.id,
      department_id: departments[i % departments.length].id,
      tenant_id: tenantId,
    })),
  )
  console.log(`  Linked user_roles, user_areas, user_departments`)

  const managers = identities.filter((x) => x.role === "manager")
  const instructors = identities.filter((x) => x.role === "instructor")

  // manager_groups: 4 area-scoped groups (1 manager per area) + 2 corporate
  // groups (spanning 2 units each) for the remaining 2 managers.
  const groupDefs = [
    { manager: managers[0], name: `Time Ribeirão Preto — ${managers[0].fullName.split(" ")[0]}`, slug: "time-ribeirao-preto", units: [areas[0]], corporate: false },
    { manager: managers[1], name: `Time Uberlândia — ${managers[1].fullName.split(" ")[0]}`, slug: "time-uberlandia", units: [areas[1]], corporate: false },
    { manager: managers[2], name: `Time Curitiba — ${managers[2].fullName.split(" ")[0]}`, slug: "time-curitiba", units: [areas[2]], corporate: false },
    { manager: managers[3], name: `Time Recife — ${managers[3].fullName.split(" ")[0]}`, slug: "time-recife", units: [areas[3]], corporate: false },
    { manager: managers[4], name: `Gestão Corporativa Sul/Sudeste — ${managers[4].fullName.split(" ")[0]}`, slug: "corp-sul-sudeste", units: [areas[0], areas[1]], corporate: true },
    { manager: managers[5], name: `Gestão Corporativa Sul/Nordeste — ${managers[5].fullName.split(" ")[0]}`, slug: "corp-sul-nordeste", units: [areas[2], areas[3]], corporate: true },
  ]
  const managerGroups = await rest(
    "POST",
    "manager_groups",
    groupDefs.map((g) => ({
      tenant_id: tenantId,
      manager_id: g.manager.id,
      name: g.name,
      slug: g.slug,
      is_corporate: g.corporate,
      created_by: g.manager.id,
    })),
  )
  const mguRows = []
  groupDefs.forEach((g, i) => {
    for (const unit of g.units) mguRows.push({ group_id: managerGroups[i].id, unit_id: unit.id, tenant_id: tenantId })
  })
  await rest("POST", "manager_group_units", mguRows)

  // reports_to: each student reports to the manager owning their home area's
  // primary (non-corporate) group. Members of manager_group_members mirror the
  // same assignment for the group-based (non-organograma) view.
  const areaToManager = new Map()
  groupDefs.filter((g) => !g.corporate).forEach((g) => areaToManager.set(g.units[0].id, g.manager))
  const reportsToUpdates = studentIdentities.map((s) => ({
    id: s.id,
    reports_to: areaToManager.get(s.area.id)?.id ?? null,
  }))
  await pMap(
    reportsToUpdates,
    (u) => rest("PATCH", `users?id=eq.${u.id}`, { reports_to: u.reports_to }),
    8,
  )

  const mgmRows = []
  studentIdentities.forEach((s) => {
    const primaryGroup = groupDefs.findIndex((g) => !g.corporate && g.units[0].id === s.area.id)
    if (primaryGroup >= 0) {
      mgmRows.push({ group_id: managerGroups[primaryGroup].id, student_id: s.id, tenant_id: tenantId, added_by: groupDefs[primaryGroup].manager.id })
    }
  })
  // A slice of each unit's students also belongs to the corporate group spanning it
  groupDefs.forEach((g, i) => {
    if (!g.corporate) return
    for (const unit of g.units) {
      const unitStudents = studentIdentities.filter((s) => s.area.id === unit.id)
      const subset = unitStudents.slice(0, Math.ceil(unitStudents.length * 0.4))
      for (const s of subset) mgmRows.push({ group_id: managerGroups[i].id, student_id: s.id, tenant_id: tenantId, added_by: g.manager.id })
    }
  })
  await rest("POST", "manager_group_members", mgmRows)
  console.log(`  Created ${managerGroups.length} manager_groups, ${reportsToUpdates.length} reports_to links, ${mgmRows.length} manager_group_members`)

  // ---------------------------------------------------------------------------
  // PHASE 3 — Hugo's demo account
  // ---------------------------------------------------------------------------
  console.log("\nPhase 3: Hugo demo account")

  let hugoId
  const existingHugo = await rest("GET", `users?email=eq.${HUGO_DEMO_EMAIL}&select=id,tenant_id`)
  if (existingHugo.length > 0 && existingHugo[0].tenant_id === tenantId) {
    hugoId = existingHugo[0].id
    console.log(`  Hugo demo account already exists (idempotent re-run): ${hugoId}`)
  } else {
    const hugoAuth = await authAdmin("POST", "users", {
      email: HUGO_DEMO_EMAIL,
      password: HUGO_DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Hugo Capitelli", demo_tenant: NEW_TENANT_SLUG },
    })
    hugoId = hugoAuth.id ?? hugoAuth.user?.id
    await rest("POST", "users", {
      id: hugoId,
      tenant_id: tenantId,
      email: HUGO_DEMO_EMAIL,
      full_name: "Hugo Capitelli",
      report_name: "Hugo Capitelli",
      role: "admin",
      onboarding_completed: true,
      profile: {},
      status: "active",
      learning_mode: "slide",
      is_test: true,
    })
    console.log(`  Created Hugo demo account: ${hugoId}`)
  }
  await rest("POST", "user_roles", [
    { user_id: hugoId, tenant_id: tenantId, role: "admin" },
    { user_id: hugoId, tenant_id: tenantId, role: "manager" },
    { user_id: hugoId, tenant_id: tenantId, role: "instructor" },
    { user_id: hugoId, tenant_id: tenantId, role: "student" },
  ]).catch(() => {}) // ON CONFLICT (user_id, role) — table has UNIQUE, duplicate insert 409s harmlessly on re-run
  await rest("POST", "user_areas", [{ user_id: hugoId, area_id: areas[0].id }]).catch(() => {})

  identities.push({ id: hugoId, fullName: "Hugo Capitelli", email: HUGO_DEMO_EMAIL, role: "admin", area: areas[0], isHugo: true })

  // Verify login works
  const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: HUGO_DEMO_EMAIL, password: HUGO_DEMO_PASSWORD }),
  })
  console.log(`  Login test: HTTP ${loginRes.status} ${loginRes.status === 200 ? "OK" : "FAILED"}`)
  if (loginRes.status !== 200) {
    console.error(await loginRes.text())
  }

  // ---------------------------------------------------------------------------
  // PHASE 4 — content copy
  // ---------------------------------------------------------------------------
  console.log("\nPhase 4: content copy")

  const primaryInstructor = instructors[0]

  // NOTE (schema divergence discovered live, 2026-07-29): `tenants`/`courses`
  // have NO `mode` column in production (migration file diverges from prod —
  // documented pattern in this repo, see epic30_user_roles.sql). `courses` has
  // `type` (default 'regular') instead. `sessions.question_id` is NULLABLE live
  // (also diverges from the NOT NULL in the original migration), so `questions`
  // never needs to be copied — sessions reference chapter_id only.
  async function copyCourse(sourceCourseId, newTitle) {
    const [sourceCourse] = await rest("GET", `courses?id=eq.${sourceCourseId}&select=*`)
    const [newCourse] = await rest("POST", "courses", {
      tenant_id: tenantId,
      title: newTitle ?? sourceCourse.title,
      description: sourceCourse.description,
      type: sourceCourse.type ?? "regular",
      status: "published",
      created_by: primaryInstructor.id,
      settings: sourceCourse.settings ?? {},
      cover_image_url: sourceCourse.cover_image_url,
      deadline_days: sourceCourse.deadline_days ?? 45,
      manager_deadline_days: sourceCourse.manager_deadline_days ?? 35,
    })

    const sourceChapters = await rest(
      "GET",
      `chapters?course_id=eq.${sourceCourseId}&select=*&order=order.asc`,
    )
    const chapterIdMap = new Map()
    const newChapters = []
    for (const ch of sourceChapters) {
      const [newCh] = await rest("POST", "chapters", {
        course_id: newCourse.id,
        title: ch.title,
        content: ch.content,
        learning_objective: ch.learning_objective,
        order: ch.order,
        status: "published",
        video_url: ch.video_url,
        audio_url: ch.audio_url,
        content_blocks: ch.content_blocks,
        key_concepts: ch.key_concepts,
        estimated_reading_time_min: ch.estimated_reading_time_min,
        interaction_type: ch.interaction_type,
        bloom_target: ch.bloom_target,
        slide_audio_url: ch.slide_audio_url,
        interaction_config: ch.interaction_config ?? {},
        estimated_duration_minutes: ch.estimated_duration_minutes,
      })
      chapterIdMap.set(ch.id, newCh.id)
      newChapters.push(newCh)
    }

    // Copy chapter_slides (the actual rendered content for slide-based chapters)
    let slideCount = 0
    for (const ch of sourceChapters) {
      const slides = await rest("GET", `chapter_slides?chapter_id=eq.${ch.id}&select=*&order=order.asc`)
      if (slides.length === 0) continue
      const rows = slides.map((s) => ({
        chapter_id: chapterIdMap.get(ch.id),
        tenant_id: tenantId,
        order: s.order,
        image_url: s.image_url,
        image_storage_path: s.image_storage_path,
        text_content: s.text_content,
        text_status: "approved",
        audio_start_ms: s.audio_start_ms,
        audio_end_ms: s.audio_end_ms,
        metadata: s.metadata ?? {},
      }))
      await rest("POST", "chapter_slides", rows)
      slideCount += rows.length
    }

    console.log(
      `  Copied course "${newCourse.title}" (${newCourse.id}): ${newChapters.length} chapters, ${slideCount} slides`,
    )
    return { course: newCourse, chapters: newChapters }
  }

  const course1 = await copyCourse(SOURCE_COURSE_1, "Análise e Solução de Problemas")
  const course2 = await copyCourse(SOURCE_COURSE_2, "Onboarding Vértice: Integração e Cultura")
  inventory.courses = [course1.course, course2.course]

  // Fetch slides for course1 chapters (needed for reflections in Phase 5)
  const course1SlidesByChapter = new Map()
  for (const ch of course1.chapters) {
    const slides = await rest("GET", `chapter_slides?chapter_id=eq.${ch.id}&select=id,order`)
    if (slides.length) course1SlidesByChapter.set(ch.id, slides)
  }
  const course1ChapterIds = course1.chapters.map((c) => c.id)

  // ---------------------------------------------------------------------------
  // PHASE 5 — movement and numbers
  // ---------------------------------------------------------------------------
  console.log("\nPhase 5: movement and numbers")

  // Tiers: adiantado 15%, no_ritmo 40%, atrasado 15%, sem_acesso 20%, nunca 10%
  const roster = identities // everyone participates as a "student view" for engagement purposes
  const tierOf = new Map()
  const shuffled = [...roster].sort(() => Math.random() - 0.5)
  const n = shuffled.length
  const bounds = { adiantado: Math.round(n * 0.15), no_ritmo: Math.round(n * 0.4), atrasado: Math.round(n * 0.15), sem_acesso: Math.round(n * 0.2) }
  let cursor = 0
  for (const tier of ["adiantado", "no_ritmo", "atrasado", "sem_acesso"]) {
    for (let i = 0; i < bounds[tier] && cursor < n; i++, cursor++) tierOf.set(shuffled[cursor].id, tier)
  }
  for (; cursor < n; cursor++) tierOf.set(shuffled[cursor].id, "nunca")
  // Hugo always "no_ritmo" — a believable, mid-progress walkthrough account
  tierOf.set(hugoId, "no_ritmo")

  const enrollmentRows = []
  const sessionRows = []
  const reflectionRows = []
  const gamificationRows = []
  const lastSeenUpdates = []

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
      default: // nunca
        return { progress: 0, sessions: 0, lastActivityDays: null, enrolledDaysAgo: 5 + Math.random() * 8, xp: 0, streak: 0, status: "active" }
    }
  }

  for (const person of roster) {
    const tier = tierOf.get(person.id)
    const profile = tierProfile(tier)

    // --- enrollment: course 1 (rich content) — everyone enrolled
    const totalChapters1 = course1.chapters.length
    const completedChapters1 = Math.round((profile.progress / 100) * totalChapters1)
    enrollmentRows.push({
      student_id: person.id,
      course_id: course1.course.id,
      tenant_id: tenantId,
      status: profile.status,
      progress: { percentage: Math.round(profile.progress), total_chapters: totalChapters1, completed_chapters: completedChapters1 },
      created_at: daysAgoISO(profile.enrolledDaysAgo),
    })

    // --- enrollment: course 2 (shell trail, no slides/questions in source) —
    // ~65%, skip most of the "nunca" tier. Progress is a plausible number only
    // (no real chapter interaction backs it, since source has no content).
    if (tier !== "nunca" || Math.random() < 0.2) {
      const pct2 = Math.round(Math.random() * (tier === "nunca" ? 5 : 60))
      const totalChapters2 = course2.chapters.length
      enrollmentRows.push({
        student_id: person.id,
        course_id: course2.course.id,
        tenant_id: tenantId,
        status: "active",
        progress: { percentage: pct2, total_chapters: totalChapters2, completed_chapters: Math.round((pct2 / 100) * totalChapters2) },
        created_at: daysAgoISO(profile.enrolledDaysAgo * 0.8),
      })
    }

    // --- sessions (drives total_sessions / last_activity_at signal via
    // auth_team_engagement_signals RPC). question_id is nullable live, so
    // sessions reference chapter_id only — no `questions` copy needed.
    for (let i = 0; i < profile.sessions; i++) {
      const chapterId = pick(course1ChapterIds)
      const daysBack = profile.lastActivityDays === null ? 0 : profile.lastActivityDays + i * (2 + Math.random() * 3)
      const status = Math.random() < 0.75 ? "completed" : Math.random() < 0.5 ? "active" : "abandoned"
      sessionRows.push({
        student_id: person.id,
        chapter_id: chapterId,
        question_id: null,
        tenant_id: tenantId,
        status,
        interactions_remaining: Math.floor(Math.random() * 15),
        turn_number: 3 + Math.floor(Math.random() * 10),
        created_at: daysAgoISO(daysBack),
        updated_at: daysAgoISO(Math.max(0, daysBack - 0.1)),
        completed_at: status === "completed" ? daysAgoISO(Math.max(0, daysBack - 0.1)) : null,
      })
    }

    // --- last_seen_at (navigation signal, independent of sessions)
    if (tier !== "nunca") {
      lastSeenUpdates.push({ id: person.id, last_seen_at: daysAgoISO(Math.max(0, (profile.lastActivityDays ?? 0) - Math.random())) })
    }

    // --- slide_reflections (adiantado + no_ritmo tiers write real reflections)
    if ((tier === "adiantado" || tier === "no_ritmo") && course1SlidesByChapter.size > 0) {
      const allSlides = [...course1SlidesByChapter.values()].flat()
      const numReflections = tier === "adiantado" ? 5 + Math.floor(Math.random() * 5) : 2 + Math.floor(Math.random() * 4)
      const chosen = [...allSlides].sort(() => Math.random() - 0.5).slice(0, Math.min(numReflections, allSlides.length))
      for (const slide of chosen) {
        reflectionRows.push({
          student_id: person.id,
          slide_id: slide.id,
          tenant_id: tenantId,
          response: pick(REFLECTION_TEXTS),
          created_at: daysAgoISO(profile.lastActivityDays ?? 1),
        })
      }
    }

    // --- gamification (one row per person)
    gamificationRows.push({
      user_id: person.id,
      tenant_id: tenantId,
      xp: Math.round(profile.xp),
      level: levelForXp(profile.xp),
      current_streak: profile.streak,
      max_streak: profile.streak + Math.floor(Math.random() * 8),
      last_activity_date: profile.lastActivityDays === null ? null : new Date(Date.now() - profile.lastActivityDays * 86_400_000).toISOString().slice(0, 10),
      badges: [],
    })
  }

  function levelForXp(xp) {
    const thresholds = [0, 500, 1500, 3000, 5000, 8000, 12000, 17000, 23000, 30000]
    let level = 1
    for (let i = 0; i < thresholds.length; i++) if (xp >= thresholds[i]) level = i + 1
    return level
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

  console.log(`  Prepared: ${enrollmentRows.length} enrollments, ${sessionRows.length} sessions, ${reflectionRows.length} reflections, ${gamificationRows.length} gamification rows`)

  async function batchInsert(table, rows, size = 300) {
    for (let i = 0; i < rows.length; i += size) {
      await rest("POST", table, rows.slice(i, i + size))
    }
  }

  await batchInsert("enrollments", enrollmentRows)
  console.log(`  Inserted enrollments`)
  await batchInsert("sessions", sessionRows)
  console.log(`  Inserted sessions`)
  await batchInsert("slide_reflections", reflectionRows)
  console.log(`  Inserted slide_reflections`)
  await batchInsert("user_gamification", gamificationRows)
  console.log(`  Inserted user_gamification`)
  await pMap(lastSeenUpdates, (u) => rest("PATCH", `users?id=eq.${u.id}`, { last_seen_at: u.last_seen_at }), 8)
  console.log(`  Updated last_seen_at for ${lastSeenUpdates.length} users`)

  // ---------------------------------------------------------------------------
  // PHASE 6 — verification + inventory dump
  // ---------------------------------------------------------------------------
  console.log("\nPhase 6: verification")

  const coryCountAfter = await rest("GET", `users?tenant_id=eq.${CORY_TENANT_ID}&select=id`)
  console.log(`  Cory tenant user count AFTER: ${coryCountAfter.length} (expected 51, unchanged)`)

  const vUsers = await rest("GET", `users?tenant_id=eq.${tenantId}&select=id,role`)
  const vEnrollments = await rest("GET", `enrollments?tenant_id=eq.${tenantId}&select=id`)
  const vSessions = await rest("GET", `sessions?tenant_id=eq.${tenantId}&select=id`)
  const vReflections = await rest("GET", `slide_reflections?tenant_id=eq.${tenantId}&select=id`)
  const vGamification = await rest("GET", `user_gamification?tenant_id=eq.${tenantId}&select=user_id`)

  const summary = {
    tenantId,
    users: vUsers.length,
    byRole: vUsers.reduce((acc, u) => ({ ...acc, [u.role]: (acc[u.role] ?? 0) + 1 }), {}),
    enrollments: vEnrollments.length,
    sessions: vSessions.length,
    reflections: vReflections.length,
    gamification: vGamification.length,
    coryUnchanged: coryCountAfter.length === 51,
    hugoLoginOk: loginRes.status === 200,
    elapsedSeconds: Math.round((Date.now() - t0) / 1000),
  }
  console.log("\n=== SUMMARY ===")
  console.log(JSON.stringify(summary, null, 2))

  writeFileSync(
    new URL("../.demo-tenant-vertice-inventory.json", import.meta.url),
    JSON.stringify({ inventory, summary, identities: identities.map((p) => ({ id: p.id, name: p.fullName, role: p.role, email: p.email })) }, null, 2),
  )
  console.log("\nInventory written to .demo-tenant-vertice-inventory.json")
}

main().catch((err) => {
  console.error("\nFATAL:", err)
  process.exit(1)
})
