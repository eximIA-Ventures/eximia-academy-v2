// ---------------------------------------------------------------------------
// POST /api/analytics/pedagogical-actions — FASE 2 item 1.3 (TUDO)
// ---------------------------------------------------------------------------
// Returns the three advanced pedagogical levers for a scope:
//   (a) reopen_reflection  — DETERMINISTIC (module with lowest reflection index).
//   (b) concept_clinic     — AI (3 most fragile concepts over reflections/sessions).
//   (c) reflection_to_case — AI (turn a high-depth reflection into a learning case).
//
// SECURITY (lição da sessão, enforced here):
//   • auth.getUser() required (401 otherwise).
//   • role gate: only leader/manager/admin/instructor/super_admin (403 otherwise).
//   • tenant is RESOLVED server-side (profile.tenant_id, then x-sa-active-tenant
//     cookie for admins) — NEVER taken from the request body.
//   • all reads are tenant-scoped via the service client (RLS-bypassing, so the
//     .eq("tenant_id", tenantId) filter is the only thing keeping it scoped).
//   • reflection/session samples are ANONYMIZED (plain text only, no ids/names)
//     before any LLM prompt is built — no PII leaves the server.
//   • rate-limited per tenant (reuses semanticAnalysisLimiter — this is an
//     AI/LLM endpoint, same cost profile as semantic analysis).
//
// AI provider/config mirrors app/api/analytics/insights/route.ts exactly
// (direct fetch to OpenAI chat/completions, gpt-4o-mini, OPENAI_API_KEY). If the
// key is absent the AI levers are silently skipped — the deterministic
// reopen_reflection still returns, so the endpoint degrades gracefully.

import {
  type AnonymizedSample,
  CONCEPT_CLINIC_SYSTEM_PROMPT,
  type HighDepthReflection,
  type ModuleReflectionIndex,
  REFLECTION_TO_CASE_SYSTEM_PROMPT,
  buildConceptClinicPrompt,
  buildReflectionToCasePrompt,
  buildReopenReflectionAction,
  parseConceptClinic,
  parseReflectionToCase,
} from "@/lib/analytics/pedagogical-actions"
import { semanticAnalysisLimiter } from "@/lib/rate-limit"
import { createClient } from "@/lib/supabase/server"
import type { PedagogicalAction, SessionAnalyticsJsonb } from "@/types/analytics"
import type { SupabaseClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { z } from "zod"

// Loose service-client shape (matches createServiceClient) so we can query
// untyped tables without fighting the generated Database generics.
// biome-ignore lint/suspicious/noExplicitAny: matches createServiceClient's loose typing
type ServiceClient = SupabaseClient<any, "public", any>

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Per-module reflection indices the deterministic reopen selector consumes.
// Structurally a subset of ModuleIndicator so the client can forward
// aggregateResponse.indicators.perModule unchanged.
const moduleIndexSchema = z.object({
  chapterId: z.string().uuid(),
  chapterTitle: z.string().max(300),
  reflectionsWritten: z.number().int().nonnegative().max(10_000_000),
  reflectionPotential: z.number().int().nonnegative().max(10_000_000),
  reflectionIndexPct: z.number().min(0).max(100),
})

const bodySchema = z.object({
  // Optional course narrowing (orthogonal to scope). Tenant is NEVER in the body.
  courseId: z.string().uuid().nullable().optional(),
  // Optional UNIDADE narrowing for sample selection (areas.id).
  areaId: z.string().uuid().nullable().optional(),
  // The per-module reflection indices for the deterministic reopen action.
  // Forwarded from the aggregate response (indicators.perModule). When omitted,
  // the reopen action is simply not produced.
  perModule: z.array(moduleIndexSchema).max(2000).optional(),
})

const PAGE_SIZE = 1000
const SESSION_SAMPLE_LIMIT = 60 // student turns sampled for the concept clinic
// Over-fetch ceiling for session turns: pull a larger recent pool, then
// distribute the SESSION_SAMPLE_LIMIT budget across DISTINCT sessions (so a
// couple of very active sessions can't dominate the clinic sample). Capped so
// the in() filter + payload stay bounded.
const SESSION_TURN_FETCH_CEILING = SESSION_SAMPLE_LIMIT * 6 // 360
const SESSION_IDS_QUERY_CAP = 100 // max session ids forwarded to the in() filter
const REFLECTION_SAMPLE_LIMIT = 60 // reflections sampled for the concept clinic
const HIGH_DEPTH_MIN = 5 // depth ≥ 5 (síntese+) counts as "high depth" for case gen

interface SessionRow {
  id: string
  student_id: string
  analytics: SessionAnalyticsJsonb | null
}

/**
 * Resolves the active tenant server-side. NEVER from the body. Mirrors the
 * resolution in aggregate/insights routes (profile first, admin cookie fallback).
 */
async function resolveTenantId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileTenantId: string | null,
): Promise<string | null> {
  if (profileTenantId) return profileTenantId
  const { cookies: getCookies } = await import("next/headers")
  const cookieStore = await getCookies()
  return cookieStore.get("x-sa-active-tenant")?.value ?? null
}

