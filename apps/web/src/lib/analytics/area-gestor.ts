// ---------------------------------------------------------------------------
// ÁREA / GESTOR aggregation engine — FASE 1b (Engenheiro de Agregação)
// ---------------------------------------------------------------------------
// Item 8   — aggregate indicators per ÁREA/GESTOR (students linked to the
//            gestor's team), with an INCLUDE/EXCLUDE "corporativo" flag.
// Item 8.1 — comparison "Time do Gestor × Unidade" (output structurally
//            compatible with the existing UNIDADE comparison contract).
// Support 1.2 — produce areaStats / unitStats mirroring `UnitStats` for the
//            FASE 2 comparison UI (unit-comparison.tsx three modes).
//
// CRITICAL TERMINOLOGY (do NOT confuse — see migration 20260530130000):
//   • UNIDADE       = the existing `areas` table (Minas Gerais, Ribeirão Preto).
//                     student→unidade link lives in `user_areas`. Stats: UnitStats.
//   • ÁREA / GESTOR = a manager-owned TEAM of students (`manager_groups`),
//                     possibly CORPORATIVO (is_corporate => spans >1 UNIDADE).
//                     student→team link lives in `manager_group_members`.
//                     Stats: AreaStats (per team) + ManagerStats (per gestor).
//
// DEPENDS ON migration 20260530130000_area_gestor.sql (NOT yet applied to the
// DB). Therefore this module is queried through a LOOSELY-typed service client
// (SupabaseClient<any,"public",any>), so referencing the not-yet-generated
// tables (manager_groups / manager_group_units / manager_group_members) does
// NOT break the build. Every reader is defensive: a missing table / RLS denial
// surfaces as `error` + empty data, which we treat as "no groups" rather than
// throwing — so this is safe to ship before the migration runs.
//
// The metric SHAPE (totalStudents / activeStudents / completedSessions /
// totalSessions / reflectionCount / avgSessionsPerStudent / completionPct)
// mirrors the UNIDADE computation in app/(platform)/analytics/page.tsx
// field-for-field, so UNIDADE and ÁREA/GESTOR are directly comparable.

import { getOrgReference } from "@/lib/analytics/org-reference-cache"
import {
  buildStudentHomeIndicators,
  computeEngagementMax,
  countReflectionPossibleSlides,
  trailChapterIdsOf,
} from "@/lib/analytics/student-home-indicators"
import type { EnrollmentRow } from "@/lib/notifications/engagement-triage"
import {
  type AnalyticsRole,
  type AreaStats,
  COMPARISON_MODES_BY_ROLE,
  type ComparableMetricBlock,
  type ComparisonMode,
  type ComparisonResponse,
  type CourseStats,
  type ManagerStats,
  type SessionAnalyticsJsonb,
  type StudentComparison,
  type UnitReferenceStats,
  type UnitStats,
} from "@/types/analytics"
import type { SupabaseClient } from "@supabase/supabase-js"

// Same loose shape as the aggregate route's ServiceClient — lets us query the
// not-yet-generated manager_group* tables without fighting the Database generics.
// biome-ignore lint/suspicious/noExplicitAny: matches createServiceClient's loose typing
export type ServiceClient = SupabaseClient<any, "public", any>

const THIRTY_DAYS_MS = 30 * 86400000

// --- Lightweight row shapes (loose client returns `any`) ---
interface SessionRow {
  student_id: string
  status: string | null
  chapter_id: string | null
  created_at: string
  /**
   * FASE 2 (8.2 PROFUNDIDADE). Session analytics JSONB (Epic 17 detector). Only
   * `depth_reached` is read here, to derive `avgDepth` per metric block. Optional
   * & defensive: a null/empty analytics blob simply doesn't contribute to the
   * depth average (no throw, no zero-pollution — we skip non-positive depths).
   */
  analytics?: SessionAnalyticsJsonb | null
}
interface ReflectionRow {
  student_id: string
  /**
   * Owning slide (slide_reflections.slide_id). Only the "Cursos" view uses this,
   * to route a reflection → slide → chapter → course. The unit/área math ignores
   * it (those views scope reflections by student membership alone).
   */
  slide_id?: string | null
}
interface SlideRow {
  id: string
  chapter_id: string | null
}
interface UserAreaRow {
  user_id: string
  area_id: string
}
/**
 * Raw shape of the tenant-scoped `user_areas` read. `user_areas` has NO
 * `tenant_id` column, so we scope it through an `areas!inner(tenant_id)` join:
 * the inner join drops any user_area whose linked area belongs to another tenant
 * (without `!inner`, PostgREST would merely null the embed and keep the parent
 * row, leaking cross-tenant memberships under the RLS-bypassing service client).
 */
interface UserAreaJoinRow {
  user_id: string
  area_id: string
  areas: { tenant_id: string } | null
}
interface GroupRow {
  id: string
  name: string
  manager_id: string | null
  is_corporate: boolean
}
interface GroupUnitRow {
  group_id: string
  unit_id: string
}
interface GroupMemberRow {
  group_id: string
  student_id: string
}
interface ChapterRow {
  id: string
  course_id: string | null
}
interface CourseRow {
  id: string
  title: string
  status: string | null
}

/**
 * Computes the shared metric block for a SET of students over the supplied
 * session / reflection universe. Identical math to the UNIDADE `unitStats`
 * computation in analytics/page.tsx, factored out so UNIDADE and ÁREA/GESTOR
 * agree by construction.
 *
 * @param studentIds  distinct students in scope
 * @param sessions    ALL tenant sessions (filtered here by membership)
 * @param reflections ALL tenant slide_reflections (filtered here by membership)
 * @param chapterCount number of curriculum chapters (completion denominator)
 * @param now         clock (injected for testability / consistency across rows)
 */
