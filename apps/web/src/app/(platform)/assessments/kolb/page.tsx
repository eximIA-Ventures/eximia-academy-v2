import { PageHeader } from "@/components/layout/page-header"
import { createClient } from "@/lib/supabase/server"
import { tenantRedirect } from "@/lib/tenant-nav"
import { redirect } from "next/navigation"
import { checkKolbCooldown, getKolbResult } from "./actions"
import { KolbAssessmentWrapper } from "./kolb-wrapper"

export default async function KolbPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return tenantRedirect("/login")

  const [cooldown, previousResult] = await Promise.all([
    checkKolbCooldown(),
    getKolbResult(),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        section="Avaliação"
        title="Estilos de Aprendizagem de Kolb"
        description="Descubra como você percebe e processa informações. 12 situações, ~8 minutos."
        accent="teal"
        backgroundImage="https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1200&q=80"
      />

      <KolbAssessmentWrapper
        previousResult={previousResult.result}
        onCooldown={cooldown.onCooldown}
        remainingDays={cooldown.remainingDays}
        userId={user.id}
      />
    </div>
  )
}
