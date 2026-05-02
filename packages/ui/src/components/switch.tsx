import { type VariantProps, cva } from "class-variance-authority"
import { type ButtonHTMLAttributes, forwardRef } from "react"
import { cn } from "../lib/utils"

const switchVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue-mid focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app disabled:cursor-not-allowed disabled:opacity-40",
  {
    variants: {
      size: {
        sm: "h-5 w-9",
        default: "h-6 w-11",
        lg: "h-7 w-[52px]",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
)

const thumbSizeMap = {
  sm: "h-4 w-4",
  default: "h-5 w-5",
  lg: "h-6 w-6",
} as const

const thumbTranslateMap = {
  sm: "translate-x-[18px]",
  default: "translate-x-[22px]",
  lg: "translate-x-[26px]",
} as const

export interface SwitchProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "role" | "onClick">,
    VariantProps<typeof switchVariants> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked = false, onCheckedChange, size = "default", disabled, ...props }, ref) => {
    const sizeKey = size ?? "default"
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={cn(
          switchVariants({ size }),
          checked ? "bg-accent-blue-mid border-accent-blue-mid" : "bg-bg-surface border-border-medium",
          className,
        )}
        onClick={() => onCheckedChange?.(!checked)}
        {...props}
      >
        <span
          className={cn(
            "pointer-events-none block rounded-full bg-text-primary shadow-card transition-transform duration-200",
            thumbSizeMap[sizeKey],
            checked ? thumbTranslateMap[sizeKey] : "translate-x-0.5",
          )}
        />
      </button>
    )
  },
)
Switch.displayName = "Switch"

export { Switch, switchVariants }
