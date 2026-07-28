import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { WorkspaceSwitchSidebarItem } from "../workspace-switch-sidebar-item"

// =============================================================================
// O CONTROLE ÚNICO de troca de workspace (rodada 7).
//
// Existiam DOIS controles fazendo a mesma coisa: a pílula no topo
// (`WorkspaceSwitchButton`, agora DELETADA) e o item no rodapé da barra. O dono
// ficou com o da barra, e este componente é o item — o MESMO nos três shells
// (Padrão, Estúdio, Administração). Se alguém reintroduzir uma segunda porta
// com rótulo próprio, este teste não pega; o que ele guarda é o contrato do
// item: rótulo, destino e o gate de multi-access.
// =============================================================================

describe("WorkspaceSwitchSidebarItem — a porta única entre os mundos", () => {
  it("multi-access vê o item, com o rótulo e o destino canônicos", () => {
    render(<WorkspaceSwitchSidebarItem canSwitch />)
    const link = screen.getByText("Trocar de workspace").closest("a")
    expect(link).toHaveAttribute("href", "/workspace")
  })

  it("single-access NÃO vê porta nenhuma (aluno puro, instrutor puro)", () => {
    const { container } = render(<WorkspaceSwitchSidebarItem canSwitch={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("o default é fechado — sem a prop, nada renderiza", () => {
    const { container } = render(<WorkspaceSwitchSidebarItem />)
    expect(container).toBeEmptyDOMElement()
  })

  it("fecha o drawer mobile ao navegar, quando o shell passa o callback", () => {
    const onNavigate = vi.fn()
    render(<WorkspaceSwitchSidebarItem canSwitch onNavigate={onNavigate} />)
    const link = screen.getByText("Trocar de workspace").closest("a")
    // `preventDefault` só para o jsdom não tentar navegar de verdade; o handler
    // do React roda igual.
    link?.addEventListener("click", (e) => e.preventDefault())
    link?.click()
    expect(onNavigate).toHaveBeenCalledTimes(1)
  })
})
