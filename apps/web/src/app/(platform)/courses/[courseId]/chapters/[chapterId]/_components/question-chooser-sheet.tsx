"use client"

import { Button, cn } from "@eximia/ui"
import { Dices, MessageCircle, Sparkles, X } from "lucide-react"
import { useEffect, useState, useTransition } from "react"
import { createPortal } from "react-dom"
import { createSession, getActiveQuestions } from "../actions"

interface Question {
  id: string
  text: string
  skill: string | null
  intention: string | null
}

interface QuestionChooserSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  chapterId: string
  courseId: string
}

const SKILL_CONFIG: Record<string, { label: string; color: string }> = {
  analise: { label: "Análise", color: "bg-purple-500/10 text-purple-400 ring-purple-500/20" },
  reflexao: { label: "Reflexão", color: "bg-amber-500/10 text-amber-400 ring-amber-500/20" },
  aplicacao: { label: "Aplicação", color: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20" },
  sintese: { label: "Síntese", color: "bg-blue-500/10 text-blue-400 ring-blue-500/20" },
}

export function QuestionChooserSheet({
  open,
  onOpenChange,
  chapterId,
  courseId,
}: QuestionChooserSheetProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setSelectedId(null)
    getActiveQuestions(chapterId)
      .then((data) => {
        if (!cancelled) setQuestions(data)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, chapterId])

  const handleStartRandom = () => {
    startTransition(() => {
      createSession(chapterId, courseId)
    })
  }

  const handleStartSelected = () => {
    if (!selectedId) return
    startTransition(() => {
      createSession(chapterId, courseId, selectedId)
    })
  }

  if (!open || !mounted) return null

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 animate-in fade-in duration-200"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div className="relative z-10 mx-4 w-full max-w-lg animate-in zoom-in-95 fade-in duration-200 rounded-2xl bg-bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between  px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cerrado-600/10">
              <MessageCircle size={16} className="text-cerrado-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Diálogo Socrático</h2>
              <p className="text-xs text-text-muted">Escolha um tema ou deixe o acaso decidir</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>

        {/* Random option */}
        <div className="px-6 pt-4">
          <button
            type="button"
            onClick={handleStartRandom}
            disabled={isPending}
            className="flex w-full items-center gap-3 rounded-xl border border-cerrado-600/20 bg-cerrado-600/5 p-4 text-left transition-all hover:bg-cerrado-600/10 hover:border-cerrado-600/30 active:scale-[0.99]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cerrado-600 text-white">
              <Dices size={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">Pergunta Aleatória</p>
              <p className="text-xs text-text-muted">Deixe a IA escolher o melhor tema</p>
            </div>
            <Sparkles size={14} className="text-cerrado-600" />
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 px-6 py-3">
          <div className="h-px flex-1 bg-border-subtle" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">ou escolha</span>
          <div className="h-px flex-1 bg-border-subtle" />
        </div>

        {/* Question list */}
        <div className="max-h-[40vh] overflow-y-auto px-6 pb-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-cerrado-600 border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-2">
              {questions.map((q) => {
                const isSelected = selectedId === q.id
                const skill = q.skill ? SKILL_CONFIG[q.skill] : null

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setSelectedId(isSelected ? null : q.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all",
                      isSelected
                        ? "border-cerrado-600 bg-cerrado-600/5 ring-1 ring-cerrado-600/20"
                        : "border-border-subtle hover:border-border-primary hover:bg-bg-card",
                    )}
                  >
                    <div className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                      isSelected ? "border-cerrado-600 bg-cerrado-600" : "border-border-primary",
                    )}>
                      {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary leading-snug">{q.text}</p>
                      <div className="mt-2 flex items-center gap-2">
                        {skill && (
                          <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium ring-1", skill.color)}>
                            {skill.label}
                          </span>
                        )}
                        {q.intention && (
                          <span className="text-[10px] text-text-muted truncate">{q.intention}</span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {selectedId && (
          <div className=" px-6 py-4">
            <Button className="w-full" onClick={handleStartSelected} disabled={isPending}>
              {isPending ? "Iniciando..." : "Iniciar com esta pergunta"}
            </Button>
          </div>
        )}

        {/* Close bottom padding if no selection */}
        {!selectedId && <div className="h-4" />}
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
