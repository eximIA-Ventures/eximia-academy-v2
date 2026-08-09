"use client"

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
import { Eye, LogOut, Settings, User } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

interface StudioHeaderProps {
  firstName: string
  fullName: string
  viewAsStudent: boolean
}

/** Slim header of the Studio. A porta de troca de workspace saiu daqui na
 *  rodada 7 (existiam dois controles para a mesma coisa; o dono ficou com o do
 *  rodapé da barra). Right: "Ver como Aluno" preview toggle (promotion
 *  of the scoped presentation-viewer toggle to a first-class workspace
 *  action), notification bell, and the account menu (Perfil/Configurações/
 *  Sair only — workspace switching lives beside the logo, not in the menu). */
export function StudioHeader({ firstName, fullName, viewAsStudent }: StudioHeaderProps) {
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

      {/* Rodada 7: a pílula de troca de workspace que morava aqui foi
          APOSENTADA. A porta existe em UM lugar só, igual nos três mundos:
          `WorkspaceSwitchSidebarItem`, no rodapé da sidebar. */}
      <div className="mr-auto min-w-0" />

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
