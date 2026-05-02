import { createClient } from "@/lib/supabase/server"
import { analyticsIndividualLimiter } from "@/lib/rate-limit"
import type {
  CognitiveAnalysis,
  SessionAnalyticsHeader,
  SessionAnalyticsJsonb,
  SessionAnalyticsResponse,
  SessionJourney,
  SessionMetrics,
  TranscriptMessage,
} from "@/types/analytics"
import { NextResponse } from "next/server"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params
  if (!UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: "Invalid session ID" }, { status: 400 })
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

  // --- Fetch session ---
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select(
      "id, student_id, analytics, created_at, turn_number, status, chapter_id, chapters(id, title, courses(id, title))",
    )
    .eq("id", sessionId)
    .eq("tenant_id", tenantId)
    .single()

  if (sessionError && sessionError.code !== "PGRST116") {
    console.error("Failed to fetch session:", sessionError.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  // --- Fetch student ---
  const { data: student } = await supabase
    .from("users")
    .select("id, full_name")
    .eq("id", session.student_id)
    .single()

  // --- Fetch messages ---
  const { data: messages } = await supabase
    .from("messages")
    .select("id, role, content, turn_number, created_at")
    .eq("session_id", sessionId)
    .order("turn_number", { ascending: true })
    .order("created_at", { ascending: true })

  // --- Fetch analyses for annotations ---
  const { data: analyses } = await supabase
    .from("analyses")
    .select("message_id, ai_detection, metrics, observations, flags")
    .eq("session_id", sessionId)

  const analysisMap = new Map(
    (analyses ?? []).map((a) => [a.message_id, a]),
  )

  // --- Fetch QA score ---
  const { data: qaReports } = await supabase
    .from("qa_reports")
    .select("score")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)

  const analytics = session.analytics as SessionAnalyticsJsonb | null
  const chapter = session.chapters as unknown as { id: string; title: string; courses: { id: string; title: string } | null } | null

  // --- Build header ---
  const header: SessionAnalyticsHeader = {
    sessionId: session.id,
    studentId: session.student_id,
    studentName: student?.full_name ?? "Unknown",
    courseTitle: chapter?.courses?.title ?? "—",
    chapterTitle: chapter?.title ?? "—",
    date: session.created_at,
    turnCount: session.turn_number,
    status: session.status,
    depthReached: analytics?.depth_reached ?? 0,
    aiDetectionVerdict: analytics?.ai_detection?.verdict ?? null,
    qaScore: qaReports?.[0]?.score ? Number(qaReports[0].score) : null,
  }

  // --- Build cognitive analysis ---
  const cognitiveAnalysis: CognitiveAnalysis = {
    dominantPatterns: [],
    implicitValues: analytics?.values_revealed ?? [],
    cognitiveLoops: analytics?.defense_mechanisms ?? [],
    readinessLevel: null,
    suggestedQuestionType: null,
    aiDetection: analytics?.ai_detection
      ? {
          probability: analytics.ai_detection.probability,
          confidence: analytics.ai_detection.confidence,
          verdict: analytics.ai_detection.verdict,
          flag: analytics.ai_detection.flag,
          indicators: [],
        }
      : null,
  }

  // Enrich from analyses if available
  for (const a of analyses ?? []) {
    const aiDet = a.ai_detection as Record<string, unknown> | null
    if (aiDet?.indicators && cognitiveAnalysis.aiDetection) {
      cognitiveAnalysis.aiDetection.indicators = aiDet.indicators as CognitiveAnalysis["aiDetection"] extends null ? never : NonNullable<CognitiveAnalysis["aiDetection"]>["indicators"]
    }
  }

  // Build dominant patterns from cognitive_patterns + analytics
  if (analytics?.cognitive_patterns) {
    const patternCounts = new Map<string, number>()
    for (const p of analytics.cognitive_patterns) {
      patternCounts.set(p, (patternCounts.get(p) ?? 0) + 1)
    }
    cognitiveAnalysis.dominantPatterns = [...patternCounts.entries()].map(([pattern, count]) => ({
      pattern,
      evidence: "",
      frequency: count >= 3 ? "high" : count >= 2 ? "medium" : "low",
    }))
  }

  // --- Build journey ---
  const journey: SessionJourney = {
    depthProgression: analytics?.depth_progression ?? [],
    emotionalArc: analytics?.emotional_journey ?? [],
    breakthroughCandidates: [],
  }

  // --- Build metrics ---
  const densities = analytics?.emotional_density_progression ?? []
  const metrics: SessionMetrics = {
    emotionalDensityProgression: densities,
    abstractionLevel: null,
    certaintyVsExploration: null,
    defenseActive: null,
    kolbSessionVector: analytics?.kolb_session_vector
      ? {
          graspingAxis: analytics.kolb_session_vector.grasping_axis,
          transformingAxis: analytics.kolb_session_vector.transforming_axis,
          indicatorsCount: analytics.kolb_session_vector.indicators_count,
        }
      : null,
  }

  // --- Build transcript with annotations ---
  const depthProg = analytics?.depth_progression ?? []
  const emotionalArc = analytics?.emotional_journey ?? []

  const transcript: TranscriptMessage[] = (messages ?? []).map((m) => {
    const analysis = analysisMap.get(m.id)
    const turnIdx = m.turn_number - 1

    const annotations: TranscriptMessage["annotations"] = {}
    if (m.role === "user") {
      if (depthProg[turnIdx] != null) annotations.depthLevel = depthProg[turnIdx]
      if (emotionalArc[turnIdx]) annotations.emotionalState = emotionalArc[turnIdx]
      if (analysis?.flags && Array.isArray(analysis.flags) && analysis.flags.length > 0) {
        annotations.detectedPattern = (analysis.flags as string[])[0]
      }
    }

    return {
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      turnNumber: m.turn_number,
      createdAt: m.created_at,
      ...(Object.keys(annotations).length > 0 ? { annotations } : {}),
    }
  })

  const response: SessionAnalyticsResponse = {
    header,
    cognitiveAnalysis,
    journey,
    metrics,
    transcript,
  }

  return NextResponse.json(response)
}
