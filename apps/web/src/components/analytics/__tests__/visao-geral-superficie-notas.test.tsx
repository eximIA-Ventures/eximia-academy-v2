import { VISAO_GERAL_COMPLETA } from "@/components/analytics/visao-geral/fixture"
import { VisaoGeralTab } from "@/components/analytics/visao-geral/visao-geral-tab"
import type { VisaoGeralDados } from "@/lib/analytics/visao-geral/tipos"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

/**
 * As duas notas de superfície CHEGAM À TELA — e só quando têm o que dizer.
 *
 * POR QUE ESTE ARQUIVO EXISTE, e por que ele não é redundante com o teste da
 * camada de dados: `superficie-estados-e-reguas.test.ts` prova que os textos são
 * CALCULADOS. Isso é metade da afirmação. A outra metade é que eles são
 * RENDERIZADOS, e ela não dá para provar na rota de preview: o harness
 * `/gauntlet-preview/visao-geral` desenha a FIXTURE, que é a rubrica do gauntlet
 * e não traz nenhum dos dois campos novos. Uma nota calculada que morre no
 * caminho até o JSX é exatamente o defeito que estas correções combatem — o
 * número certo existindo em algum lugar que o gestor não vê.
 *
 * Os cenários ADAPTAM a fixture (mesmo padrão de `visao-geral-placar-variacao`),
 * então a rota de preview continua renderizando o objeto original, intacto.
 *
 * CONTROLE NEGATIVO em cada bloco: sem ele, um componente que imprimisse a nota
 * incondicionalmente (ou um texto fixo) passaria nos dois testes positivos.
 */

const NOTA_PLACAR =
  "Regularidade: 2 dias distintos na mesma semana, na maioria das semanas. No ritmo e Sem acesso são a situação de hoje, não do período."
const NOTA_ATENCAO = "Os 4 segmentos somam 2 de 6 pessoas. Fora deles: 4 concluíram."

const base = VISAO_GERAL_COMPLETA as unknown as VisaoGeralDados

function comNotaDoPlacar(nota: string | null): VisaoGeralDados {
  return { ...base, placar: { ...base.placar, notaRodape: nota } }
}

function comNotaDaAtencao(nota: string | null): VisaoGeralDados {
  return { ...base, atencao: { ...base.atencao, notaCobertura: nota } }
}

describe("Visão geral · as notas de superfície são renderizadas", () => {
  it("a régua do Placar aparece como TEXTO, não como tooltip (I-2)", () => {
    render(<VisaoGeralTab data={comNotaDoPlacar(NOTA_PLACAR)} />)

    const marca = screen.getByText(NOTA_PLACAR)
    // O texto está no DOM como conteúdo do elemento, não escondido num atributo:
    // régua que só existe no hover é régua que ninguém encontra.
    expect(marca.textContent).toBe(NOTA_PLACAR)
    expect(marca.tagName.toLowerCase()).toBe("span")
  })

  it("CONTROLE — sem régua calculada, o Placar não inventa uma", () => {
    const { container } = render(<VisaoGeralTab data={comNotaDoPlacar(null)} />)

    expect(screen.queryByText(NOTA_PLACAR)).toBeNull()
    expect(container.textContent ?? "").not.toContain("dias distintos")
  })

  it("a nota de cobertura dos segmentos aparece como TEXTO", () => {
    render(<VisaoGeralTab data={comNotaDaAtencao(NOTA_ATENCAO)} />)

    const marca = screen.getByText(NOTA_ATENCAO)
    expect(marca.textContent).toBe(NOTA_ATENCAO)
  })

  it("CONTROLE — com a soma fechada (nota nula) o card não diz nada sobre cobertura", () => {
    const { container } = render(<VisaoGeralTab data={comNotaDaAtencao(null)} />)

    expect(screen.queryByText(NOTA_ATENCAO)).toBeNull()
    expect(container.textContent ?? "").not.toContain("Fora deles")
  })

  it("CONTROLE — a fixture original (sem os campos) renderiza sem nenhuma das duas", () => {
    // Prova de que a rota de preview, que desenha exatamente este objeto, não
    // mudou de conteúdo: os campos são aditivos e opcionais.
    const { container } = render(<VisaoGeralTab data={base} />)
    const texto = container.textContent ?? ""

    expect(texto).not.toContain("dias distintos")
    expect(texto).not.toContain("Fora deles")
  })
})
