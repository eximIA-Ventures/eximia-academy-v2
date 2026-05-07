import { getFeatureAccess, PLAN_DISPLAY_NAMES, type PlanName } from "@/lib/feature-gate"
import { Card, CardContent, buttonVariants } from "@eximia/ui"
import { Lock } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FeatureGateProps {
  feature: string
  tenantId: string
  children: ReactNode
  fallback?: ReactNode
}

// ---------------------------------------------------------------------------
// Default upgrade CTA (shown when feature is blocked and no custom fallback)
// ---------------------------------------------------------------------------

function UpgradeCTA({ requiredPlan }: { requiredPlan: PlanName | null }) {
  const planLabel = requiredPlan ? PLAN_DISPLAY_NAMES[requiredPlan] : "Standard"

  return (
    <Card className="mx-auto max-w-md border-border-medium bg-bg-card">
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cerrado-600/10">
          <Lock className="h-7 w-7 text-cerrado-600" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-text-primary">
            Recurso indisponivel
          </h3>
          <p className="text-sm text-text-secondary">
            Disponivel no plano {planLabel}
          </p>
        </div>
        <Link href="/admin/planos" className={buttonVariants({ variant: "default", size: "default" })}>
          Ver planos
        </Link>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// FeatureGate — Server Component
// ---------------------------------------------------------------------------

export async function FeatureGate({ feature, tenantId, children, fallback }: FeatureGateProps) {
  const result = await getFeatureAccess(tenantId, feature)

  if (result.allowed) {
    return <>{children}</>
  }

  if (fallback) {
    return <>{fallback}</>
  }

  return <UpgradeCTA requiredPlan={result.requiredPlan} />
}
