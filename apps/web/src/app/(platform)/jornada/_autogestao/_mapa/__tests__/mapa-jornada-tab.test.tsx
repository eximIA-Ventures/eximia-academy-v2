// ---------------------------------------------------------------------------
// "Meu Mapa da Jornada" (autogestão) — um teste por regra inegociável do
// briefing, mais as duas ramificações do marco (3.6) e a supressão de 3.7/3.8.
// ---------------------------------------------------------------------------
import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

/** A seção (`<section>`) cujo `<h2>` é exatamente este título de card. */
function secaoDoCard(titulo: string): HTMLElement {
  const heading = screen.getByRole("heading", { level: 2, name: titulo })
  const secao = heading.closest("section")
  if (!secao) throw new Error(`nenhuma <section> encontrada para o card "${titulo}"`)
  return secao
}
import { MapaJornadaAutogestaoTab } from "../mapa-jornada-tab"
import {
  blocoHistoricoComCinco,
  blocoPerdaDeRitmoSuprimido,
  blocoProximoMarcoSemLastro,
  mapaCompleto,
  moduloTrilha,
} from "./fixture"

afterEach(cleanup)

describe("§22 — a trilha nunca usa vermelho para 'não iniciado'", () => {
  it("renderiza os 3 estados de módulo (concluído, em andamento, não iniciado)", () => {
    render(<MapaJornadaAutogestaoTab dados={mapaCompleto()} />)
    // "Concluído"/"Em andamento" aparecem tanto na trilha quanto no histórico
    // (uma linha do histórico é, de propósito, o módulo em andamento) —
    // `getAllByText` é o correto aqui, não `getByText`.
    expect(screen.getAllByText("Concluído").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Em andamento").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Não iniciado").length).toBeGreaterThan(0)
  })

  it("nenhum nó 'não iniciado' carrega classe ou cor vermelha", () => {
    const { container } = render(<MapaJornadaAutogestaoTab dados={mapaCompleto()} />)
    const nosNaoIniciados = container.querySelectorAll('[data-status-no="nao-iniciado"]')
    expect(nosNaoIniciados.length).toBeGreaterThan(0)
    for (const no of nosNaoIniciados) {
      const el = no as HTMLElement
      // Nem classe utilitária de vermelho (Tailwind `red-*`/`rose-*`), nem cor
      // inline que seja um dos vermelhos usados em outras telas do design
      // system (`VARIACAO.negativo` #DE3B36, `TOM_ICONE.red` #F9D6D6/#D82422).
      expect(el.className).not.toMatch(/\b(red|rose)-/)
      const estilo = el.getAttribute("style") ?? ""
      expect(estilo).not.toMatch(/#DE3B36|#F9D6D6|#D82422/i)
    }
  })

  it("PAR VERMELHO (controle): um nó 'concluído' de fato usa a cor verde, não a mesma cor do não-iniciado", () => {
    const { container } = render(<MapaJornadaAutogestaoTab dados={mapaCompleto()} />)
    const concluido = container.querySelector('[data-status-no="concluido"]') as HTMLElement | null
    const naoIniciado = container.querySelector(
      '[data-status-no="nao-iniciado"]',
    ) as HTMLElement | null
    expect(concluido).not.toBeNull()
    expect(naoIniciado).not.toBeNull()
    expect(concluido?.getAttribute("style")).not.toBe(naoIniciado?.getAttribute("style"))
  })
})

describe("§24 / 3.6 — Meu próximo marco: as duas ramificações do plano", () => {
  it("plano com duração real → renderiza a DATA", () => {
    render(<MapaJornadaAutogestaoTab dados={mapaCompleto()} />)
    expect(screen.getByText(/até 21\/08\/2026/)).toBeInTheDocument()
    expect(screen.queryByText(/Falta prova/)).not.toBeInTheDocument()
  })

  it("plano com `days: 0` → renderiza 'Falta prova', NUNCA uma data inventada", () => {
    render(
      <MapaJornadaAutogestaoTab
        dados={mapaCompleto({ proximoMarco: blocoProximoMarcoSemLastro() })}
      />,
    )
    const marco = secaoDoCard("Meu próximo marco")
    expect(within(marco).getByText(/Falta prova/)).toBeInTheDocument()
    // Nenhum padrão de data (dd/mm/aaaa) deve aparecer DENTRO do card do
    // marco — escopado à seção, porque "Onde estou agora" legitimamente
    // mostra uma data ("Iniciado em") no mesmo documento.
    expect(within(marco).queryByText(/\d{2}\/\d{2}\/\d{4}/)).not.toBeInTheDocument()
  })
})

