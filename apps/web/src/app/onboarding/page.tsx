import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"
import { getAuthProfile } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function OnboardingPage() {
  const { user, profile } = await getAuthProfile()

  if (!user || !profile) {
    redirect("/login")
  }

  const tenantRaw = profile.tenants
  const tenant = (Array.isArray(tenantRaw) ? tenantRaw[0] : tenantRaw) || {
    id: "",
    name: "exímIA Academy",
    slug: "default",
  }

  return (
    <OnboardingWizard
      userId={user.id}
      tenantId={tenant.id}
      tenantName={tenant.name}
    />
  )
}
