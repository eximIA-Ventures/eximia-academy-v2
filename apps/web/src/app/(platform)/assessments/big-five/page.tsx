import { bigFiveResultSchema } from "@/lib/assessments/schemas"
import { getAuthProfile } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { tenantRedirect } from "@/lib/tenant-nav"
import { redirect } from "next/navigation"

import { BigFiveWizardClient } from "./big-five-wizard-client"

const COOLDOWN_DAYS = 30

export default async function BigFiveAssessmentPage() {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) return tenantRedirect("/login")

  // Check cooldown: query assessment_history for latest big_five
  const supabase = await createClient()
  const { data: lastAssessment } = await supabase
    .from("assessment_history")
    .select("completed_at, result")
    .eq("user_id", user.id)
    .eq("assessment_type", "big_five")
    .order("completed_at", { ascending: false })
    .limit(1)
    .single()

  const lastCompletedAt = lastAssessment?.completed_at
    ? new Date(lastAssessment.completed_at)
    : null

  const now = new Date()
  const daysSinceLast = lastCompletedAt
    ? Math.floor((now.getTime() - lastCompletedAt.getTime()) / (1000 * 60 * 60 * 24))
    : null

  const isOnCooldown = daysSinceLast !== null && daysSinceLast < COOLDOWN_DAYS
  const daysRemaining = isOnCooldown ? COOLDOWN_DAYS - daysSinceLast : 0

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <BigFiveWizardClient
        isOnCooldown={isOnCooldown}
        daysRemaining={daysRemaining}
        previousResult={
          isOnCooldown && lastAssessment?.result
            ? bigFiveResultSchema.safeParse(lastAssessment.result).success
              ? (bigFiveResultSchema.parse(lastAssessment.result) as Record<string, number>)
              : null
            : null
        }
      />
    </div>
  )
}
