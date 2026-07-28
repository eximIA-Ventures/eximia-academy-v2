import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SettingsHubNav } from "../settings-hub-nav"

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/configuracoes/organizacao",
}))

// =============================================================================
// O CONTRATO DO HUB (rodada 7): 9 seções VIVAS (link real) e 7 em cinza.
//
// A distinção é estrutural, não estética: item vivo é um `<a href>`, item em
// cinza é um `<span aria-disabled="true">` com a pílula "Em breve" — nunca um
// link morto. Este teste guarda a MIGRAÇÃO das 4 seções que saíram da barra do
// mundo admin: se alguém as devolver para "Em breve", a contagem fica vermelha.
// =============================================================================

const VIVAS: Array<[string, string]> = [
  ["Dados da organização", "/admin/configuracoes/organizacao"],
  ["Marca & Aparência", "/admin/configuracoes/marca"],
  ["Unidades & Áreas", "/admin/configuracoes/unidades"],
  ["Cargos", "/admin/configuracoes/cargos"],
  ["Usuários", "/admin/configuracoes/usuarios"],
  // As 4 migradas na rodada 7:
  // "Times" era "Grupos de gestores" até 2026-07-28 (rename de RÓTULO decidido
  // pelo dono; a rota, as tabelas e os tipos não se moveram). O que este teste
  // guarda continua sendo o mesmo: a seção é VIVA e aponta para a própria
  // sub-rota — se alguém devolvê-la para "Em breve", a contagem fica vermelha.
  ["Times", "/admin/configuracoes/grupos"],
  ["Segurança & Sessão", "/admin/configuracoes/seguranca"],
  ["Auditoria", "/admin/configuracoes/auditoria"],
  ["Plano & Cobrança", "/admin/configuracoes/plano"],
]

const EM_BREVE = [
  "Convites",
  "Perfis & Permissões",
  "Preferências",
  "Notificações",
  "Integrações",
  "API Keys",
  "Webhooks",
]

describe("SettingsHubNav — 9 seções vivas, 7 em cinza", () => {
  it("renderiza exatamente 9 links e 7 itens 'Em breve'", () => {
    const { container } = render(<SettingsHubNav />)
    expect(container.querySelectorAll("a[href]")).toHaveLength(9)
    expect(container.querySelectorAll('[aria-disabled="true"]')).toHaveLength(7)
    expect(screen.getAllByText("Em breve")).toHaveLength(7)
  })

  it("cada seção viva aponta para a própria sub-rota do hub", () => {
    render(<SettingsHubNav />)
    for (const [label, href] of VIVAS) {
      expect(screen.getByText(label).closest("a")).toHaveAttribute("href", href)
    }
  })

  it("as 4 seções migradas na rodada 7 deixaram de ser 'Em breve'", () => {
    render(<SettingsHubNav />)
    for (const label of ["Times", "Segurança & Sessão", "Auditoria", "Plano & Cobrança"]) {
      const el = screen.getByText(label)
      expect(el.closest("a")).not.toBeNull()
      expect(el.closest('[aria-disabled="true"]')).toBeNull()
    }
  })

  it("os 7 itens ainda não construídos continuam SEM link (nunca link morto)", () => {
    render(<SettingsHubNav />)
    for (const label of EM_BREVE) {
      const el = screen.getByText(label)
      expect(el.closest("a")).toBeNull()
      expect(el.closest('[aria-disabled="true"]')).not.toBeNull()
    }
  })
})

// =============================================================================
// CFG-4.1 (AC1) — o selo de PLANO é uma terceira semântica, não um quarto estado
// de disponibilidade. "Em breve" = não existe ainda e não clica; "PRO" = existe,
// CLICA, e a sub-rota vai explicar que o plano não cobre. Se alguém um dia
// transformar o item em `HubItemSoon` para "resolver" o gate de plano, o segundo
// teste daqui fica vermelho — é justamente o erro que a story proíbe.
// =============================================================================

describe("SettingsHubNav — selo PRO de plano em Marca & Aparência", () => {
  it("com whitelabel habilitado, nenhum selo PRO aparece", () => {
    render(<SettingsHubNav whitelabelEnabled={true} />)
    expect(screen.queryByText("PRO")).toBeNull()
  })

  it("sem whitelabel no plano, o item ganha o selo PRO e CONTINUA clicável", () => {
    render(<SettingsHubNav whitelabelEnabled={false} />)

    const pill = screen.getByText("PRO")
    const link = screen.getByText("Marca & Aparência").closest("a")

    expect(link).toHaveAttribute("href", "/admin/configuracoes/marca")
    expect(pill.closest("a")).toBe(link)
    expect(pill.closest('[aria-disabled="true"]')).toBeNull()
  })

  it("o selo PRO não altera a contagem de vivas/em cinza do hub", () => {
    const { container } = render(<SettingsHubNav whitelabelEnabled={false} />)
    expect(container.querySelectorAll("a[href]")).toHaveLength(9)
    expect(container.querySelectorAll('[aria-disabled="true"]')).toHaveLength(7)
    expect(screen.getAllByText("Em breve")).toHaveLength(7)
  })

  it("sem a prop (default), o hub não inventa bloqueio de plano", () => {
    render(<SettingsHubNav />)
    expect(screen.queryByText("PRO")).toBeNull()
  })
})
