"use client"

import { WorkspaceSwitchSidebarItem } from "@/components/layout/workspace-switch-sidebar-item"
import { useBrand } from "@/components/providers/brand-provider"
import {
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarSection,
  Sidebar as UISidebar,
} from "@eximia/ui"
import {
  BarChart3,
  GraduationCap,
  LayoutDashboard,
  Menu,
  Play,
  SquareStack,
  Users,
  X,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

/** Fixed instructor nav — the Studio owns its own list, it does NOT use
 *  getNavigation/registry (that is the standard-world, context-driven nav). */
const STUDIO_NAV = [
  { label: "Visão Geral", href: "/instructor", icon: LayoutDashboard },
  { label: "Meus Cursos", href: "/courses", icon: GraduationCap },
  { label: "Conteúdo e Materiais", href: "/materiais", icon: SquareStack },
  { label: "Sessões e Lives", href: "/lives", icon: Play },
  { label: "Acompanhamento", href: "/trails", icon: Users },
  { label: "Análises", href: "/analytics", icon: BarChart3 },
] as const

function StudioBadge() {
  const brand = useBrand()
  // Mesmo lockup do mundo padrão (logo ARGOS + script Caveat): a MARCA é a
  // mesma nos dois mundos, a COR marca o mundo. Aqui o script vem no navy do
  // Estúdio (studio-*), lá vem no cerrado. Nada de caps laranja (aquele
  // duplicava o rótulo do header — foco por subtração).
  return (
    <div className="flex items-end gap-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo-color.png"
        alt={brand.name}
        className="h-6 shrink-0 block dark:hidden"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={brand.logo} alt={brand.name} className="h-6 shrink-0 hidden dark:block" />
      <span
        className="text-[21px] leading-none mb-[1px] whitespace-nowrap font-bold text-studio-700 dark:text-studio-400"
        style={{ fontFamily: "var(--font-caveat), cursive" }}
      >
        Estúdio do Instrutor
      </span>
    </div>
  )
}

interface StudioSidebarProps {
  /** True apenas para multi-access (`accessibleWorkspaces > 1`), resolvido
   *  server-side no layout. Gate do item de rodapé "Trocar de workspace" —
   *  MESMO contrato nos três shells (rodada 7). Antes deste gate o Estúdio
   *  mostrava a porta até para o instrutor puro (single-access), que não tem
   *  para onde ir. */
  canSwitchWorkspace?: boolean
}

export function StudioSidebar({ canSwitchWorkspace = false }: StudioSidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)
  const hamburgerRef = useRef<HTMLButtonElement>(null)

  const closeMobile = useCallback(() => {
    setMobileOpen(false)
    hamburgerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!mobileOpen) return

    const sidebar = sidebarRef.current
    if (!sidebar) return

    const firstFocusable = sidebar.querySelector<HTMLElement>("a, button")
    firstFocusable?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMobile()
        return
      }

      if (e.key !== "Tab") return

      const focusableElements = sidebar.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled])",
      )
      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last?.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first?.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [mobileOpen, closeMobile])

  return (
    <>
      {/* Mobile hamburger */}
      <button
        ref={hamburgerRef}
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-30 flex h-10 w-10 items-center justify-center rounded-md text-text-secondary hover:bg-bg-hover hover:text-text-primary md:hidden"
        aria-label="Abrir menu"
      >
        <Menu size={24} />
      </button>

      {/* Mobile overlay */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape handled by focus trap effect */}
      <div
        className={`fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={closeMobile}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <UISidebar
        ref={sidebarRef}
        collapsed={false}
        aria-label="Menu do Estúdio"
        className={`
          transition-transform duration-300
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:relative md:translate-x-0
        `}
      >
        {/* Workspace badge */}
        <SidebarHeader>
          <Link href="/instructor" className="flex items-center">
            <StudioBadge />
          </Link>
          <button
            type="button"
            onClick={closeMobile}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-bg-hover hover:text-text-primary md:hidden"
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        </SidebarHeader>

        <SidebarContent>
          <nav aria-label="Menu do Estúdio" className="space-y-5">
            <SidebarSection>
              <div className="space-y-0.5">
                {STUDIO_NAV.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                  const Icon = item.icon
                  return (
                    <Link key={item.href} href={item.href} onClick={closeMobile} className="block">
                      <SidebarItem isActive={isActive}>
                        {/* RODADA 10 (A3) — o ÍCONE do item ativo era
                            `text-cerrado-400` LITERAL: laranja da Plataforma de
                            Aprendizagem aceso dentro do mundo AZUL. O fundo e o
                            marcador já derivavam de `--world-accent` (SidebarItem
                            em `packages/ui`); o ícone era o último resíduo da cor
                            que morria na porta. Agora deriva do mesmo token, que
                            é tema-dependente (parada 700 no claro, 400/500 no
                            escuro) — o que também corrige a reprovação de
                            contraste medida no tema claro (1.82:1). */}
                        <Icon
                          size={18}
                          strokeWidth={isActive ? 2 : 1.5}
                          className={`shrink-0 ${isActive ? "text-[var(--world-accent)]" : ""}`}
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                      </SidebarItem>
                    </Link>
                  )
                })}
              </div>
            </SidebarSection>
          </nav>
        </SidebarContent>

        {/* Bottom — a porta para os outros mundos. Rodada 7: era um switch
            DIRETO para o mundo Padrão (`switchWorkspace("standard")`), que
            escolhia pela pessoa; agora é o MESMO componente compartilhado dos
            outros dois shells, que leva ao picker. Com o super_admin alcançando
            os três mundos, trocar direto estaria errado por construção. */}
        <SidebarFooter>
          <WorkspaceSwitchSidebarItem canSwitch={canSwitchWorkspace} onNavigate={closeMobile} />
          {/* Powered by exímIA */}
          <div className="mt-6 px-3">
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-medium uppercase tracking-[0.15em] text-text-muted/40">
                Powered by
              </span>
              <div className="h-px flex-1 bg-border-subtle" />
            </div>
            <div className="mt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logos/eximia-horizontal.svg"
                alt="eximIA"
                className="h-4 max-w-[80%] opacity-30 block dark:hidden"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logos/eximia-horizontal-academy.svg"
                alt="eximIA"
                className="h-4 max-w-[80%] opacity-30 hidden dark:block"
              />
            </div>
          </div>
        </SidebarFooter>
      </UISidebar>
    </>
  )
}
