// GET /api/engagement/students?ids=<uuid,uuid,...>&action=<remind|activate|recognize>
// GET /api/engagement/students[?q=<name-fragment>][&limit=N]  ← LIST/SEARCH mode (manual picker)
// Engagement Center v2 (E6) — the SCOPED per-student projection the Individual
// Action Sheet (E6) and the "Ver alunos" list (E5) need: name, status, last
// access, progress, engagement, and the SERVER-DERIVED nudgeType/template.
//
// Why a dedicated route (not the heavy /api/analytics/students/[id]): the Sheet
// needs a LIGHT projection for possibly several ids at once (E5 "Ver alunos"),
// and it needs the ritmo-derived nudgeType (E6 AC10) computed server-side. This
// route reuses resolveEngagementScope so a student OUTSIDE the caller's recorte
// can NEVER be returned — the same non-leakage guarantee as every other
// /api/engagement/* route (E3 pattern: AUTH → RE-SCOPE → QUERY).
//
// LIST/SEARCH mode (Central de Envios manual flow, decisão Hugo 2026-07-09,
// AJUSTE 2026-07-09 dado real Cory): when `ids` is ABSENT, the route lists the
// students of the CURRENT recorte, ordered by name, capped. This is now the
// DEFAULT the picker loads on open — a full, scrollable roster of the manager's
// recorte, NOT a search-only surface. The optional `q` param FILTERS that list
// by full_name (ilike) WITHIN the recorte; absent/empty `q` returns the whole
// recorte up to the LIST cap. It reuses the EXACT same AUTH → RE-SCOPE → QUERY
// spine: the query runs over `users` narrowed by `.in("id", allowedStudentIds)`
// (or by tenant for an admin's null scope) so a student outside the caller's
// recorte is structurally unreachable. `q` never widens reach — it only filters
// within it. WHY the change: the Cory tenant's real manager (Rinaldo) reaches 39
// students; forcing a 2-letter search hid the entire roster behind a blank box,
// and a manager searching a NON-student (e.g. "Caio", who is himself a manager)
// saw nothing with no way to browse who IS in scope.
//
// AC10: for remind/activate, nudgeType is derived from the REAL ritmo
// (computeStudentRitmo), NEVER from computeStudentAction (which only sees
// triagem). student-triage.ts is consumed, never modified.
//
// RECOGNIZE (gap D3, "Parabenizar"): the action verb `recognize` is a POSITIVE
// gesture, not a risk-driven cobrança — the student is on track/standout. Its
// nudgeType is FORCED to `top_performer` (already in the NudgeType enum + already
// accepted by POST /api/engagement/action; NO new enum value invented), so the
// preview pre-fills the reconhecimento template regardless of the derived ritmo.

import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { readFocusParam, resolveEngagementScope } from "@/lib/notifications/engagement-scope"
import { NUDGE_TYPE_TEMPLATE_KEY } from "@/lib/notifications/engine"
import { hasAnyRole } from "@/lib/role-helpers"
import { type StudentPace, computeStudentRitmo } from "@/lib/student-triage"
import { createServiceClient } from "@/lib/supabase/service"
import type { NudgeType } from "@/types/notifications"
import { NextResponse } from "next/server"
import { deriveNudgeTypeFromRitmo } from "../../../(platform)/engagement/_components/derive-nudge-type"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_IDS = 200
// LIST/SEARCH mode caps (manual picker). The picker now loads the whole recorte
// by default, so the cap must comfortably fit a real team roster (the Cory
// tenant's top manager reaches ~40 students) while still bounding an admin's
// tenant-wide list to a sane teto. This is a browsable picker, not a full CSV
// export, so 100 is the teto and the client may raise it via ?limit up to 200.
const SEARCH_MAX_LIMIT = 200
const SEARCH_DEFAULT_LIMIT = 100

/** Light per-student row for the manual picker (no ritmo/nudge derivation). */
interface EngagementStudentOption {
  id: string
  fullName: string | null
}

