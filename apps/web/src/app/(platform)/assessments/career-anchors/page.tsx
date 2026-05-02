import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { checkCareerAnchorsCooldown, getCareerAnchorsResult } from "./actions"
import { CareerAnchorsWizardClient } from "./career-anchors-wizard-client"

export default async function CareerAnchorsAssessmentPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return redirect("/login")

  // Check cooldown (30 days between assessments)
  const cooldown = await checkCareerAnchorsCooldown()

  // Load previous result if available
  const { result: previousResult } = await getCareerAnchorsResult()

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <CareerAnchorsWizardClient
        userId={user.id}
        onCooldown={cooldown.onCooldown}
        remainingDays={cooldown.remainingDays}
        previousResult={previousResult}
      />
    </div>
  )
}
