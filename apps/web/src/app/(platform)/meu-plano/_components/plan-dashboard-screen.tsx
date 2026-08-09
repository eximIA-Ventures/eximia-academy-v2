"use client"

// ---------------------------------------------------------------------------
// PlanDashboardScreen — "Meu Plano" ACTIVE dashboard (Tela 1, SH-3.3)
// ---------------------------------------------------------------------------
// Structural port of `JARVIS/apps/hub-discovery/meu-plano-modelo-oficial-v2.html`
// (verified 1:1 against Hugo's 5 reference screenshots), with real eximIA
// brand tokens (never the mockup's ARGOS reference marks). Every number here
// is either real (from `diagnostic`/`choice`/`projection`, already validated
// by SH-3.1/SH-3.2, or from the SSR-fetched `planDashboardData`) or an
// EXPLICIT empty state — never a silent placeholder (AC2/AC6).
//
// SH-3.3 pivot: this screen is now the DEFAULT/initial screen of /meu-plano
// (no more full-screen config gate ahead of it). The day/session/reflection
// adjuster — formerly its own screen — lives inline inside the "Seu plano
// sugerido" panel, revealed by the "Ajustar plano" toggle (`adjustOpen`).
// ---------------------------------------------------------------------------

import { formatPctPtBR1 } from "@/components/analytics/comparison-insights-table"
import type { ModuleJourneyItem, WeeklyComparison } from "@/lib/analytics/study-plan-dashboard"
import type {
  StudyPlanChoice,
  StudyPlanDiagnostic,
  computeStudyPlanProjection,
} from "@/lib/analytics/study-plan-projection"
import { WEEKDAY_LABELS } from "@/lib/analytics/study-plan-projection"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  Button,
  Switch,
} from "@eximia/ui"
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Compass,
  Gauge,
  PenSquare,
  Pencil,
  RotateCcw,
  TrendingUp,
} from "lucide-react"
import Link from "next/link"
import type { PlanDashboardData } from "../page"
import type { PlanHrefs } from "./meu-plano-client"

type Projection = ReturnType<typeof computeStudyPlanProjection>

function pct1(value: number): string {
  return formatPctPtBR1(value).replace(/,0$/, "")
}

function formatDatePtBR(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
}

