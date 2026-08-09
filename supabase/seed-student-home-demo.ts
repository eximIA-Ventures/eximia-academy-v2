// ===========================================================================
// seed-student-home-demo.ts — FRESH demo activity so the student home is ALIVE
// ===========================================================================
// SH-F.4 (EPIC-STUDENT-HOME-FINALIZACAO). Idempotent seed that re-anchors the
// demo student's RECENT activity so the "Meu ritmo" home shows a recent last
// access and a healthy pace (today the demo's activity is ~52 days old, so the
// home reads as "parado"). Mirrors the canonical pattern of `seed-remote.ts`
// (TS + @supabase/supabase-js via service role). It writes ONLY to the demo
// tenant, and it is safe to run any number of times (stable-key upserts +
// dates re-anchored to `now - N days` each run → no duplication).
//
// ---------------------------------------------------------------------------
// EXECUTION NOTE
// ---------------------------------------------------------------------------
//   ALLOW_DEMO_SEED=1 \
//   SUPABASE_URL=<demo project url> \
//   SUPABASE_SERVICE_ROLE_KEY=<demo service role key> \
//   pnpm tsx supabase/seed-student-home-demo.ts
//
// The opt-in env `ALLOW_DEMO_SEED=1` is MANDATORY. Without it the script aborts
// with a non-zero exit and writes nothing. This is a deliberate speed bump so
// the seed can never run "by accident" from an ambient shell.
//
// ---------------------------------------------------------------------------
// DEMO-ONLY SAFETY (all three guards run BEFORE the first write; see below)
// ---------------------------------------------------------------------------
// This script NEVER runs against production. Three guards gate every write,
// in this order, and any failure exits non-zero with ZERO writes:
//
//   Guard 1 — OPT-IN: `ALLOW_DEMO_SEED === "1"` must be present.
//   Guard 2 — PROD-HOST DENYLIST (implemented, not just documented): the
//             `SUPABASE_URL` host must NOT match `PROD_HOST_DENYLIST` below and
//             must NOT contain the substring "prod". The denylist holds the
//             known eximIA Academy production hosts; extend it if prod infra
//             changes. A Supabase project URL can still "fool" a host denylist
//             (e.g. two `*.supabase.co` refs), which is why Guard 3 is the real
//             safety net: it is based on TENANT DATA, not on the URL string.
//   Guard 3 — RUNTIME SLUG CHECK: read `tenants.slug` for the hardcoded
//             `TENANT_ID` and proceed only if it is exactly "demo" (or the
//             tenant name is "Demo"). If it is anything else, abort with zero
//             writes. This is robust even if the URL is misleading.
//
// The target tenant id is HARDCODED to the demo tenant and never taken from an
// env or an argument.
// ===========================================================================

import { createClient } from "@supabase/supabase-js"

// --- The demo tenant. HARDCODED, never from env/argv (Guard, first line). ---
const TENANT_ID = "11111111-1111-1111-1111-111111111111"
const DEMO_SLUG = "demo"
const DEMO_NAME = "Demo"

// --- The demo student whose home we make "alive" (seed-remote.ts:22). --------
const DEMO_STUDENT_EMAIL = "student@a.com"

// --- Guard 2 data: production hosts this seed must NEVER touch. Extend as prod
//     infrastructure changes. Matching is substring-based on the URL host, plus
//     a blanket refusal of any host containing "prod". Guard 3 (slug) is the
//     authoritative net; this is defense in depth on the URL string. ----------
const PROD_HOST_DENYLIST = [
  "argos.eximiaacademy.com.br",
  "eximiaacademy.com.br",
  "academy.eximiaventures.com.br",
  "eximiaventures.com.br",
]

// --- Recent-activity anchor. Sessions are spread across the last ~10 days so
//     "último acesso" is today-ish and the 30-day window looks healthy. The
//     offsets are re-applied to `now` on every run → dates never accumulate. --
const DAY_MS = 24 * 60 * 60 * 1000

// Existing demo chapters/questions (from seed-remote.ts) that student@a.com is
// enrolled in (courses 1, 2, 3). Stable ids so the FKs resolve on the demo DB.
const C1_CH1 = "ffffffff-ffff-ffff-ffff-ffffffffffff"
const C1_CH2 = "aaaaaaaa-1111-2222-3333-444444444444"
const C1_CH3 = "bbbbbbbb-1111-2222-3333-444444444444"
const C2_CH1 = "c2c10000-0000-0000-0000-000000000001"
const C2_CH2 = "c2c20000-0000-0000-0000-000000000002"
const C3_CH1 = "c3c10000-0000-0000-0000-000000000001"

