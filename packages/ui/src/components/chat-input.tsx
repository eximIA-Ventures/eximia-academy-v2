"use client"

import {
  type HTMLAttributes,
  type KeyboardEvent,
  forwardRef,
  useCallback,
  useRef,
  useState,
} from "react"
import { cn } from "../lib/utils"
import { Button } from "./button"

export interface ChatInputProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSubmit"> {
  /** Called with the message text when send is triggered */
  onSubmit: (message: string) => void
  /** Placeholder text - defaults to "Escreva sua reflexao..." */
  placeholder?: string
  /** Disables input and send button */
  disabled?: boolean
  /** Max rows before scrolling */
  maxRows?: number
}

const LINE_HEIGHT = 20

const ChatInput = forwardRef<HTMLDivElement, ChatInputProps>(
  (
    {
      className,
      onSubmit,
      placeholder = "Escreva sua reflexao...",
      disabled = false,
      maxRows = 5,
      ...props
    },
    ref,
  ) => {
    const [value, setValue] = useState("")
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const resetHeight = useCallback(() => {
      const textarea = textareaRef.current
      if (textarea) {
        textarea.style.height = "auto"
      }
    }, [])

    const adjustHeight = useCallback(() => {
      const textarea = textareaRef.current
      if (!textarea) return
      textarea.style.height = "auto"
      const maxHeight = maxRows * LINE_HEIGHT
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`
    }, [maxRows])

    const handleSend = useCallback(() => {
      const trimmed = value.trim()
      if (!trimmed || disabled) return
      onSubmit(trimmed)
      setValue("")
      resetHeight()
    }, [value, disabled, onSubmit, resetHeight])

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault()
          handleSend()
        }
      },
      [handleSend],
    )

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setValue(e.target.value)
        adjustHeight()
      },
      [adjustHeight],
    )

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-end gap-2 p-3 border-t border-border-subtle bg-bg-card",
          className,
        )}
        {...props}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          aria-label={placeholder}
          className="flex-1 resize-none bg-transparent text-sm text-text-primary placeholder:text-text-muted border-none outline-none min-h-[36px]"
        />
        <Button
          size="icon"
          variant="default"
          disabled={!value.trim() || disabled}
          onClick={handleSend}
          aria-label="Enviar mensagem"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m22 2-7 20-4-9-9-4Z" />
            <path d="M22 2 11 13" />
          </svg>
        </Button>
      </div>
    )
  },
)

ChatInput.displayName = "ChatInput"

export { ChatInput }
