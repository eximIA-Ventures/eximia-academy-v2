"use client"

import { type VariantProps, cva } from "class-variance-authority"
import {
  type HTMLAttributes,
  type ReactNode,
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useState,
} from "react"
import { cn } from "../lib/utils"

/* -------------------------------- Context -------------------------------- */

interface SheetContextValue {
  open: boolean
  visible: boolean
  onOpenChange: (open: boolean) => void
}

const SheetContext = createContext<SheetContextValue | undefined>(undefined)

function useSheetContext() {
  const ctx = useContext(SheetContext)
  if (!ctx) {
    throw new Error("Sheet compound components must be used within <Sheet>")
  }
  return ctx
}

/* --------------------------------- Sheet --------------------------------- */

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}

function Sheet({ open, onOpenChange, children }: SheetProps) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true))
      })
    } else {
      setVisible(false)
      const timer = setTimeout(() => setMounted(false), 300)
      return () => clearTimeout(timer)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onOpenChange(false)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, onOpenChange])

  if (!mounted) return null

  return (
    <SheetContext.Provider value={{ open, visible, onOpenChange }}>
      {children}
    </SheetContext.Provider>
  )
}
Sheet.displayName = "Sheet"

/* ------------------------------ SheetOverlay ------------------------------ */

const SheetOverlay = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { visible, onOpenChange } = useSheetContext()

    return (
      <div
        ref={ref}
        className={cn(
          "fixed inset-0 z-[40] bg-black/60 transition-opacity duration-300",
          visible ? "opacity-100" : "opacity-0",
          className,
        )}
        onClick={() => onOpenChange(false)}
        {...props}
      />
    )
  },
)
SheetOverlay.displayName = "SheetOverlay"

/* ----------------------------- SheetContent ------------------------------ */

const sheetContentVariants = cva(
  "fixed z-[40] bg-bg-card shadow-elevated p-6 border-border-subtle transition-transform duration-300",
  {
    variants: {
      side: {
        right: "right-0 top-0 h-full w-80 border-l",
        left: "left-0 top-0 h-full w-80 border-r",
        top: "top-0 left-0 w-full h-auto max-h-[50vh] border-b",
        bottom: "bottom-0 left-0 w-full h-auto max-h-[50vh] border-t",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
)

const slideClasses = {
  right: { open: "translate-x-0", closed: "translate-x-full" },
  left: { open: "translate-x-0", closed: "-translate-x-full" },
  top: { open: "translate-y-0", closed: "-translate-y-full" },
  bottom: { open: "translate-y-0", closed: "translate-y-full" },
}

interface SheetContentProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof sheetContentVariants> {}

const SheetContent = forwardRef<HTMLDivElement, SheetContentProps>(
  ({ className, side = "right", ...props }, ref) => {
    const { visible } = useSheetContext()
    const slide = slideClasses[side ?? "right"]

    return (
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        className={cn(
          sheetContentVariants({ side, className }),
          visible ? slide.open : slide.closed,
        )}
        onClick={(e) => e.stopPropagation()}
        {...props}
      />
    )
  },
)
SheetContent.displayName = "SheetContent"

/* ------------------------------ SheetHeader ------------------------------ */

const SheetHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1.5", className)} {...props} />
  ),
)
SheetHeader.displayName = "SheetHeader"

/* ------------------------------ SheetTitle ------------------------------- */

const SheetTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2
      ref={ref}
      className={cn("text-lg font-semibold text-text-primary leading-tight", className)}
      {...props}
    />
  ),
)
SheetTitle.displayName = "SheetTitle"

/* --------------------------- SheetDescription ---------------------------- */

const SheetDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-text-secondary", className)} {...props} />
  ),
)
SheetDescription.displayName = "SheetDescription"

/* ------------------------------ SheetFooter ------------------------------ */

const SheetFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6", className)}
      {...props}
    />
  ),
)
SheetFooter.displayName = "SheetFooter"

/* ------------------------------ SheetClose ------------------------------- */

interface SheetCloseProps extends HTMLAttributes<HTMLButtonElement> {
  children?: ReactNode
}

const SheetClose = forwardRef<HTMLButtonElement, SheetCloseProps>(
  ({ className, children, ...props }, ref) => {
    const { onOpenChange } = useSheetContext()

    return (
      <button
        ref={ref}
        type="button"
        className={cn("text-text-muted hover:text-text-primary transition-colors", className)}
        onClick={() => onOpenChange(false)}
        {...props}
      >
        {children ?? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
      </button>
    )
  },
)
SheetClose.displayName = "SheetClose"

/* -------------------------------- Exports -------------------------------- */

export {
  Sheet,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
  sheetContentVariants,
}
export type { SheetProps, SheetContentProps }