export function PlanDashboardScreen({
  firstName,
  diagnostic,
  choice,
  projection,
  classAvgProgressPct,
  planDashboardData,
  weeklyComparison,
  planHrefs,
  warningDismissed,
  adjustOpen,
  onRecalc,
  onKeep,
  onToggleAdjust,
  onToggleDay,
  onSetSessionsPerDay,
  onSetReflFocus,
  onReset,
  onCloseAdjust,
}: {
  firstName: string
  diagnostic: StudyPlanDiagnostic
  choice: StudyPlanChoice
  projection: Projection
  classAvgProgressPct: number | null
  planDashboardData: PlanDashboardData
  weeklyComparison: WeeklyComparison | null
  planHrefs: PlanHrefs
  warningDismissed: boolean
  adjustOpen: boolean
  onRecalc: () => void
  onKeep: () => void
  onToggleAdjust: () => void
  onToggleDay: (index: number) => void
  onSetSessionsPerDay: (next: number) => void
  onSetReflFocus: (next: boolean) => void
  onReset: () => void
  onCloseAdjust: () => void
}) {
  const chosenDayLabels = choice.days
    .map((on, i) => (on ? WEEKDAY_LABELS[i] : null))
    .filter(Boolean)
    .join(" · ")

  const hasCourse = planDashboardData.courseTitle != null
  const hasWeekly = weeklyComparison != null

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6">
      {/* breadcrumb — "‹ Meu ritmo" volta para o painel principal (/dashboard) */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              href="/dashboard"
              data-testid="plan-dashboard-back-link"
              className="inline-flex items-center gap-1"
            >
              <ChevronLeft size={15} aria-hidden="true" />
              Meu ritmo
            </BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="mt-4">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
          Meu Plano
        </h1>
        <p className="mt-2 text-sm text-text-secondary sm:text-[15px]">
          Acompanhe, confirme e ajuste o ritmo da sua jornada.
        </p>
      </header>

      {/* ===== hero — banner ESCURO da referência (audit fix). bg-neutral-900
          fixo (NUNCA bg-bg-elevated: token theme-aware que vira branco no modo
          claro), textos em branco/neutral explícitos pelo mesmo motivo. ===== */}
      <section
        data-testid="plan-dashboard-hero"
        className="relative mt-6 overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900 p-5 shadow-elevated sm:p-8"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cerrado-600/[0.14] via-transparent to-neutral-950/60"
        />
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-semantic-success/40 bg-semantic-success/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-semantic-success">
              <span className="h-1.5 w-1.5 rounded-full bg-semantic-success" aria-hidden="true" />
              Plano ativo
            </span>
            <h2 className="mt-3.5 font-display text-2xl font-extrabold text-white">
              Oi, {firstName}.
            </h2>
            <p className="mt-2 max-w-md text-sm text-neutral-300">
              Seu plano está <b className="font-bold text-semantic-success">ativo</b>. Acompanhe o
              combinado e ajuste quando necessário.
            </p>
          </div>
          <Button
            onClick={onRecalc}
            data-testid="hero-recalc-cta"
            className="min-h-[44px] w-full sm:w-auto"
          >
            Revisar plano
            <ArrowRight size={15} aria-hidden="true" />
          </Button>
        </div>
      </section>

      {/* ===== 4 stat cards ===== */}
      <section className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<BookOpen size={16} aria-hidden="true" />}
          label="Trilha"
          value={planDashboardData.courseTitle ?? "Sem trilha vinculada"}
        />
        <StatCard
          icon={<Compass size={16} aria-hidden="true" />}
          label="Módulo atual"
          value={
            planDashboardData.currentChapterOrder != null
              ? `Módulo ${planDashboardData.currentChapterOrder}`
              : "—"
          }
          sub={planDashboardData.currentChapterTitle ?? undefined}
        />
        <StatCard
          icon={<TrendingUp size={16} aria-hidden="true" />}
          label="Progresso geral"
          value={`${Math.round(diagnostic.progressNow)}%`}
          sub={
            classAvgProgressPct != null
              ? `turma ${Math.round(classAvgProgressPct)}%`
              : "sem média de turma"
          }
          barPct={diagnostic.progressNow}
        />
        <StatCard
          icon={<Gauge size={16} aria-hidden="true" />}
          label="Ritmo escolhido"
          value={`${projection.sessionsPerWeek}`}
          valueSuffix="sessões / semana"
          sub={chosenDayLabels || "nenhum dia escolhido"}
          testId="stat-ritmo-value"
        />
      </section>

      {/* ===== 2 colunas: plano sugerido | sua semana ===== */}
      <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ESQUERDA: Seu plano sugerido */}
        <Panel
          title="Seu plano sugerido"
          description="Nossa IA estruturou um plano personalizado para você evoluir com autonomia."
        >
          <div className="grid grid-cols-2 gap-2.5">
            <Metric
              icon={<Clock3 size={13} aria-hidden="true" />}
              label="Duração estimada"
              value={Number.isFinite(projection.weeksToClose) ? `${projection.weeksToClose}` : "—"}
              suffix="semanas"
            />
            <Metric
              icon={<Calendar size={13} aria-hidden="true" />}
              label="Conclusão prevista"
              value={diagnostic.daysLeft != null ? `${diagnostic.daysLeft}` : "—"}
              suffix="dias restantes"
            />
            <Metric
              icon={<TrendingUp size={13} aria-hidden="true" />}
              label="Ritmo sugerido"
              value={`${projection.sessionsPerWeek}`}
              suffix="sessões/sem"
            />
            <Metric
              icon={<Clock3 size={13} aria-hidden="true" />}
              label="Tempo médio / sessão"
              value={
                planDashboardData.avgMinutesPerSession != null
                  ? `~${planDashboardData.avgMinutesPerSession}`
                  : "—"
              }
              suffix="min"
            />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-semantic-success/30 bg-semantic-success/10 px-3 py-1.5 text-[11.5px] font-bold text-semantic-success">
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
              Plano ativo
            </span>
            <button
              type="button"
              onClick={onToggleAdjust}
              aria-expanded={adjustOpen}
              data-testid="adjust-toggle"
              className="inline-flex items-center gap-1 text-xs font-bold text-cerrado-500 transition-colors hover:text-cerrado-600"
            >
              {adjustOpen ? "Fechar ajuste" : "Ajustar plano"}
              <ChevronDown
                size={14}
                aria-hidden="true"
                className={`transition-transform ${adjustOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          {/* ---------------------------------------------------------- */}
          {/* AJUSTE INLINE (SH-3.3 pivot) — dias/sessões/reflexão vivem   */}
          {/* aqui dentro, não em tela separada. Revelação progressiva:   */}
          {/* fechado por default, só quem quer mexer abre.               */}
          {/* ---------------------------------------------------------- */}
          {adjustOpen && (
            <div
              data-testid="adjust-panel"
              className="mt-4 border-t border-border-subtle pt-4"
            >
              <p className="text-xs font-semibold text-text-primary">
                Dias em que você consegue estudar
              </p>
              <div className="mt-2.5 grid grid-cols-7 gap-1.5">
                {choice.days.map((on, i) => {
                  const isRefl = on && choice.reflFocus
                  return (
                    <button
                      key={WEEKDAY_LABELS[i]}
                      type="button"
                      aria-pressed={on}
                      onClick={() => onToggleDay(i)}
                      className={`flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-xl border px-1 py-2 text-center transition-[transform,background-color,border-color] duration-[var(--motion-fast,150ms)] hover:-translate-y-0.5 active:scale-[0.98] ${
                        on
                          ? "border-cerrado-600/55 bg-cerrado-600/[0.07]"
                          : "border-border-subtle bg-bg-card"
                      }`}
                    >
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wide ${
                          on ? "text-cerrado-500" : "text-text-muted"
                        }`}
                      >
                        {WEEKDAY_LABELS[i]}
                      </span>
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-[background-color,border-color,color] duration-[var(--motion-base,220ms)] ease-[var(--ease-out-quart,ease-out)] ${
                          isRefl
                            ? "border-semantic-warning bg-semantic-warning text-black"
                            : on
                              ? "border-cerrado-600 bg-cerrado-600 text-white"
                              : "border-border-medium text-text-muted"
                        }`}
                      >
                        {on ? isRefl ? <Pencil size={13} /> : <BookOpen size={13} /> : "+"}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* sessões + reflexão, lado a lado */}
              <div className="mt-4 flex flex-wrap gap-3">
                <div className="min-w-[200px] flex-1 rounded-xl border border-border-subtle bg-bg-elevated p-4">
                  <p className="text-xs font-semibold text-text-primary">
                    Sessões por dia de estudo
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="menos sessões"
                      disabled={choice.sessionsPerDay <= 1}
                      onClick={() => onSetSessionsPerDay(choice.sessionsPerDay - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-medium bg-bg-card text-text-primary transition-colors hover:bg-bg-hover disabled:opacity-35"
                    >
                      –
                    </button>
                    <span className="min-w-[28px] text-center font-display text-xl font-extrabold text-text-primary tabular-nums">
                      {choice.sessionsPerDay}
                    </span>
                    <button
                      type="button"
                      aria-label="mais sessões"
                      disabled={choice.sessionsPerDay >= 5}
                      onClick={() => onSetSessionsPerDay(choice.sessionsPerDay + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-medium bg-bg-card text-text-primary transition-colors hover:bg-bg-hover disabled:opacity-35"
                    >
                      +
                    </button>
                    <span className="text-xs text-text-muted">sessões / dia</span>
                  </div>
                </div>
                <div className="min-w-[200px] flex-1 rounded-xl border border-border-subtle bg-bg-elevated p-4">
                  <p className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                    Foco em reflexão
                    <span className="rounded bg-semantic-warning/15 px-1.5 py-0.5 text-[8.5px] font-bold uppercase text-semantic-warning">
                      seu gap real
                    </span>
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <Switch
                      checked={choice.reflFocus}
                      onCheckedChange={onSetReflFocus}
                      aria-label="Priorizar reflexão"
                    />
                    <span className="text-xs font-semibold text-text-primary">
                      {choice.reflFocus ? "1 reflexão em cada dia" : "reflexão desligada"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onReset}>
                  <RotateCcw size={15} aria-hidden="true" />
                  Voltar ao plano sugerido
                </Button>
                <Button size="sm" onClick={onCloseAdjust} data-testid="adjust-close">
                  <Check size={15} aria-hidden="true" />
                  Concluir ajuste
                </Button>
              </div>
            </div>
          )}
        </Panel>

        {/* DIREITA: Sua semana */}
        <Panel title="Sua semana" description="O que te recoloca no ritmo esta semana.">
          {hasWeekly ? (
            <>
              <div className="mb-4 rounded-xl border border-cerrado-600/20 bg-cerrado-600/[0.06] px-3.5 py-3 text-[13px] font-semibold text-text-primary">
                Meta da semana:{" "}
                {planDashboardData.currentChapterOrder != null ? (
                  <b className="text-cerrado-500">
                    Módulo {planDashboardData.currentChapterOrder}
                    {planDashboardData.currentChapterTitle
                      ? ` · ${planDashboardData.currentChapterTitle}`
                      : ""}
                  </b>
                ) : (
                  "avançar na sua trilha"
                )}
              </div>
              <div className="flex flex-col gap-2">
                {/* audit fix — cada item é um Link real (chevron ">") para a
                    próxima ação pendente; sem pendência, degrada para o
                    continueHref genérico (nunca href morto). */}
                <ChecklistItem
                  done={weeklyComparison.realized.sessions >= weeklyComparison.planned.sessions}
                  title="Sessões da semana"
                  subtitle={`${weeklyComparison.realized.sessions} de ${weeklyComparison.planned.sessions} combinadas`}
                  href={planHrefs.interactionHref ?? planHrefs.continueHref}
                  testId="week-item-sessions"
                />
                {weeklyComparison.planned.reflections > 0 && (
                  <ChecklistItem
                    done={
                      weeklyComparison.realized.reflections >= weeklyComparison.planned.reflections
                    }
                    title="Reflexões da semana"
                    subtitle={`${weeklyComparison.realized.reflections} de ${weeklyComparison.planned.reflections} combinadas`}
                    href={planHrefs.reflectionHref ?? planHrefs.continueHref}
                    testId="week-item-reflections"
                  />
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-text-muted">
              Ainda não há sessões desta semana para comparar com o combinado.
            </p>
          )}
          {/* audit fix — saída de ação principal do painel (referência) */}
          <div className="mt-4 flex justify-end">
            <Link
              href={planHrefs.continueHref}
              data-testid="continue-journey-cta"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-border-medium bg-transparent px-5 py-2 text-sm font-semibold tracking-wide text-text-primary transition-all duration-200 hover:border-cerrado-500/40 hover:bg-cerrado-500/10 hover:text-cerrado-500"
            >
              Continuar jornada
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </Panel>
      </section>

      {/* ===== 2 colunas embaixo: jornada planejada | plano x realizado ===== */}
      <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ESQUERDA: Sua jornada planejada */}
        <Panel
          title="Sua jornada planejada"
          description="Cada módulo do curso, com prazo sugerido e o que se espera de você."
        >
          {hasCourse && planDashboardData.moduleJourney.length > 0 ? (
            <>
              <ModuleJourneyTable items={planDashboardData.moduleJourney} />
              <p className="mt-3.5 flex items-start gap-2 text-[11px] leading-relaxed text-text-muted">
                <Circle size={11} className="mt-0.5 flex-none" aria-hidden="true" />
                <span>
                  O <b className="text-text-secondary">prazo sugerido</b> é distribuído pelo custo
                  de cada módulo (reflexão pesa mais que interação). O peso{" "}
                  <b className="text-text-secondary">reflexão ÷ interação = 3</b> é ilustrativo e
                  será calibrado com dado real.
                </span>
              </p>
            </>
          ) : (
            <p className="text-sm text-text-muted">
              Ainda não há capítulos suficientes na sua trilha para montar a jornada por módulo.
            </p>
          )}
        </Panel>

        {/* DIREITA: Seu plano x seu realizado */}
        <Panel
          title="Seu plano x seu realizado"
          description={
            hasWeekly
              ? `Semana de ${formatDatePtBR(weeklyComparison.weekStart)} a ${formatDatePtBR(weeklyComparison.weekEnd)}.`
              : "O combinado da semana contra o que você entregou."
          }
        >
          {hasWeekly ? (
            <>
              <WeeklyComparisonTable comparison={weeklyComparison} />
              {weeklyComparison.situation === "pendente" && !warningDismissed && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-semantic-warning/24 bg-semantic-warning/[0.08] px-4 py-3.5">
                  <p className="text-[12.5px] leading-relaxed text-text-secondary">
                    Você está <b className="text-text-primary">abaixo do combinado</b> nesta semana.
                    Posso redistribuir a jornada sem alterar sua data final.
                  </p>
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2.5">
                <Button onClick={onRecalc} data-testid="recalc-cta" className="min-h-[44px]">
                  Recalcular plano
                </Button>
                {/* audit fix — par de decisão da referência direto no dashboard;
                    mesmo handler do "Manter como está" da Tela 2. */}
                <Button
                  variant="outline"
                  onClick={onKeep}
                  data-testid="keep-cta"
                  className="min-h-[44px]"
                >
                  Manter como está
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-text-muted">
              Sem sessões registradas nesta semana ainda — volte depois de estudar um pouco.
            </p>
          )}
        </Panel>
      </section>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  valueSuffix,
  sub,
  barPct,
  testId,
}: {
  icon: React.ReactNode
  label: string
  value: string
  valueSuffix?: string
  sub?: string
  barPct?: number
  testId?: string
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-border-subtle bg-bg-card p-4 shadow-card">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-cerrado-600/12 text-cerrado-500">
          {icon}
        </span>
        <span className="text-[10.5px] font-bold uppercase tracking-wide text-text-muted">
          {label}
        </span>
      </div>
      <div
        data-testid={testId}
        className="font-display text-lg font-extrabold leading-tight text-text-primary"
      >
        {value}
        {valueSuffix && (
          <small className="ml-1 text-xs font-medium text-text-secondary">{valueSuffix}</small>
        )}
      </div>
      {sub && <div className="text-[11.5px] font-medium text-text-secondary">{sub}</div>}
      {barPct != null && (
        <div className="h-1.5 overflow-hidden rounded-full border border-border-subtle bg-bg-elevated">
          <span
            className="block h-full rounded-full bg-cerrado-600"
            style={{ width: `${Math.min(100, Math.max(0, barPct))}%` }}
          />
        </div>
      )}
    </div>
  )
}

function Panel({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-border-subtle bg-bg-card p-5.5 shadow-card">
      <div className="mb-4">
        <h3 className="font-display text-base font-extrabold text-text-primary">{title}</h3>
        <p className="mt-1.5 text-xs text-text-muted">{description}</p>
      </div>
      {children}
    </div>
  )
}

function Metric({
  icon,
  label,
  value,
  suffix,
}: {
  icon: React.ReactNode
  label: string
  value: string
  suffix: string
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-elevated px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 font-display text-[17px] font-extrabold text-text-primary">
        {value} <small className="text-[11px] font-medium text-text-secondary">{suffix}</small>
      </div>
    </div>
  )
}

// audit fix — item do checklist é um Link real com chevron ">" (padrão da
// referência): leva o aluno para a próxima ação, não só informa.
function ChecklistItem({
  done,
  title,
  subtitle,
  href,
  testId,
}: {
  done: boolean
  title: string
  subtitle: string
  href: string
  testId?: string
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className={`group flex min-h-[44px] items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors ${
        done
          ? "border-semantic-success/30 bg-semantic-success/[0.06] hover:border-semantic-success/50"
          : "border-border-subtle bg-bg-elevated hover:border-cerrado-500/40 hover:bg-bg-hover"
      }`}
    >
      <span
        className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg border transition-[background-color,border-color,color] duration-[var(--motion-base,220ms)] ease-[var(--ease-out-quart,ease-out)] ${
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
      <div className="min-w-0 flex-1">
        <div
          className={`text-[13px] font-semibold ${done ? "text-text-secondary line-through decoration-text-muted/60" : "text-text-primary"}`}
        >
          {title}
        </div>
        <div className="mt-0.5 text-[11.5px] text-text-muted">{subtitle}</div>
      </div>
      <ChevronRight
        size={16}
        aria-hidden="true"
        className="flex-none text-text-muted transition-colors group-hover:text-cerrado-500"
      />
    </Link>
  )
}

function statusBadge(status: ModuleJourneyItem["status"]) {
  switch (status) {
    case "done":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-semantic-success/14 px-2.5 py-1 text-[10.5px] font-bold text-semantic-success">
          <CheckCircle2 size={11} aria-hidden="true" />
          Concluído
        </span>
      )
    case "doing":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cerrado-600/13 px-2.5 py-1 text-[10.5px] font-bold text-cerrado-500">
          <PenSquare size={11} aria-hidden="true" />
          Em andamento
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-text-muted/14 px-2.5 py-1 text-[10.5px] font-bold text-text-secondary">
          Planejado
        </span>
      )
  }
}

function ModuleJourneyTable({ items }: { items: ModuleJourneyItem[] }) {
  return (
    // overflow-x-auto + min-w interno: em telas pequenas a tabela rola na
    // horizontal em vez de estourar o card (ultra responsivo, rodada Hugo).
    <div className="overflow-x-auto rounded-xl border border-border-subtle">
      <table className="w-full min-w-[520px] border-collapse text-[13px]">
        <thead>
          <tr className="bg-bg-surface">
            <th className="px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-text-muted">
              Módulo
            </th>
            <th className="px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-text-muted">
              Prazo
            </th>
            <th className="px-3.5 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-text-muted">
              Inter.
            </th>
            <th className="px-3.5 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-text-muted">
              Reflex.
            </th>
            <th className="px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-text-muted">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.chapterId} className="border-t border-border-subtle">
              <td className="px-3.5 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border text-[11px] font-extrabold ${
                      item.status === "done"
                        ? "border-semantic-success bg-semantic-success text-black"
                        : item.status === "doing"
                          ? "border-cerrado-500 bg-cerrado-600 text-white"
                          : "border-border-medium bg-bg-elevated text-text-secondary"
                    }`}
                  >
                    {item.status === "done" ? (
                      <CheckCircle2 size={12} aria-hidden="true" />
                    ) : (
                      item.order
                    )}
                  </span>
                  <span className="font-semibold text-text-primary">{item.title}</span>
                </div>
              </td>
              <td className="px-3.5 py-2.5 text-text-secondary">
                {formatDatePtBR(item.suggestedDeadline) ?? "—"}
              </td>
              <td className="px-3.5 py-2.5 text-center font-bold text-text-secondary tabular-nums">
                {item.interactionsExpected}
              </td>
              <td className="px-3.5 py-2.5 text-center font-bold text-text-secondary tabular-nums">
                {item.reflectionsExpected}
              </td>
              <td className="px-3.5 py-2.5">{statusBadge(item.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function WeeklyComparisonTable({ comparison }: { comparison: WeeklyComparison }) {
  const rows: Array<{
    key: string
    label: string
    icon: React.ReactNode
    planned: number
    realized: number
  }> = [
    {
      key: "sessions",
      label: "Sessões",
      icon: <PenSquare size={13} aria-hidden="true" />,
      planned: comparison.planned.sessions,
      realized: comparison.realized.sessions,
    },
  ]
  if (comparison.planned.reflections > 0 || comparison.realized.reflections > 0) {
    rows.push({
      key: "reflections",
      label: "Reflexões",
      icon: <Pencil size={13} aria-hidden="true" />,
      planned: comparison.planned.reflections,
      realized: comparison.realized.reflections,
    })
  }

  return (
    // mesmo padrão responsivo da ModuleJourneyTable: scroll horizontal no mobile.
    <div className="overflow-x-auto rounded-xl border border-border-subtle">
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
          {rows.map((row) => {
            const ok = row.realized >= row.planned
            const gap = row.planned - row.realized
            return (
              <tr key={row.key} className="border-t border-border-subtle">
                <td className="px-3.5 py-2.5">
                  <div className="flex items-center gap-2 font-semibold text-text-primary">
                    {row.icon}
                    {row.label}
                  </div>
                </td>
                <td className="px-3.5 py-2.5 text-center font-bold text-text-secondary tabular-nums">
                  {row.planned}
                </td>
                <td className="px-3.5 py-2.5 text-center font-bold text-text-secondary tabular-nums">
                  {row.realized}
                </td>
                <td className="px-3.5 py-2.5">
                  {ok ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-semantic-success/14 px-2.5 py-1 text-[10.5px] font-bold text-semantic-success">
                      <CheckCircle2 size={11} aria-hidden="true" />
                      Cumprido
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-semantic-warning/14 px-2.5 py-1 text-[10.5px] font-bold text-semantic-warning">
                      {gap} pendente{gap === 1 ? "" : "s"}
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
