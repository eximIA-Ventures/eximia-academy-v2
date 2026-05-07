"use client"

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

/* -------------------------------- Context -------------------------------- */

interface DropdownMenuContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
  toggle: () => void
}

const DropdownMenuContext = createContext<DropdownMenuContextValue | undefined>(undefined)

function useDropdownMenuContext() {
  const ctx = useContext(DropdownMenuContext)
  if (!ctx) {
    throw new Error("DropdownMenu compound components must be used within <DropdownMenu>")
  }
  return ctx
}

/* ------------------------------ DropdownMenu ------------------------------ */

interface DropdownMenuProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: ReactNode
  className?: string
}

const DropdownMenu = forwardRef<HTMLDivElement, DropdownMenuProps & HTMLAttributes<HTMLDivElement>>(
  (
    { open: controlledOpen, onOpenChange: controlledOnOpenChange, className, children, ...props },
    ref,
  ) => {
    const [internalOpen, setInternalOpen] = useState(false)

    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : internalOpen
    const onOpenChange = useCallback(
      (value: boolean) => {
        if (controlledOnOpenChange) {
          controlledOnOpenChange(value)
        }
        if (!isControlled) {
          setInternalOpen(value)
        }
      },
      [controlledOnOpenChange, isControlled],
    )

    const toggle = useCallback(() => {
      onOpenChange(!open)
    }, [open, onOpenChange])

    return (
      <DropdownMenuContext.Provider value={{ open, onOpenChange, toggle }}>
        <div ref={ref} className={cn("relative inline-block", className)} {...props}>
          {children}
        </div>
      </DropdownMenuContext.Provider>
    )
  },
)
DropdownMenu.displayName = "DropdownMenu"

/* -------------------------- DropdownMenuTrigger --------------------------- */

const DropdownMenuTrigger = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const { open, toggle } = useDropdownMenuContext()

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            toggle()
          }
        }}
        className={cn("cursor-pointer", className)}
        {...props}
      >
        {children}
      </div>
    )
  },
)
DropdownMenuTrigger.displayName = "DropdownMenuTrigger"

/* -------------------------- DropdownMenuContent --------------------------- */

const DropdownMenuContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { open, onOpenChange } = useDropdownMenuContext()
    const contentRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      if (!open) return
      function handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape") {
          onOpenChange(false)
        }
      }
      function handleClickOutside(e: MouseEvent) {
        const el = contentRef.current
        if (el && !el.closest(".relative.inline-block")?.contains(e.target as Node)) {
          onOpenChange(false)
        }
      }
      document.addEventListener("keydown", handleKeyDown)
      document.addEventListener("mousedown", handleClickOutside)
      return () => {
        document.removeEventListener("keydown", handleKeyDown)
        document.removeEventListener("mousedown", handleClickOutside)
      }
    }, [open, onOpenChange])

    if (!open) return null

    return (
      <div
        ref={(node) => {
          ;(contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node
          if (typeof ref === "function") ref(node)
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
        }}
        role="menu"
        className={cn(
          "absolute top-full left-0 mt-1 min-w-48 rounded-xl shadow-hero p-1 z-[30] animate-dropdown-in",
          "bg-[var(--color-bg-card,#fff)]",
          className,
        )}
        {...props}
      />
    )
  },
)
DropdownMenuContent.displayName = "DropdownMenuContent"

/* --------------------------- DropdownMenuItem ----------------------------- */

interface DropdownMenuItemProps extends HTMLAttributes<HTMLButtonElement> {
  disabled?: boolean
}

const DropdownMenuItem = forwardRef<HTMLButtonElement, DropdownMenuItemProps>(
  ({ className, disabled, onClick, ...props }, ref) => {
    const { onOpenChange } = useDropdownMenuContext()

    return (
      <button
        ref={ref}
        type="button"
        role="menuitem"
        disabled={disabled}
        className={cn(
          "w-full text-left px-3 py-2 text-sm text-text-primary rounded-sm transition-colors hover:bg-bg-surface cursor-pointer",
          disabled && "opacity-40 cursor-not-allowed",
          className,
        )}
        onClick={(e) => {
          if (disabled) return
          onClick?.(e)
          onOpenChange(false)
        }}
        {...props}
      />
    )
  },
)
DropdownMenuItem.displayName = "DropdownMenuItem"

/* ------------------------- DropdownMenuSeparator -------------------------- */

const DropdownMenuSeparator = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="separator"
      className={cn("h-px bg-border-subtle my-1", className)}
      {...props}
    />
  ),
)
DropdownMenuSeparator.displayName = "DropdownMenuSeparator"

/* -------------------------------- Exports -------------------------------- */

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
}
export type { DropdownMenuProps, DropdownMenuItemProps }
