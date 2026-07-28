"use client"

import { SettingsHubNav } from "@/app/(platform)/admin/configuracoes/_components/settings-hub-nav"
import { WorkspaceSwitchSidebarItem } from "@/components/layout/workspace-switch-sidebar-item"
import { useBrand } from "@/components/providers/brand-provider"
import { useModules } from "@/components/providers/module-provider"
import { type NavItem, bottomNav, getNavigation } from "@/lib/navigation"
import { resolveAdminNavMode } from "@/lib/workspace-resolver"
import type { Role } from "@eximia/shared"
import {
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarSection,
  Sidebar as UISidebar,
} from "@eximia/ui"
import { ArrowLeft, Menu, X } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react"

/** Os DOIS mundos administrativos que este shell serve (rodada 9). Mesma
 *  anatomia, identidades separadas: cor, nome, home e chave de nav. */
export type AdminWorld = "admin" | "super"

/** Tokens por mundo. As escalas `--color-admin-*` (teal) e `--color-super-*`
 *  (violeta) vivem em `styles/theme.css`, com o contraste medido lá; aqui só se
 *  escolhe QUAL delas o shell veste. O `accent-gold` emprestado saiu: ele era
 *  vizinho do cerrado e fazia o mundo admin ler como primo da Plataforma. */
const WORLD_UI: Record<
  AdminWorld,
  { name: string; home: string; text: string; badgeBg: string; navLabel: string }
> = {
  admin: {
    name: "Administração",
    home: "/admin",
    text: "text-admin-700 dark:text-admin-300",
    badgeBg: "bg-admin-600/15",
    navLabel: "Menu de Administração",
  },
  super: {
    name: "Super Admin",
    home: "/super-admin",
    text: "text-super-700 dark:text-super-300",
    badgeBg: "bg-super-600/15",
    navLabel: "Menu do Super Admin",
  },
}

/** Rótulo da coluna no MODO CONFIGURAÇÕES. É deliberadamente diferente dos dois
 *  `navLabel` de mundo: quem navega por leitor de tela precisa perceber que a
 *  barra TROCOU, não que a de sempre mudou de itens. */
const SETTINGS_NAV_LABEL = "Menu de Configurações"

interface AdminSidebarProps {
  /** União de chapéus (E1): escolhe as chaves de nav pelo CHAPÉU real
   *  (mundo admin => `admin`; mundo super => `super_admin`), fail-closed no
   *  registry. */
  roles: Role[]
  /** True apenas para multi-access (`accessibleWorkspaces > 1`), resolvido
   *  server-side no layout. Gate do item de rodapé "Trocar de workspace" —
   *  MESMO contrato nos quatro shells. */
  canSwitchWorkspace?: boolean
  /** Qual dos dois mundos administrativos está ativo. Default `admin`, para
   *  nenhum chamador antigo mudar de comportamento. */
  world?: AdminWorld
  /**
   * Selo "PRO" de "Marca & Aparência" no MODO CONFIGURAÇÕES (CFG-4.1 AC1).
   * Resolvido server-side no `(platform)/layout.tsx` pelo MESMO gate de plano
   * que a sub-rota de marca usa (`loadTenantSettings().tenant.whitelabelEnabled`).
   * Default `true` (= sem selo): anunciar bloqueio inexistente é pior que não
   * anunciar, e a sub-rota continua sendo a fonte de verdade.
   */
  settingsWhitelabelEnabled?: boolean
}

function AdminBadge({ world }: { world: AdminWorld }) {
  const brand = useBrand()
  // Mesmo lockup dos outros mundos (logo do tenant + script Caveat): a MARCA é
  // a mesma, a COR marca o mundo.
  const ui = WORLD_UI[world]
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
        className={`text-[21px] leading-none mb-[1px] whitespace-nowrap font-bold ${ui.text}`}
        style={{ fontFamily: "var(--font-caveat), cursive" }}
      >
        {ui.name}
      </span>
    </div>
  )
}