const Q_C1_CH1 = "11110001-0001-0001-0001-000000000001"
const Q_C1_CH2 = "11110001-0001-0001-0001-000000000003"
const Q_C1_CH3 = "11110001-0001-0001-0001-000000000005"
const Q_C2_CH1 = "22220001-0001-0001-0001-000000000001"
const Q_C2_CH2 = "22220001-0001-0001-0001-000000000003"
const Q_C3_CH1 = "33330001-0001-0001-0001-000000000001"

// The 3 demo courses student@a.com is enrolled in (seed-remote.ts:518-520).
const COURSE_1_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
const COURSE_2_ID = "22222222-2222-2222-2222-222222222222"
const COURSE_3_ID = "33333333-3333-3333-3333-333333333333"

/**
 * The demo-recent session set. STABLE ids (prefix "5ee0da..") so re-running
 * upserts the SAME rows (no duplication). `dayOffset` is subtracted from `now`
 * at run time, so the activity always looks fresh.
 */
const RECENT_SESSIONS = [
  { id: "5ee0da01-0001-0001-0001-000000000001", chapter_id: C1_CH1, question_id: Q_C1_CH1, dayOffset: 0 },
  { id: "5ee0da02-0001-0001-0001-000000000002", chapter_id: C1_CH2, question_id: Q_C1_CH2, dayOffset: 1 },
  { id: "5ee0da03-0001-0001-0001-000000000003", chapter_id: C1_CH3, question_id: Q_C1_CH3, dayOffset: 2 },
  { id: "5ee0da04-0001-0001-0001-000000000004", chapter_id: C2_CH1, question_id: Q_C2_CH1, dayOffset: 4 },
  { id: "5ee0da05-0001-0001-0001-000000000005", chapter_id: C3_CH1, question_id: Q_C3_CH1, dayOffset: 6 },
  { id: "5ee0da06-0001-0001-0001-000000000006", chapter_id: C2_CH2, question_id: Q_C2_CH2, dayOffset: 9 },
] as const

// Enrollment re-anchor: enrolled ~20 days ago so deadline-based "% em dia" is
// healthy (not overdue). Idempotent by UNIQUE(student_id, course_id).
const ENROLLMENT_ANCHOR_DAYS = 20
const DEMO_STUDENT_COURSES = [COURSE_1_ID, COURSE_2_ID, COURSE_3_ID] as const

function isoDaysAgo(now: number, days: number): string {
  return new Date(now - days * DAY_MS).toISOString()
}

/** Abort helper: print the reason and exit non-zero with ZERO writes done. */
function abort(reason: string): never {
  console.error(`ABORT (zero writes): ${reason}`)
  process.exit(1)
}

// ===========================================================================
// GUARDS 1 & 2 — run before we even build the client (no network, no writes).
// ===========================================================================

const supabaseUrl = process.env.SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

if (!supabaseUrl || !supabaseServiceKey) {
  abort("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars")
}

// Guard 1 — explicit opt-in.
if (process.env.ALLOW_DEMO_SEED !== "1") {
  abort("ALLOW_DEMO_SEED=1 is required to run the demo seed (opt-in missing)")
}

// Guard 2 — production-host denylist over SUPABASE_URL (implemented, not just
// documented). Parse the host and refuse any prod match.
let supabaseHost = ""
try {
  supabaseHost = new URL(supabaseUrl).host.toLowerCase()
} catch {
  abort(`SUPABASE_URL is not a valid URL: ${supabaseUrl}`)
}
const deniedByHost =
  supabaseHost.includes("prod") ||
  PROD_HOST_DENYLIST.some((h) => supabaseHost.includes(h.toLowerCase()))
