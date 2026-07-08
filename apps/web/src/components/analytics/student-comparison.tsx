"use client"

// ---------------------------------------------------------------------------
// StudentComparison — "Meu desempenho" card (fiel ao mockup do Hugo)
// ---------------------------------------------------------------------------
// Shows the logged-in STUDENT's own performance next to the average of their
// UNIDADE (ONE reference, read-only, no PII of other students).
//
// LAYOUT (mockup):
//   • Header: big "Meu desempenho" + subtitle + two chips (30 dias / unidade)
//   • Hero verdict panel: graded headline + coach copy on the left, giant
//     Conclusão % (cerrado/laranja) + "Conclusão" label + green delta chip on
//     the right. Tinted soft surface.
//   • "Sinais principais": 4 rows (sessions, active, completed, reflections),
//     each with value in the metric's BIOME color, muted "média X", delta chip,
//     and a pair of proportional bars (você on top in the metric color, média
//     below in grey). A discreet legend to the right of the section title.
//   • Next-step bar: dark rounded footer with a contextual suggestion + a
//     laranja "Continuar agora" button (same destination as the top banner).
//
// DATA: GET /api/analytics/manager-groups?view=student → StudentComparison.
//   Both sides are ComparableMetricBlock. The endpoint resolves studentId from
//   auth.uid() server-side; this component sends NO identifying params.
//
// STATES: loading skeleton (mirrors new layout) | fetch error (same message) |
//   no-unit empty | data.
//
// The proportion/delta math + graded verdict/coach copy live in
// student-comparison-scale.ts (unit-tested). Colors bind to the biome design
// tokens (theme.css) via CSS vars, never loose hex.
// ---------------------------------------------------------------------------

import type {
  ComparableMetricBlock,
  StudentComparison as StudentComparisonType,
} from "@/types/analytics"
import { AlertCircle, ArrowRight } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import {
  type ComparisonMetric,
  type MetricBar,
  buildVerdict,
  formatMetric,
  toMetricBar,
} from "./student-comparison-scale"

// ---------------------------------------------------------------------------
// Biome color map — mockup order for "Sinais principais": azul, verde,
// laranja, âmbar. STATIC, FULL utility classes written verbatim so the
// Tailwind v4 scanner emits BOTH the utility AND the underlying --color-*
// custom property. (Dynamic `var(--color-pantanal)` inline styles fail: the
// scanner never sees a `bg-pantanal`/`text-pantanal` token, so Tailwind
// tree-shakes the variable out and the color resolves to nothing.)
//   sessions            → pantanal        (azul)
//   active              → mata-atlantica  (verde)
//   completed-sessions  → cerrado-600     (laranja, brand primary)
//   reflections         → caatinga        (âmbar; texto usa caatinga-700 p/ contraste)
// Conclusão (the hero number) is the brand cerrado/laranja.
// ---------------------------------------------------------------------------

interface BiomeClasses {
  /** Big value text color (readable on cream). */
  text: string
  /** Solid "você" bar fill. */
  bar: string
}

const BIOME: Record<string, BiomeClasses> = {
  sessions: { text: "text-pantanal", bar: "bg-pantanal" },
  active: { text: "text-mata-atlantica", bar: "bg-mata-atlantica" },
  "completed-sessions": { text: "text-cerrado-600", bar: "bg-cerrado-600" },
  reflections: { text: "text-caatinga-700", bar: "bg-caatinga" },
  completion: { text: "text-cerrado-600", bar: "bg-cerrado-600" },
}

const FALLBACK_BIOME: BiomeClasses = { text: "text-cerrado-600", bar: "bg-cerrado-600" }

/** Fallback continue destination when no active chapter is known. */
const DEFAULT_CONTINUE_HREF = "/courses"

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
// Metric derivation — build the comparable rows from the two metric blocks
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

/** The Conclusão comparison (rendered as the hero number, kept out of the rows). */
function completionBar(student: ComparableMetricBlock, unit: ComparableMetricBlock): MetricBar {
  return toMetricBar({
    key: "completion",
    label: "Conclusão",
    studentValue: student.completionPct,
    unitValue: unit.completionPct,
    format: "pct",
  })
}

/**
 * Build the 4 "Sinais principais" rows in mockup order (azul → verde → laranja
 * → âmbar). Conclusão is excluded here — it is the hero number. The unit side
 * is the UNIDADE average, normalized PER STUDENT where a raw count would
 * otherwise be apples-to-oranges (completed sessions, reflections).
 */
