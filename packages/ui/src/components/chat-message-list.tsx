"use client"

import {
  type HTMLAttributes,
  type ReactNode,
  forwardRef,
  useCallback,
  useEffect,
  useRef,
} from "react"
import { cn } from "../lib/utils"

/* ----------------------------- ChatMessageList ---------------------------- */

export interface ChatMessageListProps extends HTMLAttributes<HTMLDivElement> {
  /** When true, auto-scrolls to the bottom on new children */
  autoScroll?: boolean
  /** Children (ChatMessage components) */
  children: ReactNode
}

const ChatMessageList = forwardRef<HTMLDivElement, ChatMessageListProps>(
  ({ autoScroll = true, className, children, ...props }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const bottomRef = useRef<HTMLDivElement>(null)

    const isNearBottom = useCallback(() => {
      const container = containerRef.current
      if (!container) return true
      const threshold = 100
      return container.scrollHeight - container.scrollTop - container.clientHeight <= threshold
    }, [])

    useEffect(() => {
      if (autoScroll && isNearBottom()) {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
      }
    }, [children, autoScroll, isNearBottom])

    const setRefs = useCallback(
      (node: HTMLDivElement | null) => {
        containerRef.current = node
        if (typeof ref === "function") {
          ref(node)
        } else if (ref) {
          const mutableRef = ref as React.MutableRefObject<HTMLDivElement | null>
          mutableRef.current = node
        }
      },
      [ref],
    )

    return (
      <div
        ref={setRefs}
        role="log"
        aria-live="polite"
        className={cn("flex-1 overflow-y-auto flex flex-col gap-4 p-4", className)}
        {...props}
      >
        {children}
        <div ref={bottomRef} />
      </div>
    )
  },
)
ChatMessageList.displayName = "ChatMessageList"

/* -------------------------------- Exports -------------------------------- */

export { ChatMessageList }
