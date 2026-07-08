"use client"

import { toggleViewAsStudent } from "@/app/(studio)/instructor/actions"
import { NotificationBell } from "@/components/layout/notification-bell"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { WorkspaceSwitchButton } from "@/components/layout/workspace-switch-button"
import { signOut } from "@/lib/actions/auth"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@eximia/ui"
import { Eye, LogOut, Settings, User } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

interface StudioHeaderProps {
  firstName: string
  fullName: string
  viewAsStudent: boolean
  /** True only for multi-access users (accessibleWorkspaces > 1). Resolved
   *  server-side from `roles` in the studio layout — gates the Workspace
   *  section so single-access (instructor-only) users never see the door (S3),
   *  mirroring the standard-world Header. */
  canSwitchWorkspace?: boolean
}

/** Slim header of the Studio. Left: page section label plus the workspace
 *  switch pill beside it (the deliberate door that replaced the old
 *  RoleLensSwitcher "Vendo como" — it navigates to /workspace and only renders
 *  for multi-access users). Right: "Ver como Aluno" preview toggle (promotion
 *  of the scoped presentation-viewer toggle to a first-class workspace
 *  action), notification bell, and the account menu (Perfil/Configurações/
 *  Sair only — workspace switching lives beside the logo, not in the menu). */
export function StudioHeader({
  firstName,
  fullName,
  viewAsStudent,
  canSwitchWorkspace = false,
}: StudioHeaderProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handlePreview() {
    startTransition(async () => {
      await toggleViewAsStudent()
      router.refresh()
    })
  }

  return (
    <header className="flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-2 sm:py-3">
      {/* Spacer for mobile hamburger */}
      <div className="w-10 md:hidden" />

      {/* Porta de troca de workspace — AO LADO da logo (que mora na sidebar).
          Gated por canSwitchWorkspace; single-access (instructor-only) não vê. */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <WorkspaceSwitchButton current="Estúdio" canSwitch={canSwitchWorkspace} />
        <span className="hidden text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted sm:inline">
          Estúdio do Instrutor
        </span>
      </div>

      {/* "Ver como Aluno" — global preview action (promotion of the scoped toggle) */}
      <button
        type="button"
        onClick={handlePreview}
        disabled={isPending}
        className="hidden items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary disabled:opacity-60 sm:flex"
      >
        <Eye size={14} />
        Ver como Aluno
      </button>

      <ThemeToggle />

      <NotificationBell />

      {/* Account menu */}
      <DropdownMenu>
        <DropdownMenuTrigger>
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-card shadow-card text-sm font-medium text-text-secondary transition-colors hover:shadow-elevated hover:text-text-primary"
            aria-label="Menu do usuário"
          >
            {fullName?.[0]?.toUpperCase() ?? "U"}
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="right-0 left-auto">
          {/* User info */}
          <div className="px-3 py-2">
            <p className="text-sm font-medium text-text-primary">{fullName || firstName}</p>
            <p className="text-xs text-text-muted">Instrutor</p>
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
          {/* A troca de workspace saiu do menu de conta (foco por subtração): a
              porta agora mora num lugar só, visível, ao lado da logo
              (WorkspaceSwitchButton no início do header). */}

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