/**
 * Sidebar dos DOIS mundos administrativos: Administração (W1/W3) e, desde a
 * rodada 9, Super Admin. Uma anatomia, duas identidades — o que muda é o
 * `world`: cor, nome no badge, home do lockup e chave de nav.
 *
 * Anatomia copiada do Estúdio (hambúrguer mobile, overlay, focus trap, rodapé
 * "Powered by exímIA"), mas o CONTEÚDO vem do registry — a nav administrativa
 * depende dos módulos habilitados do tenant (`biblioteca`, `course-designer`,
 * `assessments`), diferente da nav fixa do Estúdio.
 *
 * O rodapé abre o PICKER (`/workspace`), nunca um switch direto: o dono do
 * produto tem QUATRO portas, então trocar direto escolheria por ele.
 *
 * DRILL-IN (2026-07-28) — dentro de `/admin/configuracoes/*` esta MESMA barra
 * troca de conteúdo: a nav do mundo dá lugar à nav do hub de Configurações, e o
 * lockup do topo dá lugar à porta de saída "Voltar ao Admin". Antes havia DUAS
 * colunas de navegação empilhadas na tela (esta + o `<aside>` que o
 * `configuracoes/layout.tsx` montava), ~600px de cromo antes do conteúdo. A
 * troca acontece AQUI, e não num segundo componente, exatamente para herdar sem
 * cópia o hambúrguer mobile, o overlay, o focus trap e o rodapé — inventar uma
 * segunda casca seria criar um segundo lugar onde o mesmo bug pode nascer.
 */
