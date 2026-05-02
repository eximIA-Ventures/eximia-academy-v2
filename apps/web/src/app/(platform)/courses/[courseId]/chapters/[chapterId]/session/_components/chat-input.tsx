"use client"

import { ArrowUp } from "lucide-react"
import { useRef } from "react"

interface ChatInputProps {
  input: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onSubmit: (e: React.FormEvent) => void
  disabled: boolean
}

export function ChatInput({ input, onChange, onSubmit, disabled }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget
    target.style.height = "auto"
    target.style.height = `${Math.min(target.scrollHeight, 200)}px`
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && !disabled) {
        onSubmit(e as unknown as React.FormEvent)
      }
    }
  }

  const canSend = input.trim() && !disabled

  return (
    <form onSubmit={onSubmit} className="relative">
      <div className="flex items-end gap-2 rounded-2xl border border-border-subtle bg-bg-card p-2 transition-colors focus-within:border-accent-blue-mid/40 focus-within:ring-1 focus-within:ring-accent-blue-mid/20">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={onChange}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Escreva sua reflexão..."
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!canSend}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all ${
            canSend
              ? "bg-accent-blue-mid text-white hover:bg-accent-blue-mid/80 active:scale-95"
              : "bg-bg-elevated text-text-muted cursor-not-allowed"
          }`}
        >
          <ArrowUp size={18} />
        </button>
      </div>
      <p className="mt-1.5 text-center text-[10px] text-text-muted/60">
        Enter para enviar · Shift+Enter para nova linha
      </p>
    </form>
  )
}
