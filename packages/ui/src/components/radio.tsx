"use client"

import {
  type ButtonHTMLAttributes,
  type ReactNode,
  createContext,
  forwardRef,
  useContext,
} from "react"
import { cn } from "../lib/utils"

/* --------------------------------- Context -------------------------------- */

interface RadioGroupContextValue {
  value?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  name?: string
}

const RadioGroupContext = createContext<RadioGroupContextValue>({})

/* -------------------------------- RadioGroup ------------------------------ */

export interface RadioGroupProps {
  /** Currently selected value */
  value?: string
  /** Callback fired when the selected value changes */
  onValueChange?: (value: string) => void
  /** When true, disables all radio items */
  disabled?: boolean
  /** Group name for associating items */
  name?: string
  /** Additional CSS classes */
  className?: string
  children: ReactNode
}

const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, value, onValueChange, disabled, name, children, ...props }, ref) => (
    <RadioGroupContext.Provider value={{ value, onValueChange, disabled, name }}>
      <div ref={ref} role="radiogroup" className={cn("flex flex-col gap-2", className)} {...props}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  ),
)

RadioGroup.displayName = "RadioGroup"

/* -------------------------------- RadioItem ------------------------------- */

export interface RadioItemProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "role" | "onClick" | "value"> {
  /** The value of this radio item */
  value: string
  /** When true, disables this specific item */
  disabled?: boolean
  /** Optional label text */
  children?: ReactNode
}

const RadioItem = forwardRef<HTMLButtonElement, RadioItemProps>(
  ({ className, value, disabled: itemDisabled, children, ...props }, ref) => {
    const group = useContext(RadioGroupContext)
    const isSelected = group.value === value
    const isDisabled = itemDisabled || group.disabled

    return (
      <button
        ref={ref}
        type="button"
        role="radio"
        aria-checked={isSelected}
        disabled={isDisabled}
        className={cn(
          "inline-flex items-center gap-2",
          isDisabled && "cursor-not-allowed",
          className,
        )}
        onClick={() => group.onValueChange?.(value)}
        {...props}
      >
        <span
          className={cn(
            "inline-flex items-center justify-center h-4 w-4 rounded-full border transition-colors duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cerrado-600 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app",
            isSelected ? "border-cerrado-600" : "border-border-medium",
            isDisabled && "opacity-40",
          )}
        >
          {isSelected && <span className="h-2 w-2 rounded-full bg-cerrado-600" />}
        </span>
        {children && (
          <span className={cn("text-sm", isDisabled ? "text-text-muted" : "text-text-primary")}>
            {children}
          </span>
        )}
      </button>
    )
  },
)

RadioItem.displayName = "RadioItem"

export { RadioGroup, RadioItem }