export function AdminSidebar({
  roles,
  canSwitchWorkspace = false,
  world = "admin",
  settingsWhitelabelEnabled = true,
}: AdminSidebarProps) {
  const ui = WORLD_UI[world]
  const pathname = usePathname()
  // Sub-modo de ROTA dentro do mundo (nunca um 5º mundo — ver
  // `resolveAdminNavMode`). A decisão é pura e vive ao lado de
  // `resolvePlatformShell`, que já escolheu "admin" antes de chegarmos aqui.
  const isSettingsMode = resolveAdminNavMode(pathname) === "settings"
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

  // Nav pelo eixo de MUNDO: `workspace: "admin"` faz o registry emitir a chave
  // `admin` (a nav do admin comum, hub de Configurações incluído, para admin E
  // super_admin); `workspace: "super"` emite a chave `super_admin` (Painel +
  // Empresas). Fail-closed pelo chapéu real nos dois casos. O contexto é
  // irrelevante aqui (a chave não vem de `navRoleForContext`), mas o tipo o
  // exige — "organization" é o contexto de escopo do tenant.
  const navItems = useMemo(
    () =>
      getNavigation(enabledIds, {
        roles,
        context: { type: "organization" },
        workspace: world,
      }),
    [enabledIds, roles, world],
  )

  // Group items by sections (mesmo agrupamento da sidebar do mundo padrão)
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

    // CORREÇÃO DE AUDITORIA (rodada 8) — CABEÇALHO PARA UMA LINHA SÓ.
    // Um `<p>` de seção inteiro, em caixa alta e com tracking, para um único
    // item é ruído: pesa mais que o item que anuncia. Regra determinística e
    // sóbria: grupo com UM item é ABSORVIDO pelo grupo anterior (a ordem dos
    // itens não muda, some só o cabeçalho); se não houver anterior, ele perde
    // o rótulo e os itens abrem a lista. Nunca cria grupo vazio — grupos sem
    // item já não entram em `result`.
    //
    // Isto NÃO é o conserto do defeito medido ("Administração" com só
    // "Engajamento"): esse foi consertado na raiz, no registry, restaurando
    // Cargos/Usuários/Unidades, que nunca deveriam ter saído. Isto aqui é a
    // rede que impede a CLASSE de defeito de voltar em qualquer combinação de
    // módulos habilitados/chapéus (ex.: um admin comum de um tenant enxuto,
    // onde "Sistema" fica só com a porta do hub).
    //
    // Escopo: só o mundo admin. A sidebar do mundo padrão tem a própria cópia
    // desta função e não é tocada — lá "Liderança" com um item só é o desenho
    // que o dono já aprovou.
    const compact: typeof result = []
    for (const group of result) {
      const previous = compact[compact.length - 1]
      if (group.items.length === 1) {
        if (previous) previous.items.push(...group.items)
        else compact.push({ items: group.items })
        continue
      }
      compact.push(group)
    }
    return compact
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
        aria-label={isSettingsMode ? SETTINGS_NAV_LABEL : ui.navLabel}
        // A coluna do modo Configurações é mais larga que a do mundo (260px em
        // `theme.css`) porque os rótulos do hub são mais longos — "Perfis &
        // Permissões" já truncava por 3px na moldura anterior (`lg:w-72` + p-4 =
        // 232px úteis) e foi consertado na rodada 8 espremendo a própria linha.
        // 280px aqui devolve os MESMOS 232px úteis (280 - 24 do `SidebarContent`
        // - 24 do item), então o conserto de lá continua valendo e nenhum rótulo
        // regride. A variável já é o mecanismo de largura da casca compartilhada
        // (`w-[var(--sidebar-width,230px)]`) e o override é inline, escopado a
        // este elemento: quem lê `--sidebar-width` em outras rotas não muda.
        style={isSettingsMode ? ({ "--sidebar-width": "280px" } as CSSProperties) : undefined}
        className={`
          transition-transform duration-300
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:relative md:translate-x-0
        `}
      >
        {/* Topo: lockup do mundo OU, no modo Configurações, a porta de saída.
            Ela é a ÚNICA saída visível do drill-in, então fica no primeiro item
            da coluna, sempre alcançável sem rolagem. */}
        <SidebarHeader className={isSettingsMode ? "px-3" : undefined}>
          {isSettingsMode ? (
            <Link
              href={WORLD_UI.admin.home}
              onClick={closeMobile}
              className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
            >
              <ArrowLeft size={16} className="shrink-0" />
              <span className="truncate">Voltar ao Admin</span>
            </Link>
          ) : (
            <Link href={ui.home} className="flex items-center">
              <AdminBadge world={world} />
            </Link>
          )}
          <button
            type="button"
            onClick={closeMobile}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-bg-hover hover:text-text-primary md:hidden"
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        </SidebarHeader>

        {isSettingsMode ? (
          <SidebarContent>
            {/* O `<h1>` continua sendo do HUB, como era no `<aside>` que este
                bloco substitui: as seções abrem com `<h2>` (`SectionHeader`), e
                mover o título para cá preserva a hierarquia de cabeçalhos. */}
            <div className="mb-4 px-3 pt-1">
              <h1 className="text-lg font-bold text-text-primary">Configurações</h1>
              <p className="text-xs text-text-muted">Administração da organização</p>
            </div>
            <SettingsHubNav
              whitelabelEnabled={settingsWhitelabelEnabled}
              onNavigate={closeMobile}
            />
          </SidebarContent>
        ) : (
          <SidebarContent>
            <nav aria-label={ui.navLabel} className="space-y-5">
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
                        const isActive =
                          pathname === itemPath || pathname.startsWith(`${itemPath}/`)
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
                              <Icon
                                size={18}
                                strokeWidth={isActive ? 2 : 1.5}
                                className={`shrink-0 ${isActive ? ui.text : ""}`}
                              />
                              <span className="flex-1 truncate">{item.label}</span>
                              {item.badge && (
                                <span
                                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${ui.badgeBg} ${ui.text}`}
                                >
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
        )}

        {/* O rodapé é o MESMO nos dois modos, de propósito: "Central de ajuda" e
            "Trocar de workspace" são as duas portas que a barra do mundo oferece
            e que o drill-in, sozinho, faria sumir. Elas continuam aqui para que
            entrar em Configurações custe navegação, nunca alcance. */}
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

          {/* A porta de volta: o PICKER, não um switch direto — um
              `admin + instructor` tem 3 portas e a escolha é dele. Componente
              COMPARTILHADO pelos três shells (rodada 7): mesmo ícone, mesmo
              rótulo, mesmo comportamento. */}
          <WorkspaceSwitchSidebarItem canSwitch={canSwitchWorkspace} onNavigate={closeMobile} />

          {/* Powered by exímIA */}
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
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
