import { aggregateLoopStats } from "@/lib/analytics/loop-stats"
import { countReflectionBlocks } from "@/lib/analytics/reflection-potential"
import { getManagedTeamStudentIds, getSubtreeStudentIdsAtNode } from "@/lib/area-context"
import { computeEngagementTriage } from "@/lib/notifications/engagement-triage"
import { analyticsAggregateLimiter } from "@/lib/rate-limit"
import { createClient } from "@/lib/supabase/server"
import type {
  AggregateAnalyticsResponse,
  AggregateSummary,
  AnalyticsAlert,
  AnalyticsScope,
  CognitivePatternCount,
  CurriculumPotential,
  DepthDistribution,
  DivergenceRow,
  EmotionalJourneyPoint,
  ExceptionFeedItem,
  IndicatorTotals,
  InteractionModePotential,
  KolbPoint,
  LoopStats,
  ModuleIndicator,
  ReflectionSocraticIndicators,
  SessionAnalyticsJsonb,
} from "@/types/analytics"
import type { SupabaseClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// The service client is `SupabaseClient<any, "public", any>` (see lib/supabase/service).
// Use the same loose shape so the FASE 1a helpers can run untyped table queries
// without fighting the generated Database generics.
// biome-ignore lint/suspicious/noExplicitAny: matches createServiceClient's loose typing
type ServiceClient = SupabaseClient<any, "public", any>

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// E9 (EPIC-30) — SUBTREE scope, local to this route. The shared `AnalyticsScope`
// (types/analytics.ts) is owned/extended by another work item; we keep this route
// self-contained by widening the scope locally with the `"subtree"` discriminant
// + `focusUserId`. Once the shared type carries `"subtree"`, this alias collapses
// to it without behavioural change.
type SubtreeScope = {
  kind: "subtree"
  /** Drill-down node. Absent = the caller's own subtree (auth.uid()). */
  focusUserId?: string | null
  courseId?: string | null
}
type ResolvableScope = AnalyticsScope | SubtreeScope

const DEPTH_LABELS = [
  "Repeticao superficial",
  "Compreensão basica",
  "Aplicacao",
  "Analise",
  "Questionamento",
  "Sintese",
  "Insight original",
]

function periodToDate(period: string): Date {
  const now = new Date()
  switch (period) {
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case "90d":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }
}

// =============================================================================
// FASE 1a — Potential derivation + indicator engine
// =============================================================================
// CRITICAL TERMINOLOGY: the codebase calls a geographic SITE (Minas Gerais,
// Ribeirão Preto) an "area"/areaId — that is the UNIDADE. The ÁREA/GESTOR concept
// (a manager-owned team of students, possibly CORPORATIVO) lives in
// `manager_groups` (migration 20260530130000). The helpers below keep the two
// strictly separate via the AnalyticsScope discriminator.

// PostgREST caps a single request at ~1000 rows. Any select whose result set can
// realistically exceed that (slides, reflections, sessions across a whole tenant)
// must page with .range() or it silently truncates and undercounts. FORM-08.
const PAGE_SIZE = 1000

/**
 * Exhaustively pages a PostgREST query that returns row DATA (not a head count).
 * `buildPage(from, to)` must return the query for that inclusive .range() window.
 * Stops when a page returns fewer than PAGE_SIZE rows (or an error/empty page).
 */
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

// isReflectionBlock / countReflectionBlocks were extracted VERBATIM to
// lib/analytics/reflection-potential.ts (SH-F.5, flag I1) so the "Meu ritmo"
// engagementMax path REUSES them instead of re-inventing. Imported at the top;
// behavior is byte-identical (import, not copy).

const SOCRATIC_INTERACTION_TYPES = new Set([null, "socratic_dialogue"])

/**
 * Derives the three per-curriculum potentials for a set of chapters. PURE of any
 * student scope (potential is a property of the curriculum, not the audience).
 * Returns both the totals and a per-chapter breakdown (needed by item 2.2).
 */
async function computeCurriculumPotential(
  db: ServiceClient,
  tenantId: string,
  chapters: Array<{ id: string; interaction_type: string | null }>,
): Promise<{
  total: CurriculumPotential
  perChapter: Map<string, { reflectionPotential: number; socraticPotential: number }>
}> {
  const perChapter = new Map<string, { reflectionPotential: number; socraticPotential: number }>()
  for (const ch of chapters) {
    perChapter.set(ch.id, { reflectionPotential: 0, socraticPotential: 0 })
  }

  const chapterIds = chapters.map((c) => c.id)
  if (chapterIds.length === 0) {
    return {
      total: { reflectionPotential: 0, socraticPotential: 0, sessionPotential: 0 },
      perChapter,
    }
  }

  // --- Reflection potential: parse markdown blockquotes per slide ---
  // FORM-08: paginate — a large tenant can have >1000 slides across chapters.
  const slides = await fetchAllRows<{ chapter_id: string; text_content: string | null }>(
    (from, to) =>
      db
        .from("chapter_slides")
        .select("chapter_id, text_content")
        .eq("tenant_id", tenantId)
        .in("chapter_id", chapterIds)
        .range(from, to),
  )

  for (const s of slides) {
    const entry = perChapter.get(s.chapter_id)
    if (!entry) continue
    entry.reflectionPotential += countReflectionBlocks(s.text_content)
  }

  // --- Socratic potential: count active questions, only for socratic chapters ---
  const socraticChapterIds = chapters
    .filter((c) => SOCRATIC_INTERACTION_TYPES.has(c.interaction_type))
    .map((c) => c.id)

  if (socraticChapterIds.length > 0) {
    // FORM-08: paginate — active questions can exceed the 1000-row cap.
    const activeQuestions = await fetchAllRows<{ chapter_id: string }>((from, to) =>
      db
        .from("questions")
        .select("chapter_id")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .in("chapter_id", socraticChapterIds)
        .range(from, to),
    )
    for (const q of activeQuestions) {
      const entry = perChapter.get(q.chapter_id)
      if (entry) entry.socraticPotential += 1
    }
  }

  let reflectionPotential = 0
  let socraticPotential = 0
  for (const v of perChapter.values()) {
    reflectionPotential += v.reflectionPotential
    socraticPotential += v.socraticPotential
  }

  return {
    total: {
      reflectionPotential,
      socraticPotential,
      // Model A: one expected session/advance per chapter (FASE 0b recommendation).
      sessionPotential: chapterIds.length,
    },
    perChapter,
  }
}

/**
 * Resolves the student universe (users.id, role=student) for a given scope.
 * Returns `null` to mean "no restriction" (whole-tenant default) so callers can
 * skip the IN() filter; returns `[]` to mean "scope resolved but empty".
 *   • tenant      → null (no restriction)
 *   • unit        → students whose user_areas links the UNIDADE areaId
 *   • area/gestor → students in manager_group_members for that group
 *   • individual  → exactly [studentId]
 *   • subtree     → E9: the caller's whole subtree (no focus) or a GATED drill-down
 *                   node. ALWAYS a concrete array (fail-closed []), never null —
 *                   subtree must NOT widen to tenant on a gate/empty result.
 */
async function resolveScopeStudentIds(
  db: ServiceClient,
  tenantId: string,
  scope: ResolvableScope,
): Promise<string[] | null> {
  switch (scope.kind) {
    case "individual": {
      return scope.studentId ? [scope.studentId] : []
    }
    case "subtree": {
      // E9 (EPIC-30). NOTE: this route uses the SERVICE client (RLS-bypassing),
      // so the app gate here IS the real barrier for this path — hence fail-closed
      // `[]` (never null/tenant-wide), with the route's tenant_id filter still
      // applied downstream (AC11). Without a focus node → the caller's subtree;
      // with one → GATE (node ∈ auth_subtree_user_ids) BEFORE subtree_student_ids.
      if (!scope.focusUserId) {
        const { data, error } = await db.rpc("auth_reachable_student_ids")
        return error ? [] : [...new Set((data ?? []) as string[])]
      }
      const { data: subtreeUsers } = await db.rpc("auth_subtree_user_ids")
      if (!new Set((subtreeUsers ?? []) as string[]).has(scope.focusUserId)) return [] // forged → []
      const { data, error } = await db.rpc("subtree_student_ids", { _node: scope.focusUserId })
      return error ? [] : [...new Set((data ?? []) as string[])]
    }
    case "unit": {
      if (!scope.areaId) return null
      const { data } = await db.from("user_areas").select("user_id").eq("area_id", scope.areaId)
      const candidateIds = [...new Set((data ?? []).map((r) => r.user_id as string))]
      if (candidateIds.length === 0) return []
      // UI-05: user_areas links instructors/admins too — restrict to role=student
      // so the realized universe matches the "students" population.
      const { data: studentRows } = await db
        .from("users")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("role", "student")
        .in("id", candidateIds)
      return [...new Set((studentRows ?? []).map((r) => r.id as string))]
    }
    case "area": {
      if (!scope.groupId) return null
      const { data } = await db
        .from("manager_group_members")
        .select("student_id")
        .eq("tenant_id", tenantId)
        .eq("group_id", scope.groupId)
      return [...new Set((data ?? []).map((r) => r.student_id as string))]
    }
    default:
      return null
  }
}

/**
 * Resolves the set of chapters in scope (id + interaction_type), optionally
 * narrowed to a course, an area (UNIDADE/UI-09) and/or an interaction type
 * (FORM-02). Mirrors the archived-duplicate course handling used by the sessions
 * query so potentials and realized counts share the same universe.
 *   • courseId        → same-title course family (incl. archived duplicates)
 *   • areaId (no course) → courses linked via course_areas + legacy courses.area_id,
 *     matching the top-level sessions area filter instead of "all courses"
 *   • interactionType → chapters narrowed to that interaction_type, matching the
 *     top-level sessions interactionType filter
 */
async function resolveScopeChapters(
  db: ServiceClient,
  tenantId: string,
  courseId: string | null | undefined,
  areaId?: string | null | undefined,
  interactionType?: string | null | undefined,
): Promise<
  Array<{
    id: string
    course_id: string
    title: string
    order: number
    interaction_type: string | null
  }>
> {
  let courseIdsToInclude: string[] | null = null
  if (courseId) {
    // M3: scope the course lookup to the tenant. A courseId from another tenant
    // must resolve to "course not found" (empty scope) rather than silently
    // matching by title across tenants or dropping the filter to tenant-wide.
    const { data: selectedCourse } = await db
      .from("courses")
      .select("title")
      .eq("id", courseId)
      .eq("tenant_id", tenantId)
      .single()
    if (!selectedCourse) return []
    courseIdsToInclude = [courseId]
    if (selectedCourse.title) {
      const { data: sameTitleCourses } = await db
        .from("courses")
        .select("id")
        .eq("title", selectedCourse.title)
        .eq("tenant_id", tenantId)
      if (sameTitleCourses) courseIdsToInclude = sameTitleCourses.map((c) => c.id)
    }
  } else if (areaId) {
    // UI-09: mirror the top-level sessions area filter (course_areas junction +
    // legacy courses.area_id) instead of pulling every non-archived course.
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
    courseIdsToInclude = [
      ...new Set([
        ...(courseAreaRows ?? []).map((r) => r.course_id as string),
        ...(legacyCourses ?? []).map((c) => c.id as string),
      ]),
    ]
  } else {
    const { data: courses } = await db
      .from("courses")
      .select("id")
      .eq("tenant_id", tenantId)
      .neq("status", "archived")
    courseIdsToInclude = (courses ?? []).map((c) => c.id)
  }

  if (!courseIdsToInclude || courseIdsToInclude.length === 0) return []

  let chaptersQuery = db
    .from("chapters")
    .select('id, course_id, title, "order", interaction_type')
    .eq("tenant_id", tenantId)
    .in("course_id", courseIdsToInclude)
  // FORM-02: propagate the interactionType filter so indicators and mode
  // potentials measure the same chapter universe as the top-level sessions query.
  if (interactionType) chaptersQuery = chaptersQuery.eq("interaction_type", interactionType)
  const { data: chapters } = await chaptersQuery

  return (chapters ?? []).map((c) => ({
    id: c.id as string,
    course_id: c.course_id as string,
    title: (c.title as string) ?? "—",
    order: ((c as Record<string, unknown>).order as number) ?? 0,
    interaction_type: (c.interaction_type as string | null) ?? null,
  }))
}

function pct(realized: number, potential: number): number {
  if (potential <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((realized / potential) * 100)))
}

