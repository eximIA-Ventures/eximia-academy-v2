import { createClient } from "@/lib/supabase/server"
import { analyticsIndividualLimiter } from "@/lib/rate-limit"
import type {
  CognitivePatternAggregated,
  DivergenceRow,
  EvolutionPoint,
  LearnerProfileData,
  Recommendation,
  SessionAnalyticsJsonb,
  SessionListItem,
  StudentAnalyticsResponse,
  StudentHeader,
} from "@/types/analytics"
import { NextResponse } from "next/server"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params
  if (!UUID_RE.test(studentId)) {
    return NextResponse.json({ error: "Invalid student ID" }, { status: 400 })
  }
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
  if (analyticsIndividualLimiter) {
    const { success } = await analyticsIndividualLimiter.limit(profile.tenant_id)
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 })
  }

  const tenantId = profile.tenant_id

  // --- Fetch student info ---
  const { data: student } = await supabase
    .from("users")
    .select("id, full_name, avatar_url, profile")
    .eq("id", studentId)
    .eq("tenant_id", tenantId)
    .single()

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 })
  }

  // --- Fetch learner profile ---
  const { data: lpData, error: lpError } = await supabase
    .from("learner_profiles")
    .select("engagement_style, detail_orientation, reasoning_style, avg_depth_achieved, avg_qa_score, confidence, comprehension_trend, kolb_grasping_axis, kolb_transforming_axis, kolb_dominant_style, kolb_style_confidence, strengths, growth_areas, adaptation_hints, preferred_question_types, summary, session_count")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .single()

  if (lpError && lpError.code !== "PGRST116") {
    console.error("Failed to fetch learner profile:", lpError.message)
  }

  // --- Fetch sessions (ordered by date desc) ---
  const { data: sessions, error: sessionsError } = await supabase
    .from("sessions")
    .select(
      "id, analytics, created_at, status, turn_number, chapter_id, chapters(id, title, course_id, courses(id, title))",
    )
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(50)

  if (sessionsError) {
    console.error("Failed to fetch sessions:", sessionsError.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }

  // --- Fetch QA reports for scores ---
  const sessionIds = (sessions ?? []).map((s) => s.id)
  const { data: qaReports } =
    sessionIds.length > 0
      ? await supabase
          .from("qa_reports")
          .select("session_id, score")
          .in("session_id", sessionIds)
      : { data: [] }
  const qaScoreMap = new Map(
    (qaReports ?? []).map((r) => [r.session_id, Number(r.score)]),
  )

  // --- Build header ---
  const userProfile = student.profile as Record<string, unknown> | null
  const tenantData = userProfile?.plan as string | null

  const header: StudentHeader = {
    id: student.id,
    fullName: student.full_name,
    avatarUrl: student.avatar_url,
    plan: tenantData,
    lastSessionAt: sessions?.[0]?.created_at ?? null,
    totalSessions: sessions?.length ?? 0,
    totalCompleted: sessions?.filter((s) => s.status === "completed").length ?? 0,
  }

  // --- Build learner profile data ---
  let learnerProfile: LearnerProfileData | null = null
  if (lpData) {
    learnerProfile = {
      engagementStyle: lpData.engagement_style,
      detailOrientation: lpData.detail_orientation,
      reasoningStyle: lpData.reasoning_style,
      avgDepthAchieved: lpData.avg_depth_achieved ? Number(lpData.avg_depth_achieved) : null,
      avgQaScore: lpData.avg_qa_score ? Number(lpData.avg_qa_score) : null,
      confidence: lpData.confidence ? Number(lpData.confidence) : null,
      comprehensionTrend: lpData.comprehension_trend,
      kolbGraspingAxis: lpData.kolb_grasping_axis ? Number(lpData.kolb_grasping_axis) : null,
      kolbTransformingAxis: lpData.kolb_transforming_axis
        ? Number(lpData.kolb_transforming_axis)
        : null,
      kolbDominantStyle: lpData.kolb_dominant_style,
      kolbStyleConfidence: lpData.kolb_style_confidence
        ? Number(lpData.kolb_style_confidence)
        : null,
      strengths: lpData.strengths ?? [],
      growthAreas: lpData.growth_areas ?? [],
      adaptationHints: lpData.adaptation_hints ?? [],
      preferredQuestionTypes: lpData.preferred_question_types ?? [],
      summary: lpData.summary,
      sessionCount: lpData.session_count ?? 0,
    }
  }

  // --- Cognitive patterns aggregated (last 10 sessions) ---
  const last10 = (sessions ?? []).slice(0, 10)
  const patternMap = new Map<string, { count: number; lastSeen: string }>()
  for (const s of last10) {
    const analytics = s.analytics as SessionAnalyticsJsonb | null
    for (const p of analytics?.cognitive_patterns ?? []) {
      const existing = patternMap.get(p)
      if (existing) {
        existing.count++
      } else {
        patternMap.set(p, { count: 1, lastSeen: s.created_at })
      }
    }
  }
  const cognitivePatterns: CognitivePatternAggregated[] = [...patternMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([pattern, data]) => ({ pattern, count: data.count, lastSeen: data.lastSeen }))

  // --- Evolution (all sessions, chronological) ---
  const evolution: EvolutionPoint[] = [...(sessions ?? [])]
    .reverse()
    .map((s) => {
      const analytics = s.analytics as SessionAnalyticsJsonb | null
      const densities = analytics?.emotional_density_progression ?? []
      return {
        sessionId: s.id,
        date: s.created_at,
        depthReached: analytics?.depth_reached ?? 0,
        kolbGrasping: analytics?.kolb_session_vector?.grasping_axis ?? null,
        kolbTransforming: analytics?.kolb_session_vector?.transforming_axis ?? null,
        avgEmotionalDensity:
          densities.length > 0
            ? Math.round((densities.reduce((a, b) => a + b, 0) / densities.length) * 100) / 100
            : null,
        aiDetectionVerdict: analytics?.ai_detection?.verdict ?? null,
      }
    })

  // --- Session list ---
  const sessionList: SessionListItem[] = (sessions ?? []).map((s) => {
    const analytics = s.analytics as SessionAnalyticsJsonb | null
    const chapter = s.chapters as unknown as { id: string; title: string; course_id: string; courses: { id: string; title: string } | null } | null
    return {
      id: s.id,
      date: s.created_at,
      courseTitle: chapter?.courses?.title ?? "—",
      chapterTitle: chapter?.title ?? "—",
      depthReached: analytics?.depth_reached ?? 0,
      aiDetectionVerdict: analytics?.ai_detection?.verdict ?? null,
      qaScore: qaScoreMap.get(s.id) ?? null,
      turnCount: s.turn_number,
      status: s.status,
    }
  })

  // --- Recommendations ---
  const recommendations = generateRecommendations(learnerProfile, cognitivePatterns, sessions ?? [])

  // --- Divergence ---
  let divergence: DivergenceRow | null = null
  if (lpData?.kolb_dominant_style) {
    const testKolb = (userProfile?.learning_style as string) ?? null
    divergence = {
      studentId,
      studentName: student.full_name,
      kolbTestStyle: testKolb,
      kolbAiStyle: lpData.kolb_dominant_style,
      kolbDivergence:
        testKolb && lpData.kolb_dominant_style && testKolb !== lpData.kolb_dominant_style ? 1 : 0,
    }
  }

  const response: StudentAnalyticsResponse = {
    header,
    learnerProfile,
    cognitivePatterns,
    evolution,
    sessions: sessionList,
    recommendations,
    divergence,
  }

  return NextResponse.json(response)
}

