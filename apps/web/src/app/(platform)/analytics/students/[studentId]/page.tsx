import { StudentProfileHeader } from "@/components/analytics/student-profile-header"
import { StudentProfileTabs } from "@/components/analytics/student-profile-tabs"
import { getAuthProfile } from "@/lib/auth"
import type { StudentAnalyticsResponse } from "@/types/analytics"
import { tenantRedirect } from "@/lib/tenant-nav"
import { redirect } from "next/navigation"

export default async function StudentAnalyticsPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params
  const { user, profile, supabase } = await getAuthProfile()

  if (!user || !profile) return tenantRedirect("/login")
  if (!["manager", "admin"].includes(profile.role)) return tenantRedirect("/dashboard")

  if (!profile.tenant_id) return tenantRedirect("/dashboard")
  const tenantId = profile.tenant_id

  // Fetch student data server-side
  const [{ data: student }, { data: lpData }, { data: sessions }] = await Promise.all([
    supabase
      .from("users")
      .select("id, full_name, avatar_url, profile")
      .eq("id", studentId)
      .eq("tenant_id", tenantId)
      .single(),
    supabase
      .from("learner_profiles")
      .select("*")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .single(),
    supabase
      .from("sessions")
      .select(
        "id, analytics, created_at, status, turn_number, chapter_id, chapters(id, title, course_id, courses(id, title))",
      )
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(50),
  ])

  if (!student) return tenantRedirect("/analytics")

  // Build initial data matching StudentAnalyticsResponse shape
  const userProfile = student.profile as Record<string, unknown> | null

  const initialData: StudentAnalyticsResponse = {
    header: {
      id: student.id,
      fullName: student.full_name,
      avatarUrl: student.avatar_url,
      plan: (userProfile?.plan as string) ?? null,
      lastSessionAt: sessions?.[0]?.created_at ?? null,
      totalSessions: sessions?.length ?? 0,
      totalCompleted: sessions?.filter((s) => s.status === "completed").length ?? 0,
    },
    learnerProfile: lpData
      ? {
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
      : null,
    cognitivePatterns: [],
    evolution: [],
    sessions: [],
    recommendations: [],
    divergence: null,
  }

  return (
    <div className="space-y-6">
      <StudentProfileHeader header={initialData.header} />
      <StudentProfileTabs studentId={studentId} initialData={initialData} />
    </div>
  )
}
