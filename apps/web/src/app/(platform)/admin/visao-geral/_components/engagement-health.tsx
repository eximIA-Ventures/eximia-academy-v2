import type { AdminOverviewEngagement } from "@/lib/analytics/admin-overview"
import { Card, CardContent } from "@eximia/ui"
import { formatCount, formatDate, formatDelta, formatPercent } from "./format"

/**
 * SEÇÃO 3 — saúde de engajamento.
 *
 * A regra desta seção é o que ela NÃO tem: nenhum índice composto, nenhum
 * "score de saúde". Cada número mostra o período em que foi medido, contra qual
 * período está sendo comparado e a fórmula que o produziu. Um índice agregado
 * esconderia justamente a informação que faz o admin agir.
 */
export function EngagementHealth({ engagement }: { engagement: AdminOverviewEngagement }) {
  return (
    <section aria-labelledby="secao-engajamento" className="space-y-4">
      <header>
        <h2 id="secao-engajamento" className="text-lg font-semibold text-text-primary">
          Saúde de engajamento
        </h2>
        <p className="text-sm text-text-muted">
          Cada número traz o período, a comparação e a fórmula. Não há índice agregado.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {engagement.activeMetrics.map((metric) => {
          const tone =
            metric.delta > 0
              ? "text-semantic-success"
              : metric.delta < 0
                ? "text-semantic-error"
                : "text-text-muted"
          return (
            <Card key={metric.key} className="p-0">
              <CardContent className="p-5">
                <div className="text-sm text-text-secondary">{metric.label}</div>
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="font-bold text-3xl text-text-primary tabular-nums">
                    {formatCount(metric.current)}
                  </span>
                  <span className={`text-sm tabular-nums ${tone}`}>
                    {formatDelta(metric.delta)}
                    {metric.deltaPct === null ? "" : ` (${formatPercent(metric.deltaPct, 0)})`}
                  </span>
                </div>
                <dl className="mt-3 space-y-1 text-text-muted text-xs">
                  <div className="flex gap-2">
                    <dt className="font-medium">Período:</dt>
                    <dd>{metric.periodLabel}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium">Comparado com:</dt>
                    <dd>
                      {metric.comparisonLabel} ({formatCount(metric.previous)})
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium">Fórmula:</dt>
                    <dd>{metric.formula}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="p-0">
        <CardContent className="space-y-4 p-5">
          <div>
            <h3 className="font-medium text-text-primary">Retenção por semana desde a matrícula</h3>
            <p className="text-text-muted text-xs">
              Fórmula: pessoas com atividade na semana N depois da própria matrícula ÷ pessoas que
              já viveram a semana N. Semanas que ainda não terminaram para ninguém aparecem sem
              base.
            </p>
          </div>
          <ol className="space-y-2">
            {engagement.retention.map((point) => (
              <li key={point.week} className="flex items-center gap-3 text-sm">
                <span className="w-20 shrink-0 text-text-secondary">Semana {point.week}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-elevated">
                  <div
                    className="h-full rounded-full bg-cerrado-500"
                    style={{ width: `${Math.round((point.rate ?? 0) * 100)}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-text-primary tabular-nums">
                  {formatPercent(point.rate, 0)}
                </span>
                <span className="w-28 shrink-0 text-right text-text-muted text-xs tabular-nums">
                  {formatCount(point.retained)}/{formatCount(point.cohort)}
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card className="p-0">
        <CardContent className="space-y-3 p-5">
          <div>
            <h3 className="font-medium text-text-primary">Cursos publicados sem tração</h3>
            <p className="text-text-muted text-xs">
              Critério: curso publicado com nenhuma matrícula OU nenhuma sessão nos últimos{" "}
              {engagement.windowDays} dias.
            </p>
          </div>
          {engagement.coursesWithoutTraction.length === 0 ? (
            <p className="text-sm text-text-muted">
              Nenhum curso publicado está parado nesta janela.
            </p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {engagement.coursesWithoutTraction.map((course) => (
                <li key={course.id} className="flex flex-wrap gap-x-6 gap-y-1 py-2 text-sm">
                  <span className="flex-1 font-medium text-text-primary">{course.title}</span>
                  <span className="text-text-muted">
                    {formatCount(course.enrollments)} matrículas
                  </span>
                  <span className="text-text-muted">
                    {formatCount(course.sessionsInWindow)} sessões em {engagement.windowDays}d
                  </span>
                  <span className="text-text-muted">
                    Última atividade: {formatDate(course.lastActivityAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
