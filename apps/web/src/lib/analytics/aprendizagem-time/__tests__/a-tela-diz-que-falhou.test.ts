// ---------------------------------------------------------------------------
// FALHA DE LEITURA CHEGA À TELA — as 3 montagens olhavam 1 de 3-4 fontes.
// ---------------------------------------------------------------------------
// DEFEITO QUE ESTE ARQUIVO TRANCA (LOOP-0c, tabela E→VAZIO #1, 2026-08-28):
// nas três montagens o veredito da tela era
//
//     const estado = falhas.capacidades ? "erro" : (blocos.every(vazio) ? "vazio" : "ok")
//
// e `falhas.avaliacoes` / `falhas.evidencias` / `falhas.alunos` / `falhas.conceitos`
// só alimentavam o campo `erro`, que as três telas não consultam — elas decidem o
// banner de página inteira por `data.estado === "erro"` e nada mais. Consequência:
// uma falha de leitura de `capability_assessments` ou `capability_evidence` fazia a
// tela dizer "amostra ainda insuficiente" em vez de "não foi possível carregar".
// É o mesmo sintoma do C-3 ("115/118 numa tela que não faz nada") por uma segunda
// porta, aberta em paralelo à que já havia sido fechada.
//
// O agravante era a TRIPLICAÇÃO: o mesmo julgamento em `montagem.ts`,
// `montagem-mapa.ts` e `montagem-padroes.ts`, três cópias — que é exatamente como
// o defeito nasceu e como sobreviveria a uma correção em só uma delas. Por isso os
// casos abaixo cobrem as TRÊS telas, e a decisão passou a viver num só lugar
// (`estado-tela.ts`).
//
// Item 3 do mesmo laudo: `blocoErro` — o construtor honesto de estado — nunca
// executava sob teste. Os casos [blocoErro] abaixo o exercitam pela primeira vez, e
// pinam que um bloco em erro NUNCA carrega texto de amostra insuficiente nem
// `motivoVazio`: são coisas diferentes e o tipo existe para não deixar confundir.
//
// CONTROLES POSITIVOS [CP]: sem falha nenhuma, "ok" continua "ok" e o vazio
// genuíno continua "vazio". Sem eles, a correção degenerada "responde erro sempre"
// passaria em tudo acima e apagaria a distinção que este arquivo defende.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest"
import { TEXTO_AMOSTRA_INSUFICIENTE } from "../estado-bloco"
import { SEM_FALHAS } from "../fonte"
import type { ChaveFonte, FalhasPorFonte } from "../fonte"
import { montarVisaoGeralAprendizagem } from "../montagem"
import { montarMapaCapacidades } from "../montagem-mapa"
import { montarPadroesEvolucao } from "../montagem-padroes"
import { CONTEXTO_DE_TELA, aluno, conceito, entradaBase } from "./contrato"

const TIMEOUT = { codigo: "57014", mensagem: "canceling statement due to statement timeout" }

function comFalhaEm(chave: ChaveFonte): FalhasPorFonte {
  return { ...SEM_FALHAS, [chave]: TIMEOUT }
}

/** A entrada completa das 3 telas — inclui roster e conceitos, que a Tela 1 não usa. */
function entradaCompleta(falhas: FalhasPorFonte = SEM_FALHAS) {
  return entradaBase({
    alunos: [aluno({ id: "aluno-1" }), aluno({ id: "aluno-2" }), aluno({ id: "aluno-3" })],
    conceitos: [conceito()],
    falhas,
  })
}

