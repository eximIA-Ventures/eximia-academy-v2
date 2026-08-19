// ---------------------------------------------------------------------------
// A LEITURA ASSISTIDA CHEGA AO GESTOR COM O DADO ESCASSO — ou não existe.
// ---------------------------------------------------------------------------
// O defeito que este arquivo tranca: a leitura assistida era o `leituraAssistida`
// de UM destino (§16, "Ver todas as mudanças"), e o CTA daquele destino só
// aparecia quando o CARD tinha itens. Com o dado real do tenant o card sai VAZIO
// — nenhuma das quatro dimensões passou no corte de relevância — e o CTA some
// junto, levando a IA embora. O código existia, a suíte passava, e a peça não
// chegava à tela.
//
// A CORREÇÃO NÃO É "renderizar o CTA sempre". Isso seria prometer detalhamento
// sobre o nada, que é o oposto da §32. O portão passa a olhar para o DESTINO:
// o CTA aparece quando há o que mostrar atrás da porta (linhas ou uma leitura
// assistida), e some quando não há. Card vazio e gaveta cheia deixam de ser a
// mesma coisa — porque nunca foram.
//
// POR QUE O TESTE É DE COMPONENTE E NÃO DE CAMADA: a camada sempre teve o objeto
// (`detalhes.mudancas.leituraAssistida` já existia e já era coberto). O que
// faltava era o caminho até o dedo do gestor, e esse caminho só existe no JSX.
// Um teste de camada aqui passaria antes e depois da correção — mediria o lado
// errado do defeito.
//
// CONTROLE POSITIVO em dois eixos, e os dois são obrigatórios:
//   1. a fixture REPRODUZ o dado escasso (o bloco sai `vazio`) — senão o teste
//      ficaria verde sobre um mundo denso, onde o CTA sempre existiu;
//   2. sem base para leitura alguma, nem CTA nem leitura assistida — senão
//      "aparece" seria satisfeito por um botão incondicional.
// ---------------------------------------------------------------------------

import { PadroesTendenciasTab } from "@/components/analytics/padroes-tendencias/padroes-tendencias-tab"
import { computePadroesTendencias } from "@/lib/analytics/padroes-tendencias"
import { capitulo, cenario } from "@/lib/analytics/padroes-tendencias/__tests__/cenario"
import type { EntradaVisaoGeral } from "@/lib/analytics/padroes-tendencias/entrada"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

const ROTULO_MUDANCAS = "Ver todas as mudanças"
const ROTULO_SINAIS = "Ver todos os sinais"
const GATILHO_IA = "Resumir em linguagem de gestor"
const TITULO_LEITURA = "Leitura do período"

/**
 * O dado escasso do tenant, na FORMA que produziu o defeito.
 *
 * Não é uma cópia da Cory (o banco é de cliente e não entra em teste); é o mesmo
 * ESQUELETO: gente que concluiu, gente que nunca iniciou, um punhado de ativos
 * agora, um punhado que parou no período anterior, e nenhuma variação grande o
 * bastante para passar no corte de relevância da §16.
 *
 *   • Δ de pessoas ativas = 0  (< RELEVANCIA_ABS_PESSOAS)
 *   • ninguém regular nas duas janelas ⇒ Δ de regularidade não qualifica
 *   • um só módulo com base comparável ⇒ abaixo de MODULOS_EM_QUEDA_MIN
 *   • nenhuma retomada
 *
 * Resultado: §16 em `vazio`, e mesmo assim há MUITO o que dizer sobre o período
 * — que é exatamente a leitura que a IA redige.
 */
function cenarioEscasso(): EntradaVisaoGeral {
  return cenario({
    capitulos: [capitulo("m1", "Introdução", 1), capitulo("m2", "Padronização", 2)],
    pessoas: [
      // Ativos agora, e só agora.
      { id: "ativo-1", porCapitulo: { m1: [2, 9] } },
      { id: "ativo-2", porCapitulo: { m1: [5] } },
      // Ativos no período ANTERIOR: existe comparação, ela é que é pequena.
      { id: "parou-1", porCapitulo: { m2: [45] } },
      { id: "parou-2", porCapitulo: { m2: [50] } },
      { id: "parou-3", porCapitulo: { m2: [52] } },
      // Concluíram: contam como iniciados e ficam fora dos quatro cards.
      { id: "fim-1", sessoes: [100, 95], matricula: { status: "completed", progresso: 100 } },
      { id: "fim-2", sessoes: [102, 96], matricula: { status: "completed", progresso: 100 } },
      // Nunca iniciaram: sem sessão e sem progresso.
      { id: "zero-1", matricula: { progresso: 0 } },
      { id: "zero-2", matricula: { progresso: 0 } },
      { id: "zero-3", matricula: { progresso: 0 } },
    ],
  })
}

