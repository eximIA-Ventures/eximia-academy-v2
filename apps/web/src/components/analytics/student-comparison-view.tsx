// ---------------------------------------------------------------------------
// StudentComparisonView — PURE PRESENTATION for the "Meu desempenho" card
// ---------------------------------------------------------------------------
// This module holds every visual piece of the card and knows NOTHING about
// fetching. It receives the two metric blocks (student + unit) as props and
// renders. The fetching wrapper lives in student-comparison.tsx.
//
// Splitting presentation from data lets a dev-only preview route
// (/dev/preview-desempenho) render this with the EXACT mockup numbers, so the
// pixel can be verified without a live session — closing the "nobody looked at
// the pixel before shipping" loop.
//
// LAYOUT (mockup /tmp/meu-desempenho-mockup.png):
//   • Header: big "Meu desempenho" + subtitle + two chips (30 dias / unidade)
//   • Hero verdict panel: graded headline + coach copy on the left, giant
//     Conclusão % (cerrado/laranja) + "Conclusão" label + green delta chip on
//     the right. Tinted soft surface.
//   • "Sinais principais": 4 rows (sessions, active, completed, reflections),
//     each with value in the metric's BIOME color, muted "média X", delta chip,
//     and a pair of proportional bars filling the RIGHT HALF (você on top in the
//     metric color, média below in grey). A discreet legend by the title.
//   • Next-step bar: dark rounded footer with a contextual suggestion + a
//     laranja "Continuar agora" button (same destination as the top banner).
//
// The proportion/delta math + graded verdict/coach copy live in
// student-comparison-scale.ts (unit-tested). Colors bind to the biome design
// tokens (theme.css) via full Tailwind utility strings, never loose hex.
//
// CSS-PIPELINE IMMUNITY: this component uses ONLY standard Tailwind utilities —
// no arbitrary-value classes (no `grid-cols-[...]`, no `bg-black/[0.06]`, no
// `text-[11px]`, no `max-w-[58%]`). Arbitrary values were observed to silently
// drop out of a production Docker build (layer cache) while standard utilities
// always ship, so the layout is built from flex + fixed widths (w-44/w-52/w-16/
// w-20/w-24/flex-1) and standard opacity steps (bg-black/5, /20, white/10, /25).
// ---------------------------------------------------------------------------

import type { ComparableMetricBlock } from "@/types/analytics"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
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

export const BIOME: Record<string, BiomeClasses> = {
  sessions: { text: "text-pantanal", bar: "bg-pantanal" },
  active: { text: "text-mata-atlantica", bar: "bg-mata-atlantica" },
  "completed-sessions": { text: "text-cerrado-600", bar: "bg-cerrado-600" },
  reflections: { text: "text-caatinga-700", bar: "bg-caatinga" },
  completion: { text: "text-cerrado-600", bar: "bg-cerrado-600" },
}

const FALLBACK_BIOME: BiomeClasses = { text: "text-cerrado-600", bar: "bg-cerrado-600" }

