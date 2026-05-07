"use client"

import {
  type HTMLAttributes,
  type ReactNode,
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useState,
} from "react"
import { cn } from "../lib/utils"

/* ----------------------------- AccordionContext ---------------------------- */

interface AccordionContextValue {
  value: string[]
  toggle: (itemValue: string) => void
  type: "single" | "multiple"
}

const AccordionContext = createContext<AccordionContextValue | undefined>(undefined)

function useAccordionContext() {
  const ctx = useContext(AccordionContext)
  if (!ctx) {
    throw new Error("Accordion compound components must be used within <Accordion>")
  }
  return ctx
}

/* -------------------------- AccordionItemContext --------------------------- */

interface AccordionItemContextValue {
  value: string
  isOpen: boolean
  disabled: boolean
}

const AccordionItemContext = createContext<AccordionItemContextValue | undefined>(undefined)

function useAccordionItemContext() {
  const ctx = useContext(AccordionItemContext)
  if (!ctx) {
    throw new Error("AccordionTrigger/AccordionContent must be used within <AccordionItem>")
  }
  return ctx
}

/* -------------------------------- Accordion ------------------------------- */

interface AccordionProps extends HTMLAttributes<HTMLDivElement> {
  type?: "single" | "multiple"
  value?: string | string[]
  onValueChange?: (value: string | string[]) => void
  children: ReactNode
}

const Accordion = forwardRef<HTMLDivElement, AccordionProps>(
  (
    { type = "single", value: controlledValue, onValueChange, className, children, ...props },
    ref,
  ) => {
    const [internalValue, setInternalValue] = useState<string[]>([])

    const isControlled = controlledValue !== undefined
    const currentValue = isControlled
      ? Array.isArray(controlledValue)
        ? controlledValue
        : controlledValue
          ? [controlledValue]
          : []
      : internalValue

    const toggle = useCallback(
      (itemValue: string) => {
        let nextValue: string[]

        if (type === "single") {
          nextValue = currentValue.includes(itemValue) ? [] : [itemValue]
        } else {
          nextValue = currentValue.includes(itemValue)
            ? currentValue.filter((v) => v !== itemValue)
            : [...currentValue, itemValue]
        }

        if (onValueChange) {
          onValueChange(type === "single" ? (nextValue[0] ?? "") : nextValue)
        }
        if (!isControlled) {
          setInternalValue(nextValue)
        }
      },
      [type, currentValue, onValueChange, isControlled],
    )

    return (
      <AccordionContext.Provider value={{ value: currentValue, toggle, type }}>
        <div ref={ref} className={cn("", className)} {...props}>
          {children}
        </div>
      </AccordionContext.Provider>
    )
  },
)
Accordion.displayName = "Accordion"

/* ----------------------------- AccordionItem ------------------------------ */

interface AccordionItemProps extends HTMLAttributes<HTMLDivElement> {
  value: string
  disabled?: boolean
}

const AccordionItem = forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ value, disabled = false, className, children, ...props }, ref) => {
    const { value: accordionValue } = useAccordionContext()
    const isOpen = accordionValue.includes(value)

    return (
      <AccordionItemContext.Provider value={{ value, isOpen, disabled }}>
        <div
          ref={ref}
          data-state={isOpen ? "open" : "closed"}
          className={cn("", className)}
          {...props}
        >
          {children}
        </div>
      </AccordionItemContext.Provider>
    )
  },
)
AccordionItem.displayName = "AccordionItem"

/* --------------------------- AccordionTrigger ----------------------------- */

const AccordionTrigger = forwardRef<HTMLButtonElement, HTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, ref) => {
    const { toggle } = useAccordionContext()
    const { value, isOpen, disabled } = useAccordionItemContext()

    return (
      <button
        ref={ref}
        type="button"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            toggle(value)
          }
        }}
        className={cn(
          "flex w-full items-center justify-between py-4 text-sm font-medium text-text-primary transition-colors hover:text-text-secondary",
          disabled && "opacity-40 cursor-not-allowed",
          className,
        )}
        {...props}
      >
        {children}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={cn("shrink-0 transition-transform duration-200", isOpen && "rotate-180")}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    )
  },
)
AccordionTrigger.displayName = "AccordionTrigger"

/* --------------------------- AccordionContent ----------------------------- */

const AccordionContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const { isOpen } = useAccordionItemContext()

    return (
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div
            ref={ref}
            role="region"
            className={cn("pb-4 text-sm text-text-secondary", !isOpen && "pb-0", className)}
            {...props}
          >
            {children}
          </div>
        </div>
      </div>
    )
  },
)
AccordionContent.displayName = "AccordionContent"

/* -------------------------------- Exports -------------------------------- */

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
export type { AccordionProps, AccordionItemProps }
