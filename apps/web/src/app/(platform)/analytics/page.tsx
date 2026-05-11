import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard"
import { PageHeader } from "@/components/layout/page-header"
import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import type { AggregateAnalyticsResponse, SessionAnalyticsJsonb } from "@/types/analytics"
import { redirect } from "next/navigation"

const DEPTH_LABELS = [
  "Repetição superficial",
  "Compreensão básica",
  "Aplicação",
  "Análise",
  "Questionamento",
  "Síntese",
  "Insight original",
]

function buildEmptyResponse(): AggregateAnalyticsResponse {
  return {
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
}

export default async function AnalyticsPage() {
  const { user, profile, supabase } = await getAuthProfile()

  if (!user || !profile) return redirect("/login")
  if (!["manager", "admin", "instructor", "super_admin"].includes(profile.role)) return redirect("/dashboard")

  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) return redirect("/dashboard")

  // Use service client for cross-tenant admin
  let db = supabase
  if (!profile.tenant_id) {
    const { createServiceClient } = await import("@/lib/supabase/service")
    db = createServiceClient()
  }

  // Parallel fetch: sessions (for summary), courses, areas
  const periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [{ data: sessions }, { data: courses }, { data: areas }] = await Promise.all([
    db
      .from("sessions")
      .select("id, analytics, created_at, student_id, status, turn_number, chapter_id")
      .eq("tenant_id", tenantId)
      .gte("created_at", periodStart.toISOString())
      .not("analytics", "is", null),
    db.from("courses").select("id, title").eq("tenant_id", tenantId).order("title"),
    db.from("areas").select("id, name").eq("tenant_id", tenantId).order("name"),
  ])

  let initialData: AggregateAnalyticsResponse

  if (sessions && sessions.length > 0) {
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

    const depthDist = Array(7).fill(0) as number[]
    for (const a of analyticsData) {
      const d = a.depth_reached ?? 0
      if (d >= 1 && d <= 7) depthDist[Math.round(d) - 1]++
    }

    initialData = {
      summary: {
        totalSessions,
        avgDepth: Math.round(avgDepth * 10) / 10,
        avgBreakthroughsPerSession: Math.round(avgBreakthroughsPerSession * 10) / 10,
        aiDetectionRate: Math.round(aiDetectionRate * 1000) / 10,
        deltaDepth: null,
        deltaBreakthroughs: null,
      },
      depthDistribution: DEPTH_LABELS.map((label, i) => ({ level: i + 1, count: depthDist[i], label })),
      kolbTeam: [],
      cognitivePatterns: [],
      emotionalJourney: [],
      alerts: [],
      divergenceTable: [],
    }
  } else {
    initialData = buildEmptyResponse()
  }

  return (
    <div className="space-y-8">
      <PageHeader
        section="Analytics Socrático"
        title="Visão Geral"
        description="Métricas de profundidade, breakthroughs e detecção de IA da turma."
        accent="blue"
        backgroundImage="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80"
      />

      <AnalyticsDashboard
        initialData={initialData}
        courses={(courses ?? []).map((c) => ({ id: c.id, title: c.title }))}
        areas={(areas ?? []).map((a) => ({ id: a.id, name: a.name }))}
      />
    </div>
  )
}
