// ---------------------------------------------------------------------------
// StudentProgressHeadline, PURE PRESENTATION for the "Meu progresso" hero
// ---------------------------------------------------------------------------
// SH-1.3 (EPIC-STUDENT-HOME). This is the home's NEW opening view: it leads
// with the student's OWN progress and promotes the "Continuar agora" CTA to the
// manchete, instead of opening with the comparative verdict. It knows NOTHING
// about fetching, every value arrives already resolved via props (AC8):
//   • `bars`: the comparable MetricBar rows, used ONLY to derive own-progress
//     copy via buildProgressHeadline.
//   • `consciousCompletionPct`: the North Star highlight number (optional &
//     additive; falls back to completionPct when absent).
//   • `completionPct` / `avgDepth`: support/context numbers.
//   • `continueHref`: the "continue where you left off" destination, resolved at
//     the dashboard level and passed DOWN as a prop. This component does NOT
//     import or reimplement that resolution (AC6).
//
// The copy centers on the student's own next step and NEVER mentions a média or
// a comparison (buildProgressHeadline enforces that + the no-travessão rule).
//
// CSS-PIPELINE IMMUNITY: mirrors student-comparison-view.tsx, only STANDARD
// Tailwind utilities (no arbitrary-value classes) and the hero number carries a
// literal OKLCh color inline so it never falls to black under stale CSS.
// ---------------------------------------------------------------------------

import type { MetricBar } from "./student-comparison-scale"
import { buildProgressHeadline, formatMetric } from "./student-comparison-scale"
import { BIOME_COLOR, Card, DEFAULT_CONTINUE_HREF, NextStepBar } from "./student-comparison-view"

interface StudentProgressHeadlineProps {
  /** Comparable rows (student vs unit) — consumed only to derive the copy. */
  bars: MetricBar[]
  /** North Star highlight: conscious completion %. Optional (additive field). */
  consciousCompletionPct?: number
  /** Support number: overall completion %. */
  completionPct: number
  /** Support number: average reflection depth (Kolb scale, anchored /7). */
  avgDepth?: number
  /** Resolved "continue where you left off" destination (prop, AC6). */
  continueHref?: string
  /**
   * SH-1.4 integration hook (ADDITIVE, default true → standalone behavior and
   * SH-1.3's own tests are unchanged). When `false`, the internal promoted CTA
   * is suppressed so the CONTAINER (`StudentHomeCard`) can own a SINGLE
   * "Continuar agora" rendered OUTSIDE the intent switch — the CTA-invariance
   * requirement (plan §2.3 / SH-1.4 AC5). The container reproduces the exact
   * same CTA (same href + same `buildProgressHeadline` suggestion), so hiding it
   * here never loses the CTA, it just moves ownership up one level.
   */
  showCta?: boolean
  /**
   * SH-1.4 UX hook (ADDITIVE, default true → standalone behavior + SH-1.3 tests
   * unchanged). When `false`, the internal "Meu progresso" H2 is suppressed so
   * it does not DUPLICATE the container's intent toggle label (which already
   * reads "Meu progresso"). The coaching subtitle stays.
   */
  showTitle?: boolean
}

/** One support metric cell (completion, depth). */
function SupportCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/5 px-4 py-3 text-center dark:bg-white/5">
      <p className="text-xl font-bold tabular-nums text-text-primary">{value}</p>
      <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-text-muted">{label}</p>
    </div>
  )
}

export function StudentProgressHeadline({
  bars,
  consciousCompletionPct,
  completionPct,
  avgDepth,
  continueHref = DEFAULT_CONTINUE_HREF,
  showCta = true,
  showTitle = true,
}: StudentProgressHeadlineProps) {
  const progress = buildProgressHeadline(bars)

  // North Star: conscious completion when we have it, overall completion as the
  // graceful fallback so the hero number is never blank.
  const hasConscious = typeof consciousCompletionPct === "number"
  const heroValue = hasConscious ? (consciousCompletionPct as number) : completionPct
  const heroLabel = hasConscious ? "Conclusão consciente" : "Conclusão"

  return (
    <Card>
      <div className="space-y-6">
        {/* Header — own-progress headline, no comparison. The H2 is suppressed
            when `showTitle === false` (SH-1.4: container's toggle already labels
            it "Meu progresso"); the coaching subtitle always stays. */}
        <div>
          {showTitle && (
            <h2 className="text-2xl font-bold tracking-tight text-text-primary">Meu progresso</h2>
          )}
          <p className={`text-sm text-text-secondary${showTitle ? " mt-1" : ""}`}>
            {progress.headline}
          </p>
        </div>

        {/* PROMOTED CTA — "Continuar agora" is the manchete (leads the card,
            reusing NextStepBar with the largest visual weight). Suppressed when
            `showCta === false` (SH-1.4: the container owns the invariant CTA). */}
        {showCta && (
          <NextStepBar
            suggestion={progress.nextStep ?? "faça a próxima sessão da sua trilha."}
            href={continueHref}
          />
        )}

        {/* North Star hero + support numbers + coaching sentence. */}
        <div className="flex flex-col gap-5 rounded-xl bg-cerrado-600/5 p-5 dark:bg-cerrado-600/10 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-6">
          <div className="flex shrink-0 flex-col items-start">
            <div className="flex items-baseline gap-1">
              {/* Inline cerrado-600 literal so the hero % never falls to black
                  under stale CSS (class kept as progressive enhancement). */}
              <span
                className="text-5xl font-bold leading-none tabular-nums text-cerrado-600"
                style={{ color: BIOME_COLOR.completion }}
              >
                {Math.round(heroValue)}
              </span>
              <span
                className="text-xl font-semibold text-cerrado-600"
                style={{ color: BIOME_COLOR.completion }}
              >
                %
              </span>
            </div>
            <span className="mt-1.5 text-xs font-medium text-text-muted">{heroLabel}</span>
          </div>

          <div className="min-w-0 sm:flex-1">
            <p className="text-sm leading-relaxed text-text-secondary">{progress.coachLine}</p>
            <div
              className={`mt-4 grid gap-3 ${typeof avgDepth === "number" ? "grid-cols-2" : "grid-cols-1"}`}
            >
              <SupportCell label="Conclusão" value={formatMetric(completionPct, "pct")} />
              {typeof avgDepth === "number" && (
                <SupportCell
                  label="Profundidade"
                  value={`${formatMetric(avgDepth, "decimal")}/7`}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
