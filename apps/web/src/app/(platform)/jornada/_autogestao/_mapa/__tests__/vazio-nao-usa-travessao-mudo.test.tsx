// ---------------------------------------------------------------------------
// D8 (LOOP-3 §8) — o travessão nu da Tela 3, e por que ele é um defeito.
// ---------------------------------------------------------------------------
// A auditoria de 28/08 mediu 4 ocorrências de um SEGUNDO idioma para "não
// tenho esse dado" convivendo com o idioma correto desta tela:
//
//   correto  →  "Falta prova." + o motivo em português (`FaltaProva`)
//   errado   →  "—", nu, que não diz por quê
//
// O travessão aparecia em "Tempo estimado", em "Iniciado em" e em duas linhas
// do histórico. Ele NÃO é um valor: é a ausência de um, disfarçada de valor —
// e é exatamente contra isso que o `CONTRATO-DE-DADOS.md` escreve "nunca um
// número inventado, nunca '0', nunca travessão mudo".
//
// A régua não é ambígua sobre o idioma vencedor: F-M-09 e o comportamento
// medido nas outras duas telas ("Falta prova." com o motivo ao lado) já são o
// padrão da casa. Aqui ele passa a valer também na Tela 3.
//
// LIMITE HONESTO DESTA CORREÇÃO, registrado para não virar dívida invisível:
// na linha de histórico de um módulo CONCLUÍDO, o "—" nasce em `montagem.ts`
// (`status === "concluido" ? "—" : …`), que descarta uma data que o banco TEM
// (`last_viewed_at`). A camada de apresentação só consegue dizer POR QUE não
// há número; quem pode devolver o número é a camada de dados. Reportado em
// `FIX-D-telas.md` (D8).
// ---------------------------------------------------------------------------

import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { MapaJornadaAutogestaoTab } from "../mapa-jornada-tab"
import { blocoModuloAtual, mapaCompleto } from "./fixture"

afterEach(cleanup)

/** A `<section>` cujo `<h2>` é exatamente este título de card. */
function secaoDoCard(titulo: string): HTMLElement {
  const heading = screen.getByRole("heading", { level: 2, name: titulo })
  const secao = heading.closest("section")
  if (!secao) throw new Error(`nenhuma <section> encontrada para o card "${titulo}"`)
  return secao
}

describe("D8 — o vazio da Tela 3 fala; não usa travessão mudo", () => {
  it("'Tempo estimado' sem estimativa: diz 'Falta prova.' com o motivo, não '—'", () => {
    render(
      <MapaJornadaAutogestaoTab
        dados={mapaCompleto({
          moduloAtual: blocoModuloAtual({
            estimativaRotulo: null,
            estimativaRestanteMinutos: null,
          }),
        })}
      />,
    )
    const card = secaoDoCard("Onde estou agora")
    expect(within(card).getByText(/Falta prova\./)).toBeInTheDocument()
    expect(within(card).getByText(/duração média/i)).toBeInTheDocument()
  })

  it("'Iniciado em' sem data: diz 'Falta prova.' com o motivo, não '—'", () => {
    render(
      <MapaJornadaAutogestaoTab
        dados={mapaCompleto({
          moduloAtual: blocoModuloAtual({ iniciadoEmRotulo: "", iniciadoEmISO: "" }),
        })}
      />,
    )
    const card = secaoDoCard("Onde estou agora")
    expect(within(card).getByText(/data de início/i)).toBeInTheDocument()
  })

  it("'Última atividade' sem registro: diz 'Falta prova.' com o motivo, não '—'", () => {
    render(
      <MapaJornadaAutogestaoTab
        dados={mapaCompleto({
          moduloAtual: blocoModuloAtual({ ultimaAtividadeLabel: "—" }),
        })}
      />,
    )
    const card = secaoDoCard("Onde estou agora")
    expect(within(card).getByText(/visualização registrada/i)).toBeInTheDocument()
  })

  it("no histórico, as linhas concluídas dizem POR QUE não há última atividade", () => {
    // A fixture já traz duas linhas concluídas com `ultimaAtividadeLabel: "—"`
    // — são exatamente as 2 ocorrências que a auditoria mediu na tela real.
    render(<MapaJornadaAutogestaoTab dados={mapaCompleto()} />)
    const tabela = screen.getByTestId("historico-tabela")
    expect(within(tabela).getAllByText(/módulo concluído/i).length).toBe(2)
  })

  it("VARREDURA — nenhum travessão nu sobra em toda a Tela 3", () => {
    // O par que impede a correção pontual de deixar um caso para trás: a
    // asserção é sobre a TELA, não sobre o campo que eu lembrei de corrigir.
    // Uma célula/valor cujo texto seja EXATAMENTE "—" reprova.
    const { container } = render(
      <MapaJornadaAutogestaoTab
        dados={mapaCompleto({
          moduloAtual: blocoModuloAtual({
            iniciadoEmRotulo: "",
            ultimaAtividadeLabel: "—",
            estimativaRotulo: null,
          }),
        })}
      />,
    )
    const mudos = Array.from(container.querySelectorAll("span, td, p")).filter(
      (el) => el.textContent?.trim() === "—",
    )
    expect(mudos).toHaveLength(0)
  })

  it("PAR DE CONTROLE — quando o dado existe, ele aparece como valor, sem 'Falta prova.'", () => {
    render(<MapaJornadaAutogestaoTab dados={mapaCompleto()} />)
    const card = secaoDoCard("Onde estou agora")
    expect(within(card).getByText("02/08/2026")).toBeInTheDocument()
    expect(within(card).getByText("~1h 20min")).toBeInTheDocument()
    expect(within(card).getByText("3 dias atrás")).toBeInTheDocument()
    expect(within(card).queryByText(/Falta prova\./)).not.toBeInTheDocument()
  })
})
