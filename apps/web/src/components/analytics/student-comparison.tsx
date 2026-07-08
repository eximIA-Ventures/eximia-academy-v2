"use client"

// ---------------------------------------------------------------------------
// StudentComparison — Item 1.2 (FASE 2), redesigned (padrão da casa)
// ---------------------------------------------------------------------------
// Shows the logged-in STUDENT's own performance next to the average of their
// UNIDADE (ONE reference, read-only, no PII of other students).
//
// DATA: fetched client-side from GET /api/analytics/manager-groups?view=student
//   → StudentComparison { student, unit, unitName }
//   Both sides are ComparableMetricBlock (same shape as UnitStats minus areaName).
//
// SECURITY: the endpoint resolves studentId from auth.uid() server-side.
//   This component sends NO identifying params in the query string.
//
// STATES: loading skeleton | fetch error | no-unit empty | data
//
// DESIGN: reads as a COMPARISON — one metric per row, "você" beside "média da
//   unidade" with a proportional dual bar (max = larger of the two, so bars are
//   always honest) and a signed delta vs the average. Sibling of triage-cards /
//   summary-overview: rounded-2xl bg-bg-card shadow-card, cerrado accent,
//   tabular-nums, semantic delta colors, dark-mode aware. The unit name appears
//   once as a legend, not as a giant column.
//
// The proportion/delta math lives in student-comparison-scale.ts (unit-tested).
// ---------------------------------------------------------------------------

import type {
  ComparableMetricBlock,
  StudentComparison as StudentComparisonType,
} from "@/types/analytics"
import { AlertCircle, BarChart3, CheckCircle2, Minus, TrendingUp, Users } from "lucide-react"
import { useEffect, useState } from "react"
import {
  type ComparisonMetric,
  type MetricBar,
  countLeads,
  formatMetric,
  toMetricBar,
} from "./student-comparison-scale"

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

async function fetchStudentComparison(): Promise<StudentComparisonType> {
  const res = await fetch("/api/analytics/manager-groups?view=student", {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<StudentComparisonType>
}

// ---------------------------------------------------------------------------
// Metric derivation — build the 5 comparable rows from the two metric blocks
// ---------------------------------------------------------------------------

/** Percentage of active students (0-100). Guarded against division by zero. */
function activePct(block: ComparableMetricBlock): number {
  return block.totalStudents > 0
    ? Math.round((block.activeStudents / block.totalStudents) * 100)
    : 0
}

/** Per-student unit average of a raw count (guards totalStudents = 0). */
function perStudent(total: number, students: number): number {
  return students > 0 ? total / students : 0
}

/**
 * Build the 5 comparison rows. The student side is the student's own numbers;
 * the unit side is the UNIDADE average, normalized PER STUDENT where the raw
 * count would otherwise be apples-to-oranges (completed sessions, reflections).
 */
function buildMetrics(student: ComparableMetricBlock, unit: ComparableMetricBlock): MetricBar[] {
  const metrics: ComparisonMetric[] = [
    {
      key: "completion",
      label: "Conclusão",
      studentValue: student.completionPct,
      unitValue: unit.completionPct,
      format: "pct",
    },
    {
      key: "sessions",
      label: "Sessões por período",
      studentValue: student.avgSessionsPerStudent,
      unitValue: unit.avgSessionsPerStudent,
      format: "decimal",
    },
    {
      key: "active",
      label: "Atividade (30d)",
      studentValue: activePct(student),
      unitValue: activePct(unit),
      format: "pct",
    },
    {
      key: "completed-sessions",
      label: "Sessões concluídas",
      studentValue: student.completedSessions,
      // Unit average completed-sessions PER student (Math.round → comparable int).
      unitValue: Math.round(perStudent(unit.completedSessions, unit.totalStudents)),
      format: "int",
    },
    {
      key: "reflections",
      label: "Reflexões escritas",
      studentValue: student.reflectionCount,
      unitValue: Math.round(perStudent(unit.reflectionCount, unit.totalStudents)),
      format: "int",
    },
  ]

  return metrics.map(toMetricBar)
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Card shell shared by every state so the surface is identical everywhere. */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-bg-card p-5 shadow-card dark:border dark:border-white/[0.06] dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
      {children}
    </div>
  )
}

/** Header — icon chip + title + one-line subtitle. */
function Header({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cerrado-600/10">
        <BarChart3 size={16} className="text-cerrado-600" />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-text-primary">Meu Desempenho</h3>
        <p className="truncate text-[11px] text-text-muted">{subtitle}</p>
      </div>
    </div>
  )
}

/**
 * Legend — states the two series ONCE (você = accent, média da unidade = muted),
 * with the unit name shown here instead of as a giant column.
 */
function Legend({ unitName }: { unitName: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-cerrado-600" />
        <span className="font-semibold text-text-primary">Você</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-black/[0.18] dark:bg-white/[0.22]" />
        <span className="inline-flex items-center gap-1 text-text-muted">
          <Users size={11} />
          média · <span className="font-medium text-text-secondary">{unitName}</span>
        </span>
      </span>
    </div>
  )
}

/** Signed delta chip vs the unit average. null delta → neutral "na média". */
function DeltaChip({ bar }: { bar: MetricBar }) {
  if (bar.deltaPct === null) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-text-muted">
        <Minus size={10} />
        na média
      </span>
    )
  }
  if (bar.deltaPct === 0) {
    return <span className="text-[10px] font-semibold text-text-muted">= média</span>
  }
  const positive = bar.deltaPct > 0
  return (
    <span
      className={`text-[10px] font-semibold tabular-nums ${
        positive ? "text-semantic-success" : "text-semantic-error"
      }`}
    >
      {positive ? "↑" : "↓"}
      {Math.abs(bar.deltaPct)}% vs média
    </span>
  )
}

