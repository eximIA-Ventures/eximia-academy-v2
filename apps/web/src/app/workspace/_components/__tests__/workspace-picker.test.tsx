import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { WorkspacePicker } from "../workspace-picker"

// Server actions ("use server") não rodam em jsdom — só precisamos do render.
vi.mock("@/app/(platform)/workspace/actions", () => ({
  switchWorkspace: vi.fn(async () => undefined),
}))
vi.mock("@/lib/actions/auth", () => ({
  signOut: vi.fn(async () => undefined),
}))

/** Os cartões são os únicos <button> com o CTA "Entrar" (o outro botão da
 *  página é o "Sair" do cabeçalho). A grade é o pai deles; o container de
 *  largura é o pai da grade. */
function layout() {
  const cards = screen.getAllByRole("button").filter((el) => /Entrar/.test(el.textContent ?? ""))
  const grid = cards[0]?.parentElement as HTMLElement
  const shell = grid?.parentElement as HTMLElement
  return { cards, grid, shell, titles: [...grid.querySelectorAll("h2")] }
}

describe("WorkspacePicker — grade e largura acompanham o nº de portas", () => {
  it("2 portas (aluno/gestor + instrutor): idêntico ao layout de 2 cartões", () => {
    render(<WorkspacePicker firstName="Hugo" canStandard canStudio canAdmin={false} />)

    const { cards, grid, shell } = layout()
    expect(cards).toHaveLength(2)
    // Sem 3ª coluna vazia: nada de lg:grid-cols-3 quando só há 2 cartões.
    expect(grid.className).toBe("grid gap-5 sm:grid-cols-2")
    expect(grid.className).not.toContain("lg:grid-cols-3")
    // Container original do par.
    expect(shell.className).toBe("w-full max-w-3xl")
    expect(shell.className).not.toContain("max-w-6xl")
  })

  /**
   * CORREÇÃO DE AUDITORIA (rodada 8) — O CARTÃO ÓRFÃO.
   * O trio usava `sm:grid-cols-2 lg:grid-cols-3`, o que produzia 2+1 em TODA a
   * faixa 640–1023px: "Administração" sozinho na 2ª linha, encostado à
   * esquerda, com 350px (em 768) a 500px (em 1023) de vazio à direita. Agora o
   * trio só vira fileira em `lg`; abaixo disso é coluna única, com os três
   * cartões idênticos. O container acompanha: caixa do par abaixo de `lg`,
   * 1152px a partir dele.
   */
  it("3 portas (com Administração): coluna única até lg, fileira de 3 a partir dele", () => {
    render(<WorkspacePicker firstName="Hugo" canStandard canStudio canAdmin />)

    const { cards, grid, shell } = layout()
    expect(cards).toHaveLength(3)
    expect(grid.className).toBe("grid gap-5 lg:grid-cols-3")
    // O 2+1 vinha DAQUI: duas colunas a partir de 640px com três cartões.
    expect(grid.className).not.toContain("sm:grid-cols-2")
    expect(shell.className).toBe("w-full max-w-3xl lg:max-w-6xl")
  })

  /**
   * CORREÇÃO DE AUDITORIA (rodada 8) — A RESERVA MENTIA.
   * `sm:min-h-[3.5rem]` (56px) era MENOR que as duas linhas reais do título
   * (66px = 33px de line-height x2), então o cartão de título longo empurrava
   * subtítulo e chips 10px abaixo dos vizinhos; e onde nenhum título quebrava,
   * os mesmos 56px viravam ~23px de vazio morto. A reserva passa a ser `2lh`
   * (duas vezes a line-height COMPUTADA do próprio elemento — não pode
   * divergir da fonte) e só existe a partir do breakpoint em que os cartões
   * dividem FILEIRA: `sm` no par, `lg` no trio.
   */
  it("a reserva do título é de 2 linhas REAIS e só vale onde há fileira", () => {
    const { unmount } = render(<WorkspacePicker firstName="Hugo" canStandard canStudio />)
    for (const h2 of layout().titles) {
      expect(h2.className).toContain("sm:min-h-[2lh]")
      expect(h2.className).not.toContain("min-h-[3.5rem]")
    }
    unmount()

    render(<WorkspacePicker firstName="Hugo" canStandard canStudio canAdmin />)
    for (const h2 of layout().titles) {
      expect(h2.className).toContain("lg:min-h-[2lh]")
      expect(h2.className).not.toContain("sm:min-h-")
    }
  })

  /**
   * RODADA 9 — O QUARTO CARTÃO. A regra da grade é "o nº de colunas DIVIDE o nº
   * de cartões", para nunca existir fileira parcial. Com 4 portas isso é 2+2:
   * duas fileiras cheias, cartão na MESMA largura do par já validado (~374px em
   * `max-w-3xl`). Quatro colunas espremeriam o cartão para ~273px e o título
   * "Plataforma de Aprendizagem" passaria de 2 linhas, quebrando o alinhamento
   * entre irmãos que a reserva de `2lh` garante.
   */
  it("4 portas (dono do produto): 2x2, sem fileira parcial, na caixa do par", () => {
    render(<WorkspacePicker firstName="Hugo" canStandard canStudio canAdmin canSuper />)

    const { cards, grid, shell } = layout()
    expect(cards).toHaveLength(4)
    expect(grid.className).toBe("grid gap-5 sm:grid-cols-2")
    // 3 colunas com 4 cartões seria 3+1 — o órfão que a rodada 8 matou.
    expect(grid.className).not.toContain("lg:grid-cols-3")
    expect(shell.className).toBe("w-full max-w-3xl")
    // Fileira existe a partir de `sm`, então a reserva do título vale a partir dali.
    for (const h2 of layout().titles) expect(h2.className).toContain("sm:min-h-[2lh]")
  })

  /** O invariante, escrito uma vez: nº de colunas divide o nº de cartões. */
  it("INVARIANTE: o nº de colunas divide o nº de cartões (2, 3 e 4)", () => {
    const casos = [
      { props: { canStandard: true, canStudio: true }, n: 2, cols: 2 },
      { props: { canStandard: true, canStudio: true, canAdmin: true }, n: 3, cols: 3 },
      {
        props: { canStandard: true, canStudio: true, canAdmin: true, canSuper: true },
        n: 4,
        cols: 2,
      },
    ]
    for (const c of casos) {
      const { unmount } = render(<WorkspacePicker firstName="Hugo" {...c.props} />)
      const { cards, grid } = layout()
      expect(cards).toHaveLength(c.n)
      const cols = /grid-cols-(\d)/.exec(grid.className)?.[1]
      expect(Number(cols)).toBe(c.cols)
      expect(c.n % c.cols).toBe(0)
      unmount()
    }
  })

  it("mobile preservado: 1 coluna por default nos dois casos", () => {
    const { unmount } = render(<WorkspacePicker firstName="Hugo" canStandard canStudio />)
    expect(layout().grid.className).toContain("sm:grid-cols-2")
    expect(layout().grid.className).not.toContain("grid-cols-1")
    unmount()

    // No trio a coluna única vai até lg — a grade não declara coluna antes.
    render(<WorkspacePicker firstName="Hugo" canStandard canStudio canAdmin />)
    expect(layout().grid.className).toContain("lg:grid-cols-3")
    expect(layout().grid.className).not.toContain("grid-cols-1")
  })
})
