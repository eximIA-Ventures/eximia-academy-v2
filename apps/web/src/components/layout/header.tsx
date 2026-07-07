"use client"

import { signOut } from "@/lib/actions/auth"
import type { AvailableContext } from "@/lib/context-resolver"
import type { Role, RoleLens } from "@eximia/shared"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@eximia/ui"
import { LogOut, Settings, User } from "lucide-react"
import Link from "next/link"
import { AreaSelector } from "./area-selector"
import { ContextSwitcher } from "./context-switcher"
import { NotificationBell } from "./notification-bell"
import { RoleLensSwitcher } from "./role-lens-switcher"
import { TenantSelector } from "./tenant-selector"
import { ThemeToggle } from "./theme-toggle"

interface HeaderProps {
  user: {
    full_name: string
    /** Union of hats (E1) — replaces the single `role`; used for the user-menu label. */
    roles: Role[]
  }
  tenantContext?: { name: string } | null
  multiTenant?: {
    activeTenantId: string
    tenants: Array<{ id: string; name: string; slug: string }>
  } | null
  /** Active context (E7 §4.10) — drives the ContextSwitcher. */
  activeContext: AvailableContext
  /** Contexts the person may assume (server-resolved vs user_roles). */
  availableContexts: AvailableContext[]
  activeLens: RoleLens
  eligibleLenses: RoleLens[]
  /** Server-resolved initial unread count — avoids layout shift on mount. */
  initialUnreadCount?: number
}

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Administrador",
  manager: "Gestor",
  instructor: "Instrutor",
  leader: "Lider Educador",
  student: "Aluno",
}

// Precedence mirrors the DB (recompute_primary_role, E1). Used only for the
// user-menu label now that `user.role` (single) is gone.
const ROLE_PRECEDENCE: Role[] = [
  "super_admin",
  "admin",
  "manager",
  "instructor",
  "leader",
  "student",
]

/** Highest-precedence hat label, for display only (never a permission gate). */
function primaryRoleLabel(roles: Role[]): string {
  const top = ROLE_PRECEDENCE.find((r) => roles.includes(r))
  return top ? (roleLabels[top] ?? top) : "Aluno"
}

export function Header({
  user,
  tenantContext,
  multiTenant,
  activeContext,
  availableContexts,
  activeLens,
  eligibleLenses,
  initialUnreadCount = 0,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-end gap-2 sm:gap-4 px-3 sm:px-6 py-2 sm:py-3 ml-0 md:ml-0">
      {/* Spacer for mobile hamburger */}
      <div className="w-10 md:hidden" />

      {/* Tenant selector (admin global / super_admin) */}
      {multiTenant && multiTenant.tenants.length > 0 && (
        <TenantSelector activeTenantId={multiTenant.activeTenantId} tenants={multiTenant.tenants} />
      )}

      {/* Filtros do gestor: "Unidade" escolhe lugar/escopo, ContextSwitcher
          escolhe população, e RoleLensSwitcher escolhe papel. São eixos
          distintos, ficam agrupados e separados por divisor sutil. */}
      <div className="flex items-center divide-x divide-border-subtle">
        {/* Área selector (managers with multiple areas). `empty:hidden` collapses
            the wrapper (padding + divider) when AreaSelector renders null. */}
        <div className="empty:hidden [&:not(:empty)]:pr-2 sm:[&:not(:empty)]:pr-3">
          {activeLens !== "manager" && <AreaSelector />}
        </div>

        <div className="empty:hidden [&:not(:empty)]:px-2 sm:[&:not(:empty)]:px-3">
          <RoleLensSwitcher active={activeLens} eligible={eligibleLenses} />
        </div>

        {/* Context switcher, Minha Trilha / Meu Time / Minha Org, absorbs the
            old ViewAsStudentToggle. Hidden for pure students, one context. */}
        <div className="empty:hidden [&:not(:empty)]:pl-2 sm:[&:not(:empty)]:pl-3">
          <ContextSwitcher active={activeContext} available={availableContexts} />
        </div>
      </div>

      {/* Theme toggle */}
      <ThemeToggle />

      {/* Notifications — live bell with badge and quick-peek dropdown */}
      <NotificationBell initialUnreadCount={initialUnreadCount} />

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger>
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-card shadow-card text-sm font-medium text-text-secondary transition-colors hover:shadow-elevated hover:text-text-primary"
            aria-label="Menu do usuário"
          >
            {user.full_name?.[0]?.toUpperCase() ?? "U"}
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="right-0 left-auto">
          {/* User info */}
          <div className="px-3 py-2">
            <p className="text-sm font-medium text-text-primary">{user.full_name}</p>
            <p className="text-xs text-text-muted">{primaryRoleLabel(user.roles)}</p>
          </div>
          <DropdownMenuSeparator />
          <Link href={"/profile/learning"}>
            <DropdownMenuItem>
              <span className="flex items-center gap-2">
                <User size={14} />
                Perfil
              </span>
            </DropdownMenuItem>
          </Link>
          <Link href={"/configuracoes"}>
            <DropdownMenuItem>
              <span className="flex items-center gap-2">
                <Settings size={14} />
                Configurações
              </span>
            </DropdownMenuItem>
          </Link>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              const form = document.getElementById("logout-form") as HTMLFormElement
              form?.requestSubmit()
            }}
          >
            <span className="flex items-center gap-2 text-semantic-error">
              <LogOut size={14} />
              Sair
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Hidden logout form */}
      <form id="logout-form" action={signOut} className="hidden">
        <button type="submit" tabIndex={-1}>
          Sair
        </button>
      </form>
    </header>
  )
}
