// ---------------------------------------------------------------------------
// O gate de escrita é UM só — e desligado por padrão.
// ---------------------------------------------------------------------------
// DEFEITO QUE ESTE TESTE TRANCA: existiam DUAS leituras do mesmo gate. O painel
// (`_visao-geral/painel.tsx`) aceitava dois nomes de variável; a camada de dados
// (`acoesEstaoAtivas()`) aceitava um. Ligar apenas `NEXT_PUBLIC_ACIONAMENTO_ATIVO`
// fazia a TELA DISPARAR enquanto o teste `f-44` continuava verde afirmando que o
// gate estava desligado.
//
// Um teste que afirma "não escreve" enquanto o sistema escreve em banco de
// cliente pagante é pior que teste nenhum: ele compra confiança que não tem
// lastro. Daí a asserção de EQUIVALÊNCIA abaixo — não basta o gate funcionar,
// ele precisa dar o MESMO veredito pelos dois nomes, que é a propriedade que a
// versão com duas leituras não tinha.
// ---------------------------------------------------------------------------

import { afterEach, describe, expect, it, vi } from "vitest"
import { acoesEstaoAtivas } from "../index"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("o gate de acionamento", () => {
  it("é DESLIGADO quando nenhum dos nomes está no ambiente", () => {
    vi.stubEnv("NEXT_PUBLIC_ACIONAMENTO_ATIVO", "")
    vi.stubEnv("NEXT_PUBLIC_VISAO_GERAL_ACOES_ATIVAS", "")
    expect(acoesEstaoAtivas()).toBe(false)
  })

  it("EQUIVALÊNCIA — o nome do briefing liga o gate, igual ao outro", () => {
    // Este é o caso exato que ficava mudo antes: o painel disparava, a camada
    // de dados dizia que não.
    vi.stubEnv("NEXT_PUBLIC_ACIONAMENTO_ATIVO", "true")
    vi.stubEnv("NEXT_PUBLIC_VISAO_GERAL_ACOES_ATIVAS", "")
    expect(acoesEstaoAtivas()).toBe(true)
  })

  it("EQUIVALÊNCIA — o nome da camada de dados liga o gate, igual ao outro", () => {
    vi.stubEnv("NEXT_PUBLIC_ACIONAMENTO_ATIVO", "")
    vi.stubEnv("NEXT_PUBLIC_VISAO_GERAL_ACOES_ATIVAS", "true")
    expect(acoesEstaoAtivas()).toBe(true)
  })

  it("FAIL-CLOSED — qualquer coisa que não seja a string exata `true` deixa desligado", () => {
    for (const valor of ["1", "TRUE", "True", "sim", "yes", "on", " true"]) {
      vi.stubEnv("NEXT_PUBLIC_ACIONAMENTO_ATIVO", valor)
      vi.stubEnv("NEXT_PUBLIC_VISAO_GERAL_ACOES_ATIVAS", valor)
      expect(acoesEstaoAtivas(), `"${valor}" não pode ligar escrita em produção`).toBe(false)
    }
  })

  it("o ambiente REAL deste repositório tem o gate desligado", () => {
    // Sem stub nenhum: é o `.env.local` de verdade, que aponta para PRODUÇÃO.
    // Se algum dia alguém commitar a variável ligada, este teste cai antes do
    // primeiro aluno receber uma mensagem.
    expect(acoesEstaoAtivas()).toBe(false)
  })
})
