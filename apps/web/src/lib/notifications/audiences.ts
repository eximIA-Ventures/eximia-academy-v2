// ---------------------------------------------------------------------------
// Engagement Engine — Audiences (BACKEND-3)
// ---------------------------------------------------------------------------
// Resolves a NotificationAudienceCriteria jsonb into a concrete set of student
// ids (users.id, role=student) within ONE tenant, plus a lightweight CRUD over
// the `notification_audiences` table so manual campaigns can save/reuse a target.
//
// Supported criteria keys (NotificationAudienceCriteria):
//   • risk             — reuses the SAME roster risk logic as the analytics page /
//                        next-best-action (never_accessed | inactive | no_reflection |
//                        top_performer). type → student set, computed from
//                        sessions + slide_reflections, exactly mirroring the UI.
//   • unit_id          — areas.id (UNIDADE): students whose user_areas links it.
//   • manager_group_id — manager_groups.id (ÁREA/GESTOR): manager_group_members.
//   • course_id        — students with an enrollment in that course.
// Multiple keys are ANDed (intersection) — e.g. "inactive students in unit X".
//
// SECURITY (lição da sessão, enforced by the CALLER + reasserted here):
//   • Every function takes an explicit tenantId and scopes EVERY query with
//     .eq("tenant_id", …). The tenant is NEVER read from the client — the caller
//     (route / server action) resolves it from the session and passes it in.
//   • resolveAudience uses the service client (RLS-bypassing) so it can read all
//     students' sessions/reflections; the .eq("tenant_id") filters are the only
//     thing keeping it scoped, so they are applied on every table touched.
//   • The CRUD helpers also take tenantId + createdBy explicitly and stamp them
//     on insert; reads/deletes are tenant-scoped. The caller is responsible for
//     auth + role gating (admin/manager) before calling these.
//   • No criteria value is interpolated into SQL — all filters go through the
//     parameterised PostgREST builder. unit_id/manager_group_id/course_id are
//     validated as UUIDs before use; an invalid value yields an empty set.
//
// This module is the SINGLE source of truth for turning a saved audience (or an
// ad-hoc criteria object) into recipients, so the approve-nudge / manual-send
// path and the campaign UI stay consistent.
// ---------------------------------------------------------------------------

import { resolveCallerStudentScope } from "@/lib/area-context"
import { createServiceClient } from "@/lib/supabase/service"
import type {
  NotificationAudience,
  NotificationAudienceCriteria,
  NotificationAudienceRow,
  NudgeType,
} from "@/types/notifications"
import type { SupabaseClient } from "@supabase/supabase-js"

// Loose service-client shape (matches createServiceClient) so we can query the
// untyped engagement/learning tables without fighting the generated generics.
// biome-ignore lint/suspicious/noExplicitAny: matches createServiceClient's loose typing
type ServiceClient = SupabaseClient<any, "public", any>

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Risk thresholds — kept IDENTICAL to the roster build in
// app/(platform)/analytics/page.tsx and the operational nudges in
// components/analytics/next-best-action.tsx. Do not diverge.
const INACTIVE_DAYS = 14 // daysSinceLastActivity > 14 → inactive
const NO_REFLECTION_MIN_SESSIONS = 2 // completedSessions >= 2 && reflections === 0
const TOP_PERFORMER_MIN_SESSIONS = 3 // completedSessions >= 3 && reflections >= 2
const TOP_PERFORMER_MIN_REFLECTIONS = 2
const DAY_MS = 86_400_000

/** PostgREST caps a single request at ~1000 rows; page large reads (FORM-08). */
const PAGE_SIZE = 1000