function buildSignalRows(student: ComparableMetricBlock, unit: ComparableMetricBlock): MetricBar[] {
  const metrics: ComparisonMetric[] = [
    {
      key: "sessions",
      label: "Sessões por período",
      studentValue: student.avgSessionsPerStudent,
      unitValue: unit.avgSessionsPerStudent,
      format: "decimal",
    },
    {
      key: "active",
      label: "Atividade nos últimos 30 dias",
      studentValue: activePct(student),
      unitValue: activePct(unit),
      format: "pct",
    },
    {
      key: "completed-sessions",
      label: "Sessões concluídas",
      studentValue: student.completedSessions,
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
    <div className="rounded-2xl bg-bg-card p-6 shadow-card dark:border dark:border-white/[0.06] dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] sm:p-7">
      {children}
    </div>
  )
}

/** Delta chip — green when ahead, red when behind, muted at the average. */
function DeltaChip({ bar }: { bar: MetricBar }) {
  if (bar.deltaPct === null) {
    return (
      <span className="inline-flex items-center rounded-full bg-black/[0.04] px-2 py-0.5 text-[11px] font-semibold text-text-muted dark:bg-white/[0.06]">
        na média
      </span>
    )
  }
  if (bar.deltaPct === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-black/[0.04] px-2 py-0.5 text-[11px] font-semibold text-text-muted dark:bg-white/[0.06]">
        = média
      </span>
    )
  }
  const positive = bar.deltaPct > 0
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
        positive
          ? "bg-semantic-success/15 text-semantic-success"
          : "bg-semantic-error/15 text-semantic-error"
      }`}
    >
      {positive ? "+" : ""}
      {bar.deltaPct}%
    </span>
  )
}

/** Header — big title, subtitle, and the two context chips (30 dias / unidade). */
function Header({ unitName }: { unitName: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-2xl font-bold tracking-tight text-text-primary">Meu desempenho</h2>
        <p className="mt-1 text-sm text-text-muted">
          Comparado à média da unidade {unitName} nos últimos 30 dias.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-cerrado-600/10 px-3 py-1 text-xs font-semibold text-cerrado-700 dark:text-cerrado-300">
          30 dias
        </span>
        <span className="inline-flex items-center rounded-full bg-pantanal/10 px-3 py-1 text-xs font-semibold text-pantanal dark:text-pantanal">
          {unitName}
        </span>
      </div>
    </div>
  )
}

/**
 * Hero verdict panel — graded headline + coach copy (left), giant Conclusão %
 * in the brand accent + label + green delta chip (right). Soft tinted surface.
 */
function HeroPanel({
  verdict,
  completion,
}: {
  verdict: ReturnType<typeof buildVerdict>
  completion: MetricBar
}) {
  return (
    <div className="flex flex-col gap-5 rounded-xl bg-cerrado-600/[0.06] p-5 dark:bg-cerrado-600/[0.10] sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-6">
      <div className="min-w-0 sm:max-w-[58%]">
        <h3 className="text-lg font-bold text-text-primary">{verdict.headline}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{verdict.coachLine}</p>
      </div>
      {/* Conclusão: giant % with "Conclusão" label BELOW the number, and the
          green delta chip to the RIGHT of the number (mockup arrangement). */}
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex flex-col items-start">
          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-bold leading-none tabular-nums text-cerrado-600">
              {Math.round(completion.studentValue)}
            </span>
            <span className="text-xl font-semibold text-cerrado-600">%</span>
          </div>
          <span className="mt-1.5 text-xs font-medium text-text-muted">Conclusão</span>
        </div>
        {completion.deltaPct !== null && completion.deltaPct !== 0 ? (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums ${
              completion.deltaPct > 0
                ? "bg-semantic-success/15 text-semantic-success"
                : "bg-semantic-error/15 text-semantic-error"
            }`}
          >
            {completion.deltaPct > 0 ? "+" : ""}
            {completion.deltaPct}% vs média
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-black/[0.04] px-2.5 py-1 text-[11px] font-semibold text-text-muted dark:bg-white/[0.06]">
            na média
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * One "Sinais principais" row: label | big value in the biome color | muted
 * "média X" | delta chip | pair of proportional bars (você on top in the biome
 * color, média below in grey). Honest shared scale from toMetricBar.
 */