describe("Padrões · a leitura assistida alcança o gestor com dado escasso", () => {
  it("CONTROLE POSITIVO — a fixture reproduz o defeito: o bloco §16 sai VAZIO", () => {
    const dados = computePadroesTendencias(cenarioEscasso())
    expect(dados.mudancas.estado, "fixture densa não prova nada aqui").toBe("vazio")
    expect(dados.mudancas.itens).toHaveLength(0)
    // E há base de sobra para uma leitura: gente que iniciou, e período anterior.
    expect(dados.contexto.totalRecorte).toBeGreaterThan(0)
  })

  it("a camada continua produzindo a leitura assistida neste cenário", () => {
    const destino = computePadroesTendencias(cenarioEscasso()).detalhes.mudancas
    expect(destino?.tipo).toBe("tabela")
    if (destino?.tipo !== "tabela") throw new Error("destino de mudanças não é tabela")
    expect(destino.leituraAssistida, "sem isto não há IA a alcançar").toBeDefined()
    expect(destino.leituraAssistida?.leituraDeterministica.length).toBeGreaterThan(0)
  })

  it("REGRESSÃO — o CTA que abre a leitura assistida ESTÁ na tela", () => {
    render(<PadroesTendenciasTab dados={computePadroesTendencias(cenarioEscasso())} />)
    expect(screen.getByRole("button", { name: new RegExp(ROTULO_MUDANCAS) })).toBeTruthy()
  })

  it("REGRESSÃO — e clicar nele traz a leitura assistida, com a régua da regra ao lado", () => {
    const dados = computePadroesTendencias(cenarioEscasso())
    render(<PadroesTendenciasTab dados={dados} />)

    fireEvent.click(screen.getByRole("button", { name: new RegExp(ROTULO_MUDANCAS) }))

    // A leitura das REGRAS aparece sempre — a IA entra ao lado, nunca no lugar.
    expect(screen.getByText(TITULO_LEITURA)).toBeTruthy()
    const destino = dados.detalhes.mudancas
    if (destino?.tipo !== "tabela" || !destino.leituraAssistida) {
      throw new Error("destino sem leitura assistida")
    }
    expect(screen.getByText(destino.leituraAssistida.leituraDeterministica)).toBeTruthy()
    // E o botão que pede a redação ao modelo — a IA alcançável de fato.
    expect(screen.getByRole("button", { name: GATILHO_IA })).toBeTruthy()
  })

  it("REGRESSÃO — a evidência dos sinais também deixa de ficar inalcançável", () => {
    const dados = computePadroesTendencias(cenarioEscasso())
    // Guarda: o bloco de sinais está vazio (era o que sumia com o CTA)...
    expect(dados.sinais.estado).toBe("vazio")
    // ...e o destino dele TEM conteúdo: a série por módulo, semana a semana.
    const destino = dados.detalhes.sinais
    if (destino?.tipo !== "tabela") throw new Error("destino de sinais não é tabela")
    expect(destino.linhas.length, "sem linhas o CTA deve mesmo sumir").toBeGreaterThan(0)

    render(<PadroesTendenciasTab dados={dados} />)
    expect(screen.getByRole("button", { name: new RegExp(ROTULO_SINAIS) })).toBeTruthy()
  })

  it("CONTROLE NEGATIVO — sem base, não há leitura assistida NEM CTA", () => {
    // Recorte sem ninguém: um parágrafo sobre "0 pessoas ativas" seria análise
    // prometida sobre o nada. A §32 proíbe, e o portão do CTA obedece.
    const dados = computePadroesTendencias(cenario({ pessoas: [] }))
    expect(dados.mudancas.estado).toBe("vazio")

    const destino = dados.detalhes.mudancas
    if (destino?.tipo !== "tabela") throw new Error("destino de mudanças não é tabela")
    expect(
      destino.leituraAssistida,
      "leitura sobre recorte vazio é promessa sem base",
    ).toBeUndefined()
    expect(destino.linhas).toHaveLength(0)

    render(<PadroesTendenciasTab dados={dados} />)
    expect(screen.queryByRole("button", { name: new RegExp(ROTULO_MUDANCAS) })).toBeNull()
    expect(screen.queryByRole("button", { name: GATILHO_IA })).toBeNull()
  })

  it("CONTROLE NEGATIVO — falha de leitura NÃO ganha CTA, mesmo com destino cheio", () => {
    // `erro` é fato sobre o SISTEMA, não sobre a equipe. Abrir a gaveta em cima
    // de uma base montada a partir de leitura falha é servir número sem lastro.
    const dados = computePadroesTendencias(cenarioEscasso())
    const comFalha = {
      ...dados,
      mudancas: {
        ...dados.mudancas,
        estado: "erro" as const,
        erro: { codigo: "PGRST", mensagem: "falha simulada" },
        textoVazio: null,
      },
    }
    render(<PadroesTendenciasTab dados={comFalha} />)
    expect(screen.queryByRole("button", { name: new RegExp(ROTULO_MUDANCAS) })).toBeNull()
  })
})
