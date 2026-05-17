"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import { BookOpen, ChevronDown, ChevronRight, MessageSquare, UserX } from "lucide-react"
import { useState } from "react"

export interface ModuleReflectionStats {
  chapterTitle: string
  chapterOrder: number
  totalSlides: number
  reflectionCount: number
  studentCount: number
  totalStudents: number
  avgWordCount: number
  missingStudents: string[]
}

interface ReflectionAnalyticsProps {
  modules: ModuleReflectionStats[]
  totalReflections: number
  totalStudents: number
}

export function ReflectionAnalytics({ modules, totalReflections, totalStudents }: ReflectionAnalyticsProps) {
  const [expandedModule, setExpandedModule] = useState<string | null>(null)
  const sortedModules = [...modules].sort((a, b) => a.chapterOrder - b.chapterOrder)
  const maxReflections = Math.max(...modules.map((m) => m.reflectionCount), 1)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare size={18} />
            Reflexões por Módulo
          </CardTitle>
          <span className="text-sm text-text-muted">{totalReflections} reflexões · {totalStudents} alunos</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedModules.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-muted">Nenhuma reflexão registrada no período.</p>
        ) : (
          sortedModules.map((mod) => {
            const isExpanded = expandedModule === mod.chapterTitle
            const participationPct = mod.totalStudents > 0 ? Math.round((mod.studentCount / mod.totalStudents) * 100) : 0
            const barWidth = Math.round((mod.reflectionCount / maxReflections) * 100)
            const missingCount = mod.totalStudents - mod.studentCount

            return (
              <div key={mod.chapterTitle} className="rounded-xl bg-bg-surface shadow-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedModule(isExpanded ? null : mod.chapterTitle)}
                  className="w-full text-left px-4 py-3 hover:bg-bg-hover transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown size={14} className="text-cerrado-600" /> : <ChevronRight size={14} className="text-text-muted" />}
                      <BookOpen size={14} className="text-cerrado-600" />
                      <span className="text-sm font-semibold text-text-primary">{mod.chapterTitle}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-text-primary">{mod.reflectionCount} refl.</span>
                      <span className="text-xs text-text-muted">{mod.studentCount}/{mod.totalStudents} alunos</span>
                      {missingCount > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-semantic-error bg-semantic-error/10 px-2 py-0.5 rounded-full">
                          <UserX size={10} />
                          {missingCount} sem reflexão
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full bg-black/[0.04] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-cerrado-600 transition-all"
                        style={{ width: `${barWidth}%`, opacity: 0.4 + (barWidth / 100) * 0.6 }}
                      />
                    </div>
                    <span className="text-[10px] text-text-muted tabular-nums w-10 text-right">{participationPct}%</span>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 mt-1.5">
                    <span className="text-[10px] text-text-muted">{mod.totalSlides} slides</span>
                    <span className="text-[10px] text-text-muted">~{mod.avgWordCount} palavras/reflexão</span>
                  </div>
                </button>

                {/* Expanded: missing students */}
                {isExpanded && missingCount > 0 && (
                  <div className="px-4 pb-3 border-t border-border-subtle">
                    <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mt-2 mb-1.5">
                      Alunos sem reflexão neste módulo
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {mod.missingStudents.map((name) => (
                        <span key={name} className="text-[10px] px-2 py-0.5 rounded-full bg-semantic-error/5 text-semantic-error border border-semantic-error/10">
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