/**
 * Item 2.2 — per-module + course-total indicators:
 *   • reflectionIndexPct = reflections written ÷ reflection potential
 *   • socraticIndexPct   = socratic interactions realized ÷ socratic potential
 * Scope-aware: `scopeStudentIds` restricts the realized numerators to the
 * selected view (unit/área/individual); null = whole tenant.
 */
async function computeIndicators(
  db: ServiceClient,
  tenantId: string,
  periodStart: Date,
  chapters: Array<{ id: string; title: string; order: number; interaction_type: string | null }>,
  scopeStudentIds: string[] | null,
  // ROOT PRINCIPLE: number of students the realized numerators aggregate over.
  // Per-curriculum potentials are multiplied by this so realized ÷ potential is a
  // true 0–100 ratio over the SAME population (mirrors computeMetricBlock).
  scopeStudentCount: number,
): Promise<ReflectionSocraticIndicators> {
  const empty: ReflectionSocraticIndicators = {
    perModule: [],
    total: {
      reflectionsWritten: 0,
      reflectionPotential: 0,
      reflectionIndexPct: 0,
      socraticRealized: 0,
      socraticPotential: 0,
      socraticIndexPct: 0,
    },
  }
  if (chapters.length === 0) return empty
  // Scope resolved but empty → zero realized everywhere (potentials still shown).
  const scopeEmpty = scopeStudentIds !== null && scopeStudentIds.length === 0

  const { perChapter } = await computeCurriculumPotential(db, tenantId, chapters)
  const chapterIds = chapters.map((c) => c.id)

  // --- Realized reflections per chapter (join slide_reflections → slide → chapter) ---
  const reflWritten = new Map<string, number>()
  {
    // FORM-08: paginate slides and reflections — both can exceed the 1000-row cap.
    const slides = await fetchAllRows<{ id: string; chapter_id: string }>((from, to) =>
      db
        .from("chapter_slides")
        .select("id, chapter_id")
        .eq("tenant_id", tenantId)
        .in("chapter_id", chapterIds)
        .range(from, to),
    )
    const slideToChapter = new Map<string, string>()
    for (const s of slides) slideToChapter.set(s.id, s.chapter_id)
    const slideIds = [...slideToChapter.keys()]

    if (slideIds.length > 0 && !scopeEmpty) {
      const refls = await fetchAllRows<{ slide_id: string }>((from, to) => {
        let reflQuery = db
          .from("slide_reflections")
          .select("slide_id, student_id")
          .eq("tenant_id", tenantId)
          .gte("created_at", periodStart.toISOString())
          .in("slide_id", slideIds)
        if (scopeStudentIds !== null) reflQuery = reflQuery.in("student_id", scopeStudentIds)
        return reflQuery.range(from, to)
      })
      for (const r of refls) {
        const chId = slideToChapter.get(r.slide_id)
        if (chId) reflWritten.set(chId, (reflWritten.get(chId) ?? 0) + 1)
      }
    }
  }

  // --- Realized socratic interactions per chapter (sessions on socratic chapters) ---
  // A socratic interaction = a session bound to a question on a socratic chapter.
  // UI-06: count DISTINCT students per chapter (not total sessions) so realized
  // stays bounded by the same student population the potential is scaled to.
  const socraticChapterIds = chapters
    .filter((c) => SOCRATIC_INTERACTION_TYPES.has(c.interaction_type))
    .map((c) => c.id)
  const socraticRealized = new Map<string, number>()
  if (socraticChapterIds.length > 0 && !scopeEmpty) {
    // FORM-08: paginate — socratic sessions across a tenant can exceed 1000 rows.
    const sess = await fetchAllRows<{ chapter_id: string; student_id: string }>((from, to) => {
      let sessQuery = db
        .from("sessions")
        .select("chapter_id, student_id")
        .eq("tenant_id", tenantId)
        .gte("created_at", periodStart.toISOString())
        .not("question_id", "is", null)
        .in("chapter_id", socraticChapterIds)
      if (scopeStudentIds !== null) sessQuery = sessQuery.in("student_id", scopeStudentIds)
      return sessQuery.range(from, to)
    })
    const socraticStudentsByChapter = new Map<string, Set<string>>()
    for (const s of sess) {
      const chId = s.chapter_id
      const set = socraticStudentsByChapter.get(chId) ?? new Set<string>()
      set.add(s.student_id)
      socraticStudentsByChapter.set(chId, set)
    }
    for (const [chId, set] of socraticStudentsByChapter) {
      socraticRealized.set(chId, set.size)
    }
  }

  // UI-02 / FORM-04: per-curriculum potentials are scaled by the in-scope student
  // count so the index is realized (aggregated over all students) ÷ potential
  // (per-curriculum × students) — a true 0–100 ratio, consistent with
  // computeMetricBlock. A scope with zero students collapses the denominator to 0
  // (pct() then returns 0), which is correct: no population, no expectation.
  const studentMultiplier = Math.max(0, scopeStudentCount)
  const perModule: ModuleIndicator[] = chapters.map((ch) => {
    const pot = perChapter.get(ch.id) ?? { reflectionPotential: 0, socraticPotential: 0 }
    const rWritten = reflWritten.get(ch.id) ?? 0
    const sRealized = socraticRealized.get(ch.id) ?? 0
    const reflectionPotential = pot.reflectionPotential * studentMultiplier
    const socraticPotential = pot.socraticPotential * studentMultiplier
    return {
      chapterId: ch.id,
      chapterTitle: ch.title,
      chapterOrder: ch.order,
      reflectionsWritten: rWritten,
      reflectionPotential,
      reflectionIndexPct: pct(rWritten, reflectionPotential),
      socraticRealized: sRealized,
      socraticPotential,
      socraticIndexPct: pct(sRealized, socraticPotential),
    }
  })

  const total: IndicatorTotals = perModule.reduce(
    (acc, m) => {
      acc.reflectionsWritten += m.reflectionsWritten
      acc.reflectionPotential += m.reflectionPotential
      acc.socraticRealized += m.socraticRealized
      acc.socraticPotential += m.socraticPotential
      return acc
    },
    {
      reflectionsWritten: 0,
      reflectionPotential: 0,
      reflectionIndexPct: 0,
      socraticRealized: 0,
      socraticPotential: 0,
      socraticIndexPct: 0,
    } as IndicatorTotals,
  )
  total.reflectionIndexPct = pct(total.reflectionsWritten, total.reflectionPotential)
  total.socraticIndexPct = pct(total.socraticRealized, total.socraticPotential)

  return { perModule: perModule.sort((a, b) => a.chapterOrder - b.chapterOrder), total }
}

