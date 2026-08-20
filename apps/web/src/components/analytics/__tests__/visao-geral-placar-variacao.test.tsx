import { VISAO_GERAL_COMPLETA } from "@/components/analytics/visao-geral/fixture"
import { VisaoGeralTab } from "@/components/analytics/visao-geral/visao-geral-tab"
import type { MetricaPlacar, VisaoGeralDados } from "@/lib/analytics/visao-geral/tipos"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

/**
 * Placar da jornada — como a tela desenha uma variação que NÃO tem direção.
 *
 * DEFEITOS QUE ESTE ARQUIVO TRANCA (dono do produto, 2026-08-16):
 *   • "Regularidade 0% ↓ 0 pp" e "Sem acesso 20% ↓ 0 pp" — variação exatamente
 *     zero desenhada com seta de queda e em vermelho. Zero não tem direção, e
 *     pintar zero de vermelho comunica uma piora que não aconteceu. A camada de
 *     dados já devolvia `deltaDirecao: null` e `deltaTom: null`; quem inventava
 *     a piora eram dois ternários binários no componente, que colapsavam `null`
 *     no ramo negativo.
 *   • "No ritmo 50% · sem comparação" sem dizer POR QUÊ. O motivo é conhecido
 *     (`deltaAusenteMotivo`) e morria na camada de dados.
 *
 * A fixture não cobre nenhum dos dois casos — os 5 indicadores dela têm delta
 * não-nulo — então os cenários são construídos aqui, ADAPTANDO a fixture, que é
 * o que a rota de preview continua renderizando intacta.
 */

const FLECHA_LUCIDE = ".lucide-arrow-down, .lucide-arrow-up"

/** A fixture com UMA métrica trocada, tudo o mais idêntico. */
function comMetrica(patch: Partial<MetricaPlacar>, id = "regularidade"): VisaoGeralDados {
  const base = VISAO_GERAL_COMPLETA as unknown as VisaoGeralDados
  return {
    ...base,
    placar: {
      ...base.placar,
      metricas: base.placar.metricas.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    },
  }
}

/**
 * O tile inteiro que contém aquele rótulo.
 *
 * A âncora é `data-tile`, não a classe de padding. A versão anterior procurava
 * `div[class*="px-[9px]"]` e quebrou em 2026-08-17, quando o tile cedeu 2px de
 * folga para caber o denominador de "Regularidade" e "Sem acesso": um teste que
 * mede COMPORTAMENTO (seta, cor, motivo) reprovava por causa de um número de
 * espaçamento, que é o pior tipo de falso vermelho — barulhento e sem relação
 * com o que ele existe para proteger.
 */
function tileDe(rotulo: string): HTMLElement {
  const alvo = screen.getAllByText(rotulo)[0]
  // A RAIZ do tile (o bloco tonal), não a coluna de texto dentro dele: a faixa
  // de variação é irmã dessa coluna, e é ela que este arquivo mede.
  const tile = alvo.closest("div[data-tile]")
  if (!tile) throw new Error(`tile de "${rotulo}" não encontrado`)
  return tile as HTMLElement
}

describe("Placar · variação sem direção", () => {
  it("CONTROLE — variação NÃO-zero continua com seta e com a cor semântica", () => {
    render(<VisaoGeralTab data={VISAO_GERAL_COMPLETA as unknown as VisaoGeralDados} />)

    // "Sem acesso" é a métrica INVERTIDA (subir é ruim): a fixture a traz com
    // ↑ 3 pp e tom "negativo". Se este controle não passasse, o teste seguinte
    // estaria medindo uma tela que perdeu a seta em TODO caso.
    const tile = tileDe("Sem acesso")
    expect(tile.querySelectorAll(FLECHA_LUCIDE).length).toBe(1)
    expect(tile.querySelector(".lucide-arrow-up")).not.toBeNull()
    expect(tile.textContent).toContain("3 pp")
  })

  it("variação exatamente zero: sem seta e em tom neutro", () => {
    // É o que `placar.ts` produz com `delta === 0`: rótulo "0 pp", direção e
    // tom nulos.
    render(
      <VisaoGeralTab
        data={comMetrica({
          deltaPp: 0,
          deltaDirecao: null,
          deltaTom: null,
          deltaLabel: "0 pp",
        })}
      />,
    )

    const tile = tileDe("Regularidade")
    expect(tile.textContent).toContain("0 pp")
    expect(tile.querySelectorAll(FLECHA_LUCIDE).length).toBe(0)

    // A ÂNCORA É `data-variacao-tile`, e não "o primeiro span cujo texto é 0 pp".
    //
    // REGRESSÃO MEDIDA (2026-08-20): a faixa ganhou um invólucro de layout
    // (`LinhaVariacao`, que passou a carregar o recuo de 51px como espaçador
    // FLEXÍVEL em vez de `ml-[51px]`). O invólucro tem o MESMO `textContent` do
    // filho — o espaçador irmão contribui com "" — e vem ANTES dele na ordem do
    // documento, então `find` passou a devolver o de fora, que não carrega cor
    // nenhuma. `style.color` vinha `""` e a asserção abaixo reprovava com
    // "cor inesperada: ", medindo o nada.
    //
    // O PRODUTO ESTAVA CERTO o tempo todo: a cor neutra continua aplicada ao
    // elemento visível (`rgb(111,111,110)`). É a MESMA classe de falso vermelho
    // que este arquivo já sofreu com `div[class*="px-[9px]"]`, e a cura é a
    // mesma: ancorar no atributo estável que o componente publica para teste.
    const faixa = tile.querySelector("[data-variacao-tile]")
    expect(faixa).not.toBeNull()
    // O elemento que carrega a COR tem que ser o mesmo que carrega o TEXTO. Sem
    // isto a âncora poderia apontar para um invólucro vazio e a asserção de cor
    // voltaria a medir o nada, só que em silêncio.
    expect(faixa?.textContent).toBe("0 pp")
    // Vermelho de alarme é rgb(197, 48, 48)-ish em `VARIACAO.negativo`; o tom
    // neutro é o cinza `TEXTO.mudo`. A asserção é sobre a AUSÊNCIA do alarme:
    // qualquer cinza serve, o vermelho não.
    const cor = (faixa as HTMLElement).style.color.replace(/\s/g, "")
    const canais = cor.match(/\d+/g)?.map(Number) ?? []
    expect(canais.length, `cor inesperada: ${cor}`).toBe(3)
    const [r, g, b] = canais as [number, number, number]
    expect(Math.max(r, g, b) - Math.min(r, g, b), `cor saturada: ${cor}`).toBeLessThan(24)
  })

  it("sem comparação: o motivo fica acessível no próprio cartão", () => {
    render(
      <VisaoGeralTab
        data={comMetrica(
          {
            deltaPp: null,
            deltaDirecao: null,
            deltaTom: null,
            deltaLabel: null,
            deltaAusenteMotivo: "sem-historico-comparavel",
          },
          "no-ritmo",
        )}
      />,
    )

    const marca = screen.getByText("sem comparação")
    const motivo = marca.getAttribute("title") ?? ""
    expect(motivo.length).toBeGreaterThan(20)
    // O motivo REAL, não um genérico: é o campo mutável sem histórico.
    expect(motivo).toMatch(/hist[óo]rico/i)
  })
})
