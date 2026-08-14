import type { AdminOverviewAdoption } from "@/lib/analytics/admin-overview"
import { Card, CardContent } from "@eximia/ui"
import Link from "next/link"
import { formatCount, formatPercent } from "./format"

/**
 * SEÇÃO 2 — o funil de adoção por eixo organizacional.
 *
 * A ordem é PIOR CONVERSÃO PRIMEIRO (a decisão já vem ordenada do contrato,
 * `compareAdoptionRows`): quem abre esta tela quer ver onde a adoção está
 * travada, não uma lista telefônica. O seletor troca o eixo entre a unidade
 * (`areas`) e a área funcional (`departments`) — dois recortes diferentes da
 * mesma empresa, nunca o grupo de gestor.
 */
export function AdoptionFunnel({ adoption }: { adoption: AdminOverviewAdoption }) {
  const isDepartment = adoption.axis === "department"

  return (
    <section aria-labelledby="secao-adocao" className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="secao-adocao" className="text-lg font-semibold text-text-primary">
            Adoção por {adoption.axisLabel.toLowerCase()}
          </h2>
          <p className="text-sm text-text-muted">
            Convidados → ativados → ativos ({adoption.windowDays} dias) → concluintes. Cada pessoa
            entra em uma linha só, pela filiação mais antiga, e a soma fecha com o total da empresa.
          </p>
        </div>

        <nav aria-label="Eixo do funil" className="flex gap-1 rounded-lg bg-bg-elevated p-1">
          <AxisLink href="/admin/visao-geral?eixo=unidade" active={!isDepartment} label="Unidade" />
          <AxisLink
            href="/admin/visao-geral?eixo=departamento"
            active={isDepartment}
            label="Área"
          />
        </nav>
      </header>

      {!adoption.available ? (
        <Card className="p-0">
          <CardContent className="p-6 text-sm text-text-muted">
            Esta empresa ainda não tem nenhuma {adoption.axisLabel.toLowerCase()} cadastrada.
            Enquanto isso, o funil aparece consolidado numa linha só.
          </CardContent>
        </Card>
      ) : null}

      <Card className="p-0">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Funil de adoção por {adoption.axisLabel.toLowerCase()}, da pior para a melhor
              conversão
            </caption>
            <thead>
              <tr className="border-border-subtle border-b text-left text-text-muted text-xs uppercase">
                <th scope="col" className="px-4 py-3 font-medium">
                  {adoption.axisLabel}
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Convidados
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Ativados
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Ativos ({adoption.windowDays}d)
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Concluintes
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Conversão
                </th>
              </tr>
            </thead>
            <tbody>
              {adoption.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-text-muted">
                    Nenhuma pessoa cadastrada nesta empresa ainda.
                  </td>
                </tr>
              ) : (
                adoption.rows.map((row) => (
                  <tr key={row.id} className="border-border-subtle/60 border-b last:border-0">
                    <th scope="row" className="px-4 py-3 text-left font-medium text-text-primary">
                      {row.name}
                    </th>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCount(row.invited)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCount(row.activated)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCount(row.active)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCount(row.completers)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatPercent(row.conversionRate, 1)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {adoption.rows.length > 0 && (
              <tfoot>
                <tr className="border-border-subtle border-t font-medium">
                  <th scope="row" className="px-4 py-3 text-left text-text-primary">
                    Total da empresa
                  </th>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCount(adoption.totals.invited)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCount(adoption.totals.activated)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCount(adoption.totals.active)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCount(adoption.totals.completers)}
                  </td>
                  <td className="px-4 py-3 text-right text-text-muted">—</td>
                </tr>
              </tfoot>
            )}
          </table>
        </CardContent>
      </Card>

      <p className="text-xs text-text-muted">
        Conversão = concluintes ÷ convidados. “—” significa que o dado não pôde ser apurado, não que
        o número seja zero.
      </p>
    </section>
  )
}

function AxisLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "rounded-md bg-bg-card px-3 py-1.5 font-medium text-sm text-text-primary shadow-sm"
          : "rounded-md px-3 py-1.5 text-sm text-text-muted hover:text-text-primary"
      }
    >
      {label}
    </Link>
  )
}
