import {
  getDirectTeamStudentIds,
  getManagedTeamStudentIds,
  getSubtreeStudentIdsAtNode,
} from "@/lib/area-context"
import { createClient } from "@/lib/supabase/server"
import { formatISO, startOfISOWeek, subDays, subWeeks } from "date-fns"
import { NextResponse } from "next/server"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (profileError) {
    console.error("Failed to fetch profile:", profileError.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }

  if (!profile || profile.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const url = new URL(request.url)
    const period = url.searchParams.get("period") ?? "30d"
    const courseId = url.searchParams.get("courseId")
    const tenantId = profile.tenant_id

    // E9 (EPIC-30) — SUBTREE aggregation + DRILL-DOWN params.
    //   • includeSubtree=true → the manager's whole subtree (UNION ALWAYS).
    //   • focusUserId=<uuid>  → drill into that node (gated server-side; a forged
    //     node fails the gate and collapses to []). `focusUserId` is read from the
    //     URL (shareable/SSR), validated here, gated by the helper. The E3 RPCs run
    //     under `supabase` (the authenticated RLS client), never the service client.
    const includeSubtree = url.searchParams.get("includeSubtree") === "true"
    const focusUserId = url.searchParams.get("focusUserId")
    if (focusUserId && !UUID_RE.test(focusUserId)) {
      return NextResponse.json({ error: "Invalid focus user ID" }, { status: 400 })
    }

    // DIRETOS/HIERARQUIA mode (Iteração 2, 2026-07-02 — "Mudança 4"): this
    // route used to be COMPLETELY unaware of the `x-team-view` switch that the
    // rest of "Meu Time" respects. When ManagerDashboardClient refetched on
    // period/course change, it always hit the `includeSubtree=false` DEFAULT
    // branch below (owned manager_group_members only) — for a manager who
    // reaches students purely via `reports_to` (no owned groups, e.g. Rinaldo)
    // that resolves to an EMPTY scope, zeroing the screen on any filter change
    // even though the server-rendered first paint was correct.
    //
    // `mode` is validated server-side and can ONLY NARROW, never widen: a
    // requested `focusUserId` is gated the SAME way as the existing drill-down
    // (getSubtreeStudentIdsAtNode's internal `auth_subtree_user_ids()` check;
    // a forged/out-of-scope node fails closed to `[]`, it never falls back to
    // the caller's own root here — this is a read endpoint, not navigation).
    // The client is trusted to SELECT a mode, never to grant one.
    const modeParam = url.searchParams.get("mode")
    const mode = modeParam === "direct" || modeParam === "hierarchy" ? modeParam : null

    // TEAM scope (ÁREA/GESTOR — by student_id). Security normalization (AC4/AC6):
    // for a manager, any non-list result (null = "no scope") collapses to an EMPTY
    // scope — NEVER tenant-wide. Branches, in priority order:
    //   • mode=direct    → getDirectTeamStudentIds at focusUserId (or the caller's
    //     own root when no focus) — mirrors manager-dashboard-page.tsx exactly.
    //   • mode=hierarchy → the gated subtree at focusUserId, or the whole
    //     reachable subtree when no focus — same as the pre-existing
    //     drill-down/includeSubtree branches below, just reached via `mode`.
    //   • no mode (legacy callers) → CURRENT behaviour, byte-for-byte
    //     unchanged: drill-down (focusUserId) → includeSubtree → default.
    //
    // GATE for mode=direct (Iteração 3, 2026-07-02 — simplified): the explicit
    // JS-side `auth_subtree_user_ids()` pre-check that used to live here is now
    // redundant. `getDirectTeamStudentIds` delegates to the SQL function
    // `auth_direct_student_ids(_node)` (SECURITY DEFINER), which has the SAME
    // gate embedded server-side: `_node` must be `auth.uid()` or inside
    // `auth_subtree_user_ids()`, else it returns empty. `focusUserId` still
    // arrives raw from the client here, but a forged/out-of-scope value now
    // fails closed INSIDE the RPC, not in this route — same fail-closed
    // outcome ([] payload), one fewer round-trip, no security regression (the
    // gate moved, it wasn't removed).
    const teamStudentIds =
      mode === "direct"
        ? await getDirectTeamStudentIds(supabase, tenantId, focusUserId ?? user.id)
        : mode === "hierarchy"
          ? focusUserId
            ? await getSubtreeStudentIdsAtNode(supabase, tenantId, focusUserId)
            : ((await getManagedTeamStudentIds(supabase, tenantId, user.id, {
                includeSubtree: true,
              })) ?? [])
          : focusUserId
            ? await getSubtreeStudentIdsAtNode(supabase, tenantId, focusUserId)
            : includeSubtree
              ? ((await getManagedTeamStudentIds(supabase, tenantId, user.id, {
                  includeSubtree: true,
                })) ?? [])
              : ((await getManagedTeamStudentIds(supabase, tenantId, user.id)) ?? [])

    // Manager with no team members → zeroed payload (never tenant-wide).
    if (teamStudentIds.length === 0) {
      return NextResponse.json({
        summary: { activeStudents: 0, engagementRate: 0, completionRate: 0, sessionsThisMonth: 0 },
        engagementChart: [],
        courseTable: [],
      })
    }

    // Period calculation
    const periodStart =
      period === "7d"
        ? subDays(new Date(), 7)
        : period === "30d"
          ? subDays(new Date(), 30)
          : period === "90d"
            ? subDays(new Date(), 90)
            : null

    // Summary: active students (distinct students with completed session in period)
    let activeStudentsQuery = supabase
      .from("sessions")
      .select("student_id")
      .eq("tenant_id", tenantId)
      .eq("status", "completed")
      .in("student_id", teamStudentIds)

    if (periodStart) {
      activeStudentsQuery = activeStudentsQuery.gte("updated_at", periodStart.toISOString())
    }

    const { data: activeStudentRows } = await activeStudentsQuery

    const activeStudents = new Set(activeStudentRows?.map((r) => r.student_id)).size

    // Total enrolled students
    const { data: totalEnrolledRows } = await supabase
      .from("enrollments")
      .select("student_id")
      .eq("tenant_id", tenantId)
      .in("status", ["active", "completed"])
      .in("student_id", teamStudentIds)

    const totalEnrolled = new Set(totalEnrolledRows?.map((e) => e.student_id)).size

    // Engagement rate
    const engagementRate =
      totalEnrolled > 0 ? Math.round((activeStudents / totalEnrolled) * 100) : 0

    // Completion rate
    const { count: completedEnrollments } = await supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "completed")
      .in("student_id", teamStudentIds)

    const { count: totalEnrollments } = await supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("status", ["active", "completed"])
      .in("student_id", teamStudentIds)

    const completionRate =
      (totalEnrollments ?? 0) > 0
        ? Math.round(((completedEnrollments ?? 0) / (totalEnrollments ?? 1)) * 100)
        : 0

    // Sessions this month (fixed 30-day window)
    const monthStart = subDays(new Date(), 30).toISOString()
    const { count: sessionsThisMonth } = await supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "completed")
      .gte("updated_at", monthStart)
      .in("student_id", teamStudentIds)

    // Engagement chart: sessions per week, last 12 weeks
    const chartStart = subWeeks(new Date(), 12).toISOString()
    const { data: chartSessions } = await supabase
      .from("sessions")
      .select("updated_at")
      .eq("tenant_id", tenantId)
      .eq("status", "completed")
      .gte("updated_at", chartStart)
      .in("student_id", teamStudentIds)

    // Group by ISO week
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

    // Course table
    const coursesQuery = courseId
      ? supabase.from("courses").select("id, title").eq("tenant_id", tenantId).eq("id", courseId)
      : supabase.from("courses").select("id, title").eq("tenant_id", tenantId).limit(50)

    const { data: allCourses } = await coursesQuery

    const courseTable = await Promise.all(
      (allCourses ?? []).map(async (course) => {
        // Student count — TEAM-scoped: only this manager's team members.
        const { data: courseEnrollments } = await supabase
          .from("enrollments")
          .select("student_id, status")
          .eq("course_id", course.id)
          .in("status", ["active", "completed"])
          .in("student_id", teamStudentIds)

        const studentCount = new Set(courseEnrollments?.map((e) => e.student_id)).size
        const courseCompleted = (courseEnrollments ?? []).filter(
          (e) => e.status === "completed",
        ).length
        const courseTotal = (courseEnrollments ?? []).length
        const courseCompletionRate =
          courseTotal > 0 ? Math.round((courseCompleted / courseTotal) * 100) : 0

        // Get chapters for this course
        const { data: courseChapters } = await supabase
          .from("chapters")
          .select("id")
          .eq("course_id", course.id)

        const courseChapterIds = (courseChapters ?? []).map((ch) => ch.id)

        // Get session IDs for analyses — TEAM-scoped so depth/AI-detection
        // averages reflect only this manager's team members.
        const { data: courseSessions } = await supabase
          .from("sessions")
          .select("id")
          .in("chapter_id", courseChapterIds.length > 0 ? courseChapterIds : ["__none__"])
          .in("student_id", teamStudentIds)

        const courseSessionIds = (courseSessions ?? []).map((s) => s.id)

        // Avg reflection depth
        const { data: analysisRows } = await supabase
          .from("analyses")
          .select("metrics, ai_detection")
          .in("session_id", courseSessionIds.length > 0 ? courseSessionIds : ["__none__"])

        let totalDepth = 0
        let depthCount = 0
        let humanCount = 0

        for (const analysis of analysisRows ?? []) {
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

        const avgReflectionDepth =
          depthCount > 0 ? Math.round((totalDepth / depthCount) * 100) / 100 : 0
        const avgAiDetection =
          (analysisRows ?? []).length > 0
            ? Math.round((humanCount / (analysisRows ?? []).length) * 100)
            : 0

        return {
          courseId: course.id,
          title: course.title,
          studentCount,
          completionRate: courseCompletionRate,
          avgReflectionDepth,
          avgAiDetection,
        }
      }),
    )

    return NextResponse.json({
      summary: {
        activeStudents,
        engagementRate,
        completionRate,
        sessionsThisMonth: sessionsThisMonth ?? 0,
      },
      engagementChart,
      courseTable,
    })
  } catch (error) {
    console.error("Manager analytics error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
