// ---------------------------------------------------------------------------
// A PORTA TRANCADA POR DENTRO — `/perfil` existia e não tinha entrada nenhuma.
// ---------------------------------------------------------------------------
// Achado da auditoria de 28/08: `grep -rn "perfil" components/layout/` voltava
// VAZIO — sidebar, rodapé e menu de conta. A rota
// `app/(platform)/perfil/page.tsx` (dados de conta: nome, e-mail, avatar,
// onboarding) só era alcançável por URL digitada ou pelo botão de voltar de um
// wizard. É a TERCEIRA ocorrência do mesmo defeito nesta safra, depois de
// `/jornada` (commit 790298e) e de Aprendizagem do Time (`c6ed19c`) — o padrão
// já tem nome nesta casa: a rota existe e o caminho até ela não.
//
// A COLISÃO QUE ESCONDIA O BURACO: o menu de conta JÁ tinha um item chamado
// "Perfil" — mas ele aponta para `/profile/learning`, que é o PERFIL DE
// APRENDIZAGEM (Big Five, DISC), outra tela. Um rótulo genérico ocupando o
// nome da tela que falta é pior que nenhum item: quem procura o próprio
// cadastro clica ali, não encontra, e conclui que a tela não existe.
//
// Este arquivo trava as duas metades: `/perfil` alcançável, e os dois destinos
// nomeados por aquilo que são.
// ---------------------------------------------------------------------------

import type { AvailableContext } from "@/lib/context-resolver"
import type { Role } from "@eximia/shared"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Header } from "../header"

vi.mock("../area-selector", () => ({ AreaSelector: () => <div>unidade</div> }))
vi.mock("../context-switcher", () => ({ ContextSwitcher: () => <div>ctx</div> }))
vi.mock("../notification-bell", () => ({ NotificationBell: () => <div>bell</div> }))
vi.mock("../theme-toggle", () => ({ ThemeToggle: () => <div>theme</div> }))
vi.mock("@/lib/actions/auth", () => ({ signOut: vi.fn() }))

afterEach(cleanup)

const personal: AvailableContext = { type: "personal", id: null, label: "Minha Trilha" }

/**
 * Monta o cabeçalho E ABRE o menu de conta — o conteúdo do dropdown só existe
 * na árvore depois do clique no avatar, que é o caminho real da pessoa.
 */
function montar() {
  const resultado = render(
    <Header
      user={{ full_name: "Rinaldo", roles: ["student"] as Role[] }}
      activeContext={personal}
      availableContexts={[personal]}
    />,
  )
  fireEvent.click(screen.getByLabelText("Menu do usuário"))
  return resultado
}

/** Os destinos de TODOS os links renderizados — lidos da árvore, nunca supostos. */
function destinos(): string[] {
  return screen
    .getAllByRole("link")
    .map((a) => a.getAttribute("href") ?? "")
    .filter(Boolean)
}

describe("menu de conta — `/perfil` é alcançável pela navegação", () => {
  it("existe um link para `/perfil`", () => {
    montar()
    expect(destinos()).toContain("/perfil")
  })

  it("o link de `/perfil` se anuncia como o cadastro da pessoa", () => {
    montar()
    const link = screen.getByRole("link", { name: /meu perfil/i })
    expect(link).toHaveAttribute("href", "/perfil")
  })

  it("o perfil de APRENDIZAGEM continua alcançável, e com nome próprio", () => {
    // Par de variância: sem isto, renomear/derrubar o item existente para
    // abrir espaço ao novo passaria despercebido — e trocaríamos uma porta
    // trancada por outra.
    montar()
    const link = screen.getByRole("link", { name: /perfil de aprendizagem/i })
    expect(link).toHaveAttribute("href", "/profile/learning")
  })

  it("nenhum item genérico chamado só 'Perfil' sobra, disputando os dois destinos", () => {
    montar()
    const genericos = screen
      .getAllByRole("link")
      .filter((a) => (a.textContent ?? "").trim().toLowerCase() === "perfil")
    expect(genericos).toHaveLength(0)
  })
})