const MODE_LABELS: Record<string, string> = {
  socratic_dialogue: "Socrático",
  quiz: "Quiz",
  scenario: "Cenário",
  assignment: "Atividade",
}

/**
 * Item 6 — Interaction modes as realized ÷ potential (replaces the vertical
 * share). For each mode the potential is the per-curriculum capacity and the
 * realized is what students in scope actually did:
 *   • socratic_dialogue → potential = active questions; realized = sessions w/ question
 *   • quiz              → potential = quizzes; realized = quiz_sessions
 *   • scenario          → potential = scenario chapters; realized = scenario_attempts
 *   • assignment        → potential = assignment chapters; realized = assignment_submissions
 * Falls back gracefully (potential 0 → pct 0) when a feature table is absent.
 * FORM-04: each per-curriculum potential is scaled by `scopeStudentCount` so the
 * realized (aggregated over all students) ÷ potential ratio is a true 0–100,
 * consistent with computeMetricBlock (students.size * per-curriculum capacity).
 */
async function computeInteractionModePotentials(
  db: ServiceClient,
  tenantId: string,
  periodStart: Date,
  chapters: Array<{ id: string; interaction_type: string | null }>,
  scopeStudentIds: string[] | null,
  scopeStudentCount: number,
): Promise<InteractionModePotential[]> {
  const scopeEmpty = scopeStudentIds !== null && scopeStudentIds.length === 0
  const studentMultiplier = Math.max(0, scopeStudentCount)
  const chaptersByMode = new Map<string, string[]>()
  for (const ch of chapters) {
    const mode = ch.interaction_type ?? "socratic_dialogue"
    const list = chaptersByMode.get(mode) ?? []
    list.push(ch.id)
    chaptersByMode.set(mode, list)
  }

  // Helper: count rows of a table for chapters in scope, optionally student-scoped.
  const countRealized = async (table: string, chapterIds: string[]): Promise<number> => {
    if (chapterIds.length === 0 || scopeEmpty) return 0
    let q = db
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", periodStart.toISOString())
      .in("chapter_id", chapterIds)
    if (scopeStudentIds !== null) q = q.in("student_id", scopeStudentIds)
    const { count } = await q
    return count ?? 0
  }

  const result: InteractionModePotential[] = []

  // --- socratic_dialogue ---
  {
    const chapterIds = chaptersByMode.get("socratic_dialogue") ?? []
    let potential = 0
    if (chapterIds.length > 0) {
      const { count } = await db
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .in("chapter_id", chapterIds)
      potential = (count ?? 0) * studentMultiplier
    }
    let realized = 0
    if (chapterIds.length > 0 && !scopeEmpty) {
      let q = db
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .gte("created_at", periodStart.toISOString())
        .not("question_id", "is", null)
        .in("chapter_id", chapterIds)
      if (scopeStudentIds !== null) q = q.in("student_id", scopeStudentIds)
      const { count } = await q
      realized = count ?? 0
    }
    result.push({
      mode: "socratic_dialogue",
      label: MODE_LABELS.socratic_dialogue,
      realized,
      potential,
      pct: pct(realized, potential),
    })
  }

  // --- quiz: potential = number of active quiz definitions (quiz_sessions) on the
  //     in-scope quiz chapters; realized = quiz_attempts on those definitions.
  //     NB: quiz_sessions = the quiz CONFIG (per chapter, no student_id);
  //     quiz_attempts = the per-student attempt (keyed by quiz_session_id, no chapter_id).
  {
    const chapterIds = chaptersByMode.get("quiz") ?? []
    let potential = 0
    let realized = 0
    if (chapterIds.length > 0) {
      const { data: quizDefs } = await db
        .from("quiz_sessions")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .in("chapter_id", chapterIds)
      const quizSessionIds = (quizDefs ?? []).map((q) => q.id as string)
      potential = quizSessionIds.length * studentMultiplier
      if (quizSessionIds.length > 0 && !scopeEmpty) {
        let q = db
          .from("quiz_attempts")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .gte("created_at", periodStart.toISOString())
          .in("quiz_session_id", quizSessionIds)
        if (scopeStudentIds !== null) q = q.in("student_id", scopeStudentIds)
        const { count } = await q
        realized = count ?? 0
      }
    }
    result.push({
      mode: "quiz",
      label: MODE_LABELS.quiz,
      realized,
      potential,
      pct: pct(realized, potential),
    })
  }

  // --- scenario: potential = one scenario expected per scenario chapter × students ---
  {
    const chapterIds = chaptersByMode.get("scenario") ?? []
    const potential = chapterIds.length * studentMultiplier
    const realized = await countRealized("scenario_attempts", chapterIds)
    result.push({
      mode: "scenario",
      label: MODE_LABELS.scenario,
      realized,
      potential,
      pct: pct(realized, potential),
    })
  }

  // --- assignment: potential = one submission expected per assignment chapter × students ---
  {
    const chapterIds = chaptersByMode.get("assignment") ?? []
    const potential = chapterIds.length * studentMultiplier
    const realized = await countRealized("assignment_submissions", chapterIds)
    result.push({
      mode: "assignment",
      label: MODE_LABELS.assignment,
      realized,
      potential,
      pct: pct(realized, potential),
    })
  }

  // Only surface modes that have curriculum presence (potential>0).
  // FORM-06: a mode with potential=0 but realized>0 would render a contradictory
  // 0% card; since the response type cannot express a null pct, omit those modes
  // entirely (curriculum has no capacity for that mode in scope).
  return result.filter((m) => m.potential > 0)
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id, user_roles!user_roles_user_id_fkey(role)")
    .eq("id", user.id)
    .single()

  if (
    !profile?.role ||
    !["leader", "manager", "admin", "instructor", "super_admin"].includes(profile.role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // SECURITY (EPIC-30 / E9 — fix QA "TESTE DE OURO" CHECK 5 leak): the analytics
  // scope must be decided from the caller's REAL HATS, never trusted from client
  // params. `user_roles` is the union of hats (E1); we fall back to the singular
  // `profile.role` only when the join is empty (legacy rows / no hats seeded).
  // Precedence is super_admin > admin > manager (epic-30:49): a tenant-wide view
  // is granted ONLY to admin/super_admin. A manager (without an admin hat) is
  // ALWAYS confined to their own subtree below — never the whole tenant.
  const callerRoles = new Set<string>(
    ((profile as { user_roles?: { role: string }[] }).user_roles ?? []).map((r) => r.role),
  )
  if (callerRoles.size === 0 && profile.role) callerRoles.add(profile.role)
  const isTenantWideRole = callerRoles.has("admin") || callerRoles.has("super_admin")
  // A manager hat that is NOT also admin/super_admin → subtree-confined caller.
  const isManagerScoped = !isTenantWideRole && callerRoles.has("manager")

  // Rate limit
  if (analyticsAggregateLimiter) {
    const { success } = await analyticsAggregateLimiter.limit(profile.tenant_id ?? "global")
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const period = searchParams.get("period") ?? "30d"
  const courseId = searchParams.get("courseId")
  const areaId = searchParams.get("areaId")
  const interactionType = searchParams.get("interactionType")

  const VALID_INTERACTION_TYPES = ["socratic_dialogue", "quiz", "scenario", "assignment"]

  if (courseId && !UUID_RE.test(courseId)) {
    return NextResponse.json({ error: "Invalid course ID" }, { status: 400 })
  }
  if (areaId && !UUID_RE.test(areaId)) {
    return NextResponse.json({ error: "Invalid area ID" }, { status: 400 })
  }
  if (interactionType && !VALID_INTERACTION_TYPES.includes(interactionType)) {
    return NextResponse.json({ error: "Invalid interaction type" }, { status: 400 })
  }

  const periodStart = periodToDate(period)

  // Resolve tenant for admin/super_admin with null tenant_id
  let tenantId = profile.tenant_id
  if (!tenantId) {
    const { cookies: getCookies } = await import("next/headers")
    const cookieStore = await getCookies()
    tenantId = cookieStore.get("x-sa-active-tenant")?.value ?? null
  }
  if (!tenantId) {
    return NextResponse.json({ error: "Nenhum tenant ativo" }, { status: 400 })
  }

  // Always use service client — RLS blocks instructors from seeing student data
  const { createServiceClient } = await import("@/lib/supabase/service")
  const db = createServiceClient()

  // --- Fetch sessions (include those without analytics for basic counts) ---
  let sessionsQuery = db
    .from("sessions")
    .select("id, analytics, created_at, student_id, status, turn_number, chapter_id")
    .eq("tenant_id", tenantId)
    .gte("created_at", periodStart.toISOString())

  // Filter by course if needed — include archived duplicates with same title
  if (courseId) {
    // M3: scope the course lookup to the tenant. A courseId from another tenant
    // must resolve to "course not found" rather than silently matching by title
    // across tenants or widening the session filter to the whole tenant.
    const { data: selectedCourse } = await db
      .from("courses")
      .select("title")
      .eq("id", courseId)
      .eq("tenant_id", tenantId)
      .single()
    if (!selectedCourse) {
      // Course does not belong to this tenant — constrain to an impossible
      // chapter so the sessions query returns no rows (no scope widening).
      sessionsQuery = sessionsQuery.eq("chapter_id", "00000000-0000-0000-0000-000000000000")
    } else {
      let courseIdsToInclude = [courseId]
      if (selectedCourse.title) {
        const { data: sameTitleCourses } = await db
          .from("courses")
          .select("id")
          .eq("title", selectedCourse.title)
          .eq("tenant_id", tenantId)
        if (sameTitleCourses) courseIdsToInclude = sameTitleCourses.map((c) => c.id)
      }
      const { data: chapterIds } = await db
        .from("chapters")
        .select("id")
        .in("course_id", courseIdsToInclude)
        .eq("tenant_id", tenantId)
      if (chapterIds && chapterIds.length > 0) {
        sessionsQuery = sessionsQuery.in(
          "chapter_id",
          chapterIds.map((c) => c.id),
        )
      }
    }
  }

  // Filter by area if needed (via course_areas junction table)
  if (areaId) {
    const { data: courseAreaRows } = await db
      .from("course_areas")
      .select("course_id")
      .eq("area_id", areaId)
      .eq("tenant_id", tenantId)
    const areaCourseIds = (courseAreaRows ?? []).map((r) => r.course_id)
    // Fallback: also check courses.area_id for backwards compat
    const { data: legacyCourses } = await db
      .from("courses")
      .select("id")
      .eq("area_id", areaId)
      .eq("tenant_id", tenantId)
    const allCourseIds = [...new Set([...areaCourseIds, ...(legacyCourses ?? []).map((c) => c.id)])]
    const courses = allCourseIds.map((id) => ({ id }))
    if (courses && courses.length > 0) {
      const { data: chapterIds } = await db
        .from("chapters")
        .select("id")
        .eq("tenant_id", tenantId)
        .in(
          "course_id",
          courses.map((c) => c.id),
        )
      if (chapterIds && chapterIds.length > 0) {
        sessionsQuery = sessionsQuery.in(
          "chapter_id",
          chapterIds.map((c) => c.id),
        )
      }
    }
  }

  // Filter by interaction type if needed
  if (interactionType) {
    const { data: typedChapters } = await db
      .from("chapters")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("interaction_type", interactionType)
    if (typedChapters && typedChapters.length > 0) {
      sessionsQuery = sessionsQuery.in(
        "chapter_id",
        typedChapters.map((c) => c.id),
      )
    } else {
      sessionsQuery = sessionsQuery.eq("chapter_id", "00000000-0000-0000-0000-000000000000")
    }
  }

  const { data: sessions, error: sessionsError } = await sessionsQuery
  if (sessionsError) {
    console.error("Failed to fetch sessions:", sessionsError.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }

  if (!sessions || sessions.length === 0) {
    const emptyResponse: AggregateAnalyticsResponse = {
      summary: {
        totalSessions: 0,
        avgDepth: 0,
        avgBreakthroughsPerSession: 0,
        aiDetectionRate: 0,
        deltaDepth: null,
        deltaBreakthroughs: null,
      },
      depthDistribution: DEPTH_LABELS.map((label, i) => ({ level: i + 1, count: 0, label })),
      kolbTeam: [],
      cognitivePatterns: [],
      emotionalJourney: [],
      alerts: [],
      divergenceTable: [],
    }
    return NextResponse.json(emptyResponse)
  }

  // --- Resolve the analytics scope (3 views: unit / área-gestor / individual) ---
  // The view kind is inferred from the query params. `studentId` enables the
  // INDIVIDUAL view; `groupId` the ÁREA/GESTOR view (manager_groups); `areaId`
  // the UNIDADE view (areas). They are mutually exclusive — most specific wins.
  // Resolved BEFORE the summary so every section describes the SAME population.
  const studentIdParam = searchParams.get("studentId")
  const groupIdParam = searchParams.get("groupId")
  // E9 (EPIC-30) — SUBTREE drill-down params.
  const includeSubtreeParam = searchParams.get("includeSubtree") === "true"
  const focusUserIdParam = searchParams.get("focusUserId")
  if (studentIdParam && !UUID_RE.test(studentIdParam)) {
    return NextResponse.json({ error: "Invalid student ID" }, { status: 400 })
  }
  if (groupIdParam && !UUID_RE.test(groupIdParam)) {
    return NextResponse.json({ error: "Invalid group ID" }, { status: 400 })
  }
  if (focusUserIdParam && !UUID_RE.test(focusUserIdParam)) {
    return NextResponse.json({ error: "Invalid focus user ID" }, { status: 400 })
  }
  // Most specific wins (individual → area → subtree → unit → tenant). The subtree
  // view is selected by `includeSubtree=true` and/or a `focusUserId` (drill-down);
  // it is orthogonal to courseId/period (AC10). `focusUserId` absent = the
  // caller's own subtree.
  const wantsSubtree = includeSubtreeParam || Boolean(focusUserIdParam)
  const scope: ResolvableScope = studentIdParam
    ? { kind: "individual", studentId: studentIdParam, courseId }
    : groupIdParam
      ? { kind: "area", groupId: groupIdParam, courseId }
      : wantsSubtree
        ? { kind: "subtree", focusUserId: focusUserIdParam, courseId }
        : areaId
          ? { kind: "unit", areaId, courseId }
          : { kind: "tenant", courseId }

  // Student universe for the scope (null = whole tenant, no IN() restriction).
  //
  // SECURITY (EPIC-30 / E9 — QA "TESTE DE OURO" CHECK 5): for a MANAGER-scoped
  // caller (manager hat WITHOUT admin/super_admin), the universe is ALWAYS the
  // caller's own subtree — it can NEVER be the whole tenant, an arbitrary group,
  // or a unidade outside their reach. The param-inferred `scope` above is for the
  // admin/super_admin path only; a manager requesting tenant/unit/group is
  // fail-closed to their subtree here. The E3 RPCs are wired to `auth.uid()`, so
  // they MUST run on the AUTHENTICATED RLS client (`supabase`), NOT the
  // RLS-bypassing service client (`db`) used for the rest of the route (R1/Pitfall
  // #1). A `focusUserId` drill-down is gated server-side (gate → [] on forge);
  // absent → the whole reachable subtree. The result is ALWAYS a concrete array
  // (fail-closed []), never null — so it never collapses to tenant-wide. Admin /
  // super_admin keep the existing param-inferred resolution via the service client.
  const scopeStudentIds = isManagerScoped
    ? focusUserIdParam
      ? await getSubtreeStudentIdsAtNode(supabase, tenantId, focusUserIdParam)
      : ((await getManagedTeamStudentIds(supabase, tenantId, user.id, {
          includeSubtree: true,
        })) ?? [])
    : await resolveScopeStudentIds(db, tenantId, scope)

  // --- Aggregate summary ---
  // FORM-07: when the scope resolves to a bounded student set (unit/área/
  // individual), restrict the summary to those students so totalSessions, depth,
  // breakthroughs and AI rate describe the SAME population as the scoped sections
  // below — the UNIDADE view no longer mixes "area's courses" with "area's
  // students". A scope resolved-but-empty yields an empty summary, as expected.
  const scopedSessions =
    scopeStudentIds === null
      ? sessions
      : sessions.filter((s) => scopeStudentIds.includes(s.student_id))
  // Filter to sessions with actual analytics data (skip null/empty JSONB)
  const withAnalytics = scopedSessions.filter(
    (s) =>
      s.analytics &&
      typeof s.analytics === "object" &&
      Object.keys(s.analytics as Record<string, unknown>).length > 0,
  )
  const analyticsData = withAnalytics.map((s) => s.analytics as SessionAnalyticsJsonb)
  const totalSessions = scopedSessions.length
  const depths = analyticsData.map((a) => a.depth_reached ?? 0).filter((d) => d > 0)
  const avgDepth = depths.length > 0 ? depths.reduce((a, b) => a + b, 0) / depths.length : 0

  const breakthroughs = analyticsData.map((a) => a.breakthrough_moments ?? 0)
  const totalBreakthroughs = breakthroughs.reduce((a, b) => a + b, 0)
  const avgBreakthroughsPerSession = totalSessions > 0 ? totalBreakthroughs / totalSessions : 0

  const aiLikelyCount = analyticsData.filter((a) => a.ai_detection?.verdict === "likely_ai").length
  // Rate over ANALYZED sessions only — sessions without analytics JSONB have no verdict
  const aiDetectionRate = analyticsData.length > 0 ? aiLikelyCount / analyticsData.length : 0

  // ROOT PRINCIPLE: the per-student multiplier used to scale per-curriculum
  // potentials. For a bounded scope it is |scopeStudentIds|; for the whole-tenant
  // default (null) it is the count of role=student users in the tenant — the
  // population the realized numerators aggregate over.
  let scopeStudentCount: number
  if (scopeStudentIds !== null) {
    scopeStudentCount = scopeStudentIds.length
  } else {
    const { count: tenantStudentCount } = await db
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("role", "student")
    scopeStudentCount = tenantStudentCount ?? 0
  }
  // Chapters in scope (id + interaction_type + title/order), course-aware. When an
  // interactionType filter is active it is propagated so indicators and mode
  // potentials measure the SAME chapter universe as the top-level sessions query
  // (FORM-02 / UI-09).
  const scopeChapters = await resolveScopeChapters(db, tenantId, courseId, areaId, interactionType)

  // --- Engagement rate (item 2.3) ---
  // ((completed sessions + reflections written) × students)
  //   ÷ ((session potential + reflection potential) × students)
  // The × students cancels, so we compare REALIZED interaction against the total
  // INTERACTION POTENTIAL of the curriculum. Denominator uses the DERIVED
  // potentials (FASE 0b): sessionPotential (= chapters, Model A) for socratic/chapter
  // advances, plus reflectionPotential (= reflection-prompt blockquotes), NOT the
  // raw slide count (which massively overestimated). Clamped 0–100.
  let engagementRate = 0
  {
    const { total: potential } = await computeCurriculumPotential(db, tenantId, scopeChapters)

    // FORM-01 / ROOT PRINCIPLE: realized must cover the SAME population as
    // potential. The `sessions` array is NOT yet scope-filtered, so restrict the
    // completed-session count to the scope's student universe (matching
    // reflectionsWritten below).
    const completedSessions =
      scopeStudentIds === null
        ? sessions.filter((s) => s.status === "completed").length
        : sessions.filter((s) => s.status === "completed" && scopeStudentIds.includes(s.student_id))
            .length

    // Reflections written in period, scoped to the in-scope chapters' slides and
    // to the scope's student universe.
    let reflectionsWritten = 0
    const scopeEmpty = scopeStudentIds !== null && scopeStudentIds.length === 0
    if (scopeChapters.length > 0 && !scopeEmpty) {
      // FORM-08: paginate slide ids — large tenants exceed the 1000-row cap.
      const scopedSlides = await fetchAllRows<{ id: string }>((from, to) =>
        db
          .from("chapter_slides")
          .select("id")
          .eq("tenant_id", tenantId)
          .in(
            "chapter_id",
            scopeChapters.map((c) => c.id),
          )
          .range(from, to),
      )
      const slideIdsInScope = scopedSlides.map((s) => s.id)
      if (slideIdsInScope.length > 0) {
        let reflQuery = db
          .from("slide_reflections")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .gte("created_at", periodStart.toISOString())
          .in("slide_id", slideIdsInScope)
        if (scopeStudentIds !== null) reflQuery = reflQuery.in("student_id", scopeStudentIds)
        const { count } = await reflQuery
        reflectionsWritten = count ?? 0
      }
    }

    // UI-02 / FORM-04: per-curriculum potential is multiplied by the number of
    // students in scope so the denominator covers the SAME population as the
    // realized numerators (which aggregate every student). Mirrors area-gestor.ts::
    // computeMetricBlock (students.size * chapterCount). Uses the same
    // `scopeStudentCount` the indicators/modes use for consistency.
    const totalDone = completedSessions + reflectionsWritten
    const totalPotential =
      (potential.sessionPotential + potential.reflectionPotential) * scopeStudentCount
    engagementRate = pct(totalDone, totalPotential)
  }

  // --- Compare with previous period ---
  // FORM-07: scope the previous-period comparison to the same student universe as
  // the (now scope-filtered) current summary so deltaSessions compares like with
  // like instead of scoped-current vs tenant-wide-previous.
  const periodMs = Date.now() - periodStart.getTime()
  const prevStart = new Date(periodStart.getTime() - periodMs)
  let prevSessionsQuery = db
    .from("sessions")
    .select("id, analytics, status, student_id")
    .eq("tenant_id", tenantId)
    .gte("created_at", prevStart.toISOString())
    .lt("created_at", periodStart.toISOString())
  if (scopeStudentIds !== null) {
    prevSessionsQuery =
      scopeStudentIds.length > 0
        ? prevSessionsQuery.in("student_id", scopeStudentIds)
        : prevSessionsQuery.eq("student_id", "00000000-0000-0000-0000-000000000000")
  }
  const { data: prevSessions } = await prevSessionsQuery

  const prevTotal = prevSessions?.length ?? 0
  const prevWithAnalytics = (prevSessions ?? []).filter(
    (s) =>
      s.analytics &&
      typeof s.analytics === "object" &&
      Object.keys(s.analytics as Record<string, unknown>).length > 0,
  )
  const prevDepths = prevWithAnalytics
    .map((s) => Number((s.analytics as Record<string, unknown>).depth_reached ?? 0))
    .filter((d) => d > 0)
  const prevAvgDepth =
    prevDepths.length > 0
      ? prevDepths.reduce((a: number, b: number) => a + b, 0) / prevDepths.length
      : 0

  const deltaSessions =
    prevTotal > 0 ? Math.round(((totalSessions - prevTotal) / prevTotal) * 100) : null
  const deltaDepthCalc = prevAvgDepth > 0 ? Math.round((avgDepth - prevAvgDepth) * 10) / 10 : null

  const summary: AggregateSummary = {
    totalSessions,
    avgDepth: Math.round(avgDepth * 10) / 10,
    avgBreakthroughsPerSession: Math.round(avgBreakthroughsPerSession * 10) / 10,
    aiDetectionRate: Math.round(aiDetectionRate * 1000) / 10,
    engagementRate,
    deltaSessions,
    deltaDepth: deltaDepthCalc,
    deltaBreakthroughs: null,
  }

  // --- Depth distribution ---
  const depthDist = Array(7).fill(0) as number[]
  for (const a of analyticsData) {
    const d = a.depth_reached ?? 0
    if (d >= 1 && d <= 7) depthDist[Math.round(d) - 1]++
  }
  const depthDistribution: DepthDistribution[] = DEPTH_LABELS.map((label, i) => ({
    level: i + 1,
    count: depthDist[i],
    label,
  }))

  // --- Kolb team scatter ---
  const { data: learnerProfiles } = await supabase
    .from("learner_profiles")
    .select("student_id, kolb_grasping_axis, kolb_transforming_axis, kolb_dominant_style")
    .eq("tenant_id", tenantId)
    .not("kolb_grasping_axis", "is", null)

  const studentIds = [...new Set((learnerProfiles ?? []).map((lp) => lp.student_id))]
  const { data: studentUsers } =
    studentIds.length > 0
      ? await supabase.from("users").select("id, full_name").in("id", studentIds)
      : { data: [] }
  const userMap = new Map((studentUsers ?? []).map((u) => [u.id, u.full_name]))

  // The query only guarantees kolb_grasping_axis is non-null; a row can still
  // have a null kolb_transforming_axis. Number(null) === 0 would plot a false
  // point at axis 0, so exclude rows missing the transforming axis (mirrors the
  // `? Number() : null` guard in students/[studentId]/route.ts). KolbPoint
  // requires a numeric transformingAxis, so omitting the point is the safe choice.
  const kolbTeam: KolbPoint[] = (learnerProfiles ?? [])
    .filter((lp) => lp.kolb_transforming_axis !== null && lp.kolb_transforming_axis !== undefined)
    .map((lp) => ({
      studentId: lp.student_id,
      studentName: userMap.get(lp.student_id) ?? "Unknown",
      graspingAxis: Number(lp.kolb_grasping_axis),
      transformingAxis: Number(lp.kolb_transforming_axis),
      dominantStyle: lp.kolb_dominant_style,
    }))

  // --- Cognitive patterns top 5 ---
  const patternCounts = new Map<string, number>()
  for (const a of analyticsData) {
    for (const p of a.cognitive_patterns ?? []) {
      patternCounts.set(p, (patternCounts.get(p) ?? 0) + 1)
    }
  }
  const cognitivePatterns: CognitivePatternCount[] = [...patternCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([pattern, count]) => ({ pattern, count }))

  // --- Emotional journey avg ---
  const allProgressions = analyticsData
    .map((a) => a.emotional_density_progression ?? [])
    .filter((p) => p.length > 0)

  const maxLen = Math.max(0, ...allProgressions.map((p) => p.length))
  const emotionalJourney: EmotionalJourneyPoint[] = []
  for (let i = 0; i < maxLen && i < 20; i++) {
    const values = allProgressions.filter((p) => p.length > i).map((p) => p[i])
    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
    emotionalJourney.push({ step: i + 1, avgDensity: Math.round(avg * 100) / 100 })
  }

  // --- Alerts ---
  const alerts = await generateAlerts(supabase, tenantId, periodStart)

  // --- Divergence table ---
  const divergenceTable = await buildDivergenceTable(supabase, tenantId, learnerProfiles ?? [])

  // --- Item 2.2: % índice de Reflexões Slides + % índice de Interações Socráticas ---
  // Per module (chapter) + course total, scope-aware (unit/área/individual).
  const indicators = await computeIndicators(
    db,
    tenantId,
    periodStart,
    scopeChapters,
    scopeStudentIds,
    scopeStudentCount,
  )

  // --- Item 6: interaction modes as realized ÷ potential (replaces vertical share) ---
  const interactionModePotentials = await computeInteractionModePotentials(
    db,
    tenantId,
    periodStart,
    scopeChapters,
    scopeStudentIds,
    scopeStudentCount,
  )

  // --- Redesign Uso da Plataforma — "O loop que você causou" + "Feed de exceções" ---
  // Both reuse the canonical, already-shipped Engagement Engine logic
  // (student-triage.ts via engagement-triage.ts) instead of inventing a new baseline
  // model — real data or an honest empty state, never a fabricated "normal".
  const [loopStats, exceptionsFeed] = await Promise.all([
    computeLoopStats(db, tenantId, scopeStudentIds, periodStart),
    computeExceptionsFeed(db, tenantId, scopeStudentIds),
  ])

  const response: AggregateAnalyticsResponse = {
    summary,
    depthDistribution,
    kolbTeam,
    cognitivePatterns,
    emotionalJourney,
    alerts,
    divergenceTable,
    indicators,
    interactionModePotentials,
    loopStats,
    exceptionsFeed,
  }

  return NextResponse.json(response)
}

// --- Redesign Uso da Plataforma: loop + exceptions feed ---

/**
 * "O loop que você causou" — quantos ALUNOS DISTINTOS foram acionados por nudge
 * no período/escopo do chamador, e quantos desses alunos voltaram a estudar
 * depois. Lê `notifications` diretamente (em vez de `nudgeEfficacyByType`,
 * que agrega por template para o dashboard de eficácia e cuja unidade —
 * notificações enviadas — não é a mesma do card, "alunos acionados"; um aluno
 * com 2+ nudges no período não pode contar 2x). `sent_at >= periodStart`
 * respeita o período selecionado (7/30/90 dias), igual às demais seções da
 * rota. Sem sends no escopo/período → acionados=0, a UI trata isso como
 * estado vazio honesto, nunca inventa um número.
 */
async function computeLoopStats(
  db: ServiceClient,
  tenantId: string,
  allowedStudentIds: string[] | null,
  periodStart: Date,
): Promise<LoopStats> {
  const empty: LoopStats = { acionados: 0, voltaram: 0, returnRatePct: 0 }
  // Fail-closed: caller scoped to zero reachable students.
  if (allowedStudentIds !== null && allowedStudentIds.length === 0) return empty

  // Chunk the recipient filter so a large scope never blows the URL length cap
  // (mirrors nudgeEfficacyByType's RECIPIENT_CHUNK pattern).
  const RECIPIENT_CHUNK = 200
  const scopeChunks: (string[] | null)[] =
    allowedStudentIds == null
      ? [null]
      : Array.from({ length: Math.ceil(allowedStudentIds.length / RECIPIENT_CHUNK) }, (_, i) =>
          allowedStudentIds.slice(i * RECIPIENT_CHUNK, (i + 1) * RECIPIENT_CHUNK),
        )

  const rows: Array<{ recipient_id: string; returned_at: string | null }> = []
  for (const chunk of scopeChunks) {
    const chunkRows = await fetchAllRows<{ recipient_id: string; returned_at: string | null }>(
      (from, to) => {
        let q = db
          .from("notifications")
          .select("recipient_id, returned_at")
          .eq("tenant_id", tenantId)
          .eq("origin", "nudge")
          .eq("channel", "inapp")
          .not("sent_at", "is", null)
          .gte("sent_at", periodStart.toISOString())
        if (chunk != null) q = q.in("recipient_id", chunk)
        return q.range(from, to)
      },
    )
    rows.push(...chunkRows)
  }
  return aggregateLoopStats(rows)
}

const EXCEPTION_SEVERITY_ORDER: Record<string, number> = { atencao: 0, sem_acesso: 1 }
const EXCEPTION_REASON: Record<string, string> = {
  atencao: "Atrasado no cronograma ou nunca começou",
  sem_acesso: "Mais de 14 dias sem acessar a plataforma",
}

/**
 * "Feed de exceções" — reusa a triagem canônica (student-triage.ts via
 * engagement-triage.ts), a MESMA taxonomia do módulo Engagement (semáforo), em
 * vez de inventar um modelo de baseline estatístico novo. Prioriza "atencao"
 * (atrasado/nunca começou) sobre "sem_acesso" (sumido mas em dia), espelhando
 * a hierarquia de gravidade já decidida para o semáforo.
 */
async function computeExceptionsFeed(
  db: ServiceClient,
  tenantId: string,
  allowedStudentIds: string[] | null,
): Promise<ExceptionFeedItem[]> {
  const { triagemByStudent } = await computeEngagementTriage(
    db,
    tenantId,
    allowedStudentIds,
    Date.now(),
  )
  const exceptionIds = [...triagemByStudent.entries()]
    .filter(([, t]) => t !== "no_ritmo")
    .map(([id]) => id)
  if (exceptionIds.length === 0) return []

  const { data: exceptionUsers } = await db
    .from("users")
    .select("id, full_name")
    .eq("tenant_id", tenantId)
    .in("id", exceptionIds)
  const nameById = new Map(
    ((exceptionUsers ?? []) as Array<{ id: string; full_name: string }>).map((u) => [
      u.id,
      u.full_name,
    ]),
  )

  return exceptionIds
    .map((id) => {
      const severity = triagemByStudent.get(id) as "atencao" | "sem_acesso"
      return {
        studentId: id,
        studentName: nameById.get(id) ?? "Aluno",
        severity,
        reason: EXCEPTION_REASON[severity],
      }
    })
    .sort(
      (a, b) =>
        (EXCEPTION_SEVERITY_ORDER[a.severity] ?? 2) - (EXCEPTION_SEVERITY_ORDER[b.severity] ?? 2),
    )
    .slice(0, 10)
}

// --- Alert Generation ---

async function generateAlerts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  periodStart: Date,
): Promise<AnalyticsAlert[]> {
  const alerts: AnalyticsAlert[] = []

  // Get all students in tenant with their sessions
  const { data: students } = await supabase
    .from("users")
    .select("id, full_name")
    .eq("tenant_id", tenantId)
    .eq("role", "student")

  if (!students || students.length === 0) return alerts

  // FORM-08 (B2): paginate — a tenant's sessions in the period can exceed the
  // 1000-row PostgREST cap. A truncated set silently drops a student's recent
  // sessions, marking active students as inactive (false "critico" alert).
  type AlertSession = {
    id: string
    student_id: string
    analytics: SessionAnalyticsJsonb | null
    created_at: string
    status: string | null
  }
  const allSessions = await fetchAllRows<AlertSession>((from, to) =>
    supabase
      .from("sessions")
      .select("id, student_id, analytics, created_at, status")
      .eq("tenant_id", tenantId)
      .gte("created_at", periodStart.toISOString())
      .order("created_at", { ascending: false })
      .range(from, to),
  )

  const sessionsByStudent = new Map<string, AlertSession[]>()
  for (const s of allSessions) {
    const existing = sessionsByStudent.get(s.student_id) ?? []
    existing.push(s)
    sessionsByStudent.set(s.student_id, existing)
  }

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

  for (const student of students) {
    const studentSessions = sessionsByStudent.get(student.id) ?? []

    // Inactivity > 14d
    if (studentSessions.length === 0 || new Date(studentSessions[0].created_at) < fourteenDaysAgo) {
      alerts.push({
        severity: "critico",
        type: "inactivity",
        studentId: student.id,
        studentName: student.full_name,
        message: "0 sessoes nos ultimos 14 dias",
      })
    }

    // AI detection: 2+ consecutive likely_ai
    const recentAnalytics = studentSessions
      .slice(0, 5)
      .map((s) => s.analytics as SessionAnalyticsJsonb | null)
    let consecutiveAi = 0
    for (const a of recentAnalytics) {
      if (a?.ai_detection?.verdict === "likely_ai") {
        consecutiveAi++
      } else {
        break
      }
    }
    if (consecutiveAi >= 2) {
      alerts.push({
        severity: "critico",
        type: "likely_ai",
        studentId: student.id,
        studentName: student.full_name,
        message: `${consecutiveAi}x likely_ai consecutivo`,
      })
    }

    // Depth declining: 3 sessions with decreasing trend
    if (studentSessions.length >= 3) {
      const depths = studentSessions
        .slice(0, 3)
        .map((s) => (s.analytics as SessionAnalyticsJsonb)?.depth_reached ?? 0)
      if (depths[0] < depths[1] && depths[1] < depths[2] && depths[2] > 0) {
        alerts.push({
          severity: "atencao",
          type: "depth_declining",
          studentId: student.id,
          studentName: student.full_name,
          message: `Profundidade caindo: ${depths[2]} → ${depths[1]} → ${depths[0]}`,
        })
      }
    }

    // Breakthrough streak: 2+ breakthroughs in 3 consecutive sessions
    if (studentSessions.length >= 3) {
      const breakthroughs = studentSessions
        .slice(0, 3)
        .map((s) => (s.analytics as SessionAnalyticsJsonb)?.breakthrough_moments ?? 0)
      const totalBreak = breakthroughs.reduce((a, b) => a + b, 0)
      if (totalBreak >= 2) {
        alerts.push({
          severity: "positivo",
          type: "breakthrough_streak",
          studentId: student.id,
          studentName: student.full_name,
          message: `${totalBreak} breakthroughs nas ultimas 3 sessoes`,
        })
      }
    }
  }

  // Sort: critico first, then atencao, then positivo
  const severityOrder: Record<string, number> = { critico: 0, atencao: 1, positivo: 2 }
  alerts.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3))

  return alerts.slice(0, 20)
}

// --- Divergence Table ---

async function buildDivergenceTable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  learnerProfiles: Array<{
    student_id: string
    kolb_grasping_axis: string | null
    kolb_transforming_axis: string | null
    kolb_dominant_style: string | null
  }>,
): Promise<DivergenceRow[]> {
  if (learnerProfiles.length === 0) return []

  const studentIds = learnerProfiles.map((lp) => lp.student_id)
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, profile")
    .in("id", studentIds)

  if (!users) return []

  const rows: DivergenceRow[] = []
  for (const lp of learnerProfiles) {
    const user = users.find((u) => u.id === lp.student_id)
    if (!user) continue

    const userProfile = user.profile as Record<string, unknown> | null
    const testKolb = (userProfile?.learning_style as string) ?? null

    rows.push({
      studentId: lp.student_id,
      studentName: user.full_name,
      kolbTestStyle: testKolb,
      kolbAiStyle: lp.kolb_dominant_style,
      kolbDivergence:
        testKolb && lp.kolb_dominant_style && testKolb !== lp.kolb_dominant_style ? 1 : 0,
    })
  }

  return rows.sort((a, b) => (b.kolbDivergence ?? 0) - (a.kolbDivergence ?? 0))
}