export function computeMetricBlock(
  studentIds: Iterable<string>,
  sessions: SessionRow[],
  reflections: ReflectionRow[],
  chapterCount: number,
  now: number = Date.now(),
): ComparableMetricBlock {
  const students = new Set(studentIds)
  const scopedSessions = sessions.filter((s) => students.has(s.student_id))
  const scopedReflections = reflections.filter((r) => students.has(r.student_id))
  const completed = scopedSessions.filter((s) => s.status === "completed").length
  const thirtyDaysAgo = now - THIRTY_DAYS_MS
  const activeStudents = new Set(
    scopedSessions
      .filter((s) => new Date(s.created_at).getTime() > thirtyDaysAgo)
      .map((s) => s.student_id),
  ).size
  const completionPossible = students.size * chapterCount
  const completionPct =
    completionPossible > 0 ? Math.round((completed / completionPossible) * 100) : 0

  // --- FASE 2 (8.2) PROFUNDIDADE — avgDepth over scoped sessions ---
  // Same derivation the aggregate route uses: average of positive depth_reached
  // values from the analytics JSONB. Sessions with null/empty analytics or a
  // non-positive depth are excluded (they carry no depth signal), so the average
  // is over the sessions that actually measured depth. undefined when none did.
  const depths = scopedSessions.map((s) => s.analytics?.depth_reached ?? 0).filter((d) => d > 0)
  const avgDepth =
    depths.length > 0
      ? Math.round((depths.reduce((a, b) => a + b, 0) / depths.length) * 10) / 10
      : undefined

  // --- FASE 2 (8.2) CONCLUSÃO CONSCIENTE — % students who concluded AND reflected ---
  // A student counts when they BOTH have ≥1 completed session AND ≥1 reflection
  // (concluiu + refletiu). Denominator is the scope's total students. 0–100.
  const completedStudentIds = new Set(
    scopedSessions.filter((s) => s.status === "completed").map((s) => s.student_id),
  )
  const reflectedStudentIds = new Set(scopedReflections.map((r) => r.student_id))
  let consciousCount = 0
  for (const sid of completedStudentIds) {
    if (reflectedStudentIds.has(sid)) consciousCount++
  }
  const consciousCompletionPct =
    students.size > 0 ? Math.round((consciousCount / students.size) * 100) : undefined

  // --- SH-1.1 CONSISTÊNCIA — distinctActiveDays (mean per student) ---
  // A day counts once per student regardless of how many sessions fell on it. We
  // key the calendar day by its UTC date (toISOString().slice(0,10) === "YYYY-MM-DD")
  // ON PURPOSE: the rest of this module already reasons in UTC (PostHog events and
  // the tenant queries are UTC), so a session's active-day never shifts with the
  // server's local timezone — the number is deterministic across machines.
  // AGGREGATION SEMANTICS (AC3): for a block spanning multiple students we report
  // the MEAN distinct-active-days PER STUDENT (parallel to avgSessionsPerStudent),
  // NOT the union of days across the whole scope — a union would only grow with the
  // unit size and stop being a per-student consistency signal. For a single-student
  // block the mean collapses to that student's own distinct-day count.
  const activeDaysByStudent = new Map<string, Set<string>>()
  for (const s of scopedSessions) {
    const utcDay = new Date(s.created_at).toISOString().slice(0, 10)
    let days = activeDaysByStudent.get(s.student_id)
    if (!days) {
      days = new Set<string>()
      activeDaysByStudent.set(s.student_id, days)
    }
    days.add(utcDay)
  }
  let totalActiveDays = 0
  for (const days of activeDaysByStudent.values()) totalActiveDays += days.size
  // Denominator is students.size (scope total, incl. students with 0 sessions who
  // contribute 0 days) so the mean matches avgSessionsPerStudent's denominator.
  const distinctActiveDays =
    students.size > 0 ? Math.round((totalActiveDays / students.size) * 10) / 10 : 0

  return {
    totalStudents: students.size,
    activeStudents,
    completedSessions: completed,
    totalSessions: scopedSessions.length,
    reflectionCount: scopedReflections.length,
    avgSessionsPerStudent:
      students.size > 0 ? Math.round((scopedSessions.length / students.size) * 10) / 10 : 0,
    completionPct,
    avgDepth,
    consciousCompletionPct,
    distinctActiveDays,
  }
}

/**
 * SH-1.1 — linear-interpolation percentile (the "type 7" / Excel PERCENTILE.INC
 * method) over a sorted numeric array. `p` ∈ [0,1]. For p=0.5 this yields the
 * standard median (exact middle for odd n, average of the two middles for even n).
 * Assumes `sorted` is ascending and non-empty (callers guard emptiness).
 */
function percentileSorted(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0]
  const index = (sorted.length - 1) * p
  const lo = Math.floor(index)
  const hi = Math.ceil(index)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (index - lo) * (sorted[hi] - sorted[lo])
}

/**
 * SH-1.1 — SIBLING aggregation to {@link computeMetricBlock} (deliberately OUTSIDE
 * it — the mean logic there is untouched, AC6). Computes the per-student DISTRIBUTION
 * (median/p25/p75) of `completionPct` and `avgDepth` across a UNIDADE population, the
 * outlier-resistant reference the student-home redesign (SH-1.2/SH-1.5) prefers over
 * the simple arithmetic mean. It reuses `computeMetricBlock` PER STUDENT over the
 * ALREADY-LOADED unit rows (no new query): a student's own single-student block gives
 * their `completionPct`/`avgDepth`, and we take quantiles across the population.
 *
 * `completionPct` quantiles are rounded to integers and `avgDepth` to 1 decimal, to
 * carry the same rounding as the metrics they describe. `avgDepth` is `null` when NO
 * student had a depth signal (mirrors computeMetricBlock's `avgDepth === undefined`).
 * Returns `undefined` for an empty population so the caller simply omits the field.
 */
export function computeUnitReferenceStats(
  studentIds: Iterable<string>,
  sessions: SessionRow[],
  reflections: ReflectionRow[],
  chapterCount: number,
  now: number = Date.now(),
): UnitReferenceStats | undefined {
  const ids = [...new Set(studentIds)]
  if (ids.length === 0) return undefined

  const completionValues: number[] = []
  const depthValues: number[] = []
  for (const sid of ids) {
    // Single-student block over the shared unit rows → that student's own metrics.
    // computeMetricBlock's membership filter keeps only `sid`'s sessions/reflections.
    const block = computeMetricBlock([sid], sessions, reflections, chapterCount, now)
    completionValues.push(block.completionPct)
    if (block.avgDepth !== undefined) depthValues.push(block.avgDepth)
  }
  completionValues.sort((a, b) => a - b)
  depthValues.sort((a, b) => a - b)

  const round1 = (n: number) => Math.round(n * 10) / 10
  return {
    completionPct: {
      median: Math.round(percentileSorted(completionValues, 0.5)),
      p25: Math.round(percentileSorted(completionValues, 0.25)),
      p75: Math.round(percentileSorted(completionValues, 0.75)),
    },
    avgDepth:
      depthValues.length > 0
        ? {
            median: round1(percentileSorted(depthValues, 0.5)),
            p25: round1(percentileSorted(depthValues, 0.25)),
            p75: round1(percentileSorted(depthValues, 0.75)),
          }
        : null,
  }
}

/** Options controlling the ÁREA/GESTOR aggregation. */
export interface AreaGestorOptions {
  /** When false, CORPORATIVO groups (is_corporate=true) are EXCLUDED (item 8). */
  includeCorporate?: boolean
  /** Inject a clock for deterministic "active in last 30d" windows. */
  now?: number
  /**
   * Item 8 — CORPORATE UNIT SELECTOR. Narrows the student universe of CORPORATIVO
   * groups to a single UNIDADE (areas.id). `null`/absent = "Todas as unidades do
   * grupo" (the default fan-out across every spanned unidade). When set to a
   * unidade id, a corporate group's fan-out only includes students linked to THAT
   * unidade (via user_areas); non-corporate groups (curated explicit members) are
   * UNAFFECTED — the selector is a scope narrowing of the corporate fan-out, not a
   * separate comparison mode. Applies to aggregateAreaStats / aggregateManagerStats
   * / buildComparison (the gestor's ÁREA views), NOT the tenant-wide UNIDADE list.
   */
  unitFilter?: string | null
  /**
   * E9 (EPIC-30) — SUBTREE switch. When true, the gestor rollup's universe is the
   * manager's whole subtree (UNION ALWAYS, NO CLIFF), resolved via the E3
   * functions through {@link resolveSubtreeStudents}, NOT through the group/CLIFF
   * path in {@link resolveGroupStudents}. The metric math (computeMetricBlock) is
   * unchanged — only the ORIGIN of the student Set differs.
   */
  includeSubtree?: boolean
  /**
   * E9 — DRILL-DOWN node. Only meaningful with `includeSubtree`. `null`/absent =
   * the caller's own subtree (auth_reachable_student_ids). A non-null node is the
   * focus of the drill-down and is gated (node ∈ auth_subtree_user_ids) before
   * `subtree_student_ids(node)`; a forged/out-of-subtree node yields an EMPTY set.
   */
  focusUserId?: string | null
}