function generateRecommendations(
  profile: LearnerProfileData | null,
  patterns: CognitivePatternAggregated[],
  sessions: Array<{ analytics: unknown; status: string }>,
): Recommendation[] {
  const recs: Recommendation[] = []

  if (profile) {
    if ((profile.avgDepthAchieved ?? 0) < 3) {
      recs.push({
        type: "depth",
        message: "Profundidade media abaixo de 3. Considerar conteúdo mais acessivel ou sessoes mais longas.",
        priority: "high",
      })
    }

    if (profile.comprehensionTrend === "declining") {
      recs.push({
        type: "trend",
        message: "Tendencia de compreensão em queda. Verificar se o conteúdo esta adequado ao nivel do aluno.",
        priority: "high",
      })
    }
  }

  // Check for AI detection
  const recentAi = sessions
    .slice(0, 5)
    .filter((s) => {
      const a = s.analytics as SessionAnalyticsJsonb | null
      return a?.ai_detection?.verdict === "likely_ai"
    }).length
  if (recentAi >= 2) {
    recs.push({
      type: "ai_detection",
      message: `${recentAi} sessoes recentes com deteccao de IA. Monitorar e abordar em 1:1.`,
      priority: "high",
    })
  }

  // Resistance pattern
  const hasResistance = patterns.some(
    (p) =>
      p.pattern.toLowerCase().includes("resistencia") ||
      p.pattern.toLowerCase().includes("defens"),
  )
  if (hasResistance) {
    recs.push({
      type: "resistance",
      message: "Padrao de resistencia recorrente. Considerar abordagem mais acolhedora.",
      priority: "medium",
    })
  }

  // Positive reinforcement
  if (profile && (profile.avgDepthAchieved ?? 0) >= 5) {
    recs.push({
      type: "strength",
      message: "Aluno atinge profundidade alta. Desafiar com conteúdo mais avancado.",
      priority: "low",
    })
  }

  return recs
}
