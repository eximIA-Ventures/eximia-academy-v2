import { bigFiveResultSchema, discResultSchema } from "@/lib/assessments/schemas"
import { getAuthProfile } from "@/lib/auth"
import { PageHeader } from "@/components/layout/page-header"
import { createClient } from "@/lib/supabase/server"
import { getDbClient } from "@/lib/auth"
import { redirect } from "next/navigation"

import { ProfileDashboardClient } from "./profile-dashboard-client"

export default async function LearningProfilePage() {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) return redirect("/login")

  const tenantId = profile.tenant_id
  if (!tenantId) return redirect("/dashboard")

  const supabase = await getDbClient()

  // Fetch learner_profile + latest Big Five + latest DISC in parallel
  const [learnerProfileResult, bigFiveResult, discResult] = await Promise.all([
    supabase
      .from("learner_profiles")
      .select("*")
      .eq("student_id", user.id)
      .eq("tenant_id", tenantId)
      .single(),
    supabase
      .from("assessment_history")
      .select("result, completed_at")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .eq("assessment_type", "big_five")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("assessment_history")
      .select("result, completed_at")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .eq("assessment_type", "disc")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const learnerProfile = learnerProfileResult.data
    ? {
        engagementStyle: learnerProfileResult.data.engagement_style as string | null,
        detailOrientation: learnerProfileResult.data.detail_orientation as string | null,
        reasoningStyle: learnerProfileResult.data.reasoning_style as string | null,
        kolbDominantStyle: learnerProfileResult.data.kolb_dominant_style as string | null,
        kolbStyleConfidence: learnerProfileResult.data.kolb_style_confidence
          ? Number(learnerProfileResult.data.kolb_style_confidence)
          : null,
        strengths: (learnerProfileResult.data.strengths as string[]) ?? [],
        growthAreas: (learnerProfileResult.data.growth_areas as string[]) ?? [],
        adaptationHints: (learnerProfileResult.data.adaptation_hints as string[]) ?? [],
        summary: learnerProfileResult.data.summary as string | null,
        sessionCount: learnerProfileResult.data.session_count ?? 0,
      }
    : null

  const bigFive = bigFiveResult.data
    ? bigFiveResultSchema.safeParse(bigFiveResult.data.result).success
      ? bigFiveResultSchema.parse(bigFiveResult.data.result)
      : null
    : null

  const disc = discResult.data
    ? discResultSchema.safeParse(discResult.data.result).success
      ? discResultSchema.parse(discResult.data.result)
      : null
    : null

  return (
    <div className="space-y-6">
      <PageHeader
        section="Perfil"
        title="Meu Perfil de Aprendizado"
        description="Entenda como você aprende e receba sugestões personalizadas."
        backgroundImage="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80"
      />

      <ProfileDashboardClient
        learnerProfile={learnerProfile}
        bigFiveResult={bigFive}
        discResult={disc}
      />
    </div>
  )
}