/** Bundle of everything needed to aggregate; loaded once, reused per group. */
interface AreaGestorContext {
  groups: GroupRow[]
  unitsByGroup: Map<string, Array<{ id: string; name: string }>>
  /**
   * Explicit members per group, ALREADY DEDUPED by student_id (decision 3).
   * `manager_group_members` has no guaranteed composite uniqueness before the
   * migration runs, so a student could appear twice in the raw rows — we collapse
   * to a Set on ingest so no downstream consumer can double-count.
   */
  membersByGroup: Map<string, Set<string>>
  managerNameById: Map<string, string>
  sessions: SessionRow[]
  reflections: ReflectionRow[]
  userAreas: UserAreaRow[]
  unitNameById: Map<string, string>
  chapterCount: number
  // --- course (curriculum) lookups, used by the "Cursos" comparison ---
  /** tenant courses (id/title/status), for the per-course rollup. */
  courses: CourseRow[]
  /** chapter_id → course_id, to route a session to its course. */
  courseIdByChapter: Map<string, string>
  /** course_id → number of chapters (per-course completion denominator). */
  chapterCountByCourse: Map<string, number>
  /** slide_id → chapter_id, to route a reflection (slide) → chapter → course. */
  chapterIdBySlide: Map<string, string>
  /**
   * Item 8 corporate UNIT SELECTOR. When non-null, the corporate fan-out in
   * `resolveGroupStudents` is restricted to students linked to THIS unidade
   * (areas.id) via user_areas. null = all spanned unidades (default fan-out).
   */
  unitFilter: string | null
}

/** Page size for the range-loop reads. Matches PostgREST's default max rows. */
const PAGE_SIZE = 1000

/**
 * Exhaustively reads a table via `.range()` paging, defeating the silent ~1000-row
 * cap PostgREST applies to an un-ranged `.select()`. `makeQuery` MUST return a
 * FRESH query builder per call (a builder can only be awaited once); we apply
 * `.range(offset, offset + PAGE_SIZE - 1)` and keep paging until a short page
 * (or an error) signals exhaustion. On error we return whatever we have so far
 * (defensive: a missing table / RLS denial degrades to empty, never throws).
 */
async function fetchAllRows<T>(
  // biome-ignore lint/suspicious/noExplicitAny: loose service-client query builder
  makeQuery: () => any,
): Promise<T[]> {
  const all: T[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await makeQuery().range(offset, offset + PAGE_SIZE - 1)
    if (error) break // missing table / RLS denial → degrade to what we have
    const page = (data ?? []) as T[]
    all.push(...page)
    if (page.length < PAGE_SIZE) break // short page → no more rows
  }
  return all
}

/**
 * Loads the raw data needed for ÁREA/GESTOR aggregation. Each read is defensive:
 * if the manager_group* tables don't exist yet (migration not applied) the
 * queries error out and we fall back to empty collections — the caller then
 * simply returns empty areas/managers (UNIDADE stats remain unaffected).
 */
async function loadContext(
  db: ServiceClient,
  tenantId: string,
  opts: AreaGestorOptions,
): Promise<AreaGestorContext> {
  const includeCorporate = opts.includeCorporate ?? true

  // --- ÁREA/GESTOR tables (may not exist before the migration runs) ---
  const { data: groupRows } = await db
    .from("manager_groups")
    .select("id, name, manager_id, is_corporate")
    .eq("tenant_id", tenantId)
  let groups: GroupRow[] = (groupRows ?? []) as GroupRow[]
  if (!includeCorporate) {
    groups = groups.filter((g) => !g.is_corporate)
  }
  const groupIds = groups.map((g) => g.id)

  const unitsByGroup = new Map<string, Array<{ id: string; name: string }>>()
  const membersByGroup = new Map<string, Set<string>>()
  // Guards against duplicate (group_id, unit_id) rows so a UNIDADE is listed once.
  const unitIdsSeenByGroup = new Map<string, Set<string>>()
  for (const g of groups) {
    unitsByGroup.set(g.id, [])
    membersByGroup.set(g.id, new Set<string>())
    unitIdsSeenByGroup.set(g.id, new Set<string>())
  }

  if (groupIds.length > 0) {
    const [{ data: unitRows }, { data: memberRows }] = await Promise.all([
      db
        .from("manager_group_units")
        .select("group_id, unit_id")
        .eq("tenant_id", tenantId)
        .in("group_id", groupIds),
      db
        .from("manager_group_members")
        .select("group_id, student_id")
        .eq("tenant_id", tenantId)
        .in("group_id", groupIds),
    ])
    for (const r of (unitRows ?? []) as GroupUnitRow[]) {
      // De-dupe units per group (a duplicate join row must not inflate unitCount).
      const seen = unitIdsSeenByGroup.get(r.group_id)
      if (!seen || seen.has(r.unit_id)) continue
      seen.add(r.unit_id)
      // name filled in after we resolve unitNameById below
      unitsByGroup.get(r.group_id)?.push({ id: r.unit_id, name: "" })
    }
    // De-dupe members per group by student_id (decision 3): a student listed
    // twice in one group must be counted once. The Set collapses it on ingest.
    for (const r of (memberRows ?? []) as GroupMemberRow[]) {
      membersByGroup.get(r.group_id)?.add(r.student_id)
    }
  }

  // --- Shared tenant data (UNIDADE comparison uses the same universe) ---
  // Every read pages via `fetchAllRows` so none silently truncates at PostgREST's
  // ~1000-row default cap (FORM-03). `user_areas` has no tenant_id column, so it
  // is scoped through an `areas!inner(tenant_id)` join (TYPES-01/AGGR-02): under
  // the RLS-bypassing service client an un-scoped read would leak every tenant.
  const [
    sessionRows,
    reflectionRows,
    userAreaJoinRows,
    areaRows,
    chapterRows,
    managerRows,
    courseRows,
    slideRows,
  ] = await Promise.all([
    // `analytics` JSONB is read for the PROFUNDIDADE dimension (avgDepth); only
    // depth_reached is consumed (see computeMetricBlock). Defensive: a null blob
    // simply doesn't contribute to the depth average.
    fetchAllRows<SessionRow>(() =>
      db
        .from("sessions")
        .select("student_id, status, chapter_id, created_at, analytics")
        .eq("tenant_id", tenantId),
    ),
    // slide_id lets the "Cursos" view route a reflection to its course; the
    // unit/área views ignore it (they scope reflections by student membership).
    fetchAllRows<ReflectionRow>(() =>
      db.from("slide_reflections").select("student_id, slide_id").eq("tenant_id", tenantId),
    ),
    fetchAllRows<UserAreaJoinRow>(() =>
      db
        .from("user_areas")
        .select("user_id, area_id, areas!inner(tenant_id)")
        .eq("areas.tenant_id", tenantId),
    ),
    fetchAllRows<{ id: string; name: string }>(() =>
      db.from("areas").select("id, name").eq("tenant_id", tenantId),
    ),
    // Completion denominator = chapters of non-archived courses (mirrors page.tsx).
    // course_id is also used to route a session (via chapter) to its course.
    fetchAllRows<ChapterRow>(() =>
      db.from("chapters").select("id, course_id").eq("tenant_id", tenantId),
    ),
    fetchAllRows<{ id: string; full_name: string | null }>(() =>
      db
        .from("users")
        .select("id, full_name")
        .eq("tenant_id", tenantId)
        .in("role", ["manager", "admin"]),
    ),
    fetchAllRows<CourseRow>(() =>
      db.from("courses").select("id, title, status").eq("tenant_id", tenantId),
    ),
    // slide → chapter routing for the "Cursos" reflection scoping.
    fetchAllRows<SlideRow>(() =>
      db.from("chapter_slides").select("id, chapter_id").eq("tenant_id", tenantId),
    ),
  ])

  // Flatten the joined user_areas back to the lean { user_id, area_id } shape the
  // rest of the module consumes (the join's `areas` embed only enforced scoping).
  const userAreaRows: UserAreaRow[] = userAreaJoinRows.map((r) => ({
    user_id: r.user_id,
    area_id: r.area_id,
  }))

  const unitNameById = new Map<string, string>()
  for (const a of areaRows) unitNameById.set(a.id, a.name)
  // Backfill unit names now that we have the lookup.
  for (const list of unitsByGroup.values()) {
    for (const u of list) u.name = unitNameById.get(u.id) ?? "—"
  }

  const managerNameById = new Map<string, string>()
  for (const m of managerRows) {
    managerNameById.set(m.id, m.full_name ?? "—")
  }

  // Non-archived course ids — mirrors page.tsx's `.neq("status", "archived")`
  // (AGGR-01/TYPES-03). The completion denominator (chapterCount) must NOT count
  // chapters of archived courses, or it would diverge from the page's universe.
  const activeCourseIds = new Set(
    courseRows.filter((c) => c.status !== "archived").map((c) => c.id),
  )

  // --- course (curriculum) lookups ---
  // chapter→course routing + per-course chapter counts (per-course completion
  // denominator), restricted to NON-ARCHIVED courses so the tenant chapter count
  // (and the per-course count) match the page's archived-excluding universe.
  const courseIdByChapter = new Map<string, string>()
  const chapterCountByCourse = new Map<string, number>()
  let chapterCount = 0
  for (const ch of chapterRows) {
    if (!ch.course_id) continue // orphan chapter — can't route a session to a course
    if (!activeCourseIds.has(ch.course_id)) continue // chapter of an archived course → excluded
    courseIdByChapter.set(ch.id, ch.course_id)
    chapterCountByCourse.set(ch.course_id, (chapterCountByCourse.get(ch.course_id) ?? 0) + 1)
    chapterCount++
  }
  const chapterIdBySlide = new Map<string, string>()
  for (const s of slideRows) {
    if (s.chapter_id) chapterIdBySlide.set(s.id, s.chapter_id)
  }

  return {
    groups,
    unitsByGroup,
    membersByGroup,
    managerNameById,
    sessions: sessionRows,
    reflections: reflectionRows,
    userAreas: userAreaRows,
    unitNameById,
    chapterCount,
    courses: courseRows,
    courseIdByChapter,
    chapterCountByCourse,
    chapterIdBySlide,
    unitFilter: opts.unitFilter ?? null,
  }
}

