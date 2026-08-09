"use client"

// ---------------------------------------------------------------------------
// PlanRecalcScreen — "Recalcular plano" (Tela 2, SH-3.3)
// ---------------------------------------------------------------------------
// Sub-screen opened from the "Meu Plano" dashboard. Both choices are LOCAL
// REACT STATE ONLY (wired by the parent `MeuPlanoClient`): "Recalcular
// automaticamente" redistributes `choice` via `recalculateWeeklyChoice`
// (pure, `study-plan-dashboard.ts`); "Manter como está" is a no-op that just
// closes the screen. Neither calls fetch/POST (AC4).
// ---------------------------------------------------------------------------

import type { WeeklyComparison } from "@/lib/analytics/study-plan-dashboard"
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  ChevronLeft,
  RefreshCw,
  ShieldCheck,
} from "lucide-react"

function formatDatePtBR(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
}

export function PlanRecalcScreen({
  weeklyComparison,
  onBack,
  onRecalcAuto,
  onKeep,
}: {
  weeklyComparison: WeeklyComparison | null
  onBack: () => void
  onRecalcAuto: () => void
  onKeep: () => void
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6">
      <div className="flex items-center gap-3 pb-1 pt-1">
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar para Meu Plano"
          className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-border-subtle bg-bg-card text-text-secondary transition-colors hover:border-border-medium hover:bg-bg-hover hover:text-text-primary"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <h1 className="font-display text-xl font-extrabold tracking-tight text-text-primary sm:text-2xl">
          Recalcular plano
        </h1>
      </div>

      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-display text-base font-extrabold text-text-primary">
          Comparativo da sua semana atual
        </h3>
        {weeklyComparison && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-card px-3 py-1.5 text-[11.5px] font-semibold text-text-secondary">
            <Calendar size={13} className="text-text-muted" aria-hidden="true" />
            {formatDatePtBR(weeklyComparison.weekStart)} –{" "}
            {formatDatePtBR(weeklyComparison.weekEnd)}
          </span>
        )}
      </div>

      {weeklyComparison ? (
        <>
          {/* overflow-x-auto + min-w interno: no mobile a tabela rola na
              horizontal em vez de estourar (ultra responsivo, rodada Hugo). */}
          <div className="mt-3 overflow-x-auto rounded-2xl border border-border-subtle">
            <table className="w-full min-w-[420px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-bg-surface">
                  <th className="px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-text-muted">
                    Item
                  </th>
                  <th className="px-3.5 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-text-muted">
                    Planejado
                  </th>
                  <th className="px-3.5 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-text-muted">
                    Realizado
                  </th>
                  <th className="px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-text-muted">
                    Situação
                  </th>
                </tr>
              </thead>
              <tbody>
                <RecalcRow
                  label="Sessões"
                  planned={weeklyComparison.planned.sessions}
                  realized={weeklyComparison.realized.sessions}
                />
                {(weeklyComparison.planned.reflections > 0 ||
                  weeklyComparison.realized.reflections > 0) && (
                  <RecalcRow
                    label="Reflexões"
                    planned={weeklyComparison.planned.reflections}
                    realized={weeklyComparison.realized.reflections}
                  />
                )}
              </tbody>
            </table>
          </div>

          {/* caixa avatar amigável — empilha avatar+texto no mobile */}
          <div className="mt-5 flex flex-col items-start gap-4 rounded-2xl border border-cerrado-600/20 bg-cerrado-600/[0.05] p-4 sm:flex-row sm:p-5">
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl border border-cerrado-600/30 bg-cerrado-600/15 text-cerrado-500">
              <ShieldCheck size={22} aria-hidden="true" />
            </span>
            <div>
              <h4 className="font-display text-base font-extrabold text-text-primary">
                {weeklyComparison.situation === "pendente"
                  ? "Você está um pouco abaixo do plano. Tudo bem!"
                  : "Você está em dia com o combinado desta semana."}
              </h4>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-secondary">
                Posso recalcular sua jornada para redistribuir o que falta pelas próximas semanas —
                sem estourar tudo de uma vez na próxima semana.
              </p>
            </div>
          </div>

          {/* 2 cards de escolha */}
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={onRecalcAuto}
              data-testid="recalc-auto"
              className="flex flex-col items-start gap-3 rounded-2xl border-[1.5px] border-cerrado-600/50 bg-cerrado-600/[0.06] p-5.5 text-left transition-transform duration-[var(--motion-fast,150ms)] hover:-translate-y-0.5 active:scale-[0.98]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cerrado-600 text-white">
                <RefreshCw size={20} aria-hidden="true" />
              </span>
              <span className="inline-flex items-center rounded-full bg-cerrado-600/16 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-cerrado-500">
                Recomendado
              </span>
              <span className="font-display text-base font-extrabold text-text-primary">
                Recalcular automaticamente
              </span>
              <span className="text-[12.5px] leading-relaxed text-text-secondary">
                Ajusto seu plano para que você siga no ritmo, mantendo sua data de conclusão.
              </span>
            </button>
            <button
              type="button"
              onClick={onKeep}
              data-testid="recalc-keep"
              className="flex flex-col items-start gap-3 rounded-2xl border-[1.5px] border-border-subtle bg-bg-card p-5.5 text-left transition-transform duration-[var(--motion-fast,150ms)] hover:-translate-y-0.5 active:scale-[0.98]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border-subtle bg-bg-elevated text-text-secondary">
                <ShieldCheck size={20} aria-hidden="true" />
              </span>
              <span className="inline-flex items-center rounded-full bg-text-muted/14 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-text-secondary">
                Sem mudanças
              </span>
              <span className="font-display text-base font-extrabold text-text-primary">
                Manter como está
              </span>
              <span className="text-[12.5px] leading-relaxed text-text-secondary">
                Mantém o plano atual sem alterações na distribuição dos itens.
              </span>
            </button>
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-text-muted">
          Sem sessões registradas nesta semana ainda para comparar — mantenha seu plano por agora.
        </p>
      )}

      <p className="mt-6 text-center text-xs text-text-muted">
        Você pode revisar e ajustar seu plano sempre que precisar.
      </p>
    </div>
  )
}

function RecalcRow({
  label,
  planned,
  realized,
}: {
  label: string
  planned: number
  realized: number
}) {
  const ok = realized >= planned
  const gap = planned - realized
  return (
    <tr className="border-t border-border-subtle">
      <td className="px-3.5 py-2.5 font-semibold text-text-primary">{label}</td>
      <td className="px-3.5 py-2.5 text-center font-bold text-text-secondary tabular-nums">
        {planned}
      </td>
      <td className="px-3.5 py-2.5 text-center font-bold text-text-secondary tabular-nums">
        {realized}
      </td>
      <td className="px-3.5 py-2.5">
        {ok ? (
          <span className="inline-flex items-center gap-1.5 font-bold text-semantic-success">
            <ArrowUpRight size={13} aria-hidden="true" />
            Dentro do plano
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 font-bold text-semantic-warning">
            <ArrowDownRight size={13} aria-hidden="true" />
            {gap} abaixo do plano
          </span>
        )}
      </td>
    </tr>
  )
}
