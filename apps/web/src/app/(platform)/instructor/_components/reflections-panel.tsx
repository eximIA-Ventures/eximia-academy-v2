"use client"

import { BookOpen, ChevronDown, ChevronRight } from "lucide-react"
import { useMemo, useState } from "react"
import type { TenantReflection } from "../actions"

interface ReflectionsPanelProps {
  reflections: TenantReflection[]
  total: number
}

export function ReflectionsPanel({ reflections, total }: ReflectionsPanelProps) {
  const [studentFilter, setStudentFilter] = useState("")
  const [chapterFilter, setChapterFilter] = useState("")

  const students = useMemo(() => {
    const set = new Set(reflections.map((r) => r.studentName))
    return [...set].sort()
  }, [reflections])

  const chapters = useMemo(() => {
    const set = new Set(reflections.map((r) => r.chapterTitle))
    return [...set].sort()
  }, [reflections])

  const filtered = useMemo(() => {
    let result = reflections
    if (studentFilter) result = result.filter((r) => r.studentName === studentFilter)
    if (chapterFilter) result = result.filter((r) => r.chapterTitle === chapterFilter)
    return result
  }, [reflections, studentFilter, chapterFilter])

  const grouped = useMemo(() => {
    const map = new Map<string, TenantReflection[]>()
    const sorted = [...filtered].sort((a, b) => a.slideOrder - b.slideOrder)
    for (const ref of sorted) {
      const list = map.get(ref.chapterTitle) ?? []
      list.push(ref)
      map.set(ref.chapterTitle, list)
    }
    return map
  }, [filtered])

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        {/* Student sidebar */}
        <div className="flex flex-col rounded-xl border border-border-subtle bg-bg-card shadow-md">
          <p className="rounded-t-xl border-b border-border-subtle bg-bg-elevated px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
            Alunos ({students.length})
          </p>
          <div className="flex flex-col gap-1.5 p-2 max-h-[220px] overflow-y-auto">
            <button
              type="button"
              onClick={() => setStudentFilter("")}
              className={`rounded-lg px-3 py-2.5 text-xs font-semibold text-left transition-all ${
                !studentFilter
                  ? "bg-cerrado-600 text-white shadow-md"
                  : "bg-bg-elevated text-text-primary shadow-sm hover:shadow hover:bg-bg-hover"
              }`}
            >
              Todos
            </button>
            {students.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setStudentFilter(name === studentFilter ? "" : name)}
                className={`rounded-lg px-3 py-2.5 text-xs font-medium text-left transition-all truncate ${
                  studentFilter === name
                    ? "bg-cerrado-600 text-white shadow-md"
                    : "bg-bg-elevated text-text-primary shadow-sm hover:shadow hover:bg-bg-hover"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-3">
          {chapters.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setChapterFilter("")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  !chapterFilter
                    ? "bg-varzea/20 text-varzea border border-varzea/30"
                    : "bg-bg-elevated text-text-muted border border-border-subtle hover:text-text-primary hover:bg-bg-hover"
                }`}
              >
                Todos os módulos
              </button>
              {chapters.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setChapterFilter(ch === chapterFilter ? "" : ch)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                    chapterFilter === ch
                      ? "bg-varzea/20 text-varzea border border-varzea/30"
                      : "bg-bg-elevated text-text-muted border border-border-subtle hover:text-text-primary hover:bg-bg-hover"
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          )}

          <p className="text-xs text-text-muted">
            {filtered.length} de {total} reflexões
            {studentFilter && ` · ${studentFilter}`}
            {chapterFilter && ` · ${chapterFilter}`}
          </p>

          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">
              Nenhuma reflexão encontrada.
            </p>
          ) : (
            <div className="space-y-4">
              {[...grouped.entries()].map(([chapterTitle, refs]) => (
                <CollapsibleChapter key={chapterTitle} title={chapterTitle} count={refs.length}>
                  <div className="space-y-2 pl-4 border-l-2 border-cerrado-600/20">
                    {refs.map((ref, i) => (
                      <div key={`${ref.studentName}-${ref.slideOrder}-${i}`} className="rounded-lg border border-border-subtle bg-bg-card px-4 py-3 shadow-sm">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-cerrado-600">Slide {ref.slideOrder}</span>
                            <span className="text-xs text-text-muted">·</span>
                            <span className="text-xs font-medium text-text-primary">{ref.studentName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-block h-2 w-2 rounded-full ${ref.hasAiResponse ? "bg-emerald-500" : "bg-text-muted"}`} />
                            <span className="text-xs text-text-muted">
                              {new Date(ref.createdAt).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-text-secondary leading-relaxed">{ref.response}</p>
                      </div>
                    ))}
                  </div>
                </CollapsibleChapter>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CollapsibleChapter({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 mb-2 group w-full text-left"
      >
        {open ? <ChevronDown size={14} className="text-cerrado-600" /> : <ChevronRight size={14} className="text-cerrado-600" />}
        <BookOpen size={14} className="text-cerrado-600" />
        <h4 className="text-sm font-semibold text-text-primary group-hover:text-cerrado-600 transition-colors">{title}</h4>
        <span className="text-xs text-text-muted">({count})</span>
      </button>
      {open && children}
    </div>
  )
}
