"use client"

import { signOut } from "@/lib/actions/auth"
import type { AvailableContext } from "@/lib/context-resolver"
import type { Role } from "@eximia/shared"
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
import { ThemeToggle } from "./theme-toggle"

interface HeaderProps {
  user: {
    full_name: string
    /** Union of hats (E1) — replaces the single `role`; used for the user-menu label. */
    roles: Role[]
  }
  tenantContext?: { name: string } | null
  /* RODADA 10, A1 — a prop `multiTenant` SAIU deste cabeçalho.
     O seletor de EMPRESA decide sobre qual empresa se opera; isso é noção do
     mundo de ADMINISTRAÇÃO (e do Super Admin), não do mundo de APRENDIZAGEM.
     Mantê-lo aqui era deixar dentro do Padrão o último controle administrativo,
     logo depois de tirarmos o painel global dele (rodada 9) — o mundo de
     aprender não contém administrar (`workspace-separation.story.md`).
     O que saiu foi o CONTROLE, não o ESTADO: o cookie `x-sa-active-tenant`
     continua existindo e sendo lido pelas telas que dependem dele; quem quiser
     trocar de empresa faz isso no mundo onde a troca significa algo. */
  /** Active context (E7 §4.10) — drives the ContextSwitcher. */
  activeContext: AvailableContext
  /** Contexts the person may assume (server-resolved vs user_roles). */
  availableContexts: AvailableContext[]
  /** Server-resolved initial unread count — avoids layout shift on mount. */
  initialUnreadCount?: number
  /** True only in a team/organization context. Resolved SERVER-SIDE from the
   *  active context in the platform layout (same pattern as canSwitchWorkspace) —
   *  the "Unidade" filter is a place/scope selector that makes no sense in the
   *  personal trail ("Minha Trilha"), so it must be absent there with no client
   *  flicker. AreaSelector still self-guards on userAreas.length > 1. */
  showAreaSelector?: boolean
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
  activeContext,
  availableContexts,
  initialUnreadCount = 0,
  showAreaSelector = false,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-end gap-2 sm:gap-4 px-3 sm:px-6 py-2 sm:py-3 ml-0 md:ml-0">
      {/* Spacer for mobile hamburger */}
      <div className="w-10 md:hidden" />

      {/* Rodada 7: a pílula de troca de workspace que morava aqui foi
          APOSENTADA. Havia DOIS controles para a mesma coisa (esta pílula e o
          item no rodapé da barra); o dono escolheu o da barra. A porta agora
          existe em UM lugar só, igual nos três mundos:
          `WorkspaceSwitchSidebarItem`, no rodapé da sidebar. */}
      <div className="mr-auto" />

      {/* RODADA 10, A1 — o seletor de EMPRESA que morava aqui foi movido para os
          mundos onde "empresa ativa" é uma noção legítima (Administração e Super
          Admin, via `AdminHeader`). Ver a nota na prop removida, acima. */}

      {/* Filtros do gestor no Workspace Padrão: "Unidade" escolhe lugar/escopo,
          ContextSwitcher escolhe população. O eixo-lente ("Vendo como") foi
          aposentado (WP5) — o papel virou o WORKSPACE, não um seletor. */}
      <div className="flex items-center divide-x divide-border-subtle">
        {/* Área selector (managers with multiple areas). Only in a team/org
            context (showAreaSelector, server-resolved) — the "Unidade" filter
            has no meaning in the personal trail. `empty:hidden` collapses the
            wrapper (padding + divider) when nothing renders. */}
        <div className="empty:hidden [&:not(:empty)]:pr-2 sm:[&:not(:empty)]:pr-3">
          {showAreaSelector && <AreaSelector />}
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

          {/* A troca de workspace saiu do menu de conta (foco por subtração) e,
              na rodada 7, também saiu do topo: a porta mora num lugar só, o
              rodapé da barra lateral (`WorkspaceSwitchSidebarItem`). */}

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
