import { FeatureGate } from "@/components/feature-gate"
import { redirect } from "next/navigation"
import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { CourseDesignerWizard } from "./_components/course-designer-wizard"

export default async function CourseDesignerPage() {
  const { user, profile } = await getAuthProfile()

  if (!user || !profile) return redirect("/login")
  if (!["manager", "admin", "super_admin", "instructor"].includes(profile.role)) {
    return redirect("/dashboard")
  }

  // A asserção sai da JSX e vem para cá: o gate precisa do MESMO `tenantId` que o
  // wizard, e repetir `tenantId!` nos dois pontos duplicaria a asserção sem
  // acrescentar segurança nenhuma. Uma asserção, dois consumidores — o
  // comportamento para `tenantId` nulo continua exatamente o de antes.
  const tenantId = (await resolveTenantId(profile.tenant_id))!

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Course Designer</h1>
        <p className="text-text-secondary">
          Crie um blueprint pedagógico completo com assistência de IA
        </p>
      </div>
      {/* A tela INTEIRA é a feature, então o gate envolve o wizard e o usuário
          de plano sem direito vê o CTA de upgrade em vez de um formulário que
          só falharia no POST. Aqui esconder é correto; nas telas de webhooks e
          de chaves de API não é — lá a página administra recursos que já
          existem, e o gate mora só na criação (ver as rotas de API). */}
      <FeatureGate feature="course_designer" tenantId={tenantId}>
        <CourseDesignerWizard tenantId={tenantId} />
      </FeatureGate>
    </div>
  )
}