/**
 * Resolves the student universe of ONE group.
 *   • non-corporate: just its explicit members (manager_group_members).
 *   • corporate (is_corporate): the team explicitly enrolled PLUS — when the
 *     team has no explicit members yet — every student in the spanned UNIDADE(s)
 *     (via user_areas). This makes a corporate gestor's view fan out across
 *     sites even before individual members are curated.
 *
 * AGGR-05 (product decision, by design) — the corporate fan-out fires ONLY while
 * the team has ZERO explicit members. Adding even ONE member flips the universe
 * from "everyone in the spanned UNIDADE(s)" to "just the curated member(s)" — an
 * abrupt cliff, not a blend. Intended: the unit-wide view is a bootstrap default
 * that an admin overrides the moment they start curating members. Logic unchanged.
 */
function resolveGroupStudents(ctx: AreaGestorContext, group: GroupRow): Set<string> {
  // `membersByGroup` is already a deduped Set; clone so callers can't mutate ctx.
  const explicit = ctx.membersByGroup.get(group.id) ?? new Set<string>()
  const students = new Set(explicit)
  if (group.is_corporate && students.size === 0) {
    // Item 8 corporate UNIT SELECTOR: the fan-out spans every unidade of the group
    // by default; when `unitFilter` is set, it narrows to that single unidade —
    // but ONLY if the group actually spans it (an out-of-scope filter is ignored,
    // never silently empties an unrelated group's universe).
    const spannedUnitIds = new Set((ctx.unitsByGroup.get(group.id) ?? []).map((u) => u.id))
    const selected =
      ctx.unitFilter && spannedUnitIds.has(ctx.unitFilter)
        ? new Set([ctx.unitFilter])
        : spannedUnitIds
    if (selected.size > 0) {
      for (const ua of ctx.userAreas) {
        // `.add` to a Set inherently dedupes a student reachable via >1 UNIDADE.
        if (selected.has(ua.area_id)) students.add(ua.user_id)
      }
    }
  }
  return students
}

/**
 * E9 (EPIC-30) — Resolves the student universe of a SUBTREE via the E3 SQL
 * functions, with the membership GATE on drill-down. This is a SEPARATE resolver
 * from {@link resolveGroupStudents} on purpose: D2 cravou UNIÃO SEMPRE, so this
 * path MUST NOT carry the corporate CLIFF (`if (is_corporate && size===0)`). The
 * E3 functions already do the unconditional UNION (subtree ∪ descendant group
 * members) in SQL, dedup, and auto-exclude the gestor.
 *
 * Order for drill-down is inegotiable (mirrors getSubtreeStudentIdsAtNode):
 *   auth_subtree_user_ids() → has(focusUserId) GATE → subtree_student_ids(node).
 * A forged / out-of-subtree node returns an EMPTY Set (fail-closed), never the
 * caller's full set, never tenant-wide.
 *
 * `db` MUST be the manager's AUTHENTICATED client (every E3 fn reads auth.uid()).
 * The `ServiceClient` type here is only the loose shape shared with the rest of
 * the module — the RUNTIME client passed for the subtree path is the RLS client.
 */
async function resolveSubtreeStudents(
  db: ServiceClient,
  focusUserId: string | null,
): Promise<Set<string>> {
  if (!focusUserId) {
    // No focus → the caller's own subtree (UNION ALWAYS, RLS-safe via E3).
    const { data } = await db.rpc("auth_reachable_student_ids")
    return new Set((data ?? []) as string[])
  }
  // Drill-down → GATE before resolving the node's subtree.
  const { data: subtreeUsers } = await db.rpc("auth_subtree_user_ids")
  if (!new Set((subtreeUsers ?? []) as string[]).has(focusUserId)) return new Set() // gate → empty
  const { data } = await db.rpc("subtree_student_ids", { _node: focusUserId })
  return new Set((data ?? []) as string[])
}

