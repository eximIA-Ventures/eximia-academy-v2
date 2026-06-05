"use client"

// ---------------------------------------------------------------------------
// StudentComparison — Item 1.2 (FASE 2)
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
// VISUAL: matches the card style of unit-comparison.tsx and student-dashboard.tsx.
// ---------------------------------------------------------------------------

import type {
  ComparableMetricBlock,
  StudentComparison as StudentComparisonType,
} from "@/types/analytics"
import { AlertCircle, BarChart2, BookOpen, Loader2, TrendingUp, Users } from "lucide-react"
import { useEffect, useState } from "react"

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
// Helpers
// ---------------------------------------------------------------------------

/** Format a percentage number as "42%" (rounded). */
function fmt(value: number, unit: "pct" | "number" | "decimal" = "pct"): string {
  if (unit === "pct") return `${Math.round(value)}%`
  if (unit === "decimal") return value.toFixed(1)
  return String(Math.round(value))
}

/** Percentage of active students (0-100, rounded). */
function activePct(block: ComparableMetricBlock): number {
  return block.totalStudents > 0
    ? Math.round((block.activeStudents / block.totalStudents) * 100)
    : 0
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** One metric cell used in the two-column comparison layout. */
function MetricCell({
  value,
  label,
  highlight,
  dimmed,
}: {
  value: string
  label: string
  highlight?: boolean
  dimmed?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className={`text-xl font-bold tabular-nums ${
          dimmed ? "text-text-muted" : highlight ? "text-cerrado-600" : "text-text-primary"
        }`}
      >
        {value}
      </span>
      <span className="text-[9px] font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </span>
    </div>
  )
}

/** Thin horizontal bar comparing a student value vs unit value visually. */
function ComparisonBar({
  studentValue,
  unitValue,
  label,
}: {
  studentValue: number
  unitValue: number
  label: string
}) {
  const max = Math.max(studentValue, unitValue, 1)
  const studentPct = (studentValue / max) * 100
  const unitPct = (unitValue / max) * 100
  const studentAhead = studentValue >= unitValue

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-text-muted">{label}</span>
        <span
          className={`font-semibold tabular-nums ${studentAhead ? "text-cerrado-600" : "text-text-muted"}`}
        >
          {studentValue}
          {unitValue > 0 && (
            <span className="text-text-muted font-normal"> / {unitValue} média</span>
          )}
        </span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-black/[0.04]">
        {/* Unit bar (grey reference) */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-black/[0.10] dark:bg-white/[0.12]"
          style={{ width: `${unitPct}%` }}
        />
        {/* Student bar (accent) */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-cerrado-600 transition-all duration-500"
          style={{ width: `${studentPct}%` }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function Skeleton() {
  return (
    <div className="rounded-2xl shadow-card bg-bg-card p-5 space-y-4 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-5 w-5 rounded-lg bg-bg-elevated" />
        <div className="h-4 w-32 rounded bg-bg-elevated" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {["m1", "m2", "m3", "m4"].map((k) => (
          <div key={`skeleton-metric-${k}`} className="h-14 rounded-xl bg-bg-elevated" />
        ))}
      </div>
      <div className="space-y-2">
        {["b1", "b2", "b3"].map((k) => (
          <div key={`skeleton-bar-${k}`} className="h-5 rounded bg-bg-elevated" />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state — student has no UNIDADE (unit is null)
// ---------------------------------------------------------------------------

function OwnMetricsOnly({ block }: { block: ComparableMetricBlock }) {
  return (
    <div className="rounded-2xl shadow-card bg-bg-card p-5 space-y-4">
      <Header noUnit />
      <p className="text-xs text-text-muted">
        Você ainda não está associado a uma unidade. Veja seu progresso geral:
      </p>
      <div className="grid grid-cols-3 gap-3 text-center">
        <MetricCell value={fmt(block.completionPct)} label="Conclusão" />
        <MetricCell value={fmt(block.avgSessionsPerStudent, "decimal")} label="Sessões" />
        <MetricCell value={String(block.reflectionCount)} label="Reflexões" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl shadow-card bg-bg-card p-5 flex items-start gap-3">
      <AlertCircle size={16} className="shrink-0 text-semantic-warning mt-0.5" />
      <p className="text-xs text-text-muted">Não foi possível carregar seu desempenho. {message}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Header (shared)
// ---------------------------------------------------------------------------

function Header({ noUnit }: { noUnit?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cerrado-600/10">
        <BarChart2 size={13} className="text-cerrado-600" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-text-primary">Meu Desempenho</h3>
        {!noUnit && <p className="text-[10px] text-text-muted">vs. média da unidade</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main comparison view — student + unit side-by-side
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
  const studentActivePct = activePct(student)
  const unitActivePct = activePct(unit)

  // Is student above unit in the three primary metrics?
  const aheadOnCompletion = student.completionPct >= unit.completionPct
  const aheadOnSessions = student.avgSessionsPerStudent >= unit.avgSessionsPerStudent
  const aheadOnReflections =
    student.reflectionCount >= Math.round(unit.reflectionCount / Math.max(unit.totalStudents, 1))

  const leadsCount = [aheadOnCompletion, aheadOnSessions, aheadOnReflections].filter(Boolean).length

  return (
    <div className="rounded-2xl shadow-card bg-bg-card p-5 space-y-5">
      <Header />

      {/* Column labels */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
        {/* Student column label */}
        <div className="text-center">
          <span className="inline-flex items-center gap-1 rounded-lg bg-cerrado-600/[0.08] px-2.5 py-1">
            <TrendingUp size={11} className="text-cerrado-600" />
            <span className="text-[10px] font-bold uppercase tracking-wide text-cerrado-600">
              Você
            </span>
          </span>
        </div>

        {/* Divider */}
        <div className="h-px w-5 bg-border-subtle" />

        {/* Unit column label */}
        <div className="text-center">
          <span className="inline-flex items-center gap-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.05] px-2.5 py-1">
            <Users size={11} className="text-text-muted" />
            <span
              className="text-[10px] font-medium uppercase tracking-wide text-text-muted truncate max-w-[90px]"
              title={unitName}
            >
              {unitName}
            </span>
          </span>
        </div>
      </div>

      {/* Primary metrics grid — 3 rows × 2 columns */}
      <div className="space-y-3">
        {/* Completion */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <MetricCell
            value={fmt(student.completionPct)}
            label="Conclusão"
            highlight={aheadOnCompletion}
          />
          <div className="text-center">
            <BookOpen size={10} className="text-text-muted/40 mx-auto" />
          </div>
          <MetricCell
            value={fmt(unit.completionPct)}
            label="Conclusão"
            dimmed={aheadOnCompletion}
          />
        </div>

        {/* Sessions per student */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <MetricCell
            value={fmt(student.avgSessionsPerStudent, "decimal")}
            label="Sessões"
            highlight={aheadOnSessions}
          />
          <div className="text-center">
            <div className="h-px w-3 bg-border-subtle mx-auto" />
          </div>
          <MetricCell
            value={fmt(unit.avgSessionsPerStudent, "decimal")}
            label="Sessões"
            dimmed={aheadOnSessions}
          />
        </div>

        {/* Active */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <MetricCell
            value={fmt(studentActivePct)}
            label="Ativo (30d)"
            highlight={studentActivePct >= unitActivePct}
          />
          <div className="text-center">
            <div className="h-px w-3 bg-border-subtle mx-auto" />
          </div>
          <MetricCell
            value={fmt(unitActivePct)}
            label="Ativo (30d)"
            dimmed={studentActivePct >= unitActivePct}
          />
        </div>
      </div>

      {/* Divider */}
      <div className="h-px w-full bg-border-subtle" />

      {/* Bar charts for sessions & reflections */}
      <div className="space-y-3">
        <ComparisonBar
          label="Sessões concluídas"
          studentValue={student.completedSessions}
          unitValue={Math.round(unit.avgSessionsPerStudent)}
        />
        <ComparisonBar
          label="Reflexões escritas"
          studentValue={student.reflectionCount}
          unitValue={Math.round(unit.reflectionCount / Math.max(unit.totalStudents, 1))}
        />
      </div>

      {/* Footer micro-summary */}
      <div
        className={`rounded-xl px-3 py-2 ${
          leadsCount >= 2
            ? "bg-cerrado-600/[0.06] border border-cerrado-600/[0.10]"
            : "bg-black/[0.03] dark:bg-white/[0.03]"
        }`}
      >
        <p className="text-[11px] leading-snug text-text-secondary">
          {leadsCount >= 3 ? (
            <>
              Você está <span className="font-semibold text-cerrado-600">acima da média</span> da
              sua unidade em todas as dimensões. Continue assim!
            </>
          ) : leadsCount === 2 ? (
            <>
              Você lidera em{" "}
              <span className="font-semibold text-cerrado-600">{leadsCount} de 3</span> dimensões em
              relação à sua unidade.
            </>
          ) : leadsCount === 1 ? (
            <>
              Há espaço para crescer — você está à frente da sua unidade em{" "}
              <span className="font-semibold text-text-primary">1 de 3</span> dimensões.
            </>
          ) : (
            <>
              Suas métricas estão abaixo da média da unidade. Cada sessão concluída faz diferença.
            </>
          )}
        </p>
      </div>
    </div>
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
