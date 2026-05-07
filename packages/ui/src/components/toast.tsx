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
  useRef,
  useState,
} from "react"
import { cn } from "../lib/utils"

/* -------------------------------- Variants ------------------------------- */

const toastVariants = cva(
  "rounded-md shadow-elevated p-4 flex items-start gap-3 transition-all duration-200",
  {
    variants: {
      variant: {
        default: "bg-bg-card shadow-card",
        success: "bg-bg-card shadow-card border-l-4 border-l-semantic-success",
        error: "bg-bg-card shadow-card border-l-4 border-l-semantic-error",
        warning: "bg-bg-card shadow-card border-l-4 border-l-semantic-warning",
        info: "bg-bg-card shadow-card border-l-4 border-l-semantic-info",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

/* --------------------------------- Types --------------------------------- */

interface ToastData {
  id?: string
  variant?: "default" | "success" | "error" | "warning" | "info"
  title: string
  description?: string
  duration?: number
}

interface ToastProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof toastVariants> {
  title: string
  description?: string
  onClose?: () => void
}

/* --------------------------------- Toast --------------------------------- */

const Toast = forwardRef<HTMLDivElement, ToastProps>(
  ({ className, variant, title, description, onClose, ...props }, ref) => (
    <div ref={ref} role="alert" className={cn(toastVariants({ variant, className }))} {...props}>
      <div className="flex-1">
        <p className="text-sm font-medium text-text-primary">{title}</p>
        {description && <p className="text-xs text-text-secondary mt-1">{description}</p>}
      </div>
      {onClose && (
        <button
          type="button"
          className="text-text-muted hover:text-text-primary ml-auto transition-colors"
          onClick={onClose}
          aria-label="Close"
        >
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
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  ),
)
Toast.displayName = "Toast"

/* ----------------------------- AnimatedToast ----------------------------- */

function AnimatedToast({ onRemove, ...toastProps }: ToastProps & { onRemove: () => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true))
    })
  }, [])

  const handleClose = useCallback(() => {
    setVisible(false)
    setTimeout(() => onRemove(), 200)
  }, [onRemove])

  return (
    <div
      className={cn(
        "transition-all duration-200",
        visible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0",
      )}
    >
      <Toast {...toastProps} onClose={handleClose} />
    </div>
  )
}

/* ------------------------------- Context -------------------------------- */

interface ToastContextValue {
  toast: (data: ToastData) => void
  toasts: ToastData[]
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

/* ------------------------------ Provider -------------------------------- */

interface ToastProviderProps {
  children: ReactNode
}

let toastIdCounter = 0

function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<(ToastData & { id: string })[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const toast = useCallback(
    (data: ToastData) => {
      const id = data.id ?? `toast-${++toastIdCounter}`
      const duration = data.duration ?? 5000
      const entry = { ...data, id }
      setToasts((prev) => [...prev, entry])

      const timer = setTimeout(() => {
        removeToast(id)
      }, duration)
      timersRef.current.set(id, timer)
    },
    [removeToast],
  )

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={{ toast, toasts }}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[50] flex flex-col gap-2 w-80"
        data-testid="toast-container"
      >
        {toasts.map((t) => (
          <AnimatedToast
            key={t.id}
            variant={t.variant}
            title={t.title}
            description={t.description}
            onRemove={() => removeToast(t.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
ToastProvider.displayName = "ToastProvider"

/* -------------------------------- Hook ---------------------------------- */

function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider>")
  }
  return ctx
}

/* -------------------------------- Exports -------------------------------- */

export { Toast, ToastProvider, useToast, toastVariants }
export type { ToastProps, ToastData }
