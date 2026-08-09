"use client"

import { NotificationBell } from "@/components/layout/notification-bell"
import { TenantSelector } from "@/components/layout/tenant-selector"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { signOut } from "@/lib/actions/auth"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@eximia/ui"
import { LogOut, Settings, User } from "lucide-react"
import Link from "next/link"

interface AdminHeaderProps {
  firstName: string
  fullName: string
  /** Rótulo do papel exibido no menu de conta. */
  roleLabel?: string
  /** Seletor de EMPRESA. Desde a RODADA 10 (A1), este é o ÚNICO cabeçalho que o
   *  monta: escolher sobre qual empresa se opera é ato administrativo, e o
   *  mundo de APRENDIZAGEM não contém administração
   *  (`docs/stories/workspace-separation.story.md`). O `(platform)/layout.tsx`
   *  resolve o objeto sob a conjunção "mundo administrativo E
   *  `needsTenantSelector(profile)`" e o entrega só aqui.
   *
   *  Histórico que NÃO se perde: a rodada 2 (FURO 2) trouxe o seletor para este
   *  shell porque o super_admin/admin global ficava preso ao tenant do cookie
   *  `x-sa-active-tenant` ao entrar no mundo admin. Esse acesso continua
   *  intacto — o que a rodada 10 fez foi tirar o controle do OUTRO lado, não
   *  deste. */
  multiTenant?: {
    activeTenantId: string
    tenants: Array<{ id: string; name: string; slug: string }>
  } | null
}

/** Header slim do MUNDO DO ADMIN. Cópia enxuta do header do Estúdio, SEM o
 *  "Ver como Aluno" (D3a é do instrutor): tema, sino e menu de conta. A porta
 *  de troca de workspace saiu daqui na rodada 7 — ela mora no rodapé da barra
 *  lateral, igual nos três mundos. */
export function AdminHeader({
  firstName,
  fullName,
  roleLabel = "Administrador",
  multiTenant = null,
}: AdminHeaderProps) {
  return (
    <header className="flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-2 sm:py-3">
      {/* Spacer for mobile hamburger */}
      <div className="w-10 md:hidden" />

      <div className="mr-auto min-w-0" />

      {/* Tenant selector (admin global / super_admin) — condição de renderização
          IDÊNTICA à do `Header` do shell Padrão: `multiTenant && tenants.length > 0`. */}
      {multiTenant && multiTenant.tenants.length > 0 && (
        <TenantSelector activeTenantId={multiTenant.activeTenantId} tenants={multiTenant.tenants} />
      )}

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
          <div className="px-3 py-2">
            <p className="text-sm font-medium text-text-primary">{fullName || firstName}</p>
            <p className="text-xs text-text-muted">{roleLabel}</p>
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