/**
 * Decision 3 — UNION (deduplicate by student_id) the student universes of a SET
 * of groups. A student that belongs to two of a gestor's groups (or to a
 * corporate team spanning several UNIDADEs) is counted EXACTLY ONCE. Centralized
 * so the manager rollup and the comparison payload share one source of truth and
 * cannot drift into a double-count. Also returns the distinct UNIDADE ids and
 * whether any group is corporate, for the gestor-level metadata.
 */
function unionStudentsAcrossGroups(
  ctx: AreaGestorContext,
  groups: GroupRow[],
): { students: Set<string>; unitIds: Set<string>; hasCorporate: boolean } {
  const students = new Set<string>()
  const unitIds = new Set<string>()
  let hasCorporate = false
  for (const g of groups) {
    if (g.is_corporate) hasCorporate = true
    for (const sid of resolveGroupStudents(ctx, g)) students.add(sid)
    for (const u of ctx.unitsByGroup.get(g.id) ?? []) {
      // Honor the corporate UNIT SELECTOR for the gestor's reachable-unidade count:
      // when a (group-spanned) unitFilter is active, the rollup reflects only that
      // unidade, matching the narrowed student universe resolveGroupStudents used.
      if (ctx.unitFilter && g.is_corporate && u.id !== ctx.unitFilter) continue
      unitIds.add(u.id)
    }
  }
  return { students, unitIds, hasCorporate }
}

/**
 * Item 8 — per-ÁREA/GESTOR (per group) aggregated stats. Honors the
 * include/exclude CORPORATIVO flag. Returns AreaStats[] (one per team).
 */
export async function aggregateAreaStats(
  db: ServiceClient,
  tenantId: string,
  opts: AreaGestorOptions = {},
): Promise<AreaStats[]> {
  const ctx = await loadContext(db, tenantId, opts)
  const now = opts.now ?? Date.now()

  return ctx.groups.map((group) => {
    const students = resolveGroupStudents(ctx, group)
    const block = computeMetricBlock(students, ctx.sessions, ctx.reflections, ctx.chapterCount, now)
    return {
      groupId: group.id,
      groupName: group.name,
      managerId: group.manager_id,
      managerName: group.manager_id ? (ctx.managerNameById.get(group.manager_id) ?? null) : null,
      isCorporate: group.is_corporate,
      units: ctx.unitsByGroup.get(group.id) ?? [],
      ...block,
    }
  })
}

/**
 * Gestor-level rollup: one ManagerStats per owning gestor, aggregating the
 * UNION of students across ALL groups they own (a student counted once even if
 * in two of the gestor's groups). Honors the CORPORATIVO include/exclude flag.
 */
export async function aggregateManagerStats(
  db: ServiceClient,
  tenantId: string,
  opts: AreaGestorOptions = {},
): Promise<ManagerStats[]> {
  const ctx = await loadContext(db, tenantId, opts)
  const now = opts.now ?? Date.now()

  // Group the gestor's groups together.
  const byManager = new Map<string, GroupRow[]>()
  for (const g of ctx.groups) {
    if (!g.manager_id) continue // orphan groups have no gestor rollup
    const list = byManager.get(g.manager_id) ?? []
    list.push(g)
    byManager.set(g.manager_id, list)
  }

  const result: ManagerStats[] = []
  for (const [managerId, ownedGroups] of byManager) {
    // UNION across the gestor's groups → student counted once even if in 2+ groups.
    const { students, unitIds, hasCorporate } = unionStudentsAcrossGroups(ctx, ownedGroups)
    const block = computeMetricBlock(students, ctx.sessions, ctx.reflections, ctx.chapterCount, now)
    result.push({
      managerId,
      managerName: ctx.managerNameById.get(managerId) ?? "—",
      groupCount: ownedGroups.length,
      hasCorporateGroup: hasCorporate,
      unitCount: unitIds.size,
      ...block,
    })
  }
  return result
}

/**
 * E9 (EPIC-30) — SUBTREE rollup: ONE metric block for the manager's whole
 * subtree (UNION ALWAYS, no CLIFF), or for a drill-down node when `focusUserId`
 * is set (gated). REUSES {@link computeMetricBlock} verbatim — the ONLY thing
 * that changes vs the group rollup is the ORIGIN of the student Set, which comes
 * from {@link resolveSubtreeStudents} (the E3 functions) instead of the
 * group/CLIFF path. So the numbers are comparable-by-construction with the group
 * and unidade blocks (AC8).
 *
 * `db` MUST be the manager's AUTHENTICATED client (the E3 functions read
 * auth.uid()); the loose `ServiceClient` type is only the shared shape.
 *
 * Returns the metric block plus the resolved student count. A gate failure / an
 * empty subtree yields a zeroed block over an empty Set (fail-closed) — NEVER
 * tenant-wide.
 */
export async function aggregateSubtreeStats(
  db: ServiceClient,
  tenantId: string,
  opts: AreaGestorOptions = {},
): Promise<ComparableMetricBlock & { studentCount: number }> {
  const ctx = await loadContext(db, tenantId, opts)
  const now = opts.now ?? Date.now()
  // Universe = the subtree (UNION ALWAYS) — gated when a focus node is supplied.
  const students = await resolveSubtreeStudents(db, opts.focusUserId ?? null)
  const block = computeMetricBlock(students, ctx.sessions, ctx.reflections, ctx.chapterCount, now)
  return { ...block, studentCount: students.size }
}

/**
 * UNIDADE stats (mirrors analytics/page.tsx), recomputed here so a single
 * comparison endpoint can return all three modes from one context load.
 */
export async function aggregateUnitStats(
  db: ServiceClient,
  tenantId: string,
  opts: AreaGestorOptions = {},
): Promise<UnitStats[]> {
  const ctx = await loadContext(db, tenantId, opts)
  const now = opts.now ?? Date.now()

  // student → unidade(s) via user_areas. Keyado por area_id (NÃO por name): nomes
  // de unidade não são únicos por tenant (só o slug é), então agrupar por nome
  // conflataria unidades distintas de mesmo nome — mesma regra do fix em
  // analytics/page.tsx. O nome é resolvido depois, apenas para exibição.
  const studentsByUnit = new Map<string, Set<string>>()
  for (const ua of ctx.userAreas) {
    if (!ctx.unitNameById.has(ua.area_id)) continue // area de outro tenant / ausente
    const set = studentsByUnit.get(ua.area_id) ?? new Set<string>()
    set.add(ua.user_id)
    studentsByUnit.set(ua.area_id, set)
  }

  const units: UnitStats[] = []
  for (const [areaId, students] of studentsByUnit) {
    const areaName = ctx.unitNameById.get(areaId) ?? areaId
    const block = computeMetricBlock(students, ctx.sessions, ctx.reflections, ctx.chapterCount, now)
    units.push({ areaName, ...block })
  }
  return units.sort((a, b) => a.areaName.localeCompare(b.areaName))
}

