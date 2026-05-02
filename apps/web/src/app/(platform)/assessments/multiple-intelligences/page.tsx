import { createClient } from "@/lib/supabase/server"
import { tenantRedirect } from "@/lib/tenant-nav"
import { redirect } from "next/navigation"
import { checkMICooldown, getMIResult } from "./actions"
import { MIWizardClient } from "./mi-wizard-client"

export default async function MultipleIntelligencesAssessmentPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return tenantRedirect("/login")

  // Check cooldown (30 days between assessments)
  const cooldown = await checkMICooldown()

  // Load previous result if available
  const { result: previousResult } = await getMIResult()

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <MIWizardClient
        userId={user.id}
        onCooldown={cooldown.onCooldown}
        remainingDays={cooldown.remainingDays}
        previousResult={previousResult}
      />
    </div>
  )
}
