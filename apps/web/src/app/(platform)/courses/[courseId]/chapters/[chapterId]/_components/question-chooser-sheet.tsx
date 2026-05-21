"use client"

import { Button, cn } from "@eximia/ui"
import { AlertCircle, Dices, MessageCircle, Sparkles, X } from "lucide-react"
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
  analise: { label: "Análise", color: "bg-purple-100 text-purple-700 ring-purple-200" },
  reflexao: { label: "Reflexão", color: "bg-amber-100 text-amber-700 ring-amber-200" },
  aplicacao: { label: "Aplicação", color: "bg-emerald-100 text-emerald-700 ring-emerald-200" },
  sintese: { label: "Síntese", color: "bg-blue-100 text-blue-700 ring-blue-200" },
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
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setSelectedId(null)
    setError(null)
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
    setError(null)
    startTransition(async () => {
      try {
        await createSession(chapterId, courseId)
      } catch (e: any) {
        if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e
        setError(e?.message || "Erro ao criar sessão")
      }
    })
  }

  const handleStartSelected = () => {
    if (!selectedId) return
    setError(null)
    startTransition(async () => {
      try {
        await createSession(chapterId, courseId, selectedId)
      } catch (e: any) {
        if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e
        setError(e?.message || "Erro ao criar sessão")
      }
    })
  }

  if (!open || !mounted) return null

  const content = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop — fully opaque */}
      <div
        className="absolute inset-0 bg-black/95"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal — solid white background, no tokens */}
      <div className="relative z-10 mx-4 w-full max-w-lg rounded-2xl bg-white shadow-2xl" style={{ backgroundColor: '#ffffff' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50">
              <MessageCircle size={16} className="text-cerrado-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-stone-900">Diálogo Socrático</h2>
              <p className="text-xs text-stone-500">Escolha um tema ou deixe o acaso decidir</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
          >
            <X size={16} />
          </button>
        </div>

        {/* Random option */}
        <div className="px-6 pt-5">
          <button
            type="button"
            onClick={handleStartRandom}
            disabled={isPending}
            className="flex w-full items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 text-left transition-all hover:bg-orange-100 hover:border-orange-300 active:scale-[0.99]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cerrado-600 text-white">
              <Dices size={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-stone-900">Pergunta Aleatória</p>
              <p className="text-xs text-stone-500">Deixe a IA escolher o melhor tema</p>
            </div>
            <Sparkles size={14} className="text-cerrado-600" />
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 px-6 py-3">
          <div className="h-px flex-1 bg-stone-200" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-stone-400">ou escolha</span>
          <div className="h-px flex-1 bg-stone-200" />
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
                        ? "border-cerrado-600 bg-orange-50 ring-1 ring-cerrado-600/20"
                        : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50",
                    )}
                  >
                    <div className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                      isSelected ? "border-cerrado-600 bg-cerrado-600" : "border-stone-300",
                    )}>
                      {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-stone-800 leading-snug">{q.text}</p>
                      <div className="mt-2 flex items-center gap-2">
                        {skill && (
                          <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium ring-1", skill.color)}>
                            {skill.label}
                          </span>
                        )}
                        {q.intention && (
                          <span className="text-[10px] text-stone-400 truncate">{q.intention}</span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-6 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 border border-red-100">
            <AlertCircle size={12} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Footer */}
        {selectedId && (
          <div className="px-6 py-4 border-t border-stone-100">
            <Button className="w-full" onClick={handleStartSelected} disabled={isPending}>
              {isPending ? "Iniciando..." : "Iniciar com esta pergunta"}
            </Button>
          </div>
        )}

        {!selectedId && <div className="h-4" />}
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
