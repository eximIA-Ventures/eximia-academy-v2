import { type LabelHTMLAttributes, forwardRef } from "react"
import { cn } from "../lib/utils"

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** When true, shows a red asterisk after the label text */
  required?: boolean
  /** When true, reduces opacity and disables pointer events */
  disabled?: boolean
}

const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, disabled, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "text-sm font-medium text-text-primary leading-tight peer-disabled:opacity-40 peer-disabled:cursor-not-allowed",
        disabled && "opacity-40 cursor-not-allowed",
        className,
      )}
      {...props}
    >
      {children}
      {required && <span className="text-semantic-error ml-0.5">*</span>}
    </label>
  ),
)

Label.displayName = "Label"

export { Label }
