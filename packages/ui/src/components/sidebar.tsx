"use client"

import {
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
  createContext,
  forwardRef,
  useContext,
} from "react"
import { cn } from "../lib/utils"

/* -------------------------------- Context -------------------------------- */

interface SidebarContextValue {
  collapsed: boolean
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined)

function useSidebarContext() {
  const ctx = useContext(SidebarContext)
  if (!ctx) {
    throw new Error("Sidebar compound components must be used within <Sidebar>")
  }
  return ctx
}

/* -------------------------------- Sidebar -------------------------------- */

interface SidebarProps extends HTMLAttributes<HTMLElement> {
  collapsed?: boolean
  children: ReactNode
}

const Sidebar = forwardRef<HTMLElement, SidebarProps>(
  ({ collapsed = false, className, children, ...props }, ref) => (
    <SidebarContext.Provider value={{ collapsed }}>
      <aside
        ref={ref}
        className={cn(
          "fixed left-0 top-0 h-screen bg-bg-sidebar border-r border-white/[0.06] flex flex-col z-[30]",
          collapsed ? "w-16" : "w-[var(--sidebar-width,230px)]",
          className,
        )}
        {...props}
      >
        {children}
      </aside>
    </SidebarContext.Provider>
  ),
)
Sidebar.displayName = "Sidebar"

/* ----------------------------- SidebarHeader ----------------------------- */

const SidebarHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { collapsed } = useSidebarContext()

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center px-5 h-[60px] shrink-0",
          collapsed && "justify-center px-2",
          className,
        )}
        {...props}
      />
    )
  },
)
SidebarHeader.displayName = "SidebarHeader"

/* ----------------------------- SidebarContent ---------------------------- */

const SidebarContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex-1 overflow-y-auto px-3 pt-1", className)} {...props} />
  ),
)
SidebarContent.displayName = "SidebarContent"

/* ----------------------------- SidebarFooter ----------------------------- */

const SidebarFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("px-3 pb-5 pt-2 shrink-0", className)} {...props} />
  ),
)
SidebarFooter.displayName = "SidebarFooter"

/* ----------------------------- SidebarSection ---------------------------- */

const SidebarSection = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("", className)} {...props} />,
)
SidebarSection.displayName = "SidebarSection"

/* ------------------------------ SidebarLabel ----------------------------- */

const SidebarLabel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { collapsed } = useSidebarContext()

    return (
      <div
        ref={ref}
        className={cn(
          "px-3 py-1 text-xs font-medium text-text-muted uppercase tracking-wider",
          collapsed && "sr-only",
          className,
        )}
        {...props}
      />
    )
  },
)
SidebarLabel.displayName = "SidebarLabel"

/* ------------------------------ SidebarItem ------------------------------ */

interface SidebarItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isActive?: boolean
}

const SidebarItem = forwardRef<HTMLButtonElement, SidebarItemProps>(
  ({ isActive, disabled, className, children, ...props }, ref) => {
    const { collapsed } = useSidebarContext()

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        className={cn(
          "relative w-full flex items-center justify-start text-left gap-3 rounded-lg px-3 h-9 text-[13px] transition-all duration-200 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue-mid/40",
          isActive
            ? "bg-accent-blue-mid/15 text-white font-medium ring-1 ring-accent-blue-mid/20"
            : "text-[#777] hover:bg-white/[0.06] hover:text-[#bbb]",
          collapsed && "justify-center",
          disabled && "opacity-30 cursor-not-allowed",
          className,
        )}
        {...props}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-r-full bg-accent-blue-light" />
        )}
        {children}
      </button>
    )
  },
)
SidebarItem.displayName = "SidebarItem"

/* -------------------------------- Exports -------------------------------- */

export {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarItem,
  SidebarSection,
  SidebarLabel,
}
export type { SidebarProps, SidebarItemProps }
