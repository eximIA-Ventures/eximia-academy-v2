"use client"

import { useBrand } from "@/components/providers/brand-provider"
import { useModules } from "@/components/providers/module-provider"
import type { AvailableContext } from "@/lib/context-resolver"
import { type NavItem, bottomNav, getNavigation } from "@/lib/navigation"
import { PLATFORM_LABELS, type Role } from "@eximia/shared"
import {
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarSection,
  Sidebar as UISidebar,
} from "@eximia/ui"
import { Menu, X } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { WorkspaceSwitchSidebarItem } from "./workspace-switch-sidebar-item"

interface SidebarProps {
  /** Active context (E7 §4.10): decides which nav set renders (personal vs management). */
  context: AvailableContext
  /** Union of hats (E1): selects the management nav key when context is team/org. */
  roles: Role[]
  /** True apenas para multi-access (`accessibleWorkspaces > 1`), resolvido
   *  server-side no layout. Gate do item de rodapé "Trocar de workspace" —
   *  MESMO contrato nos três shells (rodada 7). */
  canSwitchWorkspace?: boolean
}

function BrandLogo() {
  const brand = useBrand()
  return (
    <div className="flex items-end gap-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo-color.png"
        alt={brand.name}
        className="h-7 shrink-0 block dark:hidden"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={brand.logo} alt={brand.name} className="h-7 shrink-0 hidden dark:block" />
      <span
        className="text-[20px] leading-none mb-[1px] font-bold text-cerrado-600 dark:text-cerrado-400"
        style={{ fontFamily: "var(--font-caveat), cursive" }}
      >
        Academy
      </span>
    </div>
  )
}

export function Sidebar({ context, roles, canSwitchWorkspace = false }: SidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { enabledIds } = useModules()
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

  // Build navigation dynamically from enabled modules. E8: driven by the active
  // context + hats (personal => student nav; team/org => management nav).
  const navItems = useMemo(() => {
    // `workspace: "standard"` é o eixo do 3º workspace: esta sidebar é a do
    // mundo PADRÃO, e um mundo nunca contém o outro — com o eixo declarado, o
    // registry deixa de emitir a chave admin-tier aqui (a administração passou
    // a pertencer ao mundo admin). O admin no Padrão vê o produto como o
    // cliente vê: gestor se tiver o chapéu, senão aluno.
    const items = getNavigation(enabledIds, { context, roles, workspace: "standard" })
    return items.map((item) => {
      if ("section" in item && item.section) return item
      if ((item as NavItem).href !== "/courses") return item
      return { ...item, label: PLATFORM_LABELS.courses }
    })
  }, [enabledIds, context, roles])

  // Group items by sections
  const groups = useMemo(() => {
    const result: { label?: string; items: NavItem[] }[] = []
    let currentGroup: { label?: string; items: NavItem[] } = { items: [] }

    for (const entry of navItems) {
      if ("section" in entry && entry.section) {
        if (currentGroup.items.length > 0) {
          result.push(currentGroup)
        }
        currentGroup = { label: entry.section, items: [] }
      } else {
        currentGroup.items.push(entry as NavItem)
      }
    }
    if (currentGroup.items.length > 0) {
      result.push(currentGroup)
    }
    return result
  }, [navItems])

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
        aria-label="Menu principal"
        className={`
          transition-transform duration-300
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:relative md:translate-x-0
        `}
      >
        {/* Logo */}
        <SidebarHeader>
          <Link href="/dashboard" className="flex items-center">
            <BrandLogo />
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
          <nav aria-label="Menu principal" className="space-y-5">
            {groups.map((group, gi) => (
              <div key={group.label ?? `g${gi}`}>
                {group.label && (
                  <div className="mb-2 px-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#4a4a4a]">
                      {group.label}
                    </span>
                  </div>
                )}
                <SidebarSection>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      // Um href pode carregar querystring (ex.: `?tab=auth`),
                      // que não faz parte do pathname — comparar sem ele.
                      const itemPath = item.href.split("?")[0]
                      const isActive = pathname === itemPath || pathname.startsWith(`${itemPath}/`)
                      const Icon = item.icon
                      return (
                        <Link
                          key={item.href}
                          href={item.disabled ? "#" : item.href}
                          onClick={closeMobile}
                          aria-disabled={item.disabled}
                          className={item.disabled ? "pointer-events-none" : "block"}
                        >
                          <SidebarItem isActive={isActive} disabled={item.disabled}>
                            {/* RODADA 10 (A3) — mesmo resíduo do Estúdio, aqui
                                com efeito só de CONTRASTE: este shell é o mundo
                                Padrão, então a família continua sendo o cerrado.
                                O que muda é a PARADA: `cerrado-400` literal dava
                                1.82:1 sobre o fundo tingido no tema claro
                                (reprova AA); `--world-accent` é a parada 700 no
                                claro e a 500 no escuro. A cor do mundo não muda,
                                o ícone passa a ser legível. */}
                            <Icon
                              size={18}
                              strokeWidth={isActive ? 2 : 1.5}
                              className={`shrink-0 ${isActive ? "text-[var(--world-accent)]" : ""}`}
                            />
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.badge && (
                              <span className="rounded-md bg-cerrado-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-cerrado-400">
                                {item.badge}
                              </span>
                            )}
                          </SidebarItem>
                        </Link>
                      )
                    })}
                  </div>
                </SidebarSection>
              </div>
            ))}
          </nav>
        </SidebarContent>

        {/* Bottom — anchored to the base of the sidebar (SidebarContent is
            flex-1, so this footer always sits at the bottom with no dead gap).
            A top divider separates it from the nav, then a deliberate rhythm:
            Central de ajuda → generous gap → "Powered by" mark. */}
        <SidebarFooter className="border-t border-border-subtle/60 pt-3">
          <div className="space-y-0.5">
            {bottomNav.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              return (
                <Link key={item.href} href={item.href} onClick={closeMobile} className="block">
                  <SidebarItem isActive={isActive}>
                    <Icon size={18} strokeWidth={1.5} className="shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </SidebarItem>
                </Link>
              )
            })}
          </div>

          {/* A porta para os outros mundos (rodada 7). O shell Padrão era o
              ÚNICO sem item de rodapé — a troca só existia na pílula do topo,
              que foi aposentada. Mesmo componente, ícone, rótulo e destino dos
              outros dois shells; gated por multi-access, então o aluno puro
              (single-access) continua sem ver porta nenhuma. */}
          <WorkspaceSwitchSidebarItem canSwitch={canSwitchWorkspace} onNavigate={closeMobile} />

          {/* Powered by exímIA — its own row with real breathing room above and
              below so the mark reads as a deliberate anchor, never clipped. */}
          <div className="mt-6 px-3">
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-medium uppercase tracking-[0.15em] text-text-muted/40">
                Powered by
              </span>
              <div className="h-px flex-1 bg-border-subtle" />
            </div>
            <div className="mt-2 pb-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logos/eximia-horizontal.svg"
                alt="eximIA"
                className="h-4 w-auto max-w-[70%] opacity-30 block dark:hidden"
              />
              <img
                src="/logos/eximia-horizontal-academy.svg"
                alt="eximIA"
                className="h-4 w-auto max-w-[70%] opacity-30 hidden dark:block"
              />
            </div>
          </div>
        </SidebarFooter>
      </UISidebar>
    </>
  )
}