function SignalRow({ bar }: { bar: MetricBar }) {
  const biome = BIOME[bar.key] ?? FALLBACK_BIOME
  return (
    <div className="grid grid-cols-[minmax(9rem,11rem)_1fr] items-center gap-x-4 sm:grid-cols-[13rem_auto_auto_auto_1fr] sm:gap-x-5 lg:gap-x-6">
      {/* Col 1: label — fixed track so the 2-line "Atividade..." never
          desyncs the other columns. */}
      <span className="text-sm font-medium leading-snug text-text-secondary">{bar.label}</span>

      {/* Cols 2-4 collapse into one flex group below sm, break out into aligned
          grid columns from sm up so value/média/chip line up across all rows. */}
      <div className="flex items-baseline gap-2 sm:contents">
        <span className={`text-xl font-bold tabular-nums ${biome.text}`}>{bar.studentDisplay}</span>
        <span className="text-xs text-text-muted tabular-nums sm:justify-self-start">
          média {bar.unitDisplay}
        </span>
        <span className="sm:justify-self-start">
          <DeltaChip bar={bar} />
        </span>
      </div>

      {/* Col 5: dual proportional bars — você (biome color) over média (grey). */}
      <div className="col-span-2 mt-2 hidden flex-col gap-1.5 sm:col-span-1 sm:mt-0 sm:flex">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
          <div
            className={`h-full rounded-full transition-all duration-500 ${biome.bar}`}
            style={{ width: `${bar.studentWidthPct}%` }}
          />
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-black/[0.22] transition-all duration-500 dark:bg-white/[0.28]"
            style={{ width: `${bar.unitWidthPct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Dark next-step footer bar — contextual suggestion + a laranja "Continuar
 * agora" button (same destination as the top banner). Works in both themes.
 */
function NextStepBar({ suggestion, href }: { suggestion: string; href: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-neutral-900 px-4 py-3.5 dark:bg-black/40 dark:ring-1 dark:ring-white/[0.08] sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-sm text-neutral-200">
        <span className="font-semibold text-white">Próximo passo:</span> {suggestion}
      </p>
      <Link
        href={href}
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-cerrado-600 px-5 text-sm font-semibold text-white transition-all hover:bg-cerrado-500 active:scale-[0.98]"
      >
        Continuar agora
        <ArrowRight size={16} />
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loading skeleton — mirrors the real layout (header, hero, 4 rows, next-step)
// ---------------------------------------------------------------------------

function Skeleton() {
  return (
    <Card>
      <div className="animate-pulse space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="h-6 w-56 rounded bg-bg-elevated" />
            <div className="h-3.5 w-72 rounded bg-bg-elevated" />
          </div>
          <div className="flex gap-2">
            <div className="h-6 w-16 rounded-full bg-bg-elevated" />
            <div className="h-6 w-24 rounded-full bg-bg-elevated" />
          </div>
        </div>
        {/* Hero */}
        <div className="h-28 w-full rounded-2xl bg-bg-elevated" />
        {/* Rows */}
        <div className="space-y-2">
          <div className="h-4 w-32 rounded bg-bg-elevated" />
          <div className="space-y-4 pt-2">
            {["r1", "r2", "r3", "r4"].map((k) => (
              <div key={`skeleton-row-${k}`} className="flex items-center gap-6">
                <div className="h-4 w-44 shrink-0 rounded bg-bg-elevated" />
                <div className="h-5 flex-1 rounded bg-bg-elevated" />
                <div className="hidden w-48 shrink-0 space-y-1.5 sm:block">
                  <div className="h-1.5 w-full rounded-full bg-bg-elevated" />
                  <div className="h-1.5 w-2/3 rounded-full bg-bg-elevated" />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Next-step */}
        <div className="h-14 w-full rounded-2xl bg-bg-elevated" />
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Empty state — student has no UNIDADE (unit is null)
// ---------------------------------------------------------------------------

function OwnMetricsOnly({
  block,
  continueHref,
}: { block: ComparableMetricBlock; continueHref: string }) {
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
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">Meu desempenho</h2>
          <p className="mt-1 text-sm text-text-muted">
            Você ainda não está associado a uma unidade. Veja seu progresso individual.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {cells.map((cell) => (
            <div
              key={cell.key}
              className="rounded-xl bg-black/[0.02] py-4 text-center dark:bg-white/[0.03]"
            >
              <p className="text-2xl font-bold tabular-nums text-text-primary">{cell.value}</p>
              <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-text-muted">
                {cell.label}
              </p>
            </div>
          ))}
        </div>
        <NextStepBar suggestion="faça a próxima sessão da sua trilha." href={continueHref} />
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
  continueHref,
}: {
  student: ComparableMetricBlock
  unit: ComparableMetricBlock
  unitName: string
  continueHref: string
}) {
  const completion = completionBar(student, unit)
  const rows = buildSignalRows(student, unit)
  // Verdict/coach copy derive from ALL comparable dimensions (rows + Conclusão).
  const verdict = buildVerdict([completion, ...rows])

  return (
    <Card>
      <div className="space-y-6">
        <Header unitName={unitName} />
        <HeroPanel verdict={verdict} completion={completion} />

        <div>
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="text-base font-bold text-text-primary">Sinais principais</h3>
            <span className="hidden text-xs text-text-muted sm:block">
              barra superior: você · inferior: média
            </span>
          </div>
          <div className="mt-4 space-y-4">
            {rows.map((bar) => (
              <SignalRow key={bar.key} bar={bar} />
            ))}
          </div>
        </div>

        <NextStepBar suggestion={verdict.nextStep} href={continueHref} />
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Root export
// ---------------------------------------------------------------------------

/**
 * StudentComparison — renders the student's "Meu desempenho" card: their own
 * metrics next to their UNIDADE average, with a graded verdict hero and a
 * next-step CTA. Fetches from /api/analytics/manager-groups?view=student.
 *
 * `continueHref` is the destination for the next-step button (same target as
 * the dashboard's top "Continuar" banner). Defaults to /courses.
 *
 * Read-only. No PII of other students is ever displayed.
 */
export function StudentComparison({
  continueHref = DEFAULT_CONTINUE_HREF,
}: {
  continueHref?: string
} = {}) {
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
  if (!unit) return <OwnMetricsOnly block={student} continueHref={continueHref} />

  return (
    <ComparisonView
      student={student}
      unit={unit}
      unitName={unitName ?? "Unidade"}
      continueHref={continueHref}
    />
  )
}