/**
 * Internal: per-COURSE stats, REUSING `computeMetricBlock` for the SHAPE (NOT the
 * enrollment-based manager-courses route). A course is a slice of the CURRICULUM
 * ("the what"), so:
 *   • session universe = sessions whose chapter belongs to the course;
 *   • student set       = UNION of students with a session in the course AND
 *                         students with a reflection routed to the course (FORM-05).
 *                         A reflection-only student would otherwise be silently
 *                         dropped by computeMetricBlock's membership filter, losing
 *                         their reflectionCount; including them keeps it counted;
 *   • reflections       = reflections on the course's slides (slide→chapter→course);
 *   • completion denom  = students × (chapters IN THIS COURSE).
 *
 * AGGR-03 — completionPct is NOT 1:1 comparable with the UNIDADE/ÁREA axis. A
 * course's denominator is a SESSION-derived student universe × its OWN chapters,
 * whereas a UNIDADE/ÁREA uses a MEMBERSHIP-derived universe × the tenant-wide
 * chapterCount. They share the metric SHAPE, not the same denominator — read a
 * course's completionPct as "how complete is THIS course for whoever touched it",
 * not as a like-for-like rate against a unit/área.
 *
 * Tenant-wide, NOT role-gated (additive access decision). Shared by the public
 * `aggregateCourseStats` and `buildComparison` so the two cannot drift.
 */
function computeCourseStats(ctx: AreaGestorContext, now: number): CourseStats[] {
  // Bucket the shared tenant universe by course ONCE (avoids re-scanning per course).
  const sessionsByCourse = new Map<string, SessionRow[]>()
  for (const s of ctx.sessions) {
    if (!s.chapter_id) continue
    const courseId = ctx.courseIdByChapter.get(s.chapter_id)
    if (!courseId) continue // session on a chapter with no course → not attributable
    const list = sessionsByCourse.get(courseId) ?? []
    list.push(s)
    sessionsByCourse.set(courseId, list)
  }
  const reflectionsByCourse = new Map<string, ReflectionRow[]>()
  for (const r of ctx.reflections) {
    if (!r.slide_id) continue
    const chapterId = ctx.chapterIdBySlide.get(r.slide_id)
    if (!chapterId) continue
    const courseId = ctx.courseIdByChapter.get(chapterId)
    if (!courseId) continue
    const list = reflectionsByCourse.get(courseId) ?? []
    list.push(r)
    reflectionsByCourse.set(courseId, list)
  }

  return ctx.courses
    .map((course) => {
      const courseSessions = sessionsByCourse.get(course.id) ?? []
      const courseReflections = reflectionsByCourse.get(course.id) ?? []
      // Student set = UNION of students with a session in this course AND students
      // with a reflection routed to this course (FORM-05). Without the reflection
      // side, a reflection-only student is dropped by computeMetricBlock's
      // membership filter and their reflectionCount silently vanishes.
      const students = new Set(courseSessions.map((s) => s.student_id))
      for (const r of courseReflections) students.add(r.student_id)
      const courseChapterCount = ctx.chapterCountByCourse.get(course.id) ?? 0
      // Pass course-scoped sessions/reflections so computeMetricBlock's internal
      // student-membership filter operates on the course universe (identical math).
      const block = computeMetricBlock(
        students,
        courseSessions,
        courseReflections,
        courseChapterCount,
        now,
      )
      return {
        courseId: course.id,
        title: course.title,
        status: course.status ?? "—",
        ...block,
      }
    })
    .sort((a, b) => a.title.localeCompare(b.title))
}

/**
 * Per-COURSE session-based stats, symmetric with units/areas. Tenant-wide,
 * NOT role-gated. Replaces the enrollment-based manager-courses mapping for the
 * "Cursos" comparison mode.
 */
export async function aggregateCourseStats(
  db: ServiceClient,
  tenantId: string,
  opts: AreaGestorOptions = {},
): Promise<CourseStats[]> {
  const ctx = await loadContext(db, tenantId, opts)
  return computeCourseStats(ctx, opts.now ?? Date.now())
}

/**
 * Item 8.1 — "Time do Gestor × Unidade" comparison payload. Single context
 * load produces all three comparison modes (units / areas / managers) so the
 * FASE 2 UI (unit-comparison.tsx) can switch modes without extra round-trips.
 * Output shape === ComparisonResponse (types/analytics.ts), structurally
 * compatible with the existing UnitStats comparison contract.
 */
export async function buildComparison(
  db: ServiceClient,
  tenantId: string,
  opts: AreaGestorOptions = {},
): Promise<ComparisonResponse> {
  // One context load shared across the three views (avoids 3× the queries).
  const ctx = await loadContext(db, tenantId, opts)
  const now = opts.now ?? Date.now()

  // --- UNIDADE --- (keyado por area_id; nome só p/ exibição — nomes de unidade
  // não são únicos por tenant, então agrupar por nome conflataria unidades
  // distintas de mesmo nome. Mesma regra de aggregateUnitStats e analytics/page.tsx.)
  const studentsByUnit = new Map<string, Set<string>>()
  for (const ua of ctx.userAreas) {
    if (!ctx.unitNameById.has(ua.area_id)) continue
    const set = studentsByUnit.get(ua.area_id) ?? new Set<string>()
    set.add(ua.user_id)
    studentsByUnit.set(ua.area_id, set)
  }
  const units: UnitStats[] = [...studentsByUnit.entries()]
    .map(([areaId, students]) => ({
      areaName: ctx.unitNameById.get(areaId) ?? areaId,
      ...computeMetricBlock(students, ctx.sessions, ctx.reflections, ctx.chapterCount, now),
    }))
    .sort((a, b) => a.areaName.localeCompare(b.areaName))

  // --- ÁREA / GESTOR (per team) ---
  const areas: AreaStats[] = ctx.groups.map((group) => {
    const students = resolveGroupStudents(ctx, group)
    return {
      groupId: group.id,
      groupName: group.name,
      managerId: group.manager_id,
      managerName: group.manager_id ? (ctx.managerNameById.get(group.manager_id) ?? null) : null,
      isCorporate: group.is_corporate,
      units: ctx.unitsByGroup.get(group.id) ?? [],
      ...computeMetricBlock(students, ctx.sessions, ctx.reflections, ctx.chapterCount, now),
    }
  })

  // --- GESTOR rollup (per manager) ---
  const byManager = new Map<string, GroupRow[]>()
  for (const g of ctx.groups) {
    if (!g.manager_id) continue
    const list = byManager.get(g.manager_id) ?? []
    list.push(g)
    byManager.set(g.manager_id, list)
  }
  const managers: ManagerStats[] = [...byManager.entries()].map(([managerId, ownedGroups]) => {
    // Same centralized UNION as aggregateManagerStats → no drift, no double-count.
    const { students, unitIds, hasCorporate } = unionStudentsAcrossGroups(ctx, ownedGroups)
    return {
      managerId,
      managerName: ctx.managerNameById.get(managerId) ?? "—",
      groupCount: ownedGroups.length,
      hasCorporateGroup: hasCorporate,
      unitCount: unitIds.size,
      ...computeMetricBlock(students, ctx.sessions, ctx.reflections, ctx.chapterCount, now),
    }
  })

  // --- COURSES (curriculum slice) — same shared computeCourseStats → no drift. ---
  const courses = computeCourseStats(ctx, now)

  return { units, areas, managers, courses }
}

