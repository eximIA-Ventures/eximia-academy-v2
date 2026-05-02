import { createClient } from "@/lib/supabase/server"
import { analyticsAggregateLimiter } from "@/lib/rate-limit"
import type {
  AggregateAnalyticsResponse,
  AggregateSummary,
  AnalyticsAlert,
  CognitivePatternCount,
  DepthDistribution,
  DivergenceRow,
  EmotionalJourneyPoint,
  KolbPoint,
  SessionAnalyticsJsonb,
} from "@/types/analytics"
import { NextResponse } from "next/server"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
    case "30d":
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }
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
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile?.role || !["manager", "admin", "instructor"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Rate limit
  if (analyticsAggregateLimiter) {
    const { success } = await analyticsAggregateLimiter.limit(profile.tenant_id)
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

  if (courseId && !UUID_RE.test(courseId)) {
    return NextResponse.json({ error: "Invalid course ID" }, { status: 400 })
  }
  if (areaId && !UUID_RE.test(areaId)) {
    return NextResponse.json({ error: "Invalid area ID" }, { status: 400 })
  }

  const periodStart = periodToDate(period)

  const tenantId = profile.tenant_id

  // --- Fetch sessions with analytics ---
  let sessionsQuery = supabase
    .from("sessions")
    .select("id, analytics, created_at, student_id, status, turn_number, chapter_id")
    .eq("tenant_id", tenantId)
    .gte("created_at", periodStart.toISOString())
    .not("analytics", "is", null)

  // Filter by course if needed
  if (courseId) {
    const { data: chapterIds } = await supabase
      .from("chapters")
      .select("id")
      .eq("course_id", courseId)
      .eq("tenant_id", tenantId)
    if (chapterIds && chapterIds.length > 0) {
      sessionsQuery = sessionsQuery.in(
        "chapter_id",
        chapterIds.map((c) => c.id),
      )
    }
  }

  // Filter by area if needed
  if (areaId) {
    const { data: courses } = await supabase.from("courses").select("id").eq("area_id", areaId).eq("tenant_id", tenantId)
    if (courses && courses.length > 0) {
      const { data: chapterIds } = await supabase
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

  // --- Aggregate summary ---
  const analyticsData = sessions.map((s) => s.analytics as SessionAnalyticsJsonb)
  const totalSessions = sessions.length
  const depths = analyticsData.map((a) => a.depth_reached ?? 0).filter((d) => d > 0)
  const avgDepth = depths.length > 0 ? depths.reduce((a, b) => a + b, 0) / depths.length : 0

  const breakthroughs = analyticsData.map((a) => a.breakthrough_moments ?? 0)
  const totalBreakthroughs = breakthroughs.reduce((a, b) => a + b, 0)
  const avgBreakthroughsPerSession = totalSessions > 0 ? totalBreakthroughs / totalSessions : 0

  const aiLikelyCount = analyticsData.filter(
    (a) => a.ai_detection?.verdict === "likely_ai",
  ).length
  const aiDetectionRate = totalSessions > 0 ? aiLikelyCount / totalSessions : 0

  const summary: AggregateSummary = {
    totalSessions,
    avgDepth: Math.round(avgDepth * 10) / 10,
    avgBreakthroughsPerSession: Math.round(avgBreakthroughsPerSession * 10) / 10,
    aiDetectionRate: Math.round(aiDetectionRate * 1000) / 10,
    deltaDepth: null,
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
  const { data: studentUsers } = studentIds.length > 0
    ? await supabase
        .from("users")
        .select("id, full_name")
        .in("id", studentIds)
    : { data: [] }
  const userMap = new Map((studentUsers ?? []).map((u) => [u.id, u.full_name]))

  const kolbTeam: KolbPoint[] = (learnerProfiles ?? []).map((lp) => ({
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

  const response: AggregateAnalyticsResponse = {
    summary,
    depthDistribution,
    kolbTeam,
    cognitivePatterns,
    emotionalJourney,
    alerts,
    divergenceTable,
  }

  return NextResponse.json(response)
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

  const { data: allSessions } = await supabase
    .from("sessions")
    .select("id, student_id, analytics, created_at, status")
    .eq("tenant_id", tenantId)
    .gte("created_at", periodStart.toISOString())
    .order("created_at", { ascending: false })

  const sessionsByStudent = new Map<string, typeof allSessions>()
  for (const s of allSessions ?? []) {
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
        message: `0 sessoes nos ultimos 14 dias`,
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
