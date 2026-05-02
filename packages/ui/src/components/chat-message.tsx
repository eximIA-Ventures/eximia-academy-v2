"use client"

import { type HTMLAttributes, type ReactNode, forwardRef } from "react"
import { cn } from "../lib/utils"

export type ChatMessageRole = "assistant" | "user"

export interface ChatMessageProps extends Omit<HTMLAttributes<HTMLDivElement>, "content" | "role"> {
  /** Message role determines alignment and styling */
  role: ChatMessageRole
  /** Message content (string or ReactNode for rich content) */
  content: ReactNode
  /** Avatar element (ReactNode - can be Avatar component or any element) */
  avatar?: ReactNode
  /** Timestamp string */
  timestamp?: string
  /** Whether the message is currently streaming (shows cursor) */
  isStreaming?: boolean
}

const ChatMessage = forwardRef<HTMLDivElement, ChatMessageProps>(
  ({ className, role, content, avatar, timestamp, isStreaming = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex gap-3 animate-fade-in-up",
          role === "user" && "flex-row-reverse",
          className,
        )}
        {...props}
      >
        {avatar && <div className="flex-shrink-0">{avatar}</div>}
        <div className={cn("flex flex-col", role === "user" ? "items-end" : "items-start")}>
          <div
            className={cn(
              "rounded-md p-3 max-w-[80%]",
              role === "assistant" ? "bg-bg-card" : "bg-accent-blue-deep",
            )}
          >
            <div className="text-sm text-text-primary leading-relaxed">
              {content}
              {isStreaming && (
                <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-text-primary animate-pulse rounded-sm" />
              )}
            </div>
          </div>
          {timestamp && <span className="text-xs text-text-muted mt-1">{timestamp}</span>}
        </div>
      </div>
    )
  },
)
ChatMessage.displayName = "ChatMessage"

export { ChatMessage }