/**
 * PostgREST ilike escaping: `%` and `_` are wildcards in a LIKE pattern, and a
 * comma would break the `.or()`/filter grammar. We never interpolate `q` into a
 * filter string (we pass it to `.ilike("full_name", pattern)`), but we still
 * neutralise the wildcards so a user typing "%" searches for a literal "%".
 */
function ilikePattern(q: string): string {
  const escaped = q.replace(/[\\%_]/g, (m) => `\\${m}`)
  return `%${escaped}%`
}

interface EngagementStudentDetail {
  id: string
  fullName: string | null
  totalSessions: number
  completedSessions: number
  reflectionsCount: number
  /** Whole days since the last session; null if the student never accessed. */
  daysSinceLastActivity: number | null
  /** Highest enrollment progress %, 0..100. */
  progressPct: number
  behindSchedule: boolean
  ritmo: "no_ritmo" | "atrasado" | "nao_iniciado"
  /** Human triage status for the Sheet's "Status atual". */
  status: "no_ritmo" | "atencao" | "sem_acesso"
  /** SERVER-derived nudgeType (AC10). */
  nudgeType: NudgeType
  /** Template key that pre-fills the preview, from NUDGE_TYPE_TEMPLATE_KEY. */
  templateKey: string | null
}

interface EnrollmentRow {
  student_id: string
  status: string | null
  created_at: string
  progress: { percentage?: number | string | null } | null
  course_id: string
}

/**
 * Same `behind` formula as engine.computeBehindStudentIds and the RPC
 * auth_team_engagement_signals.behind CTE (single source of truth — not a new
 * definition): active enrollment + deadline_days>0 + progress% < expectedPct.
 * Also returns the max progress % per student (for the Sheet's Progresso field).
 */
function computeBehindAndProgress(
  enrollments: EnrollmentRow[],
  deadlineByCourse: Map<string, number | null>,
  now: number,
): { behind: Set<string>; progressByStudent: Map<string, number> } {
  const behind = new Set<string>()
  const progressByStudent = new Map<string, number>()
  for (const e of enrollments) {
    const rawPct = e.progress?.percentage
    const progressPct = typeof rawPct === "string" ? Number(rawPct) : (rawPct ?? 0)
    const pct = Number.isFinite(progressPct) ? (progressPct as number) : 0
    const prev = progressByStudent.get(e.student_id) ?? 0
    if (pct > prev) progressByStudent.set(e.student_id, pct)

    if (e.status !== "active") continue
    const deadlineDays = deadlineByCourse.get(e.course_id) ?? null
    if (deadlineDays === null || deadlineDays <= 0) continue
    const createdMs = new Date(e.created_at).getTime()
    if (Number.isNaN(createdMs)) continue
    const elapsedDays = Math.max(0, (now - createdMs) / 86_400_000)
    const expectedPct = Math.min(100, Math.round((elapsedDays / deadlineDays) * 100))
    if (pct < expectedPct) behind.add(e.student_id)
  }
  return { behind, progressByStudent }
}

