"use client"

import { Check, Loader2, MessageSquareText, Sparkles } from "lucide-react"
import Markdown from "react-markdown"
import { useCallback, useEffect, useState, useTransition } from "react"
import { saveAiResponse, saveReflection } from "./reflection-actions"

interface ReflectionPromptProps {
  slideId: string
  tenantId: string
  question: string
  savedResponse?: string | null
  aiEnabled?: boolean
  /** Full text_content of the slide for AI context */
  slideContext?: string
  /** Previously saved AI response */
  savedAiResponse?: string | null
}

export function ReflectionPrompt({ slideId, tenantId, question, savedResponse, aiEnabled, slideContext, savedAiResponse }: ReflectionPromptProps) {
  const [response, setResponse] = useState(savedResponse ?? "")
  const [saved, setSaved] = useState(!!savedResponse)
  const [isPending, startTransition] = useTransition()
  const [aiResponse, setAiResponse] = useState<string | null>(savedAiResponse ?? null)
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    setResponse(savedResponse ?? "")
    setSaved(!!savedResponse)
    setAiResponse(savedAiResponse ?? null)
  }, [slideId, savedResponse, savedAiResponse])

  const handleSave = useCallback(() => {
    if (!response.trim()) return
    startTransition(async () => {
      const result = await saveReflection(slideId, tenantId, response.trim())
      if (result.success) setSaved(true)
    })
  }, [slideId, tenantId, response])

  const handleDeepen = useCallback(async () => {
    if (!response.trim() || aiLoading) return
    setAiLoading(true)
    try {
      const res = await fetch("/api/reflections/deepen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slideId,
          question,
          studentResponse: response.trim(),
          slideContext: slideContext ?? question,
        }),
      })
      const data = await res.json()
      if (data.response) {
        setAiResponse(data.response)
        saveAiResponse(slideId, data.response)
      }
    } catch {
      // silently fail
    } finally {
      setAiLoading(false)
    }
  }, [slideId, question, response, slideContext, aiLoading])

  return (
    <div className="my-4 rounded-xl border border-varzea/20 bg-varzea/5 p-4 space-y-3">
      {/* Reflection question */}
      <div className="flex items-start gap-2">
        <MessageSquareText size={16} className="mt-0.5 text-varzea shrink-0" />
        <p className="text-sm text-white/80 leading-relaxed">{question}</p>
      </div>

      {/* Response area */}
      <textarea
        value={response}
        onChange={(e) => { setResponse(e.target.value); setSaved(false); setAiResponse(null) }}
        placeholder="Escreva sua reflexão..."
        rows={3}
        className="w-full resize-none rounded-lg shadow-card bg-bg-surface px-3 py-2.5 text-sm text-white placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-varzea/30 focus:border-varzea/40 transition-all"
      />

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !response.trim() || saved}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              saved
                ? "bg-semantic-success/10 text-semantic-success"
                : "bg-varzea/15 text-varzea hover:bg-varzea/25 disabled:opacity-40"
            }`}
          >
            {saved ? <><Check size={12} /> Salvo</> : isPending ? "Salvando..." : "Salvar reflexão"}
          </button>

          {aiEnabled && saved && (
            <button
              type="button"
              onClick={handleDeepen}
              disabled={aiLoading}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-cerrado-600/10 text-cerrado-600 hover:bg-cerrado-600/20 transition-all disabled:opacity-50"
            >
              {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {aiLoading ? "Pensando..." : "Aprofundar com IA"}
            </button>
          )}
        </div>

        {response.trim() && !aiResponse && (
          <span className="text-[10px] text-text-muted/40">
            {response.trim().length} caracteres
          </span>
        )}
      </div>

      {/* AI Response */}
      {aiResponse && (
        <div className="rounded-lg border border-cerrado-600/20 bg-cerrado-600/5 p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Sparkles size={12} className="text-cerrado-600" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-cerrado-600/70">IA Socrática</span>
          </div>
          <div className="text-sm leading-relaxed text-white/80">
            <Markdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
              }}
            >
              {aiResponse}
            </Markdown>
          </div>
        </div>
      )}
    </div>
  )
}
