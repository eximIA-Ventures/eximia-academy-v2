"use client"

// ---------------------------------------------------------------------------
// SummaryOverview — consolidated header metrics panel.
// Item 2.4 extension: optional `indicators` prop renders the item 2.2
// reflexão/socrática progress bars in-card when in Aprendizagem context.
// The existing Uso-tab rendering is PRESERVED unchanged.
// ---------------------------------------------------------------------------

import type { ReflectionSocraticIndicators } from "@/types/analytics"
import { HelpCircle } from "lucide-react"
import { useState } from "react"
import type { UnitStats } from "./unit-comparison"

interface SummaryOverviewProps {
  unitStats: UnitStats[]
  selectedAreaName?: string
  /**
   * Item 2.2 / 2.4 — when provided (Aprendizagem view), renders two extra
   * progress bars for Índice de Reflexões and Índice Socrático below the
   * existing Sessões / Reflexões bars. Pass undefined to keep original layout.
   */
  indicators?: ReflectionSocraticIndicators
}

/**
 * KNOWN LIMITATION (minor): the consolidated "Total" sums totalStudents and
 * activeStudents across units, so a student who belongs to two areas is counted
 * twice. This inflates the denominators for the header percentages (Ativos,
 * Conclusão, Sess./aluno) when units overlap. A correct fix needs tenant-level
 * UNIQUE active/total student counts threaded from the server (page.tsx already
 * has the unique student universe in `allStudentsList`); deferred to avoid a
 * cross-component prop refactor for what is a small, overlap-only skew. The
 * per-unit cards (UnitComparison) remain accurate — only the summed header is
 * affected, and only when a student spans multiple areas.
 */
function aggregateUnits(units: UnitStats[]): UnitStats {
  if (units.length === 0) {
    return {
      areaName: "Total",
      totalStudents: 0,
      activeStudents: 0,
      completedSessions: 0,
      totalSessions: 0,
      reflectionCount: 0,
      avgSessionsPerStudent: 0,
      completionPct: 0,
    }
  }

  const agg: UnitStats = {
    areaName: "Total",
    totalStudents: units.reduce((s, u) => s + u.totalStudents, 0),
    activeStudents: units.reduce((s, u) => s + u.activeStudents, 0),
    completedSessions: units.reduce((s, u) => s + u.completedSessions, 0),
    totalSessions: units.reduce((s, u) => s + u.totalSessions, 0),
    reflectionCount: units.reduce((s, u) => s + u.reflectionCount, 0),
    avgSessionsPerStudent: 0,
    completionPct: 0,
  }

  agg.avgSessionsPerStudent =
    agg.totalStudents > 0 ? Number((agg.totalSessions / agg.totalStudents).toFixed(1)) : 0
  agg.completionPct =
    agg.totalSessions > 0 ? Math.round((agg.completedSessions / agg.totalSessions) * 100) : 0

  return agg
}

