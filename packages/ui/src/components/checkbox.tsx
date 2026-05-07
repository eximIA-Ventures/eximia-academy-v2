import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react"
import { cn } from "../lib/utils"

export interface CheckboxProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "role" | "onClick"> {
  /** Whether the checkbox is checked */
  checked?: boolean
  /** Callback fired when the checked state changes */
  onCheckedChange?: (checked: boolean) => void
  /** When true, disables the checkbox */
  disabled?: boolean
  /** Optional label text */
  children?: ReactNode
}

const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked = false, onCheckedChange, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      className={cn("inline-flex items-center gap-2", disabled && "cursor-not-allowed", className)}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    >
      <span
        className={cn(
          "inline-flex items-center justify-center h-4 w-4 rounded-sm border transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cerrado-600 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app",
          checked
            ? "bg-cerrado-600 border-cerrado-600"
            : "bg-transparent border-border-medium",
          disabled && "opacity-40",
        )}
      >
        {checked && (
          <svg
            className="h-3 w-3 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      {children && (
        <span className={cn("text-sm", disabled ? "text-text-muted" : "text-text-primary")}>
          {children}
        </span>
      )}
    </button>
  ),
)

Checkbox.displayName = "Checkbox"

export { Checkbox }