if (deniedByHost) {
  abort(`SUPABASE_URL host "${supabaseHost}" matches the production denylist`)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function seed() {
  // =========================================================================
  // GUARD 3 — runtime slug check. The authoritative demo-only net, based on
  // TENANT DATA. Any result other than the demo tenant aborts with zero writes.
  // =========================================================================
  const { data: tenant, error: tenantErr } = await supabase
    .from("tenants")
    .select("id, slug, name")
    .eq("id", TENANT_ID)
    .maybeSingle()

  if (tenantErr) {
    abort(`Could not read tenant ${TENANT_ID}: ${tenantErr.message}`)
  }
  if (!tenant) {
    abort(`Tenant ${TENANT_ID} not found — refusing to seed an unknown tenant`)
  }
  // Proceed only if slug === "demo" (or name === "Demo"); anything else aborts.
  if (tenant.slug !== DEMO_SLUG && tenant.name !== DEMO_NAME) {
    abort(
      `Tenant ${TENANT_ID} is not the demo tenant (slug="${tenant.slug}", name="${tenant.name}") — refusing`,
    )
  }
  console.log(`Guard passed: tenant ${TENANT_ID} is the demo tenant (slug="${tenant.slug}").`)

  // Resolve the demo student id (read-only) BEFORE any write.
  const { data: student, error: studentErr } = await supabase
    .from("users")
    .select("id")
    .eq("tenant_id", TENANT_ID)
    .eq("email", DEMO_STUDENT_EMAIL)
    .maybeSingle()

  if (studentErr) {
    abort(`Could not read demo student ${DEMO_STUDENT_EMAIL}: ${studentErr.message}`)
  }
  if (!student) {
    abort(
      `Demo student ${DEMO_STUDENT_EMAIL} not found in tenant ${TENANT_ID}. Run seed-remote first.`,
    )
  }
  const studentId = student.id as string
  console.log(`Demo student resolved: ${DEMO_STUDENT_EMAIL} → ${studentId}`)

  // Frozen clock: one `now` per run so every offset is consistent.
  const now = Date.now()

  // =========================================================================
  // FIRST WRITE BELOW THIS LINE. Everything above is read-only guard/lookup.
  // =========================================================================

  // --- Recent sessions (drives "último acesso" + healthy 30-day pace). Stable
  //     ids → upsert overwrites the same rows; created_at re-anchored to now. --
  let sessionsWritten = 0
  for (const s of RECENT_SESSIONS) {
    const ts = isoDaysAgo(now, s.dayOffset)
    const { error } = await supabase.from("sessions").upsert(
      {
        id: s.id,
        student_id: studentId,
        chapter_id: s.chapter_id,
        question_id: s.question_id,
        tenant_id: TENANT_ID,
        status: "completed",
        interactions_remaining: 14,
        turn_number: 6,
        created_at: ts,
        updated_at: ts,
      },
      { onConflict: "id" },
    )
    if (error) {
      console.error(`  Session ${s.id} error: ${error.message}`)
    } else {
      sessionsWritten++
    }
  }
  console.log(`Recent sessions upserted: ${sessionsWritten}/${RECENT_SESSIONS.length}`)

  // --- Enrollment re-anchor: enrolled ~20 days ago so deadline-based "% em dia"
  //     reads healthy. Idempotent by UNIQUE(student_id, course_id); `progress`
  //     is intentionally omitted so an existing value is preserved on update. --
  const enrolledAt = isoDaysAgo(now, ENROLLMENT_ANCHOR_DAYS)
  let enrollmentsWritten = 0
  for (const courseId of DEMO_STUDENT_COURSES) {
    const { error } = await supabase.from("enrollments").upsert(
      {
        student_id: studentId,
        course_id: courseId,
        tenant_id: TENANT_ID,
        status: "active",
        created_at: enrolledAt,
        updated_at: isoDaysAgo(now, 0),
      },
      { onConflict: "student_id,course_id" },
    )
    if (error) {
      console.error(`  Enrollment (course ${courseId}) error: ${error.message}`)
    } else {
      enrollmentsWritten++
    }
  }
  console.log(`Enrollments re-anchored: ${enrollmentsWritten}/${DEMO_STUDENT_COURSES.length}`)

  // --- Reflections (boost "ritmo" when the demo has slides). Defensive: only
  //     writes if chapter_slides exist for the student's recent chapters, and
  //     is idempotent by UNIQUE(student_id, slide_id). Skipped cleanly when the
  //     demo has no slides, so a missing FK never aborts the seed. -------------
  const recentChapterIds = [...new Set(RECENT_SESSIONS.map((s) => s.chapter_id))]
  const { data: slides, error: slidesErr } = await supabase
    .from("chapter_slides")
    .select("id")
    .in("chapter_id", recentChapterIds)
    .limit(4)
  if (slidesErr) {
    console.log(`  Reflections skipped (chapter_slides not readable: ${slidesErr.message})`)
  } else if (!slides || slides.length === 0) {
    console.log("  Reflections skipped (no chapter_slides for the demo chapters)")
  } else {
    let reflectionsWritten = 0
    for (const [i, slide] of slides.entries()) {
      const ts = isoDaysAgo(now, i) // spread over the last few days
      const { error } = await supabase.from("slide_reflections").upsert(
        {
          student_id: studentId,
          slide_id: slide.id as string,
          tenant_id: TENANT_ID,
          response:
            "Reflexão de demonstração, registrada ao final da sessão para manter o ritmo de estudo.",
          created_at: ts,
          updated_at: ts,
        },
        { onConflict: "student_id,slide_id" },
      )
      if (error) {
        console.error(`  Reflection (slide ${slide.id}) error: ${error.message}`)
      } else {
        reflectionsWritten++
      }
    }
    console.log(`Reflections upserted: ${reflectionsWritten}/${slides.length}`)
  }

  console.log("\n✓ Demo home seed complete. Login as student@a.com to see a live 'Meu ritmo'.")
}

seed().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
