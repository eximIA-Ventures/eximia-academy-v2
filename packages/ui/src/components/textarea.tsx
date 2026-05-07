import { type TextareaHTMLAttributes, forwardRef } from "react"
import { cn } from "../lib/utils"

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** When true, applies error styling */
  error?: boolean
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex w-full min-h-20 px-4 py-3 bg-bg-card text-text-primary text-sm rounded-xl shadow-card placeholder:text-text-muted resize-none transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cerrado-600/30 disabled:cursor-not-allowed disabled:opacity-40",
        error &&
          "border-semantic-error focus-visible:border-semantic-error focus-visible:ring-semantic-error",
        className,
      )}
      aria-invalid={error ? true : undefined}
      {...props}
    />
  ),
)

Textarea.displayName = "Textarea"

export { Textarea }
