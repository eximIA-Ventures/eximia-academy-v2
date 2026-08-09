"use client"

// ---------------------------------------------------------------------------
// CauseProbablePanel — Spike 8.2 closer (Task 2)
// ---------------------------------------------------------------------------
// Renders the pairwise cause-inference result BELOW the comparison grid.
// Consumes the pure cause-inference lib (no fetch, deterministic).
//
// USAGE:
//   • When exactly 2 entities are visible: one pairwise inference (A vs B).
//   • When N > 2 entities are visible: each non-leader entity is compared
//     against the overall-best entity; recommendations are deduplicated.
//   • When no significant gap is found: renders nothing (empty fragment).
//
// LABEL CONTRACT:
//   • The block is always titled "Recomendações" (never "Diagnóstico").
//   • Phase-2 hypotheses are shown in a muted "A investigar" sub-list.
//   • The caller decides whether to render this; no role-gating here.
// ---------------------------------------------------------------------------

import {
  type CauseDifference,
  type ComparableMetrics,
  type InferCauseOptions,
  inferCause,
} from "@/lib/analytics/cause-inference"
import { HelpCircle, Lightbulb } from "lucide-react"
import { useMemo } from "react"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface CausePanelEntity {
  /** Stable identifier (CardData.key) — used to detect the overall-best. */
  key: string
  /** Display name shown in the recommendation text. */
  name: string
  /** The shared metric block. */
  metrics: ComparableMetrics
}

export interface CauseProbablePanelProps {
  /**
   * The entities currently visible in the comparison grid — at least 2.
   * Pass the same ordered slice that the grid renders.
   */
  entities: CausePanelEntity[]
  /**
   * Key of the overall-best entity (already computed by UnitComparison's
   * winsCount logic). Used as the reference leader in N>2 comparisons.
   */
  overallBestKey: string
  /** Optional threshold overrides forwarded to inferCause. */
  inferOptions?: InferCauseOptions
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Deduplicate recommendations by their full text (same rec can arise from
 *  multiple pairs when the same entity consistently lags behind the leader). */
function dedup(diffs: CauseDifference[]): CauseDifference[] {
  const seen = new Set<string>()
  return diffs.filter((d) => {
    if (seen.has(d.recommendation)) return false
    seen.add(d.recommendation)
    return true
  })
}

function deduplicateStrings(strs: string[]): string[] {
  return [...new Set(strs)]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function CauseProbablePanel({
  entities,
  overallBestKey,
  inferOptions,
}: CauseProbablePanelProps) {
  const { differences, phase2Hypotheses } = useMemo(() => {
    if (entities.length < 2) {
      return { differences: [], phase2Hypotheses: [] }
    }

    const allDiffs: CauseDifference[] = []
    const allPhase2: string[] = []

    if (entities.length === 2) {
      // Exact pairwise: A vs B
      const [a, b] = entities
      const result = inferCause(a.metrics, a.name, b.metrics, b.name, inferOptions)
      allDiffs.push(...result.differences)
      allPhase2.push(...result.phase2Hypotheses)
    } else {
      // N > 2: compare each non-leader against the overall-best entity
      const leader = entities.find((e) => e.key === overallBestKey) ?? entities[0]
      for (const entity of entities) {
        if (entity.key === leader.key) continue
        const result = inferCause(
          leader.metrics,
          leader.name,
          entity.metrics,
          entity.name,
          inferOptions,
        )
        allDiffs.push(...result.differences)
        allPhase2.push(...result.phase2Hypotheses)
      }
    }

    return {
      differences: dedup(allDiffs),
      phase2Hypotheses: deduplicateStrings(allPhase2),
    }
  }, [entities, overallBestKey, inferOptions])

  // Nothing to show — render nothing, keep layout clean
  if (differences.length === 0 && phase2Hypotheses.length === 0) {
    return null
  }

  return (
    <div className="mt-5 pt-4 border-t border-black/[0.06] dark:border-white/[0.06] space-y-3">
      {differences.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Lightbulb size={13} className="text-cerrado-600 shrink-0" />
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Recomendações
            </h4>
          </div>
          <ul className="space-y-1.5">
            {differences.map((d) => (
              <li
                key={`${d.dimension}-${d.leaderName}-${d.trailingName}`}
                className="flex items-start gap-2 rounded-xl bg-cerrado-600/[0.04] border border-cerrado-600/[0.08] px-3 py-2"
              >
                {/* Dimension badge */}
                <span className="mt-0.5 shrink-0 rounded-md bg-cerrado-600/[0.12] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-cerrado-600">
                  {d.dimensionLabel}
                </span>
                <p className="text-[11px] text-text-primary leading-snug">{d.recommendation}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {phase2Hypotheses.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <HelpCircle size={12} className="text-text-muted shrink-0" />
            <h4 className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              A investigar (não confirmado)
            </h4>
          </div>
          <ul className="space-y-1">
            {phase2Hypotheses.map((h) => (
              <li key={h} className="text-[10px] text-text-muted leading-snug pl-1">
                {/* Strip the "[hipótese]" or legacy "[hipótese fase 2]" prefix —
                    already contextualised by the "A investigar" heading */}
                {h.replace(/^\[hipótese(?:\s+fase\s+2)?\]\s*/i, "")}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
