import { SessionDetailView } from "@/components/analytics/session-detail-view"
import { getAuthProfile } from "@/lib/auth"
import type {
  SessionAnalyticsJsonb,
  SessionAnalyticsResponse,
  TranscriptMessage,
} from "@/types/analytics"
import { redirect } from "next/navigation"

export default async function SessionAnalyticsPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  const { user, profile, supabase } = await getAuthProfile()

  if (!user || !profile) return redirect("/login")
  if (!["manager", "admin"].includes(profile.role)) return redirect("/dashboard")

  if (!profile.tenant_id) return redirect("/dashboard")
  const tenantId = profile.tenant_id

  // Fetch session
  const { data: session } = await supabase
    .from("sessions")
    .select("*, chapters(id, title, courses(id, title))")
    .eq("id", sessionId)
    .eq("tenant_id", tenantId)
    .single()

  if (!session) return redirect("/analytics")

  // Parallel fetches
  const [{ data: student }, { data: messages }, { data: analyses }, { data: qaReports }] =
    await Promise.all([
      supabase.from("users").select("id, full_name").eq("id", session.student_id).single(),
      supabase
        .from("messages")
        .select("id, role, content, turn_number, created_at")
        .eq("session_id", sessionId)
        .order("turn_number", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("analyses")
        .select("message_id, ai_detection, metrics, observations, flags")
        .eq("session_id", sessionId),
      supabase
        .from("qa_reports")
        .select("score")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(1),
    ])

  const analytics = session.analytics as SessionAnalyticsJsonb | null
  const chapter = session.chapters as unknown as {
    id: string
    title: string
    courses: { id: string; title: string } | null
  } | null

  const analysisMap = new Map((analyses ?? []).map((a) => [a.message_id, a]))

  // Build transcript with annotations
  const depthProg = analytics?.depth_progression ?? []
  const emotionalArc = analytics?.emotional_journey ?? []

  const transcript: TranscriptMessage[] = (messages ?? []).map((m) => {
    const analysis = analysisMap.get(m.id)
    const turnIdx = m.turn_number - 1

    const annotations: TranscriptMessage["annotations"] = {}
    if (m.role === "user") {
      if (depthProg[turnIdx] != null) annotations.depthLevel = depthProg[turnIdx]
      if (emotionalArc[turnIdx]) annotations.emotionalState = emotionalArc[turnIdx]
      if (
        analysis?.flags &&
        Array.isArray(analysis.flags) &&
        analysis.flags.length > 0
      ) {
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

  const initialData: SessionAnalyticsResponse = {
    header: {
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
    },
    cognitiveAnalysis: {
      dominantPatterns: analytics?.cognitive_patterns
        ? (() => {
            const counts = new Map<string, number>()
            for (const p of analytics.cognitive_patterns) {
              counts.set(p, (counts.get(p) ?? 0) + 1)
            }
            return [...counts.entries()].map(([pattern, count]) => ({
              pattern,
              evidence: "",
              frequency: count >= 3 ? "high" : count >= 2 ? "medium" : "low",
            }))
          })()
        : [],
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
    },
    journey: {
      depthProgression: analytics?.depth_progression ?? [],
      emotionalArc: analytics?.emotional_journey ?? [],
      breakthroughCandidates: [],
    },
    metrics: {
      emotionalDensityProgression: analytics?.emotional_density_progression ?? [],
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
    },
    transcript,
  }

  return <SessionDetailView initialData={initialData} />
}
