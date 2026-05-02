import { createClient } from "@/lib/supabase/server"
import { tenantRedirect } from "@/lib/tenant-nav"
import { redirect } from "next/navigation"
import { checkDiscCooldown, getDiscResult } from "./actions"
import { DiscWizardClient } from "./disc-wizard-client"

export default async function DiscAssessmentPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return tenantRedirect("/login")

  // Check cooldown (30 days between assessments)
  const cooldown = await checkDiscCooldown()

  // Load previous result if available
  const { result: previousResult } = await getDiscResult()

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <DiscWizardClient
        userId={user.id}
        onCooldown={cooldown.onCooldown}
        remainingDays={cooldown.remainingDays}
        previousResult={previousResult}
      />
    </div>
  )
}
