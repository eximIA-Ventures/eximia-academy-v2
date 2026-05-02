import { type VariantProps, cva } from "class-variance-authority"
import { type SelectHTMLAttributes, forwardRef } from "react"
import { cn } from "../lib/utils"

const selectVariants = cva(
  "w-full appearance-none bg-bg-card text-text-primary border border-white/[0.08] rounded-xl pr-10 transition-all hover:border-white/[0.15] focus-visible:outline-none focus-visible:border-accent-blue-mid/50 focus-visible:ring-1 focus-visible:ring-accent-blue-mid/30 disabled:cursor-not-allowed disabled:opacity-40",
  {
    variants: {
      selectSize: {
        sm: "h-9 px-3 text-xs",
        default: "h-11 px-4 text-sm",
        lg: "h-12 px-4 text-base",
      },
      error: {
        true: "border-semantic-error focus-visible:border-semantic-error focus-visible:ring-semantic-error",
        false: "",
      },
    },
    defaultVariants: {
      selectSize: "default",
      error: false,
    },
  },
)

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size">,
    VariantProps<typeof selectVariants> {}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, selectSize, error, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(selectVariants({ selectSize, error }), className)}
        aria-invalid={error ? true : undefined}
        {...props}
      >
        {children}
      </select>
      <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </span>
    </div>
  ),
)

Select.displayName = "Select"

export { Select, selectVariants }
