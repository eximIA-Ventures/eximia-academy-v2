import { type HTMLAttributes, type ReactNode, forwardRef } from "react"
import { Label } from "../components/label"
import { cn } from "../lib/utils"

export interface FormFieldProps extends HTMLAttributes<HTMLDivElement> {
  /** Label text displayed above the form control */
  label: string
  /** Associates the label with the form control */
  htmlFor?: string
  /** Error message text; when provided, triggers the error state */
  error?: string
  /** When true, shows a required asterisk on the label */
  required?: boolean
  /** When true, applies disabled styling to the label */
  disabled?: boolean
  /** The form control (Input, Select, Textarea, etc.) */
  children: ReactNode
}

const FormField = forwardRef<HTMLDivElement, FormFieldProps>(
  ({ className, label, htmlFor, error, required, disabled, children, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1.5", className)} {...props}>
      <Label htmlFor={htmlFor} required={required} disabled={disabled}>
        {label}
      </Label>
      {children}
      {error && (
        <p className="text-xs text-semantic-error" role="alert">
          {error}
        </p>
      )}
    </div>
  ),
)

FormField.displayName = "FormField"

export { FormField }