/** Single OpenAI chat/completions call — identical config to insights/route.ts. */
async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 600,
      }),
    })
    const data = await res.json()
    return (data.choices?.[0]?.message?.content as string | undefined) ?? null
  } catch (err) {
    console.error("[pedagogical-actions] AI error:", err)
    return null
  }
}

/**
 * Resolves the slide ids in scope (optionally narrowed by course/area), used to
 * scope reflections to the relevant curriculum. Returns null when no narrowing
 * applies (= all tenant slides). Tenant-scoped throughout.
 */
async function resolveScopeSlideIds(
  db: ServiceClient,
  tenantId: string,
  courseId: string | null | undefined,
  areaId: string | null | undefined,
): Promise<string[] | null> {
  // Determine the courses in scope (mirrors aggregate route's narrowing logic).
  let courseIds: string[] | null = null
  if (courseId) {
    const { data: selected } = await db.from("courses").select("title").eq("id", courseId).single()
    courseIds = [courseId]
    if (selected?.title) {
      const { data: sameTitle } = await db
        .from("courses")
        .select("id")
        .eq("title", selected.title)
        .eq("tenant_id", tenantId)
      if (sameTitle) courseIds = sameTitle.map((c) => c.id as string)
    }
  } else if (areaId) {
    const { data: courseAreaRows } = await db
      .from("course_areas")
      .select("course_id")
      .eq("area_id", areaId)
      .eq("tenant_id", tenantId)
    const { data: legacyCourses } = await db
      .from("courses")
      .select("id")
      .eq("area_id", areaId)
      .eq("tenant_id", tenantId)
    courseIds = [
      ...new Set([
        ...(courseAreaRows ?? []).map((r) => r.course_id as string),
        ...(legacyCourses ?? []).map((c) => c.id as string),
      ]),
    ]
  }

  if (courseIds === null) return null // no narrowing → all tenant slides
  if (courseIds.length === 0) return [] // narrowing resolved but empty

  const { data: chapters } = await db
    .from("chapters")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("course_id", courseIds)
  const chapterIds = (chapters ?? []).map((c) => c.id as string)
  if (chapterIds.length === 0) return []

  const slides: { id: string }[] = []
  for (let from = 0; from < 50_000; from += PAGE_SIZE) {
    const { data, error } = await db
      .from("chapter_slides")
      .select("id")
      .eq("tenant_id", tenantId)
      .in("chapter_id", chapterIds)
      .range(from, from + PAGE_SIZE - 1)
    if (error || !data || data.length === 0) break
    slides.push(...(data as { id: string }[]))
    if (data.length < PAGE_SIZE) break
  }
  return slides.map((s) => s.id)
}

