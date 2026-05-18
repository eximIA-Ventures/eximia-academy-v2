"use client"

import { Heart, Send, X } from "lucide-react"
import { useCallback, useRef, useState } from "react"

interface ReflectionDetailModalProps {
  reflection: {
    id: string
    studentName: string
    chapterTitle: string
    fullResponse: string
    createdAt: string
  }
  onClose: () => void
  onSendComment: (reflectionId: string, comment: string) => Promise<void>
  alreadySent: boolean
}

export function ReflectionDetailModal({
  reflection,
  onClose,
  onSendComment,
  alreadySent,
}: ReflectionDetailModalProps) {
  const [comment, setComment] = useState("")
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = useCallback(async () => {
    if (!comment.trim() || sending) return
    setSending(true)
    try {
      await onSendComment(reflection.id, comment.trim())
    } finally {
      setSending(false)
    }
  }, [comment, sending, reflection.id, onSendComment])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Close on backdrop click */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg rounded-xl bg-bg-card border border-border-subtle shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
          <div>
            <p className="text-sm font-semibold text-text-primary">
              {reflection.studentName}
            </p>
            <p className="text-[10px] text-cerrado-500">
              {reflection.chapterTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Reflection content */}
        <div className="px-5 py-4 max-h-[40vh] overflow-y-auto">
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
            {reflection.fullResponse}
          </p>
          <p className="text-[10px] text-text-muted mt-3">
            {new Date(reflection.createdAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        {/* Comment section */}
        <div className="border-t border-border-subtle px-5 py-3">
          {alreadySent ? (
            <div className="flex items-center gap-2 text-emerald-400 py-2">
              <Heart size={14} className="fill-emerald-400" />
              <span className="text-xs">Incentivo enviado com sucesso.</span>
            </div>
          ) : (
            <div className="space-y-2">
              <label
                htmlFor="leader-comment"
                className="text-[10px] font-semibold uppercase tracking-wider text-text-muted"
              >
                Deixe um incentivo
              </label>
              <textarea
                ref={textareaRef}
                id="leader-comment"
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Parabens pela reflexao! Essa conexao que voce fez entre..."
                className="w-full resize-none rounded-lg border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-cerrado-500 focus:outline-none focus:ring-1 focus:ring-cerrado-500/30"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!comment.trim() || sending}
                  className="flex items-center gap-1.5 rounded-lg bg-cerrado-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-cerrado-500 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send size={12} />
                  {sending ? "Enviando..." : "Enviar incentivo"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
