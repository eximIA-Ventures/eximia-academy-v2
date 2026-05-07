"use client"

import { type VariantProps, cva } from "class-variance-authority"
import {
  type HTMLAttributes,
  type ReactNode,
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react"
import { cn } from "../lib/utils"

/* -------------------------------- Context -------------------------------- */

interface ModalContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
  titleId: string
  descriptionId: string
}

const ModalContext = createContext<ModalContextValue | undefined>(undefined)

function useModalContext() {
  const ctx = useContext(ModalContext)
  if (!ctx) {
    throw new Error("Modal compound components must be used within <Modal>")
  }
  return ctx
}

/* --------------------------------- Modal --------------------------------- */

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}

function Modal({ open, onOpenChange, children }: ModalProps) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const uid = useId()
  const titleId = `${uid}-title`
  const descriptionId = `${uid}-desc`

  useEffect(() => {
    if (open) {
      setMounted(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true))
      })
    } else {
      setVisible(false)
      const timer = setTimeout(() => setMounted(false), 200)
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
    <ModalContext.Provider value={{ open: visible, onOpenChange, titleId, descriptionId }}>
      {children}
    </ModalContext.Provider>
  )
}
Modal.displayName = "Modal"

/* ------------------------------ ModalOverlay ------------------------------ */

const ModalOverlay = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { open, onOpenChange } = useModalContext()

    return (
      <div
        ref={ref}
        className={cn(
          "fixed inset-0 z-[100] bg-black/60 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
          className,
        )}
        onClick={() => onOpenChange(false)}
        {...props}
      />
    )
  },
)
ModalOverlay.displayName = "ModalOverlay"

/* ----------------------------- ModalContent ------------------------------ */

const modalContentVariants = cva(
  "fixed left-1/2 top-1/2 z-[101] -translate-x-1/2 -translate-y-1/2 w-full bg-bg-card rounded-2xl shadow-hero p-6 transition-all duration-200",
  {
    variants: {
      size: {
        sm: "max-w-sm",
        md: "max-w-md",
        lg: "max-w-lg",
        xl: "max-w-xl",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
)

interface ModalContentProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof modalContentVariants> {}

const ModalContent = forwardRef<HTMLDivElement, ModalContentProps>(
  ({ className, size, ...props }, ref) => {
    const { open, titleId, descriptionId } = useModalContext()
    const contentRef = useRef<HTMLDivElement>(null)

    // Focus trap
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
      if (e.key !== "Tab") return
      const el = contentRef.current
      if (!el) return
      const focusable = el.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }, [])

    // Auto-focus first focusable on open
    useEffect(() => {
      if (!open) return
      const el = contentRef.current
      if (!el) return
      const focusable = el.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      focusable?.focus()
    }, [open])

    return (
      <div
        ref={(node) => {
          ;(contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node
          if (typeof ref === "function") ref(node)
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={cn(
          modalContentVariants({ size, className }),
          open ? "scale-100 opacity-100" : "scale-95 opacity-0",
        )}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        {...props}
      />
    )
  },
)
ModalContent.displayName = "ModalContent"

/* ------------------------------ ModalHeader ------------------------------ */

const ModalHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1.5", className)} {...props} />
  ),
)
ModalHeader.displayName = "ModalHeader"

/* ------------------------------ ModalTitle ------------------------------- */

const ModalTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => {
    const { titleId } = useModalContext()
    return (
      <h2
        ref={ref}
        id={titleId}
        className={cn("text-lg font-semibold text-text-primary leading-tight", className)}
        {...props}
      />
    )
  },
)
ModalTitle.displayName = "ModalTitle"

/* --------------------------- ModalDescription ---------------------------- */

const ModalDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => {
    const { descriptionId } = useModalContext()
    return (
      <p ref={ref} id={descriptionId} className={cn("text-sm text-text-secondary", className)} {...props} />
    )
  },
)
ModalDescription.displayName = "ModalDescription"

/* ------------------------------ ModalFooter ------------------------------ */

const ModalFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6", className)}
      {...props}
    />
  ),
)
ModalFooter.displayName = "ModalFooter"

/* ------------------------------ ModalClose ------------------------------- */

interface ModalCloseProps extends HTMLAttributes<HTMLButtonElement> {
  children?: ReactNode
}

const ModalClose = forwardRef<HTMLButtonElement, ModalCloseProps>(
  ({ className, children, ...props }, ref) => {
    const { onOpenChange } = useModalContext()

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
ModalClose.displayName = "ModalClose"

/* -------------------------------- Exports -------------------------------- */

export {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
  ModalClose,
  modalContentVariants,
}
export type { ModalProps, ModalContentProps, ModalCloseProps }