async function fetchAllRows<T>(
  // biome-ignore lint/suspicious/noExplicitAny: PostgREST builder is loosely typed
  buildPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
): Promise<T[]> {
  const all: T[] = []
  let from = 0
  // Hard cap of 50 pages (50k rows) as a FinOps guardrail against runaway loops.
  for (let page = 0; page < 50; page++) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await buildPage(from, to)
    if (error || !data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return all
}

// ---------------------------------------------------------------------------
// Risk roster — student ids for a given NudgeType, tenant-scoped.
// ---------------------------------------------------------------------------

interface RosterAgg {
  studentId: string
  hasAnySession: boolean
  completedSessions: number
  reflectionsCount: number
  /** Floor((now - latestSession) / day); null when the student has no session. */
  daysSinceLastActivity: number | null
}

/**
 * Builds the per-student aggregates the risk classifier needs, for every
 * role=student user in the tenant. Mirrors analytics/page.tsx's roster build:
 *   • sessions(student_id, status, created_at)   → completed count + recency
 *   • slide_reflections(student_id)              → reflections count
 * A student with no sessions is "never accessed" (hasAnySession=false).
 */
async function buildRosterAggregates(db: ServiceClient, tenantId: string): Promise<RosterAgg[]> {
  const students = await fetchAllRows<{ id: string }>((from, to) =>
    db.from("users").select("id").eq("tenant_id", tenantId).eq("role", "student").range(from, to),
  )
  if (students.length === 0) return []

  const sessions = await fetchAllRows<{
    student_id: string
    status: string | null
    created_at: string
  }>((from, to) =>
    db
      .from("sessions")
      .select("student_id, status, created_at")
      .eq("tenant_id", tenantId)
      .range(from, to),
  )
  const reflections = await fetchAllRows<{ student_id: string }>((from, to) =>
    db.from("slide_reflections").select("student_id").eq("tenant_id", tenantId).range(from, to),
  )

  const completedByStudent = new Map<string, number>()
  const latestByStudent = new Map<string, number>()
  const anySessionByStudent = new Set<string>()
  for (const s of sessions) {
    anySessionByStudent.add(s.student_id)
    if (s.status === "completed")
      completedByStudent.set(s.student_id, (completedByStudent.get(s.student_id) ?? 0) + 1)
    const t = new Date(s.created_at).getTime()
    if (!Number.isNaN(t)) {
      const prev = latestByStudent.get(s.student_id)
      if (prev === undefined || t > prev) latestByStudent.set(s.student_id, t)
    }
  }

  const reflectionsByStudent = new Map<string, number>()
  for (const r of reflections)
    reflectionsByStudent.set(r.student_id, (reflectionsByStudent.get(r.student_id) ?? 0) + 1)

  const now = Date.now()
  return students.map((stu) => {
    const latest = latestByStudent.get(stu.id)
    return {
      studentId: stu.id,
      hasAnySession: anySessionByStudent.has(stu.id),
      completedSessions: completedByStudent.get(stu.id) ?? 0,
      reflectionsCount: reflectionsByStudent.get(stu.id) ?? 0,
      daysSinceLastActivity: latest === undefined ? null : Math.floor((now - latest) / DAY_MS),
    }
  })
}

/**
 * Classifies a single student aggregate against a NudgeType. Pure predicate —
 * the EXACT same conditions used by the analytics roster + operational nudges:
 *   • never_accessed → no sessions at all
 *   • inactive       → has sessions but last activity > 14d ago
 *   • no_reflection  → completedSessions >= 2 && reflectionsCount === 0
 *   • top_performer  → completedSessions >= 3 && reflectionsCount >= 2
 * The non-risk types (announcement/custom) never match a risk roster.
 */
function matchesRisk(agg: RosterAgg, type: NudgeType): boolean {
  switch (type) {
    case "never_accessed":
      return !agg.hasAnySession
    case "inactive":
      return (
        agg.hasAnySession &&
        agg.daysSinceLastActivity !== null &&
        agg.daysSinceLastActivity > INACTIVE_DAYS
      )
    case "no_reflection":
      return agg.completedSessions >= NO_REFLECTION_MIN_SESSIONS && agg.reflectionsCount === 0
    case "top_performer":
      return (
        agg.completedSessions >= TOP_PERFORMER_MIN_SESSIONS &&
        agg.reflectionsCount >= TOP_PERFORMER_MIN_REFLECTIONS
      )
    default:
      return false
  }
}

/**
 * Resolves the student ids matching a roster risk type for the tenant. Exposed
 * so the suggestion generator (BACKEND-1) can reuse the SAME classification
 * instead of re-deriving it. Returns role=student users only.
 */
export async function resolveRiskStudentIds(
  db: ServiceClient,
  tenantId: string,
  type: NudgeType,
): Promise<string[]> {
  // announcement/custom are not risk rosters — nothing to compute.
  if (type === "announcement" || type === "custom") return []
  const aggregates = await buildRosterAggregates(db, tenantId)
  return aggregates.filter((a) => matchesRisk(a, type)).map((a) => a.studentId)
}

// ---------------------------------------------------------------------------
// Per-criterion resolvers (each returns role=student users in the tenant).
// ---------------------------------------------------------------------------

/** Students linked to a UNIDADE (areas.id) via user_areas, restricted to role=student. */
async function resolveUnitStudentIds(
  db: ServiceClient,
  tenantId: string,
  unitId: string,
): Promise<string[]> {
  const links = await fetchAllRows<{ user_id: string }>((from, to) =>
    db.from("user_areas").select("user_id").eq("area_id", unitId).range(from, to),
  )
  const candidateIds = [...new Set(links.map((r) => r.user_id))]
  if (candidateIds.length === 0) return []
  // user_areas links instructors/admins too — restrict to role=student so the
  // audience matches the "students" population (mirrors aggregate route UI-05).
  const studentRows = await fetchAllRows<{ id: string }>((from, to) =>
    db
      .from("users")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("role", "student")
      .in("id", candidateIds)
      .range(from, to),
  )
  return [...new Set(studentRows.map((r) => r.id))]
}

/** Students in a manager_group (ÁREA/GESTOR) via manager_group_members, tenant-scoped. */
async function resolveManagerGroupStudentIds(
  db: ServiceClient,
  tenantId: string,
  groupId: string,
): Promise<string[]> {
  const members = await fetchAllRows<{ student_id: string }>((from, to) =>
    db
      .from("manager_group_members")
      .select("student_id")
      .eq("tenant_id", tenantId)
      .eq("group_id", groupId)
      .range(from, to),
  )
  return [...new Set(members.map((r) => r.student_id))]
}

/** Students enrolled in a course (enrollments), restricted to role=student. */
async function resolveCourseStudentIds(
  db: ServiceClient,
  tenantId: string,
  courseId: string,
): Promise<string[]> {
  const rows = await fetchAllRows<{ student_id: string }>((from, to) =>
    db
      .from("enrollments")
      .select("student_id")
      .eq("tenant_id", tenantId)
      .eq("course_id", courseId)
      .range(from, to),
  )
  const candidateIds = [...new Set(rows.map((r) => r.student_id))]
  if (candidateIds.length === 0) return []
  // Defense: only keep tenant role=student rows (enrollments could, in theory,
  // reference a non-student or another tenant if data were ever inconsistent).
  const studentRows = await fetchAllRows<{ id: string }>((from, to) =>
    db
      .from("users")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("role", "student")
      .in("id", candidateIds)
      .range(from, to),
  )
  return [...new Set(studentRows.map((r) => r.id))]
}

// ---------------------------------------------------------------------------
// resolveAudience — criteria → student ids (intersection of supplied keys).
// ---------------------------------------------------------------------------

/**
 * Resolves a NotificationAudienceCriteria into the set of student ids (users.id,
 * role=student) it targets in `tenantId`. Each supplied key narrows the set
 * (logical AND / intersection); an empty criteria object yields an empty set
 * (a campaign must specify at least one targeting key — we never default to
 * "everyone" implicitly).
 *
 * TENANT SAFETY: tenantId is supplied by the caller (resolved from the session),
 * NEVER from the criteria/client. Every underlying query is tenant-scoped.
 * Invalid UUIDs in unit_id/manager_group_id/course_id collapse that key to an
 * empty set (and therefore the whole intersection to empty), failing closed.
 *
 * @param criteria  The saved/ad-hoc targeting predicate.
 * @param tenantId  The tenant to scope to (caller-resolved, server-trusted).
 * @param dbOverride Optional service client (tests); defaults to createServiceClient().
 * @returns De-duplicated student id array. Order is not guaranteed.
 */
export async function resolveAudience(
  criteria: NotificationAudienceCriteria,
  tenantId: string,
  dbOverride?: ServiceClient,
): Promise<string[]> {
  if (!tenantId || !UUID_RE.test(tenantId)) return []
  const db = dbOverride ?? (createServiceClient() as ServiceClient)

  // Collect one id-set per supplied key. A key present but invalid → empty set.
  const sets: string[][] = []

  if (criteria.risk) {
    sets.push(await resolveRiskStudentIds(db, tenantId, criteria.risk))
  }
  if (criteria.unit_id !== undefined) {
    sets.push(
      UUID_RE.test(criteria.unit_id)
        ? await resolveUnitStudentIds(db, tenantId, criteria.unit_id)
        : [],
    )
  }
  if (criteria.manager_group_id !== undefined) {
    sets.push(
      UUID_RE.test(criteria.manager_group_id)
        ? await resolveManagerGroupStudentIds(db, tenantId, criteria.manager_group_id)
        : [],
    )
  }
  if (criteria.course_id !== undefined) {
    sets.push(
      UUID_RE.test(criteria.course_id)
        ? await resolveCourseStudentIds(db, tenantId, criteria.course_id)
        : [],
    )
  }

  // No targeting key supplied → empty (never implicitly target everyone).
  if (sets.length === 0) return []
  // Single key → that set, de-duplicated.
  if (sets.length === 1) return [...new Set(sets[0])]

  // Multiple keys → intersection. Start from the smallest set for efficiency.
  sets.sort((a, b) => a.length - b.length)
  const [smallest, ...rest] = sets
  const others = rest.map((s) => new Set(s))
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of smallest) {
    if (seen.has(id)) continue
    if (others.every((set) => set.has(id))) {
      seen.add(id)
      out.push(id)
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// resolveAudienceScoped — caller-scoped audience resolution (E3, non-leakage).
// ---------------------------------------------------------------------------

/**
 * SCOPED audience resolution — the single trava that guarantees a campaign/
 * suggestion audience NEVER contains a student outside the caller's reach.
 *
 * It COMPOSES the two existing primitives (no new scoping rule):
 *   1. `resolveCallerStudentScope(authClient, tenantId, userId, roles)` →
 *      `null` (admin/super_admin, tenant-wide) | `[]` (fail-closed) | [ids].
 *   2. `resolveAudience(criteria, tenantId)` → the criteria's target set.
 * The result is the INTERSECTION: when the caller scope is non-null, only ids in
 * BOTH the criteria set AND the caller scope survive. When the caller scope is
 * `null` (admin), the criteria set passes through unchanged (tenant-wide).
 *
 * CLIENT CONTRACT: `authClient` MUST be the caller's AUTHENTICATED RLS client —
 * `resolveCallerStudentScope`'s manager branch reads `auth.uid()`. `resolveAudience`
 * uses its own service client internally (it only needs tenant scoping), passed
 * via `dbOverride` for tests.
 *
 * @returns the final, scoped student id array. Never contains a student the
 *   caller could not otherwise reach, even if `criteria` asked for something wider.
 */
export async function resolveAudienceScoped(
  // biome-ignore lint/suspicious/noExplicitAny: authenticated RLS client, matches resolveCallerStudentScope
  authClient: SupabaseClient<any, "public", any>,
  tenantId: string,
  userId: string,
  roles: string[],
  criteria: NotificationAudienceCriteria,
  serviceDbOverride?: ServiceClient,
): Promise<string[]> {
  if (!tenantId || !UUID_RE.test(tenantId)) return []

  const callerScope = await resolveCallerStudentScope(authClient, tenantId, userId, roles)
  const audience = await resolveAudience(criteria, tenantId, serviceDbOverride)

  // Admin/super_admin (null scope) → no caller restriction, criteria as-is.
  if (callerScope === null) return [...new Set(audience)]

  // Scoped caller → intersect. Empty caller scope ([]) yields empty (fail-closed).
  const allowed = new Set(callerScope)
  return [...new Set(audience.filter((id) => allowed.has(id)))]
}

// ---------------------------------------------------------------------------
// Lightweight CRUD over notification_audiences (saved targeting for campaigns).
// ---------------------------------------------------------------------------
// The caller (admin/manager route or server action) MUST have validated auth +
// role + tenant before calling these. tenantId / createdBy are always passed
// explicitly and stamped server-side — never trusted from the client payload.
// ---------------------------------------------------------------------------

function rowToAudience(row: NotificationAudienceRow): NotificationAudience {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    criteria: row.criteria ?? {},
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Lists saved audiences for a tenant, newest first. Tenant-scoped. */
export async function listAudiences(
  tenantId: string,
  dbOverride?: ServiceClient,
): Promise<NotificationAudience[]> {
  if (!tenantId || !UUID_RE.test(tenantId)) return []
  const db = dbOverride ?? (createServiceClient() as ServiceClient)
  const { data, error } = await db
    .from("notification_audiences")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
  if (error || !data) return []
  return (data as NotificationAudienceRow[]).map(rowToAudience)
}

/**
 * Creates a saved audience. tenantId + createdBy are stamped server-side from
 * caller-trusted values, NOT from the criteria/client. Returns the created row
 * (domain shape) or null on failure.
 */
export async function createAudience(
  params: {
    tenantId: string
    name: string
    criteria: NotificationAudienceCriteria
    createdBy: string | null
  },
  dbOverride?: ServiceClient,
): Promise<NotificationAudience | null> {
  const { tenantId, name, criteria, createdBy } = params
  if (!tenantId || !UUID_RE.test(tenantId)) return null
  const trimmedName = name?.trim()
  if (!trimmedName) return null
  const db = dbOverride ?? (createServiceClient() as ServiceClient)
  const { data, error } = await db
    .from("notification_audiences")
    .insert({
      tenant_id: tenantId,
      name: trimmedName,
      criteria: criteria ?? {},
      created_by: createdBy,
    })
    .select("*")
    .single()
  if (error || !data) return null
  return rowToAudience(data as NotificationAudienceRow)
}

/**
 * Deletes a saved audience by id, scoped to the tenant (so a caller cannot
 * delete another tenant's audience even if it guesses the id). Returns true
 * when a row was deleted.
 */
export async function deleteAudience(
  audienceId: string,
  tenantId: string,
  dbOverride?: ServiceClient,
): Promise<boolean> {
  if (!UUID_RE.test(audienceId) || !tenantId || !UUID_RE.test(tenantId)) return false
  const db = dbOverride ?? (createServiceClient() as ServiceClient)
  const { data, error } = await db
    .from("notification_audiences")
    .delete()
    .eq("id", audienceId)
    .eq("tenant_id", tenantId)
    .select("id")
  if (error) return false
  return Array.isArray(data) && data.length > 0
}
