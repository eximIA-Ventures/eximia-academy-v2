import { cn } from "@eximia/ui"
import { Bot, User } from "lucide-react"
import Markdown from "react-markdown"

interface ChatMessageProps {
  role: string
  content: string
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isAssistant = role === "assistant"

  return (
    <div className={cn("flex gap-3", isAssistant ? "justify-start" : "flex-row-reverse")}>
      {/* Avatar */}
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-medium",
          isAssistant
            ? "bg-gradient-to-br from-cerrado-600 to-cerrado-800 text-white"
            : "bg-bg-elevated text-text-secondary shadow-card",
        )}
      >
        {isAssistant ? <Bot size={18} /> : <User size={18} />}
      </div>

      {/* Message bubble */}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isAssistant
            ? "rounded-tl-sm bg-bg-card shadow-card text-text-primary"
            : "rounded-tr-sm bg-cerrado-600/15 text-text-primary ring-1 ring-cerrado-600/20",
        )}
      >
        <div className="prose prose-invert prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1">
          <Markdown>{content}</Markdown>
        </div>
      </div>
    </div>
  )
}