export async function POST(request: Request) {
  // --- Auth ---
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // --- Role gate (same allow-list as aggregate/insights/semantic) ---
  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()
  if (
    !profile?.role ||
    !["leader", "manager", "admin", "instructor", "super_admin"].includes(profile.role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // --- Tenant (server-resolved, NEVER from the body) ---
  const tenantId = await resolveTenantId(supabase, profile.tenant_id)
  if (!tenantId) return NextResponse.json({ error: "Nenhum tenant ativo" }, { status: 400 })

  // --- Rate limit (per tenant) — AI endpoint, reuse semantic limiter ---
  if (semanticAnalysisLimiter) {
    const { success } = await semanticAnalysisLimiter.limit(tenantId)
    if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 })
  }

  // --- Validate body ---
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(rawBody)
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  const { courseId, areaId, perModule } = parsed.data

  // Defense in depth — body uses .uuid(), but re-check before any query.
  if (courseId && !UUID_RE.test(courseId))
    return NextResponse.json({ error: "Invalid course ID" }, { status: 400 })
  if (areaId && !UUID_RE.test(areaId))
    return NextResponse.json({ error: "Invalid area ID" }, { status: 400 })

  const { createServiceClient } = await import("@/lib/supabase/service")
  const db = createServiceClient()

  const actions: PedagogicalAction[] = []

  // ===========================================================================
  // (a) REABRIR REFLEXÃO — deterministic, no AI, no DB (uses forwarded indices).
  // ===========================================================================
  if (perModule && perModule.length > 0) {
    const reopen = buildReopenReflectionAction(perModule as ModuleReflectionIndex[])
    if (reopen) actions.push(reopen)
  }

  // --- Shared data pull for the two AI levers (tenant-scoped) ---
  const apiKey = process.env.OPENAI_API_KEY

  // Slides in scope (for reflection scoping). null = all tenant slides.
  const scopeSlideIds = await resolveScopeSlideIds(db, tenantId, courseId, areaId)
  const scopeEmpty = scopeSlideIds !== null && scopeSlideIds.length === 0

  // Reflections (anonymized): response text only. Scope by slide when narrowed.
  let reflections: { id: string; response: string; student_id: string }[] = []
  if (!scopeEmpty) {
    let reflQuery = db
      .from("slide_reflections")
      .select("id, response, student_id")
      .eq("tenant_id", tenantId)
    if (scopeSlideIds !== null) reflQuery = reflQuery.in("slide_id", scopeSlideIds)
    const { data: reflRows } = await reflQuery
      .order("created_at", { ascending: false })
      .limit(REFLECTION_SAMPLE_LIMIT)
    reflections = (reflRows ?? []) as { id: string; response: string; student_id: string }[]
  }

  // Sessions with analytics (for student turns + depth ranking). Tenant-scoped.
  let sessions: SessionRow[] = []
  if (!scopeEmpty) {
    const { data: sessRows } = await db
      .from("sessions")
      .select("id, student_id, analytics")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(200)
    sessions = (sessRows ?? []) as SessionRow[]
  }

  // ===========================================================================
  // (b) CLÍNICA DOS 3 CONCEITOS MAIS FRÁGEIS — AI.
  // ===========================================================================
  if (apiKey && !scopeEmpty) {
    // Sample student turns where fragility shows. Over-fetch a larger RECENT pool
    // and then distribute the SESSION_SAMPLE_LIMIT budget across DISTINCT sessions
    // (round-robin), so a couple of very active sessions can't dominate and skew
    // the clinic toward 1–2 students. Cross-session representativeness > recency.
    const sessionIds = sessions.map((s) => s.id)
    const depthBySession = new Map(sessions.map((s) => [s.id, s.analytics?.depth_reached ?? null]))
    const studentTurns: { content: string; session_id: string }[] = []
    if (sessionIds.length > 0) {
      const { data: msgRows } = await db
        .from("messages")
        .select("content, session_id")
        .eq("tenant_id", tenantId)
        .eq("role", "user")
        .in("session_id", sessionIds.slice(0, SESSION_IDS_QUERY_CAP))
        .order("created_at", { ascending: false })
        .limit(SESSION_TURN_FETCH_CEILING)
      const pool = (msgRows ?? []) as { content: string; session_id: string }[]

      // Group the recent pool by session (insertion order preserves recency).
      const turnsBySession = new Map<string, { content: string; session_id: string }[]>()
      for (const row of pool) {
        const bucket = turnsBySession.get(row.session_id)
        if (bucket) bucket.push(row)
        else turnsBySession.set(row.session_id, [row])
      }

      // Round-robin: take 1 turn per session per pass until the budget fills or
      // the pool is exhausted. Each session contributes its most-recent turns,
      // but every session gets a turn before any session gets a second.
      const buckets = [...turnsBySession.values()]
      for (let pass = 0; studentTurns.length < SESSION_SAMPLE_LIMIT; pass++) {
        let tookOne = false
        for (const bucket of buckets) {
          if (pass >= bucket.length) continue
          studentTurns.push(bucket[pass])
          tookOne = true
          if (studentTurns.length >= SESSION_SAMPLE_LIMIT) break
        }
        if (!tookOne) break // pool exhausted
      }
    }

    const samples: AnonymizedSample[] = [
      // Reflections: free text only — no id, no name.
      ...reflections.map((r) => ({ text: r.response, source: "reflection" as const })),
      // Session turns: content + coarse depth bucket; no id, no name.
      ...studentTurns.map((m) => ({
        text: m.content,
        source: "session" as const,
        depth: depthBySession.get(m.session_id) ?? null,
      })),
    ]

    const clinicPrompt = buildConceptClinicPrompt(samples)
    if (clinicPrompt) {
      const content = await callOpenAI(apiKey, CONCEPT_CLINIC_SYSTEM_PROMPT, clinicPrompt)
      const clinicAction = content ? parseConceptClinic(content) : null
      if (clinicAction) actions.push(clinicAction)
    }
  }

  // ===========================================================================
  // (c) TRANSFORMAR REFLEXÃO EM CASO — AI. Pick the highest-depth author's
  //     reflection (depth proxy = author's session avgDepth; slide_reflections
  //     has no depth column).
  // ===========================================================================
  if (apiKey && !scopeEmpty && reflections.length > 0) {
    // Per-student avg session depth (the only depth signal available).
    const depthSumByStudent = new Map<string, { sum: number; n: number }>()
    for (const s of sessions) {
      const d = s.analytics?.depth_reached ?? 0
      if (d <= 0) continue
      const acc = depthSumByStudent.get(s.student_id) ?? { sum: 0, n: 0 }
      acc.sum += d
      acc.n += 1
      depthSumByStudent.set(s.student_id, acc)
    }
    const avgDepthByStudent = new Map<string, number>()
    for (const [sid, { sum, n }] of depthSumByStudent)
      avgDepthByStudent.set(sid, n > 0 ? sum / n : 0)

    // Rank reflections by their author's avg session depth; keep only high-depth.
    const candidates: HighDepthReflection[] = reflections
      .map((r) => ({
        reflectionId: r.id,
        text: r.response,
        depth: Math.round(avgDepthByStudent.get(r.student_id) ?? 0),
      }))
      .filter((c) => c.depth >= HIGH_DEPTH_MIN && c.text.trim().length > 0)
      .sort((a, b) => b.depth - a.depth)

    const best = candidates[0]
    if (best) {
      const casePrompt = buildReflectionToCasePrompt(best)
      if (casePrompt) {
        const content = await callOpenAI(apiKey, REFLECTION_TO_CASE_SYSTEM_PROMPT, casePrompt)
        const caseAction = content ? parseReflectionToCase(content, best.reflectionId) : null
        if (caseAction) actions.push(caseAction)
      }
    }
  }

  return NextResponse.json({ actions })
}
