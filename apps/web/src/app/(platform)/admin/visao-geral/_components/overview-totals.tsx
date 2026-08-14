import type { AdminOverviewTotals } from "@/lib/analytics/admin-overview"
import { Card, CardContent } from "@eximia/ui"
import { formatCount } from "./format"

interface Tile {
  label: string
  value: string
  /** O período em que o número foi medido — nunca fica implícito na tela. */
  period: string
}

/**
 * SEÇÃO 1 — os totais da empresa.
 *
 * Cada bloco carrega o próprio período no rodapé. O que é acumulado desde
 * sempre diz "acumulado"; o que é da janela diz a janela. Sem isso, dois números
 * lado a lado com escalas de tempo diferentes leem como se fossem comparáveis.
 */
export function OverviewTotals({ totals }: { totals: AdminOverviewTotals }) {
  const windowLabel = `Últimos ${totals.windowDays} dias`
  const tiles: Tile[] = [
    { label: "Pessoas na empresa", value: formatCount(totals.people), period: "Acumulado" },
    {
      label: "Alunos com atividade registrada",
      value: formatCount(totals.activeStudents),
      period: "Acumulado",
    },
    {
      label: "Pessoas ativas no período",
      value: formatCount(totals.activePeopleInWindow),
      period: windowLabel,
    },
    { label: "Sessões", value: formatCount(totals.sessionsInWindow), period: windowLabel },
    { label: "Reflexões", value: formatCount(totals.reflectionsInWindow), period: windowLabel },
    {
      label: "Matrículas ativas",
      value: formatCount(totals.activeEnrollments),
      period: "Acumulado",
    },
    {
      label: "Matrículas concluídas",
      value: formatCount(totals.completedEnrollments),
      period: "Acumulado",
    },
    {
      label: "Cursos publicados",
      value: formatCount(totals.publishedCourses),
      period: "Acumulado",
    },
    { label: "Capítulos publicados", value: formatCount(totals.chapters), period: "Acumulado" },
    {
      label: "Certificados emitidos",
      value: formatCount(totals.certificatesInWindow),
      period: windowLabel,
    },
  ]

  return (
    <section aria-labelledby="secao-visao-geral" className="space-y-4">
      <header>
        <h2 id="secao-visao-geral" className="text-lg font-semibold text-text-primary">
          Visão Geral
        </h2>
        <p className="text-sm text-text-muted">
          Totais da empresa. A janela padrão desta tela é de {totals.windowDays} dias.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {tiles.map((tile) => (
          <Card key={tile.label} className="p-0">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-text-primary">{tile.value}</div>
              <div className="mt-1 text-sm text-text-secondary">{tile.label}</div>
              <div className="mt-2 text-xs text-text-muted">{tile.period}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {totals.certificatesTotal === null && (
        <p className="text-xs text-text-muted">
          Certificados aparecem como “—” porque a base de certificados não pôde ser lida agora — não
          é o mesmo que zero certificado emitido.
        </p>
      )}
    </section>
  )
}