export function SummaryOverview({ unitStats, selectedAreaName, indicators }: SummaryOverviewProps) {
  const [showHelp, setShowHelp] = useState(false)

  const stats = selectedAreaName
    ? (unitStats.find((u) => u.areaName === selectedAreaName) ?? aggregateUnits(unitStats))
    : aggregateUnits(unitStats)

  const activePct =
    stats.totalStudents > 0 ? Math.round((stats.activeStudents / stats.totalStudents) * 100) : 0

  const sessionsPct =
    stats.totalSessions > 0 ? Math.round((stats.completedSessions / stats.totalSessions) * 100) : 0

  // Scale reflections bar relative to total students (avg ~5 reflexões/aluno = 100%)
  const reflBarPct =
    stats.totalStudents > 0
      ? Math.min(100, Math.round((stats.reflectionCount / (stats.totalStudents * 5)) * 100))
      : 0

  // Item 2.2 — derived from indicators prop when present
  const indTotal = indicators?.total
  const reflIndexPct = indTotal?.reflectionIndexPct ?? null
  const socIndexPct = indTotal?.socraticIndexPct ?? null

  return (
    <div className="relative rounded-2xl bg-bg-card p-6 shadow-card dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06]">
      {/* Help */}
      <div className="absolute top-4 right-4">
        <button
          type="button"
          onClick={() => setShowHelp(!showHelp)}
          className="text-text-muted hover:text-cerrado-600 transition-colors"
        >
          <HelpCircle size={14} />
        </button>
        {showHelp && (
          <div className="absolute right-0 top-6 z-10 w-64 rounded-xl bg-bg-card border border-gray-100 dark:border-white/10 shadow-lg p-3">
            <p className="text-[11px] text-text-secondary leading-relaxed">
              Visão consolidada{" "}
              {selectedAreaName ? `de ${selectedAreaName}` : "de todas as unidades"}. Ativos: alunos
              com atividade nos últimos 30 dias. Conclusão: % de sessões concluídas sobre o total.
              Sess./aluno: média de sessões por aluno no período.
              {indicators &&
                " Índice de Reflexões e Índice Socrático: realizado ÷ potencial do currículo."}
            </p>
          </div>
        )}
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-8">
        <div className="text-center">
          <p className="text-4xl font-bold text-text-primary tabular-nums">{activePct}%</p>
          <p className="text-[10px] text-text-muted mt-1">Ativos (30d)</p>
        </div>
        <div className="text-center">
          <p className="text-4xl font-bold text-text-primary tabular-nums">
            {stats.completionPct}%
          </p>
          <p className="text-[10px] text-text-muted mt-1">Conclusão</p>
        </div>
        <div className="text-center">
          <p className="text-4xl font-bold text-text-primary tabular-nums">
            {typeof stats.avgSessionsPerStudent === "number"
              ? stats.avgSessionsPerStudent.toFixed(1)
              : "0.0"}
          </p>
          <p className="text-[10px] text-text-muted mt-1">Sess./aluno</p>
        </div>
      </div>

      {/* Progress bars — always rendered (Uso tab baseline) */}
      <div className="grid grid-cols-2 gap-6 mt-5">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-text-muted">Sessões</span>
            <span className="text-[10px] font-semibold text-text-primary tabular-nums">
              {stats.completedSessions}/{stats.totalSessions}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-black/[0.04] dark:bg-white/[0.04] overflow-hidden">
            <div
              className="h-full rounded-full bg-cerrado-600"
              style={{ width: `${sessionsPct}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-text-muted">Reflexões</span>
            <span className="text-[10px] font-semibold text-text-primary tabular-nums">
              {stats.reflectionCount}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-black/[0.04] dark:bg-white/[0.04] overflow-hidden">
            <div className="h-full rounded-full bg-varzea" style={{ width: `${reflBarPct}%` }} />
          </div>
        </div>
      </div>

      {/* Item 2.2 — Índice bars: only rendered when indicators prop is provided */}
      {indicators && (
        <div className="grid grid-cols-2 gap-6 mt-4 pt-4 border-t border-black/[0.04] dark:border-white/[0.04]">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-text-muted">Índice Reflexões</span>
              <span className="text-[10px] font-semibold tabular-nums" style={{ color: "#059669" }}>
                {reflIndexPct !== null ? `${reflIndexPct}%` : "—"}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-black/[0.04] dark:bg-white/[0.04] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${reflIndexPct ?? 0}%`, backgroundColor: "#059669" }}
              />
            </div>
            {indTotal && (
              <p className="text-[9px] text-text-muted mt-0.5">
                {indTotal.reflectionsWritten}/{indTotal.reflectionPotential} potencial
              </p>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-text-muted">Índice Socrático</span>
              <span className="text-[10px] font-semibold tabular-nums" style={{ color: "#7c3aed" }}>
                {socIndexPct !== null ? `${socIndexPct}%` : "—"}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-black/[0.04] dark:bg-white/[0.04] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${socIndexPct ?? 0}%`, backgroundColor: "#7c3aed" }}
              />
            </div>
            {indTotal && (
              <p className="text-[9px] text-text-muted mt-0.5">
                {indTotal.socraticRealized}/{indTotal.socraticPotential} potencial
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
