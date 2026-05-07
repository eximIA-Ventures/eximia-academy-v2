import { type ButtonHTMLAttributes, forwardRef } from "react"
import { cn } from "../lib/utils"

export interface ToggleProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "role" | "onClick"> {
  /** Whether the toggle is in the on state */
  checked?: boolean
  /** Callback fired when the toggle state changes */
  onCheckedChange?: (checked: boolean) => void
  /** When true, disables the toggle */
  disabled?: boolean
}

const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
  ({ className, checked = false, onCheckedChange, disabled, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={cn(
        "inline-flex items-center w-11 h-6 rounded-full border transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-cerrado-600 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app focus-visible:outline-none",
        checked
          ? "bg-cerrado-600 border-cerrado-600"
          : "bg-bg-surface border-border-medium",
        disabled && "opacity-40 cursor-not-allowed",
        className,
      )}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    >
      <span
        className={cn(
          "block h-5 w-5 rounded-full bg-text-primary shadow-card transition-transform duration-200",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  ),
)

Toggle.displayName = "Toggle"

export { Toggle }
