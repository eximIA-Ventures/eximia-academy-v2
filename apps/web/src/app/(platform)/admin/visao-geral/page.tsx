import { redirect } from "next/navigation"
import { AdoptionFunnel } from "./_components/adoption-funnel"
import { EngagementHealth } from "./_components/engagement-health"
import { OverviewTotals } from "./_components/overview-totals"
import { loadAdminOverviewPage, parseAdoptionAxis } from "./loader"

/**
 * VISÃO GERAL DO ADMIN (ADM-1/2/3, consolidadas).
 *
 * Três seções empilhadas na MESMA rota, lendo UM agregado só — três telas
 * separadas fariam o admin navegar entre abas para montar na cabeça a leitura
 * que esta página já entrega junta.
 *
 * O nome é "Visão Geral" e não "Analytics" de propósito: `/analytics` já existe
 * na barra com escopo de gestor/turma. Dois itens homônimos com escopos
 * diferentes na mesma casa seria a confusão que a separação de mundos existe
 * para evitar.
 *
 * Guard por CHAPÉU real, fail-closed na própria página (espelha `admin/page.tsx`)
 * — a rota nunca depende só do middleware.
 */
export default async function AdminVisaoGeralPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const axis = parseAdoptionAxis(params.eixo)
  const loaded = await loadAdminOverviewPage(axis)

  if (loaded.kind === "unauthenticated") redirect("/login")
  if (loaded.kind === "forbidden") redirect("/dashboard")

  if (loaded.kind === "no-tenant") {
    return (
      <div className="p-8 text-text-muted">
        Nenhuma empresa ativa encontrada. Escolha uma empresa no seletor do cabeçalho.
      </div>
    )
  }

  const { overview } = loaded

  return (
    <div className="space-y-10 p-6">
      <header className="space-y-1">
        <h1 className="font-semibold text-2xl text-text-primary">Visão Geral</h1>
        <p className="text-sm text-text-muted">
          Como a empresa está usando a Academy: totais, adoção por unidade ou área, e saúde de
          engajamento com período e comparação em cada número.
        </p>
      </header>

      <OverviewTotals totals={overview.totals} />
      <AdoptionFunnel adoption={overview.adoption} />
      <EngagementHealth engagement={overview.engagement} />
    </div>
  )
}