export async function GET(request: Request) {
  // 1. AUTH — staff only.
  const { user, profile, roles, supabase } = await getAuthProfile()
  if (!user || !profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!hasAnyRole({ roles }, ["admin", "manager", "instructor", "super_admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
  }

  const url = new URL(request.url)

  // 2a. LIST/SEARCH mode — `ids` ABSENT (manual picker). Lists the students of
  //     the current recorte, ordered by name, capped. The optional `q` param
  //     FILTERS that list by full_name (ilike) WITHIN the recorte; absent/empty
  //     `q` returns the whole recorte up to the cap (the default the picker
  //     loads on open). Reuses the SAME re-scope spine, so results are always
  //     within the caller's reach. `q` never widens reach — only filters it.
  if (!url.searchParams.has("ids")) {
    const qParam = (url.searchParams.get("q") ?? "").trim()
    const allowedStudentIds = await resolveEngagementScope(
      supabase,
      tenantId,
      user.id,
      roles,
      readFocusParam(request),
    )
    // Fail-closed: a scoped caller with no reachable students returns nothing.
    if (allowedStudentIds !== null && allowedStudentIds.length === 0) {
      return NextResponse.json({ students: [] })
    }
    const limitParam = Number(url.searchParams.get("limit"))
    const limit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(Math.floor(limitParam), SEARCH_MAX_LIMIT)
        : SEARCH_DEFAULT_LIMIT

    const svc = createServiceClient()
    let query = svc
      .from("users")
      .select("id, full_name")
      .eq("tenant_id", tenantId)
      .eq("role", "student")
    // Only apply the name filter when the manager is actually searching. An
    // empty box lists the whole recorte (the browse-the-roster default).
    if (qParam.length > 0) {
      query = query.ilike("full_name", ilikePattern(qParam))
    }
    // null scope = tenant-wide (admin); otherwise bound to the exact recorte.
    if (allowedStudentIds !== null) {
      query = query.in("id", allowedStudentIds)
    }
    const { data, error } = await query.order("full_name", { ascending: true }).limit(limit)
    if (error) {
      console.error("[engagement/students] list/search error:", error)
      return NextResponse.json({ error: "Search failed" }, { status: 500 })
    }
    const options: EngagementStudentOption[] = (
      (data ?? []) as { id: string; full_name: string | null }[]
    ).map((s) => ({ id: s.id, fullName: s.full_name }))
    return NextResponse.json({ students: options })
  }

  // 2b. VALIDATE — the requested ids.
  // `recognize` (Parabenizar) forces top_performer; remind/activate derive from ritmo.
  const isRecognize = url.searchParams.get("action") === "recognize"
  const idsParam = url.searchParams.get("ids") ?? ""
  const requestedIds = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  if (requestedIds.length === 0) {
    return NextResponse.json({ students: [] })
  }
  if (requestedIds.length > MAX_IDS) {
    return NextResponse.json({ error: `At most ${MAX_IDS} ids` }, { status: 400 })
  }
  if (!requestedIds.every((id) => UUID_RE.test(id))) {
    return NextResponse.json({ error: "Every id must be a UUID" }, { status: 400 })
  }

  // 3. RE-SCOPE — narrow the requested ids to the caller's recorte. A student
  //    outside the scope is silently dropped, never returned. Rodada 3: the
  //    drill-down `?focus=` gates the picker/detail to the SAME node as the page.
  const allowedStudentIds = await resolveEngagementScope(
    supabase,
    tenantId,
    user.id,
    roles,
    readFocusParam(request),
  )
  const scopedIds =
    allowedStudentIds === null
      ? requestedIds
      : requestedIds.filter((id) => new Set(allowedStudentIds).has(id))
  if (scopedIds.length === 0) {
    return NextResponse.json({ students: [] })
  }

  // 4. QUERY — light per-student projection for the scoped set.
  const svc = createServiceClient()
  const now = Date.now()
  const [studentsRes, sessionsRes, reflectionsRes, enrollmentsRes] = await Promise.all([
    svc
      .from("users")
      .select("id, full_name")
      .eq("tenant_id", tenantId)
      .eq("role", "student")
      .in("id", scopedIds),
    svc
      .from("sessions")
      .select("student_id, status, created_at")
      .eq("tenant_id", tenantId)
      .in("student_id", scopedIds),
    svc
      .from("slide_reflections")
      .select("student_id")
      .eq("tenant_id", tenantId)
      .in("student_id", scopedIds),
    svc
      .from("enrollments")
      .select("student_id, status, created_at, progress, course_id")
      .eq("tenant_id", tenantId)
      .in("student_id", scopedIds),
  ])

  const students = (studentsRes.data ?? []) as { id: string; full_name: string | null }[]
  const sessions = (sessionsRes.data ?? []) as {
    student_id: string
    status: string | null
    created_at: string
  }[]
  const reflections = (reflectionsRes.data ?? []) as { student_id: string }[]
  const enrollments = (enrollmentsRes.data ?? []) as EnrollmentRow[]

  // Deadlines for the courses in this scoped enrollment set only.
  const courseIds = [...new Set(enrollments.map((e) => e.course_id))]
  const coursesRes =
    courseIds.length > 0
      ? await svc
          .from("courses")
          .select("id, deadline_days")
          .eq("tenant_id", tenantId)
          .in("id", courseIds)
      : { data: [] as { id: string; deadline_days: number | null }[] }
  const deadlineByCourse = new Map<string, number | null>()
  for (const c of (coursesRes.data ?? []) as { id: string; deadline_days: number | null }[]) {
    deadlineByCourse.set(c.id, c.deadline_days)
  }

  const sessionsByStudent = new Map<string, { status: string | null; created_at: string }[]>()
  for (const s of sessions) {
    const list = sessionsByStudent.get(s.student_id) ?? []
    list.push(s)
    sessionsByStudent.set(s.student_id, list)
  }
  const reflectionCountByStudent = new Map<string, number>()
  for (const r of reflections) {
    reflectionCountByStudent.set(
      r.student_id,
      (reflectionCountByStudent.get(r.student_id) ?? 0) + 1,
    )
  }
  const { behind, progressByStudent } = computeBehindAndProgress(enrollments, deadlineByCourse, now)

  // A pace map ("behind"/"on_track") is the ONLY input computeStudentRitmo needs
  // beyond the roster row — we feed it the same `behind` set the engine derives.
  const paceByStudent = new Map<string, StudentPace>()
  for (const id of behind) paceByStudent.set(id, "behind")

  const details: EngagementStudentDetail[] = students.map((stu) => {
    const mySessions = sessionsByStudent.get(stu.id) ?? []
    const completedSessions = mySessions.filter((s) => s.status === "completed").length
    let daysSinceLastActivity: number | null = null
    if (mySessions.length > 0) {
      const latest = Math.max(...mySessions.map((s) => new Date(s.created_at).getTime()))
      daysSinceLastActivity = Math.floor((now - latest) / 86_400_000)
    }
    const progressPct = Math.round(progressByStudent.get(stu.id) ?? 0)
    const lastSessionDate =
      mySessions.length > 0
        ? new Date(
            Math.max(...mySessions.map((s) => new Date(s.created_at).getTime())),
          ).toISOString()
        : null

    const ritmo = computeStudentRitmo(
      {
        id: stu.id,
        totalSessions: mySessions.length,
        lastSessionDate,
        courseProgressPct: progressPct,
      },
      paceByStudent,
    )
    // recognize → top_performer (positive); otherwise derive from real ritmo (AC10).
    const nudgeType: NudgeType = isRecognize
      ? "top_performer"
      : deriveNudgeTypeFromRitmo(ritmo, mySessions.length)

    // Human triage status ("Status atual") from the same ritmo — mirrors
    // computeStudentTriagem's mapping without importing it (kept light here).
    const status: "no_ritmo" | "atencao" | "sem_acesso" =
      ritmo === "atrasado" || ritmo === "nao_iniciado"
        ? "atencao"
        : daysSinceLastActivity !== null && daysSinceLastActivity > 14
          ? "sem_acesso"
          : "no_ritmo"

    return {
      id: stu.id,
      fullName: stu.full_name,
      totalSessions: mySessions.length,
      completedSessions,
      reflectionsCount: reflectionCountByStudent.get(stu.id) ?? 0,
      daysSinceLastActivity,
      progressPct,
      behindSchedule: behind.has(stu.id),
      ritmo,
      status,
      nudgeType,
      templateKey: NUDGE_TYPE_TEMPLATE_KEY[nudgeType],
    }
  })

  return NextResponse.json({ students: details })
}
