import {
  FeatureCheckUnavailableError,
  getFeatureAccess,
  PLAN_DISPLAY_NAMES,
  type PlanName,
} from "@/lib/feature-gate"
import { Card, CardContent, buttonVariants } from "@eximia/ui"
import { AlertTriangle, Lock } from "lucide-react"
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
        {/* `/admin/planos` não existe neste app — o CTA nasceu apontando para
            404 e ninguém percebeu porque o componente nunca teve consumidor.
            O destino real é a seção "Plano & Cobrança" do hub, que é a tela
            que "visualiza as features do seu plano e solicita upgrades". */}
        <Link
          href="/admin/configuracoes/plano"
          className={buttonVariants({ variant: "default", size: "default" })}
        >
          Ver planos
        </Link>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Estado "não deu para verificar" — deliberadamente NÃO é o CTA de upgrade
// ---------------------------------------------------------------------------

/**
 * Quando a leitura do plano falha, o sistema não sabe se o cliente tem direito.
 * Mostrar "Disponível no plano Standard" aqui seria afirmar uma recusa comercial
 * que ninguém verificou — e, pior, sugerir ao cliente que ele pague por algo que
 * talvez já tenha. Esta tela diz o que é verdade: não deu para checar agora.
 */
function CheckUnavailable() {
  return (
    <Card className="mx-auto max-w-md border-border-medium bg-bg-card">
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
          <AlertTriangle className="h-7 w-7 text-amber-600" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-text-primary">
            Nao foi possivel verificar seu plano
          </h3>
          <p className="text-sm text-text-secondary">
            Falha temporaria ao consultar os dados da sua conta. Tente novamente em instantes.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// FeatureGate — Server Component
// ---------------------------------------------------------------------------

export async function FeatureGate({ feature, tenantId, children, fallback }: FeatureGateProps) {
  let result: Awaited<ReturnType<typeof getFeatureAccess>>
  try {
    result = await getFeatureAccess(tenantId, feature)
  } catch (err) {
    if (!(err instanceof FeatureCheckUnavailableError)) throw err
    // `fallback` NÃO é usado aqui de propósito: quem passa um fallback está
    // descrevendo a alternativa para "sem direito", não para "não sabemos".
    return <CheckUnavailable />
  }

  if (result.allowed) {
    return <>{children}</>
  }

  if (fallback) {
    return <>{fallback}</>
  }

  return <UpgradeCTA requiredPlan={result.requiredPlan} />
}
