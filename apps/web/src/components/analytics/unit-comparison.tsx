"use client"

// ---------------------------------------------------------------------------
// UnitComparison — Item 1.2 (three role-gated modes) + Item 7 (N-entity selection)
// FASE 2 additions: allowedModes prop gates visible comparison modes by role;
//                  avgDepth + consciousCompletionPct displayed in card mini-row;
//                  both optional fields threaded through to CauseProbablePanel.
// ---------------------------------------------------------------------------

import type {
  ComparisonMode as AnalyticsComparisonMode,
  AreaStats,
  CourseStats,
} from "@/types/analytics"
import { Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import { ArrowUp, BookOpen, Building2, ChevronDown, Crown, LayoutGrid, Users } from "lucide-react"
import { useMemo, useState } from "react"
import { type CausePanelEntity, CauseProbablePanel } from "./cause-probable-panel"

// Re-export so analytics-dashboard.tsx keeps its existing import path.
export interface UnitStats {
  areaName: string
  totalStudents: number
  activeStudents: number
  completedSessions: number
  totalSessions: number
  reflectionCount: number
  avgSessionsPerStudent: number
  completionPct: number
  /** FASE 2 (8.2) — average session depth; optional & additive. */
  avgDepth?: number
  /** FASE 2 (8.2) — % students who completed AND reflected; optional & additive. */
  consciousCompletionPct?: number
}

type ComparisonMode = "units" | "areas" | "courses"

const COMPARISON_LABELS: Record<ComparisonMode, string> = {
  units: "Unidades",
  areas: "Áreas / Gestor",
  courses: "Cursos",
}

/** Maximum items shown before showing the selection panel. */
const MAX_VISIBLE = 6

const ALL_MODES: readonly ComparisonMode[] = ["units", "areas", "courses"]

// ---------------------------------------------------------------------------
// Uniform card-data shape
// ---------------------------------------------------------------------------
interface CardData {
  key: string
  name: string
  sublabel?: string
  badge?: string
  totalStudents: number
  activeStudents: number
  completedSessions: number
  totalSessions: number
  reflectionCount: number
  avgSessionsPerStudent: number
  completionPct: number
  avgDepth?: number
  consciousCompletionPct?: number
}

function unitToCard(u: UnitStats): CardData {
  return {
    key: u.areaName,
    name: u.areaName,
    totalStudents: u.totalStudents,
    activeStudents: u.activeStudents,
    completedSessions: u.completedSessions,
    totalSessions: u.totalSessions,
    reflectionCount: u.reflectionCount,
    avgSessionsPerStudent: u.avgSessionsPerStudent,
    completionPct: u.completionPct,
    avgDepth: u.avgDepth,
    consciousCompletionPct: u.consciousCompletionPct,
  }
}

function areaToCard(a: AreaStats): CardData {
  return {
    key: a.groupId,
    name: a.groupName,
    sublabel: a.managerName ?? undefined,
    badge: a.isCorporate ? "corporativo" : undefined,
    totalStudents: a.totalStudents,
    activeStudents: a.activeStudents,
    completedSessions: a.completedSessions,
    totalSessions: a.totalSessions,
    reflectionCount: a.reflectionCount,
    avgSessionsPerStudent: a.avgSessionsPerStudent,
    completionPct: a.completionPct,
    avgDepth: a.avgDepth,
    consciousCompletionPct: a.consciousCompletionPct,
  }
}

function courseToCard(c: CourseStats): CardData {
  return {
    key: c.courseId,
    name: c.title,
    sublabel: c.status === "published" ? "publicado" : c.status,
    totalStudents: c.totalStudents,
    activeStudents: c.activeStudents,
    completedSessions: c.completedSessions,
    totalSessions: c.totalSessions,
    reflectionCount: c.reflectionCount,
    avgSessionsPerStudent: c.avgSessionsPerStudent,
    completionPct: c.completionPct,
    avgDepth: c.avgDepth,
    consciousCompletionPct: c.consciousCompletionPct,
  }
}

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------
export interface UnitComparisonProps {
  units: UnitStats[]
  areaStats?: AreaStats[]
  courseStats?: CourseStats[]
  /**
   * 1.2 — Comparison modes the current role may see. Controls which options
   * appear in the mode dropdown. Defaults to all three for backward-compat.
   */
  allowedModes?: readonly AnalyticsComparisonMode[]
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function UnitComparison({
  units,
  areaStats = [],
  courseStats = [],
  allowedModes = ALL_MODES,
}: UnitComparisonProps) {
  // Default to the first allowed mode that also has data; fall back to first allowed.
  const resolveDefault = (): ComparisonMode => {
    const ordered: ComparisonMode[] = ["units", "areas", "courses"]
    for (const m of ordered) {
      if (!allowedModes.includes(m)) continue
      const count =
        m === "areas" ? areaStats.length : m === "courses" ? courseStats.length : units.length
      if (count >= 2) return m
    }
    return (allowedModes[0] as ComparisonMode | undefined) ?? "units"
  }

  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>(resolveDefault)
  const [showSelector, setShowSelector] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  const allCards = useMemo<CardData[]>(() => {
    switch (comparisonMode) {
      case "areas":
        return areaStats.map(areaToCard)
      case "courses":
        return courseStats.map(courseToCard)
      default:
        return units.map(unitToCard)
    }
  }, [comparisonMode, units, areaStats, courseStats])

  const visibleCards = useMemo<CardData[]>(() => {
    if (selectedKeys.size === 0 || allCards.every((c) => !selectedKeys.has(c.key))) {
      return [...allCards].sort((a, b) => b.completionPct - a.completionPct).slice(0, MAX_VISIBLE)
    }
    return allCards.filter((c) => selectedKeys.has(c.key))
  }, [allCards, selectedKeys])

  const modeEnabled: Record<ComparisonMode, boolean> = {
    units: units.length >= 2 && allowedModes.includes("units"),
    areas: areaStats.length >= 2 && allowedModes.includes("areas"),
    courses: courseStats.length >= 2 && allowedModes.includes("courses"),
  }

  const bestActive =
    visibleCards.length > 0
      ? visibleCards.reduce((a, b) =>
          a.activeStudents / Math.max(a.totalStudents, 1) >=
          b.activeStudents / Math.max(b.totalStudents, 1)
            ? a
            : b,
        )
      : null
  const bestCompletion =
    visibleCards.length > 0
      ? visibleCards.reduce((a, b) => (a.completionPct >= b.completionPct ? a : b))
      : null
  const bestSessPerStudent =
    visibleCards.length > 0
      ? visibleCards.reduce((a, b) => (a.avgSessionsPerStudent >= b.avgSessionsPerStudent ? a : b))
      : null
  const bestReflections =
    visibleCards.length > 0
      ? visibleCards.reduce((a, b) => (a.reflectionCount >= b.reflectionCount ? a : b))
      : null

  function winsCount(c: CardData): number {
    let w = 0
    if (bestActive && c.key === bestActive.key) w++
    if (bestCompletion && c.key === bestCompletion.key) w++
    if (bestSessPerStudent && c.key === bestSessPerStudent.key) w++
    if (bestReflections && c.key === bestReflections.key) w++
    return w
  }

  const overallBest =
    visibleCards.length > 0
      ? visibleCards.reduce((a, b) => (winsCount(a) >= winsCount(b) ? a : b))
      : null

  function toggleKey(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleModeChange(mode: ComparisonMode) {
    setComparisonMode(mode)
    setSelectedKeys(new Set())
    setShowSelector(false)
  }

  const anyEnabled = Object.values(modeEnabled).some(Boolean)
  if (!anyEnabled) return null

  const ModeIcon =
    comparisonMode === "courses" ? BookOpen : comparisonMode === "areas" ? Users : Building2
  const gridCols =
    visibleCards.length <= 2
      ? "md:grid-cols-2"
      : visibleCards.length === 3
        ? "md:grid-cols-2 lg:grid-cols-3"
        : "md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"

  // Only show modes the role is allowed to compare
  const modesInDropdown = ALL_MODES.filter((m) =>
    allowedModes.includes(m as AnalyticsComparisonMode),
  )

  return (
    <Card className="dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06]">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <ModeIcon size={18} />
            Comparação entre {COMPARISON_LABELS[comparisonMode]}
          </CardTitle>

          <div className="flex items-center gap-2">
            {allCards.length > MAX_VISIBLE && (
              <button
                type="button"
                onClick={() => setShowSelector((v) => !v)}
                className={`text-[11px] font-medium rounded-md px-2 py-1 transition-colors ${
                  showSelector
                    ? "bg-cerrado-600/10 text-cerrado-600"
                    : "text-text-muted hover:text-cerrado-600"
                }`}
                title="Selecionar quais comparar"
              >
                <LayoutGrid size={13} className="inline mr-1" />
                Selecionar
              </button>
            )}

            {/* Mode selector — hidden when only 1 mode is allowed (no choice to make) */}
            {modesInDropdown.length >= 2 && (
              <div className="relative inline-flex items-center">
                <select
                  value={comparisonMode}
                  onChange={(e) => handleModeChange(e.target.value as ComparisonMode)}
                  className="appearance-none text-[11px] font-medium text-text-muted bg-transparent rounded-md pl-2 pr-5 py-1 cursor-pointer hover:text-cerrado-600 transition-colors focus:outline-none"
                >
                  {modesInDropdown.map((m) => (
                    <option key={m} value={m} disabled={!modeEnabled[m]}>
                      {COMPARISON_LABELS[m]}
                      {!modeEnabled[m] ? " (sem dados)" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={10}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-text-muted/50 pointer-events-none"
                />
              </div>
            )}
          </div>
        </div>

        {showSelector && allCards.length > 0 && (
          <div className="mt-3 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08]">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-2">
              Selecionar quais comparar (máx. {MAX_VISIBLE})
            </p>
            <div className="flex flex-wrap gap-2">
              {allCards.map((c) => {
                const checked = selectedKeys.has(c.key)
                const wouldExceed = !checked && selectedKeys.size >= MAX_VISIBLE
                return (
                  <button
                    key={c.key}
                    type="button"
                    disabled={wouldExceed}
                    onClick={() => toggleKey(c.key)}
                    className={`text-[11px] font-medium rounded-lg px-2.5 py-1 border transition-colors ${
                      checked
                        ? "bg-cerrado-600 text-white border-cerrado-600"
                        : wouldExceed
                          ? "bg-transparent text-text-muted/40 border-black/[0.06] cursor-not-allowed"
                          : "bg-white dark:bg-white/[0.04] text-text-primary border-black/[0.08] dark:border-white/[0.08] hover:border-cerrado-600/40"
                    }`}
                  >
                    {c.name}
                  </button>
                )
              })}
            </div>
            {selectedKeys.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedKeys(new Set())}
                className="mt-2 text-[10px] text-text-muted hover:text-cerrado-600 transition-colors"
              >
                Limpar seleção
              </button>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {visibleCards.length < 2 ? (
          <p className="text-sm text-text-muted text-center py-6">
            Dados insuficientes para comparação neste modo.
          </p>
        ) : (
          <>
            <div className={`grid gap-4 ${gridCols}`}>
              {visibleCards.map((card) => {
                const activePct =
                  card.totalStudents > 0
                    ? Math.round((card.activeStudents / card.totalStudents) * 100)
                    : 0
                const isOverallBest = overallBest?.key === card.key
                const isActiveWinner = bestActive?.key === card.key
                const isCompletionWinner = bestCompletion?.key === card.key
                const isSessWinner = bestSessPerStudent?.key === card.key
                const isReflWinner = bestReflections?.key === card.key

                return (
                  <div
                    key={card.key}
                    className={`rounded-2xl p-5 space-y-4 ${
                      isOverallBest
                        ? "bg-cerrado-600/[0.04] ring-1 ring-cerrado-600/10"
                        : "bg-gray-50 dark:bg-white/[0.04] dark:border dark:border-white/[0.06]"
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-sm font-bold text-text-primary truncate">
                            {card.name}
                          </h4>
                          {isOverallBest && (
                            <Crown size={14} className="text-cerrado-600 shrink-0" />
                          )}
                          {card.badge && (
                            <span className="text-[9px] font-semibold uppercase tracking-wide text-cerrado-600/70 bg-cerrado-600/[0.08] rounded-full px-1.5 py-0.5">
                              {card.badge}
                            </span>
                          )}
                        </div>
                        {card.sublabel && (
                          <p className="text-[10px] text-text-muted mt-0.5 truncate">
                            {card.sublabel}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] text-text-muted font-medium shrink-0">
                        {card.totalStudents} alunos
                      </span>
                    </div>

                    {/* Main metrics */}
                    <div className="grid grid-cols-3 gap-3">
                      <MetricCell
                        value={`${activePct}%`}
                        label="Ativos (30d)"
                        isWinner={isActiveWinner}
                      />
                      <MetricCell
                        value={`${card.completionPct}%`}
                        label="Conclusão"
                        isWinner={isCompletionWinner}
                      />
                      <MetricCell
                        value={card.avgSessionsPerStudent.toFixed(1)}
                        label="Sess./aluno"
                        isWinner={isSessWinner}
                      />
                    </div>

                    {/* FASE 2 (8.2) — depth + conscious completion mini-row */}
                    {(card.avgDepth !== undefined || card.consciousCompletionPct !== undefined) && (
                      <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-black/[0.04] dark:border-white/[0.04]">
                        {card.avgDepth !== undefined && (
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-text-muted">Profundidade:</span>
                            <span className="text-[10px] font-semibold text-[#8b5cf6] tabular-nums">
                              {card.avgDepth.toFixed(1)}
                            </span>
                          </div>
                        )}
                        {card.consciousCompletionPct !== undefined && (
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-text-muted">Concl. consciente:</span>
                            <span className="text-[10px] font-semibold text-varzea tabular-nums">
                              {Math.round(card.consciousCompletionPct)}%
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bars */}
                    <div className="grid grid-cols-2 gap-3">
                      <BarMetric
                        label="Sessões"
                        value={card.completedSessions}
                        total={card.totalSessions}
                        isWinner={false}
                        color="bg-cerrado-600"
                        maxValue={Math.max(...visibleCards.map((u) => u.completedSessions), 1)}
                        current={card.completedSessions}
                      />
                      <BarMetric
                        label="Reflexões"
                        value={card.reflectionCount}
                        isWinner={isReflWinner}
                        color="bg-varzea"
                        maxValue={Math.max(...visibleCards.map((u) => u.reflectionCount), 1)}
                        current={card.reflectionCount}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* CauseProbablePanel — passes avgDepth + consciousCompletionPct through */}
            {(() => {
              const causeEntities: CausePanelEntity[] = visibleCards.map((c) => ({
                key: c.key,
                name: c.name,
                metrics: {
                  totalStudents: c.totalStudents,
                  activeStudents: c.activeStudents,
                  completedSessions: c.completedSessions,
                  totalSessions: c.totalSessions,
                  reflectionCount: c.reflectionCount,
                  avgSessionsPerStudent: c.avgSessionsPerStudent,
                  completionPct: c.completionPct,
                  avgDepth: c.avgDepth,
                  consciousCompletionPct: c.consciousCompletionPct,
                },
              }))
              return (
                <CauseProbablePanel
                  entities={causeEntities}
                  overallBestKey={overallBest?.key ?? visibleCards[0].key}
                />
              )
            })()}
          </>
        )}

        {allCards.length > MAX_VISIBLE && selectedKeys.size === 0 && !showSelector && (
          <p className="mt-3 text-center text-[10px] text-text-muted">
            Mostrando {Math.min(allCards.length, MAX_VISIBLE)} de {allCards.length}.{" "}
            <button
              type="button"
              className="underline hover:text-cerrado-600 transition-colors"
              onClick={() => setShowSelector(true)}
            >
              Selecionar quais comparar
            </button>
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricCell({
  value,
  label,
  isWinner,
}: { value: string; label: string; isWinner: boolean }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1">
        <p
          className={`text-lg font-bold tabular-nums ${isWinner ? "text-cerrado-600" : "text-text-primary"}`}
        >
          {value}
        </p>
        {isWinner && <ArrowUp size={12} className="text-cerrado-600" />}
      </div>
      <p className="text-[9px] text-text-muted">{label}</p>
    </div>
  )
}

function BarMetric({
  label,
  value,
  total,
  isWinner,
  color,
  maxValue,
  current,
}: {
  label: string
  value: number
  total?: number
  isWinner: boolean
  color: string
  maxValue: number
  current: number
}) {
  const pct = maxValue > 0 ? (current / maxValue) * 100 : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-text-muted">{label}</span>
        <span
          className={`text-[10px] font-semibold tabular-nums ${isWinner ? "text-cerrado-600" : "text-text-primary"}`}
        >
          {total !== undefined ? `${value}/${total}` : value}
          {isWinner && " ★"}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-black/[0.04] overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
