import { getStudentDetails } from "@/app/(platform)/instructor/actions"
import { ManagerDashboard } from "@/components/dashboard/manager-dashboard"
import { TeachingPlanHighlights } from "@/components/dashboard/teaching-plan-highlights"
import {
  getActiveAreaId,
  getAreaStudentIds,
  getDirectTeamStudentIds,
  getManagedTeamStudentIds,
  getStudentSubteamMap,
  getSubtreeStudentIdsAtNode,
} from "@/lib/area-context"
import {
  type PaceHighlightEntry,
  type StudentPace,
  computeStudentRitmo,
  computeStudentTriagem,
  computeTriageSummary,
  partitionHighlights,
} from "@/lib/student-triage"
import type { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { type TeamViewMode, getTeamViewMode } from "@/lib/team-view-context"

interface ManagerDashboardPageProps {
  supabase: Awaited<ReturnType<typeof createClient>>
  tenantId: string
  /** The authenticated manager's user id (= owner of the team(s) to scope to). */
  managerId: string
  fullName: string
  /**
   * E9 drill-down: a node inside the manager's subtree to focus the analytics on.
   * `null`/undefined => the manager's own root. When set, and `teamViewMode` is
   * "hierarchy", the student universe is resolved via {@link getSubtreeStudentIdsAtNode},
   * which gates `node ∈ auth_subtree_user_ids()` BEFORE drilling — a forged/
   * out-of-scope node collapses to `[]` (zeroed payload), never tenant-wide. This
   * only changes the SLICE shown; it never widens what the manager may read (RLS
   * is the trava).
   */
  focusUserId?: string | null
  /**
   * Diretos / Hierarquia switch (team context). "direct" (default) = only
   * the focused node's direct students ({@link getDirectTeamStudentIds});
   * "hierarchy" = the focused node's whole reachable subtree (previous
   * "global" behaviour, renamed). Not passed by callers outside the team
   * context, in which case it is read from the cookie (defensive default for
   * any stray caller).
   */
  teamViewMode?: TeamViewMode
  /**
   * "Meu Time" team-scope panel (drill-down breadcrumb + Diretos/Hierarquia
   * switch + engagement buckets), forwarded as a slot to
   * <ManagerDashboard> so it renders right after the "Olá, {nome}" hero
   * instead of before it. Only passed by {@link ManagerTeamDashboardPage}.
   */
  teamRecortePanel?: React.ReactNode
}

export async function ManagerDashboardPage({
  supabase,
  tenantId,
  managerId,
  fullName,
  focusUserId,
  teamViewMode,
  teamRecortePanel,
}: ManagerDashboardPageProps) {
  // Resolve active area for unit-scoped filtering (UNIDADE — by course/area_id)
  const activeAreaId = await getActiveAreaId()
  const resolvedTeamViewMode = teamViewMode ?? (await getTeamViewMode())

  // TEAM scope (ÁREA/GESTOR — by student_id): E9 SUBTREE wiring (gap E9). A
  // manager sees the WHOLE reachable subtree (reports_to ∪ descendant
  // manager_group members), not just the explicit members of the team(s) they
  // happen to OWN — that was the fiação bug where a superior manager (Rafael/
  // Sara/Bia) saw 0 on screen while `/api/analytics/manager?includeSubtree=true`
  // already returned the correct 8/6/3. `includeSubtree:true` resolves the set
  // via the E3 SQL function `auth_reachable_student_ids()`, which is hard-wired
  // to `auth.uid()`; `supabase` here is the AUTHENTICATED RLS client of the
  // manager (managerId === user.id from the dashboard router), so the anchor is
  // correct. This does NOT widen permission (RLS is the trava) — it only makes
  // the SCREEN reflect what the manager may already read.
  // Security normalization (EPIC §S2, AC4/AC6): for a manager, ANY non-list
  // result (null = "no scope" / RPC error) MUST collapse to an EMPTY scope —
  // never tenant-wide. `[]` (subtree with no students) stays empty.
  //
  // E9 DRILL-DOWN + DIRETOS/HIERARQUIA: `focusUserId` picks WHICH node is
  // in play (defaults to the manager's own root); `resolvedTeamViewMode` picks
  // direct-vs-subtree AT that node:
  //   • "hierarchy" → the node's WHOLE reachable subtree. With a focus, that is
  //     the GATED subtree (getSubtreeStudentIdsAtNode runs the
  //     `node ∈ auth_subtree_user_ids()` gate before subtree_student_ids; a
  //     forged node yields []). Without a focus, it is the manager's whole
  //     reachable subtree (UNION ALWAYS via auth_reachable_student_ids).
  //   • "direct" (default) → only the node's DIRECT students
  //     (getDirectTeamStudentIds — reports_to ∪ owned manager_group members,
  //     no subtree flattening). `focusUserId` here is already the RESOLVED,
  //     gated node from the caller (manager-team-dashboard-page's `nav`), so
  //     no additional gating is needed before calling the direct-only helper.
  // All paths use the AUTHENTICATED RLS client (`supabase`), so auth.uid()
  // anchors correctly. The switch only changes the SLICE — RLS still bounds reach.
  const teamStudentIds =
    resolvedTeamViewMode === "hierarchy"
      ? focusUserId
        ? await getSubtreeStudentIdsAtNode(supabase, tenantId, focusUserId)
        : await getManagedTeamStudentIds(supabase, tenantId, managerId, {
            includeSubtree: true,
          })
      : await getDirectTeamStudentIds(supabase, tenantId, focusUserId ?? managerId)
  const teamScope: string[] = teamStudentIds ?? []
  const teamSet = new Set(teamScope)
  const showSubteam = resolvedTeamViewMode === "hierarchy"
  const studentSubteamMapPromise = showSubteam
    ? getStudentSubteamMap(supabase, tenantId, managerId)
    : Promise.resolve(
        new Map<
          string,
          { subteamId: string; subteamName: string; colorIndex: number; path: string[] }
        >(),
      )

  // Parallelize independent queries (FIX-17 + FIX-16)
  const periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const [
    { data: tenant, error: mgrTenantError },
    analytics,
    { data: allCourses },
    { data: socraticSessions },
    rawStudentDetails,
    studentSubteamMap,
  ] = await Promise.all([
    supabase.from("tenants").select("settings").eq("id", tenantId).maybeSingle(),
    fetchManagerAnalytics(supabase, tenantId, activeAreaId, teamScope),
    supabase.from("courses").select("id, title").eq("tenant_id", tenantId),
    supabase
      .from("sessions")
      .select("analytics")
      .eq("tenant_id", tenantId)
      .not("analytics", "is", null)
      .gte("created_at", periodStart.toISOString())
      .in("student_id", teamScope.length > 0 ? teamScope : ["__none__"]),
    // TEAM-SCOPED roster (Iteração 3, 2026-07-03): pass the RPC-resolved team
    // scope so the "Detalhes dos Alunos" table is the team universe resolved by
    // the STUDENT HAT (user_roles), not the singular users.role column. Without
    // this, a multi-hat member (e.g. Caio, users.role='manager' + student hat)
    // was dropped from the roster before the teamSet post-filter could include
    // him. Passing [] here yields an empty roster (fail-closed), matching the
    // "manager with no team → no data" floor used elsewhere on this page.
    getStudentDetails(tenantId, activeAreaId, { restrictToStudentIds: teamScope }),
    studentSubteamMapPromise,
  ])
  if (mgrTenantError) console.error("Failed to fetch tenant settings:", mgrTenantError.message)
  const aiDetectionEnabled = isFeatureEnabled(tenant?.settings, "ai_detection")

  // Post-filter student details by TEAM membership. As of Iteração 3 the roster
  // is ALREADY team-scoped inside getStudentDetails (restrictToStudentIds =
  // teamScope, resolved by the student hat), so this filter is now a redundant
  // defence-in-depth pass, not the primary trava. Kept so any future widening of
  // getStudentDetails can never leak a non-team student onto this page.
  const studentDetails = rawStudentDetails
    .filter((s) => teamSet.has(s.id))
    .map((student) => {
      // LGPD: the manager dashboard NEVER surfaces raw student content (session
      // interactions, reflection text). Strip the verbatim text SERVER-SIDE so it
      // never reaches the client payload, not just the UI (the manager table is
      // rendered with expandable={false}). Only instructor/admin see content, on
      // their own surfaces. Counts/metrics (reflectionsCount, totalMessages) stay.
      const safe = { ...student, recentSessions: [], recentReflections: [] }
      if (!showSubteam) return safe
      const subteam = studentSubteamMap.get(student.id)
      if (!subteam) return safe
      return {
        ...safe,
        subteam: {
          id: subteam.subteamId,
          name: subteam.subteamName,
          colorIndex: subteam.colorIndex,
          path: subteam.path,
        },
      }
    })

  // Only surface the TIME (subteam) column when there is real differentiation,
  // i.e. at least one student belongs to a subteam. A leaf manager (all students
  // report directly, like Caio) would otherwise show a whole column of "Direto"
  // that informs nothing, so hide it.
  const showSubteamColumn = showSubteam && studentSubteamMap.size > 0

  // Teaching Plan highlights follow the SAME scope as the rest of the view: the
  // Diretos/Hierarquia toggle. In "direct", the manager's (or focused node's)
  // DIRECT members are considered — including multi-hat gestor+aluno directs
  // (e.g. Rinaldo's directs Artur/Venilton, who lead teams AND are enrolled).
  // This is exactly `teamScope`, already resolved above for the active mode.
  const highlightScope: string[] = teamScope

  // Teaching Plan: compute pace status for active enrollments with deadlines.
  //
  // RLS NOTE (why service client): the enrollment/course reads below run on the
  // SERVICE client, NOT the manager's RLS client. `highlightScope` is ALREADY the
  // authorized set — it comes from the SECURITY DEFINER RPCs (getDirectTeamStudentIds
  // / getManagedTeamStudentIds / getSubtreeStudentIdsAtNode), each gated to the
  // caller's reach. Reading enrollments for exactly those ids via service is the
  // same trava pattern as getStudentDetails(restrictToStudentIds). The RLS client
  // could NOT see a multi-hat DIRECT report's OWN enrollment (the enrollments RLS
  // scopes to reachable *leaf* students; a reports_to direct who leads a team is
  // invisible to it — the same gap engagement-helpers works around via RPC), which
  // is why "Diretos" collapsed to an empty panel for Rinaldo.
  const serviceClient = createServiceClient()
  const areaStudentIds = await getAreaStudentIds(supabase, tenantId, activeAreaId)
  const { data: deadlineCourses } = await serviceClient
    .from("courses")
    .select("id, title, deadline_days")
    .eq("tenant_id", tenantId)
    .not("deadline_days", "is", null)

  const paceHighlights: PaceHighlightEntry[] = []
  // S7 (Onda 2): pior status de pace por aluno (behind > on_track > ahead),
  // alimentado no MESMO loop abaixo. Consumido por computeStudentRitmo.
  const paceByStudent = new Map<string, StudentPace>()
  const paceRank: Record<StudentPace, number> = { ahead: 0, on_track: 1, behind: 2 }

  if (deadlineCourses && deadlineCourses.length > 0) {
    const courseIds = deadlineCourses.map((c) => c.id)
    let activeEnrollmentsQuery = serviceClient
      .from("enrollments")
      .select("student_id, course_id, progress, created_at, users!inner(full_name)")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .in("course_id", courseIds)
      // TEAM scope: only this manager's team members.
      .in("student_id", highlightScope.length > 0 ? highlightScope : ["__none__"])
    if (areaStudentIds) {
      // UNIDADE scope: intersect with the active unit's student universe.
      activeEnrollmentsQuery = activeEnrollmentsQuery.in("student_id", areaStudentIds)
    }
    const { data: activeEnrollments } = await activeEnrollmentsQuery

    const now = Date.now()
    const deadlineMap = new Map(
      deadlineCourses.map((c) => [c.id, { title: c.title, days: c.deadline_days as number }]),
    )

    for (const e of activeEnrollments ?? []) {
      const courseInfo = deadlineMap.get(e.course_id)
      if (!courseInfo) continue
      const enrolled = new Date(e.created_at).getTime()
      const deadlineMs = enrolled + courseInfo.days * 86400000
      const elapsed = Math.max(0, (now - enrolled) / 86400000)
      const expectedPct = Math.min(100, Math.round((elapsed / courseInfo.days) * 100))
      const pct = (e.progress as { percentage?: number } | null)?.percentage ?? 0
      const daysLeft = Math.max(0, Math.ceil((deadlineMs - now) / 86400000))
      const daysAhead = Math.round(((pct - expectedPct) / 100) * courseInfo.days)
      const studentName = (e.users as { full_name?: string } | null)?.full_name ?? "—"
      const status = pct >= expectedPct ? (pct > expectedPct + 10 ? "ahead" : "on_track") : "behind"

      paceHighlights.push({
        studentId: e.student_id,
        studentName,
        courseTitle: courseInfo.title,
        status,
        progressPct: pct,
        daysLeft,
        daysAhead,
      })

      const prevPace = paceByStudent.get(e.student_id)
      if (!prevPace || paceRank[status] > paceRank[prevPace])
        paceByStudent.set(e.student_id, status)
    }
    // Sort: behind first, then ahead
    paceHighlights.sort((a, b) => {
      if (a.status === "behind" && b.status !== "behind") return -1
      if (a.status !== "behind" && b.status === "behind") return 1
      return b.daysAhead - a.daysAhead
    })
  }

  // Compute socratic KPIs from sessions with analytics
  type SocraticAnalytics = { depth_reached?: number; breakthrough_moments?: number }
  const socraticData = (socraticSessions ?? []).map((s) => s.analytics as SocraticAnalytics)
  const depths = socraticData.map((a) => a.depth_reached ?? 0).filter((d) => d > 0)
  const avgDepth =
    depths.length > 0
      ? Math.round((depths.reduce((a, b) => a + b, 0) / depths.length) * 10) / 10
      : 0
  const totalBreakthroughs = socraticData.reduce((sum, a) => sum + (a.breakthrough_moments ?? 0), 0)

  // S7 (Onda 2): enriquece cada row com a taxonomia canônica (ritmo/triagem) e
  // computa o sumário dos 4 cards. O universo segue o RECORTE ativo (teamScope
  // já resolvido acima), não o filtro fino `?teams=` (E5/E10 da spec S7).
  // triageSummary só é passado na visão Meu Time (teamRecortePanel presente).
  const triagedStudentDetails = studentDetails.map((s) => {
    const ritmo = computeStudentRitmo(s, paceByStudent)
    return { ...s, ritmo, triagem: computeStudentTriagem(s, ritmo) }
  })
  const triageSummary = teamRecortePanel
    ? computeTriageSummary(triagedStudentDetails.map((s) => s.triagem))
    : undefined

  // S8/S12-fix (Onda 2): partição EXCLUSIVA dos destaques, POR ALUNO (nenhum
  // aluno em 2 colunas, triagem sem_acesso tem precedência sobre o pace, e
  // concluídos sem enrollment ativo ganham entry sintética na coluna 1).
  // Nenhuma query nova, só redistribui as rows já escopadas/enriquecidas.
  const { paceHighlights: partitionedPaceHighlights, noAccess: noAccessHighlights } =
    partitionHighlights(paceHighlights, triagedStudentDetails)

  return (
    <ManagerDashboard
      fullName={fullName}
      data={analytics}
      aiDetectionEnabled={aiDetectionEnabled}
      courses={(allCourses ?? []).map((c) => ({ id: c.id, title: c.title }))}
      socraticKpis={{ avgDepth, totalBreakthroughs }}
      studentDetails={triagedStudentDetails}
      triageSummary={triageSummary}
      showSubteam={showSubteamColumn}
      teamRecortePanel={teamRecortePanel}
      teachingPlanHighlights={
        partitionedPaceHighlights.length > 0 || teamRecortePanel ? (
          <TeachingPlanHighlights
            highlights={partitionedPaceHighlights}
            showEmptyState={!!teamRecortePanel}
            noAccess={teamRecortePanel ? noAccessHighlights : undefined}
          />
        ) : undefined
      }
      teamViewMode={resolvedTeamViewMode}
      focusUserId={focusUserId}
    />
  )
}

// Server-side data fetching for manager analytics (RSC pattern)
// PERF: Batch all course-table queries — fetch ALL enrollments, chapters,
// sessions, and analyses in ONE query each, then aggregate in JS.
async function fetchManagerAnalytics(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  areaId: string | null | undefined,
  // TEAM scope (ÁREA/GESTOR): the explicit set of student ids this manager may
  // see. ALWAYS a concrete list — the caller already collapsed null ⇒ [] for
  // managers (AC4/AC6). An empty list means "no students" → zeroed metrics.
  teamStudentIds: string[],
) {
  const emptyAnalytics = {
    summary: { activeStudents: 0, engagementRate: 0, completionRate: 0, sessionsThisMonth: 0 },
    engagementChart: [] as Array<{ week: string; sessions: number }>,
    courseTable: [] as Array<{
      courseId: string
      title: string
      studentCount: number
      completionRate: number
      avgReflectionDepth: number
      avgAiDetection: number
    }>,
  }

  try {
    // Manager with no team members → no data (NEVER tenant-wide). This is the
    // security floor of S2: ausência de escopo ⇒ sem dados.
    if (teamStudentIds.length === 0) return emptyAnalytics

    const { subDays, subWeeks, startOfISOWeek, formatISO } = await import("date-fns")

    const monthStart = subDays(new Date(), 30).toISOString()

    // When an area is active, restrict all metrics to courses in that area
    let areaCourseIds: string[] | null = null
    if (areaId) {
      const { data: areaCourses } = await supabase
        .from("courses")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("area_id", areaId)
      areaCourseIds = (areaCourses ?? []).map((c) => c.id)
      if (areaCourseIds.length === 0) {
        // No courses in this area — return empty analytics
        return {
          summary: {
            activeStudents: 0,
            engagementRate: 0,
            completionRate: 0,
            sessionsThisMonth: 0,
          },
          engagementChart: [],
          courseTable: [],
        }
      }
    }

    // Helper: build an enrollment query with optional area-scoped course filter
    function applyAreaFilter<T extends { in: (col: string, vals: string[]) => T }>(query: T): T {
      if (areaCourseIds) {
        return query.in("course_id", areaCourseIds)
      }
      return query
    }

    // Active students
    let activeStudentQuery = supabase
      .from("sessions")
      .select("student_id")
      .eq("tenant_id", tenantId)
      .eq("status", "completed")
      .gte("updated_at", monthStart)
      .in("student_id", teamStudentIds)
    if (areaCourseIds) {
      // sessions link to courses via chapters; filter by chapter_id from area courses
      const { data: areaChapters } = await supabase
        .from("chapters")
        .select("id")
        .in("course_id", areaCourseIds)
      const areaChapterIds = (areaChapters ?? []).map((ch) => ch.id)
      if (areaChapterIds.length > 0) {
        activeStudentQuery = activeStudentQuery.in("chapter_id", areaChapterIds)
      } else {
        activeStudentQuery = activeStudentQuery.in("chapter_id", ["__none__"])
      }
    }
    const { data: activeStudentRows } = await activeStudentQuery

    const activeStudents = new Set(activeStudentRows?.map((r) => r.student_id)).size

    // Total enrolled
    let totalEnrolledQuery = supabase
      .from("enrollments")
      .select("student_id")
      .eq("tenant_id", tenantId)
      .in("status", ["active", "completed"])
      .in("student_id", teamStudentIds)
    totalEnrolledQuery = applyAreaFilter(totalEnrolledQuery)
    const { data: totalEnrolledRows } = await totalEnrolledQuery

    const totalEnrolled = new Set(totalEnrolledRows?.map((e) => e.student_id)).size
    const engagementRate =
      totalEnrolled > 0 ? Math.round((activeStudents / totalEnrolled) * 100) : 0

    // Completion rate
    let completedQuery = supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "completed")
      .in("student_id", teamStudentIds)
    completedQuery = applyAreaFilter(completedQuery)
    const { count: completedEnrollments } = await completedQuery

    let totalQuery = supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("status", ["active", "completed"])
      .in("student_id", teamStudentIds)
    totalQuery = applyAreaFilter(totalQuery)
    const { count: totalEnrollments } = await totalQuery

    const completionRate =
      (totalEnrollments ?? 0) > 0
        ? Math.round(((completedEnrollments ?? 0) / (totalEnrollments ?? 1)) * 100)
        : 0

    // Sessions this month
    let sessionsMonthQuery = supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "completed")
      .gte("updated_at", monthStart)
      .in("student_id", teamStudentIds)
    if (areaCourseIds) {
      const { data: areaChapters2 } = await supabase
        .from("chapters")
        .select("id")
        .in("course_id", areaCourseIds)
      const areaChapterIds2 = (areaChapters2 ?? []).map((ch) => ch.id)
      if (areaChapterIds2.length > 0) {
        sessionsMonthQuery = sessionsMonthQuery.in("chapter_id", areaChapterIds2)
      } else {
        sessionsMonthQuery = sessionsMonthQuery.in("chapter_id", ["__none__"])
      }
    }
    const { count: sessionsThisMonth } = await sessionsMonthQuery

    // Engagement chart: sessions per week, last 12 weeks
    const chartStart = subWeeks(new Date(), 12).toISOString()
    let chartQuery = supabase
      .from("sessions")
      .select("updated_at")
      .eq("tenant_id", tenantId)
      .eq("status", "completed")
      .gte("updated_at", chartStart)
      .in("student_id", teamStudentIds)
    if (areaCourseIds) {
      const { data: areaChapters3 } = await supabase
        .from("chapters")
        .select("id")
        .in("course_id", areaCourseIds)
      const areaChapterIds3 = (areaChapters3 ?? []).map((ch) => ch.id)
      if (areaChapterIds3.length > 0) {
        chartQuery = chartQuery.in("chapter_id", areaChapterIds3)
      } else {
        chartQuery = chartQuery.in("chapter_id", ["__none__"])
      }
    }
    const { data: chartSessions } = await chartQuery

    const weekMap = new Map<string, number>()
    for (const session of chartSessions ?? []) {
      if (!session.updated_at) continue
      const weekKey = formatISO(startOfISOWeek(new Date(session.updated_at)), {
        representation: "date",
      })
      weekMap.set(weekKey, (weekMap.get(weekKey) ?? 0) + 1)
    }

    const engagementChart = Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, sessions]) => ({ week, sessions }))

    // Batch all course-table queries
    let coursesQuery = supabase
      .from("courses")
      .select("id, title")
      .eq("tenant_id", tenantId)
      .limit(50)
    if (areaId) {
      coursesQuery = coursesQuery.eq("area_id", areaId)
    }
    const { data: allCourses } = await coursesQuery

    const courseList = allCourses ?? []
    const courseIds = courseList.map((c) => c.id)

    // Early return if no courses — skip batch queries entirely
    if (courseIds.length === 0) {
      return {
        summary: {
          activeStudents,
          engagementRate,
          completionRate,
          sessionsThisMonth: sessionsThisMonth ?? 0,
        },
        engagementChart,
        courseTable: [],
      }
    }

    // Batch: all enrollments, chapters for all courses in parallel.
    // TEAM scope on enrollments → courseTable studentCount/completionRate count
    // only this manager's team members.
    const [{ data: allEnrollmentRows }, { data: allChapterRows }] = await Promise.all([
      supabase
        .from("enrollments")
        .select("course_id, student_id, status")
        .in("course_id", courseIds)
        .in("status", ["active", "completed"])
        .in("student_id", teamStudentIds),
      supabase.from("chapters").select("id, course_id").in("course_id", courseIds),
    ])

    const allEnrollments = allEnrollmentRows ?? []
    const allChapters = allChapterRows ?? []

    // Build chapter-to-course map and collect all chapter IDs
    const chapterIdToCourse = new Map<string, string>()
    for (const ch of allChapters) {
      chapterIdToCourse.set(ch.id, ch.course_id)
    }
    const allChapterIds = allChapters.map((ch) => ch.id)

    // Batch: all sessions for all chapters, then all analyses for those sessions.
    // TEAM-scoped so per-course depth/AI-detection averages reflect only this
    // manager's team members.
    const { data: allSessionRows } =
      allChapterIds.length > 0
        ? await supabase
            .from("sessions")
            .select("id, chapter_id")
            .in("chapter_id", allChapterIds)
            .in("student_id", teamStudentIds)
        : { data: [] as Array<{ id: string; chapter_id: string }> }

    const allSessions = allSessionRows ?? []
    const allSessionIds = allSessions.map((s) => s.id)

    const { data: allAnalysisRows } =
      allSessionIds.length > 0
        ? await supabase
            .from("analyses")
            .select("session_id, metrics, ai_detection")
            .in("session_id", allSessionIds)
        : { data: [] as Array<{ session_id: string; metrics: unknown; ai_detection: unknown }> }

    const allAnalyses = allAnalysisRows ?? []

    // Build lookup maps for JS-side aggregation
    // Enrollments grouped by course_id
    const enrollmentsByCourse = new Map<string, Array<{ student_id: string; status: string }>>()
    for (const e of allEnrollments) {
      const list = enrollmentsByCourse.get(e.course_id) ?? []
      list.push({ student_id: e.student_id, status: e.status })
      enrollmentsByCourse.set(e.course_id, list)
    }

    // Sessions grouped by course_id (via chapter mapping)
    const sessionIdToCourse = new Map<string, string>()
    for (const s of allSessions) {
      const courseId = chapterIdToCourse.get(s.chapter_id)
      if (courseId) sessionIdToCourse.set(s.id, courseId)
    }

    // Analyses grouped by course_id (via session -> chapter -> course mapping)
    const analysesByCourse = new Map<string, Array<{ metrics: unknown; ai_detection: unknown }>>()
    for (const a of allAnalyses) {
      const courseId = sessionIdToCourse.get(a.session_id)
      if (courseId) {
        const list = analysesByCourse.get(courseId) ?? []
        list.push({ metrics: a.metrics, ai_detection: a.ai_detection })
        analysesByCourse.set(courseId, list)
      }
    }

    // Aggregate per-course metrics in JS (no more N+1)
    const courseTable = courseList.map((course) => {
      const courseEnrollments = enrollmentsByCourse.get(course.id) ?? []
      const studentCount = new Set(courseEnrollments.map((e) => e.student_id)).size
      const courseCompleted = courseEnrollments.filter((e) => e.status === "completed").length
      const courseTotal = courseEnrollments.length
      const courseCompletionRate =
        courseTotal > 0 ? Math.round((courseCompleted / courseTotal) * 100) : 0

      const courseAnalyses = analysesByCourse.get(course.id) ?? []
      let totalDepth = 0
      let depthCount = 0
      let humanCount = 0

      for (const analysis of courseAnalyses) {
        const metrics = analysis.metrics as Record<string, unknown> | null
        const quality = metrics?.quality as Record<string, unknown> | null
        const depth = quality?.depth_of_thought as number | undefined
        if (typeof depth === "number") {
          totalDepth += depth
          depthCount++
        }
        const aiDetection = analysis.ai_detection as Record<string, unknown> | null
        if (aiDetection?.verdict === "likely_human") {
          humanCount++
        }
      }

      return {
        courseId: course.id,
        title: course.title,
        studentCount,
        completionRate: courseCompletionRate,
        avgReflectionDepth: depthCount > 0 ? Math.round((totalDepth / depthCount) * 100) / 100 : 0,
        avgAiDetection:
          courseAnalyses.length > 0 ? Math.round((humanCount / courseAnalyses.length) * 100) : 0,
      }
    })

    return {
      summary: {
        activeStudents,
        engagementRate,
        completionRate,
        sessionsThisMonth: sessionsThisMonth ?? 0,
      },
      engagementChart,
      courseTable,
    }
  } catch (error) {
    console.error("Failed to fetch manager analytics:", error)
    throw new Error("Failed to load manager analytics")
  }
}

/** Check if a feature flag is enabled in tenant settings (FIX-15) */
function isFeatureEnabled(settings: unknown, feature: string): boolean {
  if (!settings || typeof settings !== "object") return false
  const s = settings as Record<string, unknown>
  if (!s.features || typeof s.features !== "object") return false
  const features = s.features as Record<string, unknown>
  return features[feature] === true
}