// ---------------------------------------------------------------------------
// 1.2 — PERMISSIONS BY ROLE (fixed rules, no config screen) + filtering.
// ---------------------------------------------------------------------------
// The server is the source of truth: it NEVER returns comparison entities the
// caller's role is not allowed to compare. The allowed modes per role live in
// types/analytics.ts (COMPARISON_MODES_BY_ROLE + canCompare) so the UI and the
// server share ONE contract. RULES (Hugo's binding decision):
//   • student     → only `self` (own perf vs own unidade avg) — handled by
//                   computeStudentComparison, NOT this comparison payload.
//   • manager     → `areas` (their team vs unidades / gestor rollups).
//   • admin       → everything tenant-wide: units, areas, courses.
//   • super_admin → everything (same as admin).

/** Roles that may hit the manager-groups comparison route at all. */
const COMPARISON_ALLOWED_ROLES: ReadonlySet<AnalyticsRole> = new Set<AnalyticsRole>([
  "manager",
  "admin",
  "super_admin",
])

/**
 * Returns the comparison modes a role may perform (mirrors COMPARISON_MODES_BY_ROLE).
 * The server uses this to decide which slices of a ComparisonResponse to expose;
 * the UI uses it to decide which mode toggles to render.
 */
export function allowedComparisonModes(role: AnalyticsRole): readonly ComparisonMode[] {
  return COMPARISON_MODES_BY_ROLE[role] ?? []
}

/** True when `role` is permitted on the manager-groups comparison route at all. */
export function canAccessComparison(role: AnalyticsRole): boolean {
  return COMPARISON_ALLOWED_ROLES.has(role)
}

/**
 * 1.2 — Strips a {@link ComparisonResponse} down to only the entities the role is
 * permitted to compare (server-side enforcement; never trust the client). A mode
 * the role lacks comes back EMPTY (never undefined) so the response shape is
 * stable for every caller.
 *   • manager     → keeps `areas`/`managers` (their team vs unidades); drops the
 *                   tenant-wide unit×unit and course×course slices (admin scope).
 *                   `units` is RETAINED as the comparison reference a gestor needs
 *                   to place their team against unidades (the `areas` mode is
 *                   "team vs unidades"), but `courses` is cleared. The `areas`/
 *                   `managers` slices are FURTHER scoped to the manager's OWN
 *                   groups (see `userId` below) so one gestor never sees another
 *                   gestor's team name, identity or metrics.
 *   • admin / super_admin → everything (units, areas, managers, courses).
 * The `student` role never reaches here (it uses computeStudentComparison).
 *
 * @param userId  the AUTHENTICATED user's id (auth.uid()). REQUIRED to scope a
 *                manager's `areas`/`managers` to their own groups only — without
 *                it the manager branch would leak every tenant gestor's team (a
 *                cross-gestor data exposure). admin/super_admin are tenant-wide
 *                and ignore it. When omitted for a manager, the team slices come
 *                back EMPTY (fail-closed) rather than leaking other gestors.
 */
export function filterComparisonByRole(
  comparison: ComparisonResponse,
  role: AnalyticsRole,
  userId?: string,
): ComparisonResponse {
  const modes = new Set(allowedComparisonModes(role))
  // `areas` mode for a manager means "team vs unidades", so when areas is allowed
  // the unidade reference is part of that comparison and stays. `units` as a
  // standalone unit×unit comparison is admin-only; for a manager we keep units as
  // the reference axis but never the course×course slice.
  const canUnits = modes.has("units")
  const canAreas = modes.has("areas")
  const canCourses = modes.has("courses")

  // A manager may only see THEIR OWN team(s) — never another gestor's group. We
  // scope `areas`/`managers` to entries owned by `userId`. admin/super_admin are
  // tenant-wide (they compare every team) so they bypass this narrowing. If a
  // manager reaches here without a userId we fail closed (empty), never leak.
  const isTenantWide = role === "admin" || role === "super_admin"
  const scopedAreas = isTenantWide
    ? comparison.areas
    : userId
      ? comparison.areas.filter((a) => a.managerId === userId)
      : []
  const scopedManagers = isTenantWide
    ? comparison.managers
    : userId
      ? comparison.managers.filter((m) => m.managerId === userId)
      : []

  return {
    // Manager keeps units as the reference for "team vs unidades"; admin gets the
    // full unit×unit comparison. Either way units are visible to both, so retain.
    units: canUnits || canAreas ? comparison.units : [],
    areas: canAreas ? scopedAreas : [],
    managers: canAreas ? scopedManagers : [],
    courses: canCourses ? (comparison.courses ?? []) : [],
  }
}

// ---------------------------------------------------------------------------
// 1.2 — STUDENT self-comparison: own performance vs the ORGANIZATION average.
// (M2, 2026-07-11: reference scope changed from own UNIDADE to the whole tenant.)
// ---------------------------------------------------------------------------

/** Lean rows for the student self-comparison (loose service client returns any). */
interface StudentSessionRow {
  status: string | null
  created_at: string
  analytics?: SessionAnalyticsJsonb | null
}

/**
 * 1.2 — Builds the STUDENT self-comparison: the logged-in student's OWN metric
 * block beside the AVERAGE of the WHOLE ORGANIZATION (tenant). M2 (2026-07-11):
 * the reference scope changed from the student's own UNIDADE to the entire tenant
 * (all role=student users, NO area filter) — Hugo's explicit decision. Both blocks
 * reuse {@link computeMetricBlock} so the numbers are computed identically.
 *
 * SECURITY: the caller MUST pass the AUTHENTICATED student's own id (auth.uid())
 * and the tenant resolved server-side — never a client-supplied id. This function
 * reads only aggregate ORG numbers (counts/averages); it returns NO per-other-
 * student rows or identities. When the tenant has no students at all, `unit` is
 * null (the UI then shows only the student's own numbers).
 *
 * @param db        loose service client (RLS-bypassing; tenant scoping enforced here)
 * @param tenantId  tenant resolved server-side (NOT from the client)
 * @param studentId the authenticated student's own id (auth.uid())
 * @param opts      clock injection only (corporate flags don't apply to a student)
 */
/**
 * The ORG-WIDE reference for the student home — the tenant population aggregate.
 * IDENTICAL for every student of the tenant within a short window, so it is the
 * memoizable unit (SH-F.3 `org-reference-cache.ts`). Carries the raw org rows the
 * per-request "Você" derivation reads, the frozen clock `now` used to compute the
 * org side (so a cache hit is numerically identical), and the pre-computed
 * aggregates. It holds NO per-student identity — `studentId` never enters here.
 */
export interface OrgReference {
  /** The clock the org side was computed at — frozen so cache hits are identical. */
  now: number
  /** Every role=student user of the tenant (NO area filter — M2). */
  orgStudentIds: string[]
  orgSessionRows: SessionRow[]
  orgReflectionRows: ReflectionRow[]
  orgEnrollmentRows: EnrollmentRow[]
  deadlineByCourse: Map<string, number | null>
  /** Tenant chapter count (org-wide completion denominator, same for both blocks). */
  tenantChapterCount: number
  /**
   * SH-F.5 — the tenant's chapter CATALOG (id + course_id). ORG-WIDE (same for
   * every student, no per-student data), so it is safe to cache. The student's
   * OWN trail subset (enrolled ∩ active courses) is derived FRESH per request from
   * this catalog — the catalog is cached, the per-student slice is not.
   */
  chapterRows: ChapterRow[]
  /** SH-F.5 — non-archived course ids of the tenant (org-wide). */
  activeCourseIds: Set<string>
  orgBlock: ComparableMetricBlock
  referenceStats: UnitReferenceStats | undefined
}

