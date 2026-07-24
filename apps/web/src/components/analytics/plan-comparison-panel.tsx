"use client"

// ---------------------------------------------------------------------------
// PlanComparisonPanel — "Comparativo com o Plano" (SH-3.3 R5, Hugo 2026-07-21)
// ---------------------------------------------------------------------------
// 3rd toggle of the "Meu ritmo" card (student-home-card.tsx), sibling to
// "Visão detalhada" (ComparisonInsightsTable, Você vs Turma) and "Gráficos"
// (SignalRowsView). This one compares Você vs O SEU PRÓPRIO PLANO instead of
// the class average: 4 columns (MEU PLANO | REALIZADO | COMO ESTOU | AÇÃO),
// a "Meu plano da semana" checklist, and a "Próximo ajuste sugerido" card.
//
// A painel real (design-chief, @pm, pedro-valerio, aiox-analyst) recommended a
// leaner summary+link version; Hugo, as final decisão-maker, confirmed the
// FULL version from the reference mockup ("eu to mandando fazer daquele
// jeito"). ONE non-negotiable survived the critique (Pedro Valério, engineering
// not scope): ZERO reimplementation of "planejado × realizado" math — every
// number here comes from `computeCumulativeExpected`/`StudyPlanDiagnostic`/
// `computeWeeklyComparison`/`computeStudyPlanProjection` via
// `/api/analytics/plan-dashboard`, the SAME functions that already power
// `/meu-plano` (see `@/lib/analytics/plan-dashboard-data`).
//
// R7 correction (Hugo 2026-07-21): R6 read "Realizado"/"Meu plano" for
// Sessões/Reflexões as WEEK-SCOPED (`computeWeeklyComparison`/
// `getCalendarWeekRange`) — Hugo tested and corrected this: those two rows are
// CUMULATIVE since the start of the plan/enrollment, exactly like "Progresso
// da trilha" always was. "Realizado" now reads `diagnostic.sessionsDoneCount`/
// `.reflDoneCount` (the SAME lifetime counts the sibling "Visão detalhada"
// toggle shows), and "Meu plano" reads `planDashboardData.cumulativeExpected`
// (`computeCumulativeExpected`, elapsedDays × weekly rhythm). The week-scoped
// `weeklyComparison` still powers the SEPARATE "Meu plano da semana" checklist
// and "Próximo ajuste sugerido" card below — those two widgets are genuinely
// about the current week and were never part of the misreading.
//
// Brand note: the reference mockup was "ARGOS Academy" (navy/blue) — this
// implementation uses eximIA's own identity (cerrado orange, real theme.css
// tokens), the SAME decision already made across the rest of `/meu-plano`.
// Only the STRUCTURE (columns, cards, layout) came from the mockup.
// ---------------------------------------------------------------------------

import type { PlanComparisonResponse } from "@/lib/analytics/plan-dashboard-data"
import { buttonVariants } from "@eximia/ui"
import { AlertCircle, CalendarClock, CheckCircle2, Circle, Sparkles } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

// ---------------------------------------------------------------------------
// Fetch wrapper
// ---------------------------------------------------------------------------

async function fetchPlanComparison(courseId?: string | null): Promise<PlanComparisonResponse> {
  // JRN-D — courseId opcional ancora o comparativo NAQUELE curso (seletor da home).
  const url = courseId
    ? `/api/analytics/plan-dashboard?courseId=${encodeURIComponent(courseId)}`
    : "/api/analytics/plan-dashboard"
  const res = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<PlanComparisonResponse>
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3" data-testid="plan-comparison-skeleton">
      <div className="h-40 w-full rounded-xl bg-bg-elevated" />
      <div className="h-24 w-full rounded-xl bg-bg-elevated" />
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3" data-testid="plan-comparison-error">
      <AlertCircle size={16} className="mt-0.5 shrink-0 text-semantic-warning" />
      <p className="text-xs text-text-muted">
        Não foi possível carregar o comparativo com o plano. {message}
      </p>
    </div>
  )
}

