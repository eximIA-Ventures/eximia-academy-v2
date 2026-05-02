import type { ShadowPersistence, ExistingLearnerProfile } from "@eximia/agents"
import type { SupabaseClient } from "@supabase/supabase-js"

export function createShadowPersistence(serviceClient: SupabaseClient): ShadowPersistence {
  return {
    getExistingProfile: async (studentId, tenantId): Promise<ExistingLearnerProfile | null> => {
      const { data } = await serviceClient
        .from("learner_profiles")
        .select("*")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId)
        .single()

      if (!data) return null

      return {
        engagement_style: data.engagement_style,
        detail_orientation: data.detail_orientation,
        reasoning_style: data.reasoning_style,
        avg_depth_achieved: data.avg_depth_achieved != null ? Number(data.avg_depth_achieved) : null,
        avg_qa_score: data.avg_qa_score != null ? Number(data.avg_qa_score) : null,
        confidence: data.confidence != null ? Number(data.confidence) : null,
        kolb_grasping_axis: data.kolb_grasping_axis != null ? Number(data.kolb_grasping_axis) : null,
        kolb_transforming_axis: data.kolb_transforming_axis != null ? Number(data.kolb_transforming_axis) : null,
        kolb_dominant_style: data.kolb_dominant_style,
        kolb_style_confidence: data.kolb_style_confidence != null ? Number(data.kolb_style_confidence) : null,
        strengths: data.strengths ?? [],
        growth_areas: data.growth_areas ?? [],
        adaptation_hints: data.adaptation_hints ?? [],
        preferred_question_types: data.preferred_question_types ?? [],
        comprehension_trend: data.comprehension_trend,
        summary: data.summary,
        session_count: data.session_count ?? 0,
      }
    },

    getSessionAnalytics: async (sessionId) => {
      const { data } = await serviceClient
        .from("sessions")
        .select("analytics")
        .eq("id", sessionId)
        .single()

      return (data?.analytics as Record<string, unknown>) ?? {}
    },

    updateSessionAnalytics: async (sessionId, analytics) => {
      await serviceClient
        .from("sessions")
        .update({ analytics })
        .eq("id", sessionId)
    },

    upsertLearnerProfile: async (studentId, tenantId, profileData) => {
      await serviceClient
        .from("learner_profiles")
        .upsert(
          { student_id: studentId, tenant_id: tenantId, ...profileData },
          { onConflict: "student_id,tenant_id" },
        )
    },
  }
}
