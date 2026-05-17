"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import { BookOpen, ChevronDown, ChevronRight, Download, MessageSquare, UserX } from "lucide-react"
import { useMemo, useState } from "react"

export interface ModuleReflectionStats {
  chapterTitle: string
  chapterOrder: number
  totalSlides: number
  reflectionCount: number
  studentCount: number
  totalStudents: number
  avgWordCount: number
  missingStudents: string[]
  reflections?: Array<{
    studentName: string
    slideOrder: number
    response: string
    createdAt: string
  }>
}

interface ReflectionAnalyticsProps {
  modules: ModuleReflectionStats[]
  totalReflections: number
  totalStudents: number
}

export function ReflectionAnalytics({ modules, totalReflections, totalStudents }: ReflectionAnalyticsProps) {
  const [expandedModule, setExpandedModule] = useState<string | null>(null)
  const [studentFilter, setStudentFilter] = useState("")
  const sortedModules = [...modules].sort((a, b) => a.chapterOrder - b.chapterOrder)
  const maxReflections = Math.max(...modules.map((m) => m.reflectionCount), 1)

  // Get unique student names from all reflections
  const allStudents = useMemo(() => {
    const names = new Set<string>()
    for (const mod of modules) {
      for (const r of mod.reflections ?? []) names.add(r.studentName)
    }
    return [...names].sort()
  }, [modules])

  // Filter modules' reflections by student
  const filteredModules = useMemo(() => {
    if (!studentFilter) return sortedModules
    return sortedModules.map((mod) => ({
      ...mod,
      reflections: (mod.reflections ?? []).filter((r) => r.studentName === studentFilter),
      reflectionCount: (mod.reflections ?? []).filter((r) => r.studentName === studentFilter).length,
      studentCount: (mod.reflections ?? []).filter((r) => r.studentName === studentFilter).length > 0 ? 1 : 0,
    }))
  }, [sortedModules, studentFilter])

  function handleExport() {
    const headers = ["Módulo", "Slide", "Aluno", "Reflexão", "Data"]
    const rows: string[][] = []
    for (const mod of sortedModules) {
      for (const r of mod.reflections ?? []) {
        rows.push([mod.chapterTitle, String(r.slideOrder), r.studentName, r.response, new Date(r.createdAt).toLocaleDateString("pt-BR")])
      }
    }
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(","))].join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `reflexoes-analytics-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare size={18} />
            Reflexões por Módulo
          </CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-muted">{totalReflections} reflexões · {totalStudents} alunos</span>
            <button type="button" onClick={handleExport} className="flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover transition-colors">
              <Download size={12} /> Exportar
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Student filter + module filter */}
        <div className="grid gap-4 md:grid-cols-[200px_1fr]">
          {/* Student sidebar */}
          <div className="flex flex-col gap-1 rounded-xl bg-bg-surface p-2 shadow-card max-h-[300px] overflow-y-auto">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted px-2 py-1">Alunos</p>
            <button
              type="button"
              onClick={() => setStudentFilter("")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium text-left transition-all ${!studentFilter ? "bg-cerrado-600 text-white" : "text-text-muted hover:text-text-primary hover:bg-bg-hover"}`}
            >
              Todos
            </button>
            {allStudents.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setStudentFilter(name === studentFilter ? "" : name)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium text-left transition-all truncate ${studentFilter === name ? "bg-cerrado-600 text-white" : "text-text-muted hover:text-text-primary hover:bg-bg-hover"}`}
              >
                {name}
              </button>
            ))}
          </div>

          {/* Module list */}
          <div className="space-y-3">
            <p className="text-xs text-text-muted">
              {studentFilter ? `Reflexões de ${studentFilter}` : `${totalReflections} reflexões em ${modules.length} módulos`}
            </p>

            {filteredModules.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-muted">Nenhuma reflexão registrada.</p>
            ) : (
              filteredModules.map((mod) => {
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
                          {missingCount > 0 && !studentFilter && (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-semantic-error bg-semantic-error/10 px-2 py-0.5 rounded-full">
                              <UserX size={10} />
                              {missingCount} sem reflexão
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 rounded-full bg-black/[0.04] overflow-hidden">
                          <div className="h-full rounded-full bg-cerrado-600 transition-all" style={{ width: `${barWidth}%`, opacity: 0.4 + (barWidth / 100) * 0.6 }} />
                        </div>
                        <span className="text-[10px] text-text-muted tabular-nums w-10 text-right">{participationPct}%</span>
                      </div>
                      <div className="flex items-center gap-4 mt-1.5">
                        <span className="text-[10px] text-text-muted">{mod.totalSlides} slides</span>
                        <span className="text-[10px] text-text-muted">~{mod.avgWordCount} palavras/reflexão</span>
                      </div>
                    </button>

                    {/* Expanded: reflections + missing students */}
                    {isExpanded && (
                      <div className="border-t border-border-subtle">
                        {/* Actual reflections */}
                        {(mod.reflections?.length ?? 0) > 0 && (
                          <div className="px-4 py-3 space-y-2">
                            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Reflexões</p>
                            <div className="space-y-1.5 pl-3 border-l-2 border-cerrado-600/20">
                              {[...(mod.reflections ?? [])].sort((a, b) => a.slideOrder - b.slideOrder).map((ref, i) => (
                                <div key={i} className="rounded-md bg-bg-card px-3 py-2">
                                  <div className="flex items-center justify-between mb-0.5">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium text-cerrado-600">Slide {ref.slideOrder}</span>
                                      <span className="text-xs text-text-muted">·</span>
                                      <span className="text-xs font-medium text-text-primary">{ref.studentName}</span>
                                    </div>
                                    <span className="text-[9px] text-text-muted">{new Date(ref.createdAt).toLocaleDateString("pt-BR")}</span>
                                  </div>
                                  <p className="text-[11px] text-text-secondary leading-relaxed">{ref.response}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Missing students */}
                        {missingCount > 0 && !studentFilter && (
                          <div className="px-4 py-3 border-t border-border-subtle">
                            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
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
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