// JRN-D (Hugo 2026-07-24) — estado-convite honesto quando NÃO há jornada
// persistida para o curso: nunca um número fake, um convite para montá-la.
function JourneyInviteState({ journeyHref }: { journeyHref: string }) {
  return (
    <div
      className="rounded-xl border border-border-subtle bg-bg-elevated p-5 text-center"
      data-testid="plan-comparison-no-journey"
    >
      <p className="text-sm text-text-secondary">Você ainda não montou sua jornada.</p>
      <Link
        href={journeyHref}
        className={`${buttonVariants({ size: "sm" })} mt-3 inline-flex`}
        data-testid="plan-comparison-cta-empty"
      >
        Montar minha jornada
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root export — fetch wrapper (lazy: only mounted when the toggle is active,
// so this extra query never fires unless the student opens this view)
// ---------------------------------------------------------------------------

export function PlanComparisonPanel({
  continueHref,
  interactionHref,
  reflectionHref,
  courseId,
}: {
  continueHref: string
  interactionHref?: string | null
  reflectionHref?: string | null
  /** JRN-D — curso selecionado no card "Meu ritmo" (seletor da home); ancora o
   *  comparativo naquela jornada. Ausente → curso líder. */
  courseId?: string | null
}) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ok"; data: PlanComparisonResponse }
  >({ status: "loading" })

  useEffect(() => {
    let cancelled = false
    setState({ status: "loading" })
    fetchPlanComparison(courseId)
      .then((data) => {
        if (!cancelled) setState({ status: "ok", data })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Erro desconhecido"
          setState({ status: "error", message })
        }
      })
    return () => {
      cancelled = true
    }
  }, [courseId])

  if (state.status === "loading") return <Skeleton />
  if (state.status === "error") return <ErrorState message={state.message} />

  const { diagnostic, planDashboardData, hasJourney, journeyCourseId } = state.data
  // JRN-D — CTA/rota da jornada apontam ao curso certo (?curso=), quando conhecido.
  const journeyHref = journeyCourseId
    ? `/jornada?curso=${encodeURIComponent(journeyCourseId)}`
    : "/jornada"
  // Sem jornada persistida → estado-convite honesto (nunca número fake).
  if (!hasJourney || !diagnostic || !planDashboardData) {
    return <JourneyInviteState journeyHref={journeyHref} />
  }

  const weekly = planDashboardData.weeklyComparison
  const rows = buildPlanRows(diagnostic, planDashboardData.cumulativeExpected, {
    continueHref,
    interactionHref: interactionHref ?? null,
    reflectionHref: reflectionHref ?? null,
  })

  return (
    <div className="space-y-4" data-testid="plan-comparison-panel">
      <PlanComparisonTable rows={rows} />
      {weekly ? (
        <>
          <WeeklyChecklistCard weekly={weekly} planDashboardData={planDashboardData} />
          <SuggestedAdjustmentCard weekly={weekly} journeyHref={journeyHref} />
        </>
      ) : (
        <p className="text-sm text-text-muted">
          Sem sessões registradas nesta semana ainda para comparar com a sua jornada.
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Table — MEU PLANO | REALIZADO | COMO ESTOU | AÇÃO
// ---------------------------------------------------------------------------

type PlanRowStatus = "ok" | "pendente" | "sem-meta"

interface PlanRow {
  key: string
  label: string
  planned: string
  realized: string
  status: PlanRowStatus
  actionHref: string
  actionLabel: string
}

/**
 * PURE row builder — no calculation, only reads already-computed
 * `CumulativeExpected`/`StudyPlanDiagnostic` fields (`computeCumulativeExpected`/
 * `buildStudyPlanDiagnostic`, never re-derived here). 3 rows, chosen because
 * they're the ONLY "Meu ritmo" indicators with a REAL plan-backed target today
 * (sessions/reflections cumulative vs. the weekly-rhythm-scaled-by-elapsed-time
 * plan, progress from `expectedProgressPct`) — "Último acesso" and
 * "Engajamento" have no plan equivalent to compare against, so they're not
 * fabricated here. "Realizado" for sessions/reflections is the SAME lifetime
 * count the sibling "Visão detalhada" toggle shows (`sessionsDoneCount`/
 * `reflDoneCount` == `subject.interactions`/`.reflections`) — SH-3.3 R7,
 * Hugo 2026-07-21.
 */
function buildPlanRows(
  diagnostic: NonNullable<PlanComparisonResponse["diagnostic"]>,
  cumulativeExpected: NonNullable<
    PlanComparisonResponse["planDashboardData"]
  >["cumulativeExpected"],
  hrefs: { continueHref: string; interactionHref: string | null; reflectionHref: string | null },
): PlanRow[] {
  const rows: PlanRow[] = []

  if (cumulativeExpected) {
    rows.push({
      key: "sessions",
      label: "Sessões",
      planned: `${cumulativeExpected.sessions}`,
      realized: `${diagnostic.sessionsDoneCount}`,
      status: diagnostic.sessionsDoneCount >= cumulativeExpected.sessions ? "ok" : "pendente",
      actionHref: hrefs.interactionHref ?? hrefs.continueHref,
      actionLabel: "Fazer uma interação",
    })
    if (cumulativeExpected.reflections > 0 || diagnostic.reflDoneCount > 0) {
      rows.push({
        key: "reflections",
        label: "Reflexões",
        planned: `${cumulativeExpected.reflections}`,
        realized: `${diagnostic.reflDoneCount}`,
        status: diagnostic.reflDoneCount >= cumulativeExpected.reflections ? "ok" : "pendente",
        actionHref: hrefs.reflectionHref ?? hrefs.continueHref,
        actionLabel: "Registrar uma reflexão",
      })
    }
  }

  rows.push({
    key: "progress",
    label: "Progresso da trilha",
    planned: diagnostic.progressTarget != null ? `${Math.round(diagnostic.progressTarget)}%` : "—",
    realized: `${Math.round(diagnostic.progressNow)}%`,
    status:
      diagnostic.progressTarget == null
        ? "sem-meta"
        : diagnostic.progressNow >= diagnostic.progressTarget
          ? "ok"
          : "pendente",
    actionHref: hrefs.interactionHref ?? hrefs.continueHref,
    actionLabel: "Continuar sessão",
  })

  return rows
}

function PlanStatusChip({ status }: { status: PlanRowStatus }) {
  if (status === "ok") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-semantic-success/14 px-2.5 py-1 text-[10.5px] font-bold text-semantic-success">
        <CheckCircle2 size={11} aria-hidden="true" />
        Cumprido
      </span>
    )
  }
  if (status === "sem-meta") {
    return (
      <span className="inline-flex items-center rounded-full bg-text-muted/14 px-2.5 py-1 text-[10.5px] font-bold text-text-secondary">
        Sem meta definida
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-semantic-warning/14 px-2.5 py-1 text-[10.5px] font-bold text-semantic-warning">
      Pendente
    </span>
  )
}

function PlanComparisonTable({ rows }: { rows: PlanRow[] }) {
  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{ border: "1px solid var(--color-border-subtle)" }}
      data-testid="plan-comparison-table"
    >
      {/* SH-3.4 (responsividade) — MESMA decisão da tabela irmã
          (comparison-insights-table.tsx): colapso CSS-ONLY abaixo de lg, os
          mesmos nós <table>/<tr>/<td> re-displayados como cards por indicador
          via variantes max-lg:*, sem duplicar DOM (getByTestId estrito dos
          testes) e sem tocar o desktop aprovado (lg+ intacto). */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm max-lg:block">
          <thead className="max-lg:hidden">
            <tr
              style={{
                backgroundColor: "var(--color-bg-elevated)",
                borderBottom: "1px solid var(--color-border-subtle)",
              }}
            >
              <th className="px-4 py-3 text-left">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Indicador
                </span>
              </th>
              <th className="px-4 py-3 text-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Minha jornada
                </span>
              </th>
              <th className="px-4 py-3 text-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                  Realizado
                </span>
              </th>
              <th className="px-4 py-3 text-left">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Como estou
                </span>
              </th>
              <th className="px-4 py-3 text-center">
                <span className="sr-only">Ação</span>
              </th>
            </tr>
          </thead>
          <tbody className="max-lg:block">
            {rows.map((row, i) => (
              <tr
                key={row.key}
                data-testid={`plan-row-${row.key}`}
                // SH-3.4 — card mobile: nome (span 2) / Meu plano | Realizado
                // lado a lado / chip (span 2) / ação full-width (span 2).
                className="transition-colors hover:bg-bg-hover max-lg:grid max-lg:grid-cols-2 max-lg:gap-x-3 max-lg:gap-y-3 max-lg:p-4"
                style={i > 0 ? { borderTop: "1px solid var(--color-border-subtle)" } : undefined}
              >
                <td className="px-4 py-4 text-left max-lg:col-span-2 max-lg:p-0">
                  <span className="text-sm font-semibold text-text-primary">{row.label}</span>
                </td>
                <td className="px-4 py-4 text-center text-sm font-medium text-text-secondary tabular-nums max-lg:p-0">
                  {/* SH-3.4 — mini-cabeçalho da célula no mobile (thead oculto
                      abaixo de lg). Minúsculas + uppercase via CSS, mesma razão
                      da tabela irmã (unicidade de texto nas queries). */}
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted lg:hidden">
                    minha jornada
                  </div>
                  {row.planned}
                </td>
                <td className="px-4 py-4 text-center text-sm font-bold text-text-primary tabular-nums max-lg:p-0">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted lg:hidden">
                    realizado
                  </div>
                  {row.realized}
                </td>
                <td className="px-4 py-4 text-left max-lg:col-span-2 max-lg:p-0">
                  <PlanStatusChip status={row.status} />
                </td>
                <td className="px-4 py-4 text-center max-lg:col-span-2 max-lg:p-0">
                  <Link
                    href={row.actionHref}
                    data-testid={`plan-action-${row.key}`}
                    // SH-3.4 — full-width + alvo de toque ≥44px no mobile.
                    className={`${buttonVariants({ variant: "outline", size: "sm" })} max-lg:min-h-11 max-lg:w-full`}
                  >
                    {row.actionLabel}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// "Meu plano da semana" — checklist, SAME done-predicate as
// PlanDashboardScreen's "Sua semana" panel (realized >= planned per item).
// ---------------------------------------------------------------------------

function WeeklyChecklistCard({
  weekly,
  planDashboardData,
}: {
  weekly: NonNullable<NonNullable<PlanComparisonResponse["planDashboardData"]>["weeklyComparison"]>
  planDashboardData: NonNullable<PlanComparisonResponse["planDashboardData"]>
}) {
  return (
    <div
      className="rounded-2xl border border-border-subtle bg-bg-card p-5"
      data-testid="plan-weekly-checklist"
    >
      <h4 className="font-display text-sm font-extrabold text-text-primary">
        Minha semana na jornada
      </h4>
      <p className="mt-1 text-xs text-text-muted">
        {planDashboardData.currentChapterOrder != null ? (
          <>
            Meta: <b className="text-cerrado-500">Módulo {planDashboardData.currentChapterOrder}</b>
            {planDashboardData.currentChapterTitle
              ? ` · ${planDashboardData.currentChapterTitle}`
              : ""}
          </>
        ) : (
          "Avançar na sua trilha"
        )}
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <ChecklistRow
          done={weekly.realized.sessions >= weekly.planned.sessions}
          title="Sessões da semana"
          subtitle={`${weekly.realized.sessions} de ${weekly.planned.sessions} combinadas`}
        />
        {weekly.planned.reflections > 0 && (
          <ChecklistRow
            done={weekly.realized.reflections >= weekly.planned.reflections}
            title="Reflexões da semana"
            subtitle={`${weekly.realized.reflections} de ${weekly.planned.reflections} combinadas`}
          />
        )}
      </div>
    </div>
  )
}

function ChecklistRow({
  done,
  title,
  subtitle,
}: {
  done: boolean
  title: string
  subtitle: string
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 ${
        done
          ? "border-semantic-success/30 bg-semantic-success/[0.06]"
          : "border-border-subtle bg-bg-elevated"
      }`}
    >
      <span
        className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg border ${
          done
            ? "border-semantic-success/40 bg-semantic-success/15 text-semantic-success"
            : "border-border-subtle bg-bg-card text-text-secondary"
        }`}
      >
        {done ? (
          <CheckCircle2 size={15} aria-hidden="true" />
        ) : (
          <Circle size={15} aria-hidden="true" />
        )}
      </span>
      <div className="min-w-0">
        <div
          className={`text-[13px] font-semibold ${done ? "text-text-secondary line-through decoration-text-muted/60" : "text-text-primary"}`}
        >
          {title}
        </div>
        <div className="mt-0.5 text-[11.5px] text-text-muted">{subtitle}</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// "Próximo ajuste sugerido" — light, mata-atlantica-tinted card (SAME
// color-mix pattern StudyPlanInviteStrip already uses, just the green brand
// token instead of cerrado). Deliberately NOT the dark neutral-900 pattern —
// this card wants the light/positive "coach" tone from the reference mockup,
// which sidesteps the bg-bg-elevated-in-light-mode trap entirely.
// ---------------------------------------------------------------------------

function SuggestedAdjustmentCard({
  weekly,
  journeyHref,
}: {
  weekly: NonNullable<NonNullable<PlanComparisonResponse["planDashboardData"]>["weeklyComparison"]>
  journeyHref: string
}) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const isPending = weekly.situation === "pendente"

  return (
    <div
      className="flex flex-col gap-3 rounded-2xl border p-5 sm:flex-row sm:items-start sm:gap-4"
      data-testid="plan-suggested-adjustment"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in oklch, var(--color-mata-atlantica) 8%, var(--color-bg-card)), var(--color-bg-card))",
        borderColor:
          "color-mix(in oklch, var(--color-mata-atlantica) 22%, var(--color-border-subtle))",
      }}
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
        style={{ background: "color-mix(in oklch, var(--color-mata-atlantica) 16%, white)" }}
      >
        <Sparkles size={20} className="text-mata-atlantica" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="font-display text-sm font-extrabold text-text-primary">
          Próximo ajuste sugerido
        </h4>
        <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
          {isPending
            ? "Você está um pouco abaixo do combinado esta semana. Dá para redistribuir a jornada sem alterar sua data final."
            : "Você está em dia com o combinado desta semana — nenhum ajuste necessário por agora."}
        </p>
        {/* SH-3.4 — abaixo de sm os dois botões viram full-width empilhados
            (w-full dentro do flex-wrap ocupa a linha inteira) com alvo de toque
            ≥44px; em sm+ o par lado a lado segue como aprovado. JRN-D — "Revisar
            jornada" aponta à rota real /jornada (revisar) do curso. */}
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={journeyHref}
            data-testid="plan-suggested-recalc"
            className={`${buttonVariants({ size: "sm" })} max-sm:min-h-11 max-sm:w-full`}
          >
            <CalendarClock size={14} aria-hidden="true" />
            Revisar jornada
          </Link>
          <button
            type="button"
            data-testid="plan-suggested-keep"
            onClick={() => setDismissed(true)}
            className={`${buttonVariants({ variant: "ghost", size: "sm" })} max-sm:min-h-11 max-sm:w-full`}
          >
            Manter como está
          </button>
        </div>
      </div>
    </div>
  )
}
