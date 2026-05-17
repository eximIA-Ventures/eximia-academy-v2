import { StudentProfileHeader } from "@/components/analytics/student-profile-header"
import { StudentProfileTabs } from "@/components/analytics/student-profile-tabs"
import { getAuthProfile } from "@/lib/auth"
import type { StudentAnalyticsResponse } from "@/types/analytics"
import { redirect } from "next/navigation"

export default async function StudentAnalyticsPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params
  const { user, profile, supabase } = await getAuthProfile()

  if (!user || !profile) return redirect("/login")
  if (!["manager", "admin", "instructor", "super_admin"].includes(profile.role)) return redirect("/dashboard")

  // Resolve tenant for super_admin (null tenant_id)
  let tenantId = profile.tenant_id
  if (!tenantId) {
    const { resolveTenantId } = await import("@/lib/auth")
    tenantId = await resolveTenantId(null)
  }
  if (!tenantId) return redirect("/dashboard")

  // Always use service client — RLS blocks instructors from seeing student data
  const { createServiceClient } = await import("@/lib/supabase/service")
  const dbClient = createServiceClient()

  // Fetch student data server-side
  const [{ data: student }, { data: lpData }, { data: sessions }] = await Promise.all([
    dbClient
      .from("users")
      .select("id, full_name, avatar_url, profile")
      .eq("id", studentId)
      .eq("tenant_id", tenantId)
      .single(),
    dbClient
      .from("learner_profiles")
      .select("*")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .single(),
    dbClient
      .from("sessions")
      .select(
        "id, analytics, created_at, status, turn_number, chapter_id, chapters(id, title, course_id, courses(id, title))",
      )
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(50),
  ])

  if (!student) return redirect("/analytics")

  // Fetch reflections for this student
  const { data: studentReflections } = await dbClient
    .from("slide_reflections")
    .select("slide_id, response, ai_response, created_at, chapter_slides(\"order\", chapter_id, chapters(title, \"order\"))")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(100)

  // Fetch enrollments
  const { data: enrollments } = await dbClient
    .from("enrollments")
    .select("course_id, status, courses(title)")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)

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