/**
 * PURE LOAD of the org reference (SH-F.3). Runs the org-wide scans (tenant-scoped,
 * NO area filter — M2): users (population) + chapters/active-courses (tenant chapter
 * count) + the 4 org scans (sessions, reflections, enrollments, course deadlines),
 * then composes `orgBlock` + `referenceStats`. NO per-student query lives here — the
 * student's OWN block is computed FRESH in `computeStudentComparison`, never cached.
 * Memoized per tenant by `getOrgReference` (org-reference-cache.ts).
 */
export async function loadOrgReference(
  db: ServiceClient,
  tenantId: string,
  now: number,
): Promise<OrgReference> {
  // Tenant chapter universe (org-wide completion denominator).
  const chapterRows = await fetchAllRows<ChapterRow>(() =>
    db.from("chapters").select("id, course_id").eq("tenant_id", tenantId),
  )
  const { data: activeCourseRows } = await db
    .from("courses")
    .select("id")
    .eq("tenant_id", tenantId)
    .neq("status", "archived")
  const activeCourseIds = new Set((activeCourseRows ?? []).map((c) => c.id as string))
  const tenantChapterCount = chapterRows.filter(
    (ch) => ch.course_id && activeCourseIds.has(ch.course_id),
  ).length

  // Org population — every role=student user of the tenant (NO area filter, M2).
  const { data: orgStudentRows } = await db
    .from("users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("role", "student")
  const orgStudentIds = [...new Set((orgStudentRows ?? []).map((r) => r.id as string))]

  // The 4 org scans (tenant_id only). Empty population → empty rows, zero block.
  const [orgSessionRows, orgReflectionRows, orgEnrollmentRows, courseDeadlineRows] =
    await Promise.all([
      fetchAllRows<SessionRow>(() =>
        db
          .from("sessions")
          .select("student_id, status, chapter_id, created_at, analytics")
          .eq("tenant_id", tenantId),
      ),
      fetchAllRows<ReflectionRow>(() =>
        db.from("slide_reflections").select("student_id").eq("tenant_id", tenantId),
      ),
      fetchAllRows<EnrollmentRow>(() =>
        db
          .from("enrollments")
          .select("student_id, status, created_at, progress, course_id")
          .eq("tenant_id", tenantId),
      ),
      fetchAllRows<{ id: string; deadline_days: number | null }>(() =>
        db.from("courses").select("id, deadline_days").eq("tenant_id", tenantId),
      ),
    ])
  const deadlineByCourse = new Map<string, number | null>()
  for (const c of courseDeadlineRows) deadlineByCourse.set(c.id, c.deadline_days)

  const orgBlock = computeMetricBlock(
    orgStudentIds,
    orgSessionRows,
    orgReflectionRows,
    tenantChapterCount,
    now,
  )
  const referenceStats = computeUnitReferenceStats(
    orgStudentIds,
    orgSessionRows,
    orgReflectionRows,
    tenantChapterCount,
    now,
  )

  return {
    now,
    orgStudentIds,
    orgSessionRows,
    orgReflectionRows,
    orgEnrollmentRows,
    deadlineByCourse,
    tenantChapterCount,
    chapterRows,
    activeCourseIds,
    orgBlock,
    referenceStats,
  }
}

export async function computeStudentComparison(
  db: ServiceClient,
  tenantId: string,
  studentId: string,
  opts: Pick<AreaGestorOptions, "now"> = {},
): Promise<StudentComparison> {
  const now = opts.now ?? Date.now()

  // ORG reference (cached per tenant, TTL — SH-F.3). The tenant population aggregate
  // is identical for every student in a short window, so it is memoized (0 org scans
  // on a cache hit). The student's OWN block below is NEVER cached, fresh per request.
  const orgRef = await getOrgReference(db, tenantId, now)

  // --- The student's OWN metric block (their sessions + reflections only) ---
  // FRESH per request (student_id = auth), NEVER cached. Uses the org reference's
  // tenant chapter count so both blocks share the same completion denominator.
  const [ownSessionRows, ownReflectionRows] = await Promise.all([
    fetchAllRows<StudentSessionRow>(() =>
      db
        .from("sessions")
        .select("status, created_at, analytics")
        .eq("tenant_id", tenantId)
        .eq("student_id", studentId),
    ),
    fetchAllRows<{ id: string }>(() =>
      db
        .from("slide_reflections")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("student_id", studentId),
    ),
  ])
  const ownSessions: SessionRow[] = ownSessionRows.map((s) => ({
    student_id: studentId,
    status: s.status,
    chapter_id: null,
    created_at: s.created_at,
    analytics: s.analytics ?? null,
  }))
  const ownReflections: ReflectionRow[] = ownReflectionRows.map(() => ({ student_id: studentId }))
  const student = computeMetricBlock(
    [studentId],
    ownSessions,
    ownReflections,
    orgRef.tenantChapterCount,
    now,
  )

  // No org population → own numbers only (M2: unitName always null).
  if (orgRef.orgStudentIds.length === 0) {
    return { student, unit: null, unitName: null, indicators: null }
  }

  // SH-F.5 — engagement CEILING N of the STUDENT'S OWN trail (fraction "X de N").
  // The trail (enrolled ∩ non-archived courses → chapters) is derived FRESH per
  // request from the CACHED org catalog (chapterRows/activeCourseIds/enrollments —
  // org-wide, no per-student data cached). The ONE new scan is `chapter_slides` of
  // the trail chapters (student-side, FRESH, NEVER cached — not in OrgReference).
  const trailChapterIds = trailChapterIdsOf(
    studentId,
    orgRef.orgEnrollmentRows,
    orgRef.chapterRows,
    orgRef.activeCourseIds,
  )
  const trailSlideRows =
    trailChapterIds.length > 0
      ? await fetchAllRows<{ text_content: string | null }>(() =>
          db
            .from("chapter_slides")
            .select("id, chapter_id, text_content")
            .eq("tenant_id", tenantId)
            .in("chapter_id", trailChapterIds),
        )
      : []
  const engagementMax = computeEngagementMax(
    trailChapterIds.length,
    countReflectionPossibleSlides(trailSlideRows),
  )

  // Recompose unit + "Meu ritmo" indicators PER REQUEST from the CACHED org reference
  // (in memory, no DB). The "Você" side is derived per-request from `studentId`; the
  // org side + clock come from the frozen reference, so a cache hit is numerically
  // identical (AC5) and two students share the same orgBlock but differ on `student`.
  const unit = orgRef.referenceStats
    ? { ...orgRef.orgBlock, referenceStats: orgRef.referenceStats }
    : orgRef.orgBlock
  const indicators = buildStudentHomeIndicators(
    studentId,
    orgRef.orgStudentIds,
    orgRef.orgSessionRows,
    orgRef.orgReflectionRows,
    orgRef.orgEnrollmentRows,
    orgRef.deadlineByCourse,
    orgRef.now,
    engagementMax,
  )

  return { student, unit, unitName: null, indicators }
}
