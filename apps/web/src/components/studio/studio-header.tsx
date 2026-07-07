"use client"

import { switchWorkspace } from "@/app/(platform)/workspace/actions"
import { toggleViewAsStudent } from "@/app/(studio)/instructor/actions"
import { NotificationBell } from "@/components/layout/notification-bell"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { signOut } from "@/lib/actions/auth"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@eximia/ui"
import { ArrowRight, Check, Eye, LogOut, Settings, User } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

interface StudioHeaderProps {
  firstName: string
  fullName: string
  viewAsStudent: boolean
}

/** Slim header of the Studio. Left: page section label. Right: "Ver como Aluno"
 *  preview toggle (promotion of the scoped presentation-viewer toggle to a
 *  first-class workspace action), notification bell, and the account menu whose
 *  "Workspace" section is the deliberate door that REPLACES the old
 *  RoleLensSwitcher ("Vendo como"). */
export function StudioHeader({ firstName, fullName, viewAsStudent }: StudioHeaderProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handlePreview() {
    startTransition(async () => {
      await toggleViewAsStudent()
      router.refresh()
    })
  }

  function handleSwitch() {
    startTransition(async () => {
      await switchWorkspace("standard")
    })
  }

  return (
    <header className="flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-2 sm:py-3">
      {/* Spacer for mobile hamburger */}
      <div className="w-10 md:hidden" />

      <div className="min-w-0 flex-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
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
          <DropdownMenuSeparator />

          {/* Workspace section — the deliberate door between two worlds (S3). */}
          <div className="mx-1 my-1 rounded-lg bg-cerrado-600/8 p-1">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
              Workspace
            </p>
            <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text-primary">
              <Check size={14} className="text-cerrado-600 dark:text-cerrado-400" />
              <span className="flex-1">Estúdio do Instrutor</span>
            </div>
            <button
              type="button"
              onClick={handleSwitch}
              disabled={isPending}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary disabled:opacity-60"
            >
              <span className="flex-1 text-left">Plataforma de Aprendizagem</span>
              <ArrowRight size={14} className="shrink-0 text-text-muted" />
            </button>
          </div>

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
