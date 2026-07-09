"use client"

// =============================================================================
// WorkspaceSwitchButton — the visible door between the two worlds (S3)
// =============================================================================
//
// A porta para trocar de workspace saiu do menu de conta (foco por subtração)
// e passou a morar AO LADO da logo, visível, nos dois headers. NÃO é um toggle
// direto: navega para /workspace (o seletor), que é a tela de escolha canônica.
//
// O rótulo é o NOME COMPLETO do mundo atual ("Plataforma de Aprendizagem" /
// "Estúdio do Instrutor"), não um apelido — a pílula é a única indicação de
// "onde estou" (o rótulo caps redundante ao lado dela foi aposentado). Um ponto
// da cor do mundo (cerrado para Plataforma, studio navy para Estúdio) dá
// identidade: a marca é a mesma, a cor marca o mundo.
//
// SECURITY: puramente de navegação. O gate real acontece em /workspace (a page
// redireciona single-access users) e em switchWorkspace (re-valida hats no
// server). Aqui só renderizamos quando `canSwitch` — resolvido server-side a
// partir de accessibleWorkspaces(roles).length > 1. Single-access nunca vê.
// =============================================================================

import { Repeat } from "lucide-react"
import Link from "next/link"

/** Which world the pill currently represents — decides the accent color. */
type World = "standard" | "studio"

interface Props {
  /** Nome COMPLETO do mundo atual, ex.: "Plataforma de Aprendizagem". */
  current: string
  /** Mundo atual — cerrado (standard) ou studio navy (studio) no acento. */
  world: World
  /** True apenas para multi-access (accessibleWorkspaces > 1). Gate S3. */
  canSwitch?: boolean
}

/** Accent (o ponto de identidade) por mundo. Cerrado é a cor da Plataforma;
 *  studio navy é a cor do Estúdio. Segue o mesmo par light/dark dos seletores
 *  irmãos (context-switcher etc). */
const ACCENT: Record<World, string> = {
  standard: "bg-cerrado-500 dark:bg-cerrado-400",
  studio: "bg-studio-600 dark:bg-studio-400",
}

export function WorkspaceSwitchButton({ current, world, canSwitch = false }: Props) {
  if (!canSwitch) return null

  return (
    <Link
      href="/workspace"
      aria-label={`Workspace atual: ${current}. Trocar de workspace`}
      className="group flex items-center gap-2.5 rounded-2xl bg-bg-card px-3.5 py-2 text-[11px] font-semibold tracking-wide text-text-secondary shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.05)] transition-all hover:text-text-primary hover:shadow-[0_2px_6px_rgba(0,0,0,0.10),0_8px_20px_rgba(0,0,0,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cerrado-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app"
    >
      {/* Ponto da cor do mundo — a identidade visual da pílula. */}
      <span
        aria-hidden="true"
        className={`h-2 w-2 shrink-0 rounded-full ${ACCENT[world]} shadow-[0_0_0_3px] shadow-black/[0.03] transition-transform duration-200 group-hover:scale-110`}
      />
      <span className="hidden text-[9px] font-semibold uppercase tracking-widest text-text-muted sm:inline">
        Workspace
      </span>
      <span className="max-w-[180px] truncate text-text-primary">{current}</span>
      <Repeat
        size={14}
        className="text-text-muted transition-transform duration-200 group-hover:rotate-180 group-hover:text-text-secondary"
      />
    </Link>
  )
}