/**
 * One metric row — the heart of the redesign. Reads left→right as a comparison:
 *   • label + signed delta (top line)
 *   • big student value (accent) + small unit value (muted) (value line)
 *   • dual proportional bar: student track over unit track, honest shared scale.
 */
function MetricRow({ bar }: { bar: MetricBar }) {
  return (
    <div className="space-y-1.5">
      {/* Label + delta */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-text-secondary">{bar.label}</span>
        <DeltaChip bar={bar} />
      </div>

      {/* Values: your value big + accent, unit value small + muted */}
      <div className="flex items-baseline gap-2">
        <span
          className={`text-lg font-bold tabular-nums ${
            bar.studentAhead ? "text-cerrado-600" : "text-text-primary"
          }`}
        >
          {bar.studentDisplay}
        </span>
        <span className="text-[11px] text-text-muted tabular-nums">média {bar.unitDisplay}</span>
      </div>

      {/* Dual proportional bars — honest shared scale (max = larger of the two). */}
      <div className="space-y-1">
        {/* Você */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.04] dark:bg-white/[0.05]">
          <div
            className="h-full rounded-full bg-cerrado-600 transition-all duration-500"
            style={{ width: `${bar.studentWidthPct}%` }}
          />
        </div>
        {/* Média da unidade */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.04] dark:bg-white/[0.05]">
          <div
            className="h-full rounded-full bg-black/[0.18] transition-all duration-500 dark:bg-white/[0.22]"
            style={{ width: `${bar.unitWidthPct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

/** Refined status line (replaces the generic banner). Icon + graded copy. */
function StatusLine({ leads, total }: { leads: number; total: number }) {
  const allAhead = leads === total
  const majority = leads >= Math.ceil(total / 2)

  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-3 py-2.5 ${
        allAhead
          ? "bg-cerrado-600/[0.07] ring-1 ring-cerrado-600/[0.12]"
          : "bg-black/[0.03] dark:bg-white/[0.04]"
      }`}
    >
      {allAhead ? (
        <CheckCircle2 size={15} className="shrink-0 text-cerrado-600" />
      ) : majority ? (
        <TrendingUp size={15} className="shrink-0 text-semantic-success" />
      ) : (
        <TrendingUp size={15} className="shrink-0 text-text-muted" />
      )}
      <p className="text-[11px] leading-snug text-text-secondary">
        {allAhead ? (
          <>
            Você está <span className="font-semibold text-cerrado-600">acima da média</span> da sua
            unidade em todas as {total} dimensões. Continue assim.
          </>
        ) : leads > 0 ? (
          <>
            Você está à frente da média em{" "}
            <span className="font-semibold text-text-primary tabular-nums">
              {leads} de {total}
            </span>{" "}
            dimensões.
          </>
        ) : (
          <>Suas métricas estão abaixo da média da unidade. Cada sessão concluída aproxima você.</>
        )}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loading skeleton — mirrors the real layout (header, legend, 5 rows, status)
// ---------------------------------------------------------------------------

function Skeleton() {
  return (
    <Card>
      <div className="animate-pulse space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-bg-elevated" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-32 rounded bg-bg-elevated" />
            <div className="h-2.5 w-24 rounded bg-bg-elevated" />
          </div>
        </div>
        <div className="h-2.5 w-40 rounded bg-bg-elevated" />
        <div className="space-y-4">
          {["r1", "r2", "r3", "r4", "r5"].map((k) => (
            <div key={`skeleton-row-${k}`} className="space-y-1.5">
              <div className="h-3 w-full rounded bg-bg-elevated" />
              <div className="h-1.5 w-full rounded-full bg-bg-elevated" />
              <div className="h-1.5 w-2/3 rounded-full bg-bg-elevated" />
            </div>
          ))}
        </div>
        <div className="h-10 w-full rounded-xl bg-bg-elevated" />
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Empty state — student has no UNIDADE (unit is null)
// ---------------------------------------------------------------------------

function OwnMetricsOnly({ block }: { block: ComparableMetricBlock }) {
  const cells = [
    { key: "completion", label: "Conclusão", value: formatMetric(block.completionPct, "pct") },
    {
      key: "sessions",
      label: "Sessões",
      value: formatMetric(block.avgSessionsPerStudent, "decimal"),
    },
    { key: "reflections", label: "Reflexões", value: formatMetric(block.reflectionCount, "int") },
  ]
  return (
    <Card>
      <div className="space-y-4">
        <Header subtitle="Seu progresso geral" />
        <p className="text-xs text-text-muted">
          Você ainda não está associado a uma unidade — veja seu progresso individual:
        </p>
        <div className="grid grid-cols-3 gap-3">
          {cells.map((cell) => (
            <div
              key={cell.key}
              className="rounded-xl bg-black/[0.02] py-3 text-center dark:bg-white/[0.03]"
            >
              <p className="text-xl font-bold tabular-nums text-text-primary">{cell.value}</p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                {cell.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Error state — SAME message contract as before (do not change copy).
// ---------------------------------------------------------------------------

function ErrorState({ message }: { message: string }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <AlertCircle size={16} className="mt-0.5 shrink-0 text-semantic-warning" />
        <p className="text-xs text-text-muted">
          Não foi possível carregar seu desempenho. {message}
        </p>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main comparison view
// ---------------------------------------------------------------------------

function ComparisonView({
  student,
  unit,
  unitName,
}: {
  student: ComparableMetricBlock
  unit: ComparableMetricBlock
  unitName: string
}) {
  const bars = buildMetrics(student, unit)
  const leads = countLeads(bars)

  return (
    <Card>
      <div className="space-y-5">
        <Header subtitle="Comparado à média da sua unidade" />
        <Legend unitName={unitName} />

        <div className="space-y-4">
          {bars.map((bar) => (
            <MetricRow key={bar.key} bar={bar} />
          ))}
        </div>

        <StatusLine leads={leads} total={bars.length} />
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Root export
// ---------------------------------------------------------------------------

/**
 * StudentComparison — renders the student's own metrics alongside their
 * UNIDADE average. Fetches from /api/analytics/manager-groups?view=student.
 *
 * Read-only. No PII of other students is ever displayed.
 * Insert in the student dashboard (student-dashboard.tsx) below the hero section.
 */
export function StudentComparison() {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ok"; data: StudentComparisonType }
  >({ status: "loading" })

  useEffect(() => {
    let cancelled = false

    fetchStudentComparison()
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
  }, [])

  if (state.status === "loading") return <Skeleton />
  if (state.status === "error") return <ErrorState message={state.message} />

  const { student, unit, unitName } = state.data

  // Student has no UNIDADE — show their own numbers only
  if (!unit) return <OwnMetricsOnly block={student} />

  return <ComparisonView student={student} unit={unit} unitName={unitName ?? "Unidade"} />
}
