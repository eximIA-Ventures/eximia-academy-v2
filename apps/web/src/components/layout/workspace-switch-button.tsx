"use client"

// =============================================================================
// WorkspaceSwitchButton — the visible door between the two worlds (S3)
// =============================================================================
//
// A porta para trocar de workspace saiu do menu de conta (foco por subtração)
// e passou a morar AO LADO da logo, visível, nos dois headers. NÃO é um toggle
// direto: navega para /workspace (o seletor), que é a tela de escolha canônica.
//
// SECURITY: puramente de navegação. O gate real acontece em /workspace (a page
// redireciona single-access users) e em switchWorkspace (re-valida hats no
// server). Aqui só renderizamos quando `canSwitch` — resolvido server-side a
// partir de accessibleWorkspaces(roles).length > 1. Single-access nunca vê.
// =============================================================================

import { Repeat } from "lucide-react"
import Link from "next/link"

interface Props {
  /** Rótulo do mundo atual, ex.: "Plataforma" ou "Estúdio". */
  current: string
  /** True apenas para multi-access (accessibleWorkspaces > 1). Gate S3. */
  canSwitch?: boolean
}

export function WorkspaceSwitchButton({ current, canSwitch = false }: Props) {
  if (!canSwitch) return null

  return (
    <Link
      href="/workspace"
      aria-label={`Workspace atual: ${current}. Trocar de workspace`}
      className="group flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-[11px] font-semibold tracking-wide text-text-secondary shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.05)] transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cerrado-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app dark:bg-bg-card"
    >
      <span className="hidden text-[9px] font-semibold uppercase tracking-widest text-text-muted sm:inline">
        Workspace
      </span>
      <span className="max-w-[120px] truncate">{current}</span>
      <Repeat
        size={14}
        className="text-cerrado-500 transition-transform duration-200 group-hover:rotate-180 dark:text-cerrado-400"
      />
    </Link>
  )
}
