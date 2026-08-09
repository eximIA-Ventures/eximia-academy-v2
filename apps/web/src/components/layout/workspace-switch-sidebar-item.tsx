"use client"

// =============================================================================
// WorkspaceSwitchSidebarItem — a ÚNICA porta visível entre os mundos
// =============================================================================
//
// Rodada 7, decisão do dono: existiam DOIS controles fazendo a mesma coisa — a
// pílula no topo (`WorkspaceSwitchButton`, ao lado da logo) e o item no rodapé
// da barra lateral. O dono viu os dois e disse que o da barra ficou melhor.
// Então a pílula foi APOSENTADA e este componente passou a ser o item de rodapé
// ÚNICO dos TRÊS shells (Padrão, Estúdio, Administração), com o mesmo ícone
// (`ArrowLeftRight`), o mesmo rótulo ("Trocar de workspace") e o mesmo
// comportamento (navegar para `/workspace`, o seletor).
//
// POR QUE LINK PARA O PICKER, E NÃO TROCA DIRETA: o Estúdio trocava DIRETO para
// o mundo Padrão (`switchWorkspace("standard")`), o que escolhia pela pessoa.
// Com o `super_admin` alcançando os TRÊS mundos (rodada 7), trocar direto
// passaria a estar errado por construção. O picker é a tela de escolha canônica
// e já resolve single-access sozinha.
//
// SEGURANÇA: puramente navegação. O gate real está em `/workspace` (a page
// redireciona single-access) e em `switchWorkspace` (revalida chapéus no
// server). Aqui só renderizamos quando `canSwitch` — resolvido SERVER-SIDE por
// `accessibleWorkspaces(roles).length > 1`, o mesmo sinal que a pílula usava.
// Single-access (aluno puro, instrutor puro) nunca vê a porta.
// =============================================================================

import { ArrowLeftRight } from "lucide-react"
import Link from "next/link"

interface Props {
  /** True apenas para multi-access (`accessibleWorkspaces(roles).length > 1`). */
  canSwitch?: boolean
  /** Fecha o drawer mobile da barra, quando o shell tem um. */
  onNavigate?: () => void
}

export function WorkspaceSwitchSidebarItem({ canSwitch = false, onNavigate }: Props) {
  if (!canSwitch) return null

  return (
    <div className="mt-3 border-t border-border-subtle pt-3">
      <Link
        href="/workspace"
        onClick={onNavigate}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
      >
        <ArrowLeftRight size={18} strokeWidth={1.5} className="shrink-0" />
        <span className="truncate">Trocar de workspace</span>
      </Link>
    </div>
  )
}