/** Default continue destination when no active chapter is known. */
export const DEFAULT_CONTINUE_HREF = "/courses"

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
export function completionBar(
  student: ComparableMetricBlock,
  unit: ComparableMetricBlock,
): MetricBar {
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
export function buildSignalRows(
  student: ComparableMetricBlock,
  unit: ComparableMetricBlock,
): MetricBar[] {
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
// Card shell — shared by every state so the surface is identical everywhere.
// ---------------------------------------------------------------------------

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-bg-card p-6 shadow-card dark:border dark:border-white/5 dark:shadow-sm sm:p-7">
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Delta chip — green PILL when ahead, red when behind, muted at the average.
// ---------------------------------------------------------------------------

function DeltaChip({ bar }: { bar: MetricBar }) {
  if (bar.deltaPct === null) {
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-full bg-black/5 px-2.5 py-0.5 text-xs font-semibold text-text-muted dark:bg-white/5">
        na média
      </span>
    )
  }
  if (bar.deltaPct === 0) {
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-full bg-black/5 px-2.5 py-0.5 text-xs font-semibold text-text-muted dark:bg-white/5">
        = média
      </span>
    )
  }
  const positive = bar.deltaPct > 0
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${
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

// ---------------------------------------------------------------------------
// Header — big title, subtitle, and the two context chips (30 dias / unidade).
// ---------------------------------------------------------------------------

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
        <span className="inline-flex items-center whitespace-nowrap rounded-full bg-cerrado-600/10 px-3 py-1 text-xs font-semibold text-cerrado-700 dark:text-cerrado-300">
          30 dias
        </span>
        <span className="inline-flex items-center whitespace-nowrap rounded-full bg-pantanal/10 px-3 py-1 text-xs font-semibold text-pantanal dark:text-pantanal">
          {unitName}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hero verdict panel — graded headline + coach copy (left), giant Conclusão %
// in the brand accent + label + green delta chip (right). Soft tinted surface.
// ---------------------------------------------------------------------------

function HeroPanel({
  verdict,
  completion,
}: {
  verdict: ReturnType<typeof buildVerdict>
  completion: MetricBar
}) {
  return (
    <div className="flex flex-col gap-5 rounded-xl bg-cerrado-600/5 p-5 dark:bg-cerrado-600/10 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-6">
      <div className="min-w-0 sm:flex-1">
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
            className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
              completion.deltaPct > 0
                ? "bg-semantic-success/15 text-semantic-success"
                : "bg-semantic-error/15 text-semantic-error"
            }`}
          >
            {completion.deltaPct > 0 ? "+" : ""}
            {completion.deltaPct}% vs média
          </span>
        ) : (
          <span className="inline-flex items-center whitespace-nowrap rounded-full bg-black/5 px-2.5 py-1 text-xs font-semibold text-text-muted dark:bg-white/5">
            na média
          </span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// One "Sinais principais" row.
//
// IMMUNE LAYOUT (no arbitrary-value classes — see file header): the row is a
// flex split into a LEFT HALF and a RIGHT HALF, each `sm:flex-1`, so both take
// half the width regardless of the CSS pipeline. The LEFT HALF is itself a flex
// with FIXED WIDTHS on its cells (label `w-44`/`sm:w-52`, value `w-16`, média
// `w-20`/`sm:w-24`, chip auto) so the columns line up across every row without
// needing an arbitrary grid template. The RIGHT HALF holds the two proportional
// bars. Below sm the bars hide and only the textual comparison shows (mobile).
// Every utility here (w-44, w-52, w-16, w-20, w-24, flex-1, bg-black/5, …) is a
// STANDARD Tailwind class present in any build — no `[...]` arbitrary values.
// ---------------------------------------------------------------------------

function SignalRow({ bar }: { bar: MetricBar }) {
  const biome = BIOME[bar.key] ?? FALLBACK_BIOME
  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-8">
      {/* LEFT HALF — label | value | média | chip, fixed-width cells so the
          columns line up across every row (no arbitrary grid template). */}
      <div className="flex items-baseline gap-4 sm:flex-1 sm:gap-5">
        <span className="w-44 shrink-0 text-sm font-medium leading-snug text-text-secondary sm:w-52">
          {bar.label}
        </span>
        <span className={`w-16 shrink-0 text-xl font-bold tabular-nums ${biome.text}`}>
          {bar.studentDisplay}
        </span>
        <span className="w-20 shrink-0 whitespace-nowrap text-xs text-text-muted tabular-nums sm:w-24">
          média {bar.unitDisplay}
        </span>
        <DeltaChip bar={bar} />
      </div>

      {/* RIGHT HALF — dual proportional bars: você (biome color) over média
          (grey). Hidden below sm. */}
      <div className="hidden flex-col gap-1.5 sm:flex sm:flex-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
          <div
            className={`h-full rounded-full transition-all duration-500 ${biome.bar}`}
            style={{ width: `${bar.studentWidthPct}%` }}
          />
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-black/20 transition-all duration-500 dark:bg-white/25"
            style={{ width: `${bar.unitWidthPct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dark next-step footer bar — contextual suggestion + a laranja "Continuar
// agora" button (same destination as the top banner). Works in both themes.
// The suggestion text is WHITE (font-medium) so it stays legible on the dark
// surface — the previous muted grey was unreadable on black.
// ---------------------------------------------------------------------------

export function NextStepBar({ suggestion, href }: { suggestion: string; href: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-neutral-900 px-4 py-3.5 dark:bg-black/40 dark:ring-1 dark:ring-white/10 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-sm font-medium text-white">
        <span className="font-semibold">Próximo passo:</span> {suggestion}
      </p>
      <Link
        href={href}
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-cerrado-600 px-5 text-sm font-semibold text-white transition-all hover:bg-cerrado-500 active:scale-95"
      >
        Continuar agora
        <ArrowRight size={16} />
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state — student has no UNIDADE (unit is null). Own numbers only.
// ---------------------------------------------------------------------------

export function OwnMetricsOnly({
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
              className="rounded-xl bg-black/5 py-4 text-center dark:bg-white/5"
            >
              <p className="text-2xl font-bold tabular-nums text-text-primary">{cell.value}</p>
              <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-text-muted">
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
// StudentComparisonView — the MAIN PURE presentation. Given the two metric
// blocks (both non-null) + unit name + continue href, renders the full card.
// NO fetching. The fetch wrapper (student-comparison.tsx) resolves the state
// and hands this component ready data.
// ---------------------------------------------------------------------------

export function StudentComparisonView({
  student,
  unit,
  unitName,
  continueHref = DEFAULT_CONTINUE_HREF,
}: {
  student: ComparableMetricBlock
  unit: ComparableMetricBlock
  unitName: string
  continueHref?: string
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
