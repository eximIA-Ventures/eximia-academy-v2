import { type VariantProps, cva } from "class-variance-authority"
import { type InputHTMLAttributes, type ReactNode, forwardRef } from "react"
import { cn } from "../lib/utils"

const inputVariants = cva(
  "flex w-full bg-bg-card text-text-primary text-sm rounded-xl shadow-card placeholder:text-text-muted transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cerrado-600/30 disabled:cursor-not-allowed disabled:opacity-40",
  {
    variants: {
      inputSize: {
        sm: "h-9 px-3 py-1.5 text-xs",
        default: "h-11 px-4 py-3 text-sm",
        lg: "h-12 px-4 py-3 text-base",
      },
      error: {
        true: "border-semantic-error focus-visible:border-semantic-error focus-visible:ring-semantic-error",
        false: "",
      },
    },
    defaultVariants: {
      inputSize: "default",
      error: false,
    },
  },
)

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  /** Leading icon or element */
  leadingIcon?: ReactNode
  /** Trailing icon or element */
  trailingIcon?: ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, inputSize, error, leadingIcon, trailingIcon, ...props }, ref) => {
    if (leadingIcon || trailingIcon) {
      return (
        <div className="relative flex items-center">
          {leadingIcon && (
            <span className="absolute left-3 flex items-center text-text-muted pointer-events-none">
              {leadingIcon}
            </span>
          )}
          <input
            ref={ref}
            className={cn(
              inputVariants({ inputSize, error }),
              leadingIcon && "pl-10",
              trailingIcon && "pr-10",
              className,
            )}
            aria-invalid={error ? true : undefined}
            {...props}
          />
          {trailingIcon && (
            <span className="absolute right-3 flex items-center text-text-muted">
              {trailingIcon}
            </span>
          )}
        </div>
      )
    }

    return (
      <input
        ref={ref}
        className={cn(inputVariants({ inputSize, error }), className)}
        aria-invalid={error ? true : undefined}
        {...props}
      />
    )
  },
)

Input.displayName = "Input"

export { Input, inputVariants }
