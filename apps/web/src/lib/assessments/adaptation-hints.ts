"use server"

import { bigFiveResultSchema, discResultSchema } from "@/lib/assessments/schemas"
import { createClient } from "@/lib/supabase/server"
import { type AdaptationHints, buildAdaptationHints } from "@eximia/shared"

/**
 * Story 29.5 — Server action that fetches a user's assessment data
 * and builds adaptation hints for the Mestre pipeline.
 *
 * Returns neutral defaults when no assessments exist (AC5).
 */
export async function getAdaptationHints(userId: string): Promise<{
  data: AdaptationHints
  error?: string
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: buildAdaptationHints({}), error: "Não autenticado" }

  // Authorization: only own profile or admin roles
  if (user.id !== userId) {
    const { data: callerProfile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()
    if (!callerProfile || !["admin", "super_admin"].includes(callerProfile.role)) {
      return { data: buildAdaptationHints({}), error: "Acesso negado" }
    }
  }

  // Fetch latest Big Five and DISC results
  const { data: assessments } = await supabase
    .from("assessment_history")
    .select("assessment_type, result")
    .eq("user_id", userId)
    .in("assessment_type", ["big_five", "disc"])
    .order("completed_at", { ascending: false })

  let bigFive = null
  let disc = null

  for (const a of assessments ?? []) {
    if (a.assessment_type === "big_five" && !bigFive) {
      const parsed = bigFiveResultSchema.safeParse(a.result)
      bigFive = parsed.success ? parsed.data : null
    }
    if (a.assessment_type === "disc" && !disc) {
      const parsed = discResultSchema.safeParse(a.result)
      disc = parsed.success ? parsed.data : null
    }
  }

  const hints = buildAdaptationHints({ bigFive, disc })

  return { data: hints }
}