describe("Aprendizagem do Time — falha de leitura chega à tela como erro, não como vazio", () => {
  it("[CP] sem falha nenhuma, a Tela 1 é 'ok' e não carrega erro", () => {
    const tela = montarVisaoGeralAprendizagem(entradaCompleta(), CONTEXTO_DE_TELA)
    expect(tela.estado).toBe("ok")
    expect(tela.erro).toBeNull()
  })

  it("[CP] vazio genuíno (sem capacidade cadastrada) continua 'vazio', não vira erro", () => {
    const tela = montarVisaoGeralAprendizagem(
      entradaBase({ capacidades: [], avaliacoes: [], evidencias: [] }),
      CONTEXTO_DE_TELA,
    )
    expect(tela.estado).toBe("vazio")
    expect(tela.erro).toBeNull()
  })

  // --- Tela 1 (Visão Geral) -------------------------------------------------

  it("Tela 1 — falha ao ler `avaliacoes` é ERRO, não 'amostra insuficiente'", () => {
    const tela = montarVisaoGeralAprendizagem(
      entradaCompleta(comFalhaEm("avaliacoes")),
      CONTEXTO_DE_TELA,
    )
    expect(tela.estado).toBe("erro")
    expect(tela.erro).toEqual(TIMEOUT)
  })

  it("Tela 1 — falha ao ler `evidencias` é ERRO", () => {
    const tela = montarVisaoGeralAprendizagem(
      entradaCompleta(comFalhaEm("evidencias")),
      CONTEXTO_DE_TELA,
    )
    expect(tela.estado).toBe("erro")
  })

  it("[CP] Tela 1 — falha em `capacidades` continua sendo erro (não regrediu)", () => {
    const tela = montarVisaoGeralAprendizagem(
      entradaCompleta(comFalhaEm("capacidades")),
      CONTEXTO_DE_TELA,
    )
    expect(tela.estado).toBe("erro")
  })

  // --- Tela 3 (Mapa de Capacidades) ----------------------------------------

  it("Tela 3 — falha ao ler `alunos` (roster) é ERRO, não matriz vazia", () => {
    const tela = montarMapaCapacidades(entradaCompleta(comFalhaEm("alunos")), CONTEXTO_DE_TELA)
    expect(tela.estado).toBe("erro")
    expect(tela.erro).toEqual(TIMEOUT)
  })

  it("Tela 3 — falha ao ler `avaliacoes` é ERRO", () => {
    const tela = montarMapaCapacidades(entradaCompleta(comFalhaEm("avaliacoes")), CONTEXTO_DE_TELA)
    expect(tela.estado).toBe("erro")
  })

  it("[CP] Tela 3 — sem falha é 'ok'", () => {
    const tela = montarMapaCapacidades(entradaCompleta(), CONTEXTO_DE_TELA)
    expect(tela.estado).toBe("ok")
    expect(tela.erro).toBeNull()
  })

  // --- Tela 2 (Padrões e Evolução) -----------------------------------------

  it("Tela 2 — falha ao ler `conceitos` é ERRO, não 'sem módulos'", () => {
    const tela = montarPadroesEvolucao(entradaCompleta(comFalhaEm("conceitos")), CONTEXTO_DE_TELA)
    expect(tela.estado).toBe("erro")
    expect(tela.erro).toEqual(TIMEOUT)
  })

  it("Tela 2 — falha ao ler `evidencias` é ERRO", () => {
    const tela = montarPadroesEvolucao(entradaCompleta(comFalhaEm("evidencias")), CONTEXTO_DE_TELA)
    expect(tela.estado).toBe("erro")
  })

  it("[CP] Tela 2 — sem falha é 'ok'", () => {
    const tela = montarPadroesEvolucao(entradaCompleta(), CONTEXTO_DE_TELA)
    expect(tela.estado).toBe("ok")
  })

  // --- Item 3: a saída antecipada também perde o sinal de falha -------------

  /**
   * A saída antecipada ("este curso ainda não tem capacidades definidas") devolvia
   * `estado: "vazio", erro: null` mesmo com uma leitura vizinha em falha — o
   * gestor lia uma explicação de PRODUTO ("ninguém cadastrou capacidade") para uma
   * causa de INFRAESTRUTURA. As 3 telas tinham a mesma saída antecipada.
   */
  it("item 3 — curso sem capacidades E falha em `evidencias`: a falha não pode ser engolida", () => {
    const entrada = entradaBase({
      capacidades: [],
      avaliacoes: [],
      evidencias: [],
      falhas: comFalhaEm("evidencias"),
    })
    const tela = montarVisaoGeralAprendizagem(entrada, CONTEXTO_DE_TELA)
    expect(tela.erro).toEqual(TIMEOUT)
    expect(tela.estado).toBe("erro")
  })

  // --- Item 3: blocoErro exercitado pela primeira vez -----------------------

  /**
   * [blocoErro] O construtor honesto de estado nunca havia executado sob teste.
   * Um bloco em erro não é um bloco vazio: `motivoVazio`/`textoVazio` ficam nulos
   * de propósito, para que a tela não possa exibir "amostra insuficiente" sobre
   * uma falha de leitura.
   */
  it("[blocoErro] bloco em erro não carrega texto de amostra insuficiente nem motivoVazio", () => {
    const tela = montarVisaoGeralAprendizagem(
      entradaCompleta(comFalhaEm("evidencias")),
      CONTEXTO_DE_TELA,
    )
    expect(tela.placar.estado).toBe("erro")
    expect(tela.placar.erro).toEqual(TIMEOUT)
    expect(tela.placar.motivoVazio).toBeNull()
    expect(tela.placar.textoVazio).toBeNull()
    expect(tela.placar.textoVazio).not.toBe(TEXTO_AMOSTRA_INSUFICIENTE)
  })

  /**
   * [blocoErro] O outro lado: amostra genuinamente pequena continua sendo VAZIO
   * com o texto da §7. Sem este caso, "tudo vira erro" passaria no de cima.
   */
  it("[CP][blocoErro] amostra pequena SEM falha continua vazio com o texto da §7", () => {
    const entrada = entradaBase({
      evidencias: [],
      alunos: [aluno()],
    })
    const tela = montarVisaoGeralAprendizagem(entrada, CONTEXTO_DE_TELA)
    expect(tela.placar.estado).toBe("vazio")
    expect(tela.placar.erro).toBeNull()
    expect(tela.placar.textoVazio).toBe(TEXTO_AMOSTRA_INSUFICIENTE)
  })
})
