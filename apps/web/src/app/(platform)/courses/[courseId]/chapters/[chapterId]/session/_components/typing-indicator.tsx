import { Bot } from "lucide-react"

export function TypingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-blue-mid to-accent-blue-deep text-white">
        <Bot size={18} />
      </div>
      <div className="rounded-2xl rounded-tl-sm bg-bg-card ring-1 ring-border-subtle px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-muted">Pensando</span>
          <span className="flex gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent-blue-mid/60 [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent-blue-mid/60 [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent-blue-mid/60 [animation-delay:300ms]" />
          </span>
        </div>
      </div>
    </div>
  )
}
