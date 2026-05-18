"use client"

import { BookOpen, ChevronDown, ChevronRight, MessageSquare } from "lucide-react"
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
        <div
          className="flex flex-col rounded-xl border border-stone-200 bg-white shadow-md dark:border-stone-700 dark:bg-stone-900"
        >
          <p className="rounded-t-xl border-b border-stone-200 bg-stone-50 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400">
            Alunos ({students.length})
          </p>
          <div className="flex flex-col gap-1 p-2 max-h-[220px] overflow-y-auto">
            <button
              type="button"
              onClick={() => setStudentFilter("")}
              className={`rounded-lg px-3 py-2 text-xs font-semibold text-left transition-all ${
                !studentFilter
                  ? "bg-cerrado-600 text-white shadow-md"
                  : "bg-stone-100 text-stone-700 shadow-sm hover:bg-stone-200 hover:shadow dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
              }`}
            >
              Todos
            </button>
            {students.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setStudentFilter(name === studentFilter ? "" : name)}
                className={`rounded-lg px-3 py-2 text-xs font-medium text-left transition-all truncate ${
                  studentFilter === name
                    ? "bg-cerrado-600 text-white shadow-md"
                    : "bg-stone-100 text-stone-700 shadow-sm hover:bg-stone-200 hover:shadow dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
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
                    : "bg-stone-100 text-stone-500 hover:text-stone-700 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700"
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
                      : "bg-stone-100 text-stone-500 hover:text-stone-700 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700"
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          )}

          <p className="text-xs text-stone-500 dark:text-stone-400">
            {filtered.length} de {total} reflexões
            {studentFilter && ` · ${studentFilter}`}
            {chapterFilter && ` · ${chapterFilter}`}
          </p>

          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-stone-400">
              Nenhuma reflexão encontrada com os filtros selecionados.
            </p>
          ) : (
            <div className="space-y-4">
              {[...grouped.entries()].map(([chapterTitle, refs]) => (
                <CollapsibleChapter key={chapterTitle} title={chapterTitle} count={refs.length}>
                  <div className="space-y-2 pl-4 border-l-2 border-cerrado-600/20">
                    {refs.map((ref, i) => (
                      <div key={`${ref.studentName}-${ref.slideOrder}-${i}`} className="rounded-lg border border-stone-200 bg-white px-4 py-3 shadow-sm dark:border-stone-700 dark:bg-stone-900">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-cerrado-600">Slide {ref.slideOrder}</span>
                            <span className="text-xs text-stone-300 dark:text-stone-600">·</span>
                            <span className="text-xs font-medium text-stone-700 dark:text-stone-300">{ref.studentName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-block h-2 w-2 rounded-full ${ref.hasAiResponse ? "bg-emerald-500" : "bg-stone-300 dark:bg-stone-600"}`} />
                            <span className="text-xs text-stone-400">
                              {new Date(ref.createdAt).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-stone-600 leading-relaxed dark:text-stone-300">{ref.response}</p>
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
        <h4 className="text-sm font-semibold text-stone-800 group-hover:text-cerrado-600 transition-colors dark:text-stone-200">{title}</h4>
        <span className="text-xs text-stone-400">({count})</span>
      </button>
      {open && children}
    </div>
  )
}
