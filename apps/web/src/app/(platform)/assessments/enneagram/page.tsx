import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { checkEnneagramCooldown, getEnneagramResult } from "./actions"
import { EnneagramWizardClient } from "./enneagram-wizard-client"

export default async function EnneagramAssessmentPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return redirect("/login")

  // Check cooldown (30 days between assessments)
  const cooldown = await checkEnneagramCooldown()

  // Load previous result if available
  const { result: previousResult } = await getEnneagramResult()

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <EnneagramWizardClient
        userId={user.id}
        onCooldown={cooldown.onCooldown}
        remainingDays={cooldown.remainingDays}
        previousResult={previousResult}
      />
    </div>
  )
}
