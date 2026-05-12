"use client"

import { signOut } from "@/lib/actions/auth"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@eximia/ui"
import { Bell, Eye, EyeOff, LogOut, Settings, User } from "lucide-react"
import Link from "next/link"
import { AreaSelector } from "./area-selector"
import { TenantSelector } from "./tenant-selector"
import { ThemeToggle } from "./theme-toggle"
import { ViewAsStudentToggle } from "./view-as-student-toggle"

interface HeaderProps {
  user: {
    full_name: string
    role: string
  }
  tenantContext?: { name: string } | null
  multiTenant?: {
    activeTenantId: string
    tenants: Array<{ id: string; name: string; slug: string }>
  } | null
  viewAsStudent?: boolean
}

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  manager: "Gestor",
  instructor: "Instrutor",
  student: "Aluno",
}

export function Header({ user, tenantContext, multiTenant, viewAsStudent }: HeaderProps) {

  return (
    <header className="flex items-center justify-end gap-2 sm:gap-4 px-3 sm:px-6 py-2 sm:py-3 ml-0 md:ml-0">
      {/* Spacer for mobile hamburger */}
      <div className="w-10 md:hidden" />

      {/* View as student badge (instructor only) */}
      {viewAsStudent && (
        <div className="mr-auto flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 sm:px-3 py-1 sm:py-1.5 ring-1 ring-amber-500/20">
          <Eye size={13} className="text-amber-400" />
          <span className="text-[10px] sm:text-xs font-medium text-amber-400">Modo Aluno</span>
        </div>
      )}

      {/* View toggle for instructors, admins and super admins */}
      {(user.role === "instructor" || user.role === "admin" || user.role === "super_admin") && (
        <div className="hidden sm:block">
          <ViewAsStudentToggle active={viewAsStudent ?? false} />
        </div>
      )}

      {/* Tenant selector (admin global / super_admin) */}
      {multiTenant && multiTenant.tenants.length > 0 && (
        <TenantSelector
          activeTenantId={multiTenant.activeTenantId}
          tenants={multiTenant.tenants}
        />
      )}

      {/* Área selector (managers with multiple areas) */}
      <AreaSelector />

      {/* Theme toggle */}
      <ThemeToggle />

      {/* Notifications */}
      <DropdownMenu>
        <DropdownMenuTrigger>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-elevated text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
            aria-label="Notificações"
          >
            <Bell size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="right-0 left-auto min-w-[240px]">
          <div className="px-3 py-2">
            <p className="text-sm font-medium text-text-primary">
              Notificações
            </p>
          </div>
          <DropdownMenuSeparator />
          <div className="mx-2 mb-2 rounded-lg bg-bg-surface/50 px-3 py-8 text-center">
            <Bell size={24} className="mx-auto mb-3 text-text-muted/60" />
            <p className="text-xs font-medium text-text-secondary">
              Tudo em dia
            </p>
            <p className="mt-0.5 text-[11px] text-text-muted">
              Nenhuma notificação no momento
            </p>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

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
            <p className="text-xs text-text-muted">{roleLabels[user.role] ?? user.role}</p>
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