describe("§25 / 3.7-3.8 — Onde costumo perder ritmo? é suprimido sem histórico suficiente", () => {
  it("com 2+ ocorrências, o bloco aparece com a média de pausa", () => {
    render(<MapaJornadaAutogestaoTab dados={mapaCompleto()} />)
    expect(screen.getByText(/perdeu ritmo ao iniciar módulos novos/)).toBeInTheDocument()
    expect(screen.getByText(/Média de pausa nesses momentos: 9 dias/)).toBeInTheDocument()
  })

  it("com 1 só ocorrência (estado 'vazio'), o bloco é suprimido — nenhum padrão inventado", () => {
    render(
      <MapaJornadaAutogestaoTab
        dados={mapaCompleto({ perdaDeRitmo: blocoPerdaDeRitmoSuprimido() })}
      />,
    )
    expect(screen.queryByText(/perdeu ritmo ao iniciar módulos novos/)).not.toBeInTheDocument()
    expect(
      screen.getByText("Nenhuma interrupção relevante foi identificada neste período."),
    ).toBeInTheDocument()
  })
})

describe("§26 / 3.9 — Histórico mostra exatamente 3, mesmo com mais módulos iniciados", () => {
  it("5 módulos iniciados na fonte → a tabela renderiza exatamente 3 linhas", () => {
    render(
      <MapaJornadaAutogestaoTab dados={mapaCompleto({ historico: blocoHistoricoComCinco() })} />,
    )
    const tabela = screen.getByTestId("historico-tabela")
    const linhas = within(tabela).getAllByRole("row")
    // 1 linha de cabeçalho + 3 de dados.
    expect(linhas).toHaveLength(4)
  })

  it("o histórico é histórico, não ranking — não exibe numeral de posição/mérito", () => {
    render(
      <MapaJornadaAutogestaoTab dados={mapaCompleto({ historico: blocoHistoricoComCinco() })} />,
    )
    const tabela = screen.getByTestId("historico-tabela")
    // Nenhuma célula de dado começa com "1º"/"2º"/"#1" — só título, progresso,
    // atividade e status.
    expect(within(tabela).queryByText(/^#?\d+[ºo]?\s*$/)).not.toBeInTheDocument()
  })
})

describe("Estados de bloco (ok/vazio/erro) — nunca zero renderizado como fato", () => {
  it("trilha em erro não mostra a matriz de nós, mostra a mensagem de falha", () => {
    render(
      <MapaJornadaAutogestaoTab
        dados={mapaCompleto({
          trilha: {
            estado: "erro",
            erro: { codigo: "PGRST301", mensagem: "JWT expired" },
            textoVazio: null,
            motivoVazio: null,
            modulos: [],
          },
        })}
      />,
    )
    const trilha = secaoDoCard("Minha jornada nos módulos")
    expect(
      within(trilha).getByText("Não foi possível carregar este bloco agora."),
    ).toBeInTheDocument()
    // Escopado à seção da trilha: "Onde estou agora" legitimamente mostra
    // "Análise de Causa" no mesmo documento, e esse bloco está `ok`.
    expect(within(trilha).queryByText("Análise de Causa")).not.toBeInTheDocument()
    expect(trilha.querySelectorAll("[data-status-no]")).toHaveLength(0)
  })

  it("jornada concluída: 'Onde estou agora' mostra o texto vazio, não um módulo inventado", () => {
    render(
      <MapaJornadaAutogestaoTab
        dados={mapaCompleto({
          moduloAtual: {
            estado: "vazio",
            erro: null,
            textoVazio: "Revisar minha evolução",
            motivoVazio: "jornada-concluida",
            conteudo: null,
          },
        })}
      />,
    )
    expect(screen.getByText("Revisar minha evolução")).toBeInTheDocument()
  })
})

describe("controle — a fábrica de fixture não fabrica módulo 'não iniciado' fantasma", () => {
  it("moduloTrilha default é 'nao-iniciado', explícito na fábrica", () => {
    expect(moduloTrilha({ ordem: 9 }).status).toBe("nao-iniciado")
  })
})
