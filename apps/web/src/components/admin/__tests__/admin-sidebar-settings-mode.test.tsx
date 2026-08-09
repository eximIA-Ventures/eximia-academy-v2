import { render, screen } from "@testing-library/react"
import { LayoutDashboard } from "lucide-react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AdminSidebar } from "../admin-sidebar"

// =============================================================================
// DRILL-IN — "entrar no modo Configurações" (decisão do dono, 2026-07-28)
//
// O defeito relatado ao ver a tela: em `/admin/configuracoes/*` apareciam DUAS
// barras laterais coladas — a do mundo Admin (logo + CONTEÚDO/ADMINISTRAÇÃO) e a
// do hub (ORGANIZAÇÃO/PESSOAS/PLATAFORMA/AVANÇADO) — somando ~600px de cromo
// antes do conteúdo e sem deixar claro qual era a navegação principal.
//
// A decisão: uma barra lateral POR VEZ. Dentro do hub, a barra do mundo dá lugar
// à do hub, e a única porta de saída visível é o "Voltar ao Admin" do topo.
//
// Este teste prova as TRÊS metades da decisão de uma vez: (a) dentro do hub a
// barra do mundo NÃO é renderizada, (b) a de Configurações É, (c) a saída aponta
// para o mundo Admin. E prova o contrapositivo — fora do hub, nada muda.
// =============================================================================

// A nav do mundo é mockada de propósito: o que este teste garante é a TROCA de
// casca, não o conteúdo do registry (que tem testes próprios e muda por módulo
// habilitado). "Painel do mundo" é a sentinela — se ela aparecer dentro do hub,
// as duas barras voltaram.
const SENTINELA_MUNDO = "Painel do mundo"

vi.mock("@/lib/navigation", () => ({
  getNavigation: () => [
    { section: "CONTEÚDO" },
    { label: SENTINELA_MUNDO, href: "/admin", icon: LayoutDashboard },
    { label: "Cursos", href: "/admin/biblioteca", icon: LayoutDashboard },
  ],
  bottomNav: [{ label: "Central de ajuda", href: "/help", icon: LayoutDashboard }],
}))

vi.mock("@/components/providers/module-provider", () => ({
  useModules: () => ({
    enabledIds: [],
    isEnabled: () => false,
    isRouteAllowed: () => true,
  }),
}))

vi.mock("@/components/providers/brand-provider", () => ({
  useBrand: () => ({ name: "Cory Alimentos", logo: "/brand/logo.png", slug: "cory" }),
}))

let pathname = "/admin"
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}))

function renderSidebar() {
  return render(<AdminSidebar roles={["admin"]} canSwitchWorkspace world="admin" />)
}

describe("AdminSidebar — modo Configurações (drill-in) substitui a barra do mundo", () => {
  beforeEach(() => {
    pathname = "/admin"
  })

  it("dentro do hub, a barra do MUNDO não é renderizada", () => {
    pathname = "/admin/configuracoes/organizacao"
    renderSidebar()

    expect(screen.queryByRole("navigation", { name: "Menu de Administração" })).toBeNull()
    expect(screen.queryByText(SENTINELA_MUNDO)).toBeNull()
    // O lockup do mundo (logo + "Administração") sai junto: o topo da coluna
    // passa a ser a porta de saída, e ela precisa ser o primeiro elemento.
    expect(screen.queryByText("Administração")).toBeNull()
  })

  it("dentro do hub, a barra de CONFIGURAÇÕES é a que ocupa a coluna", () => {
    pathname = "/admin/configuracoes/usuarios"
    renderSidebar()

    expect(screen.getByRole("navigation", { name: "Seções de configurações" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 1, name: "Configurações" })).toBeInTheDocument()
    // As 9 seções vivas continuam links e as 7 não construídas continuam sem
    // link — o contrato da nav não foi renegociado para caber na casca nova.
    expect(screen.getByText("Usuários").closest("a")).toHaveAttribute(
      "href",
      "/admin/configuracoes/usuarios",
    )
    expect(screen.getByText("Perfis & Permissões").closest("a")).toBeNull()
    expect(screen.getByText("Perfis & Permissões").closest('[aria-disabled="true"]')).not.toBeNull()
  })

  it("a saída explícita do topo leva de volta ao mundo Admin", () => {
    pathname = "/admin/configuracoes/marca"
    renderSidebar()

    expect(screen.getByRole("link", { name: /Voltar ao Admin/ })).toHaveAttribute("href", "/admin")
  })

  it("a raiz do hub também entra no modo (não só as sub-rotas)", () => {
    pathname = "/admin/configuracoes"
    renderSidebar()

    expect(screen.getByRole("navigation", { name: "Seções de configurações" })).toBeInTheDocument()
    expect(screen.queryByText(SENTINELA_MUNDO)).toBeNull()
  })

  it("FORA do hub nada muda: a barra do mundo continua sendo a única", () => {
    pathname = "/admin/biblioteca"
    renderSidebar()

    expect(screen.getByRole("navigation", { name: "Menu de Administração" })).toBeInTheDocument()
    expect(screen.getByText(SENTINELA_MUNDO)).toBeInTheDocument()
    expect(screen.queryByRole("navigation", { name: "Seções de configurações" })).toBeNull()
    expect(screen.queryByRole("link", { name: /Voltar ao Admin/ })).toBeNull()
  })

  it("o rodapé sobrevive ao drill-in: entrar em Configurações custa navegação, não alcance", () => {
    pathname = "/admin/configuracoes/organizacao"
    renderSidebar()

    expect(screen.getByText("Central de ajuda")).toBeInTheDocument()
    expect(screen.getByText("Trocar de workspace")).toBeInTheDocument()
  })

  it("o selo PRO de plano continua chegando à nav dentro da casca nova (CFG-4.1 AC1)", () => {
    pathname = "/admin/configuracoes/organizacao"
    render(<AdminSidebar roles={["admin"]} world="admin" settingsWhitelabelEnabled={false} />)

    const selo = screen.getByText("PRO")
    expect(selo.closest("a")).toHaveAttribute("href", "/admin/configuracoes/marca")
  })
})
