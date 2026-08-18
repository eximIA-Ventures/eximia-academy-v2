import { describe, expect, it } from "vitest"
import { fonteDaEntrada } from "../entrada"
import type { ChaveFonte } from "../fonte"
import { ERRO_LEITURA, montarPadroesTendencias } from "../index"
import type { FalhaLeitura } from "../tipos"
import { cenarioAtivosMais3, contemDigito, serializar } from "./cenario"
import { DIR_CAMADA, DIR_COMPONENTES, DIR_PREVIEW, casam, formatar, linhasDe } from "./varredura"

/**
 * F-39 · I-4 — o erro da consulta é LIDO, não descartado.
 *
 * `supabase-js` devolve `{data, error}` em vez de lançar: o `error.tsx` do App
 * Router nunca dispara nessa classe de falha, e é assim que uma falha de banco
 * vira tela limpa apresentada como fato. O bloco afetado sai em `erro`, com o
 * texto de erro e NENHUM numeral.
 *
 * INVARIÂNCIA: injetando falha em `sessoes`, os blocos §16..§19 saem em `erro` e
 *   a serialização deles não contém dígito algum.
 * VARIÂNCIA: sem a falha, os mesmos blocos saem em `ok` COM números.
 */

const FALHA: FalhaLeitura = { codigo: "PGRST301", mensagem: "JWT expired" }

/**
 * As linhas de PRODUÇÃO desta tela — camada, componentes e preview, sem os
 * testes.
 *
 * `__tests__` fica de fora porque um teste que prova um detector é obrigado a
 * conter o padrão que o detector procura. Varrer o diretório de testes junto
 * faria a prova acusar a si mesma, e a saída "consertar" isso seria apagar a
 * prova — trocando um falso vermelho por um verde vazio.
 */
function linhasDeProducao() {
  return linhasDe([DIR_CAMADA, DIR_COMPONENTES, DIR_PREVIEW], "F-39").filter(
    (l) => !l.arquivo.includes("__tests__"),
  )
}

function comFalhaEm(chave: ChaveFonte) {
  const fonte = fonteDaEntrada(cenarioAtivosMais3())
  return montarPadroesTendencias({ ...fonte, falhas: { ...fonte.falhas, [chave]: FALHA } })
}

/** O corpo do bloco, sem os literais de cabeçalho (que são régua, não dado). */
function corpo(bloco: Record<string, unknown>): string {
  const { titulo: _t, subtitulo: _s, acao: _a, textoVazio: _v, erro: _e, ...resto } = bloco
  return serializar(resto)
}

describe("F-39 · falha de leitura vira estado, não silêncio", () => {
  it("INVARIÂNCIA — falha em 'sessoes' derruba §16..§21 para erro", () => {
    const d = comFalhaEm("sessoes")
    for (const bloco of [d.mudancas, d.serie, d.sinais, d.gargalos, d.participacao, d.risco]) {
      expect(bloco.estado).toBe("erro")
      expect(bloco.erro).toEqual(FALHA)
      expect(bloco.motivoVazio).toBe("falha-de-leitura")
    }
  })

  it("INVARIÂNCIA — nenhum numeral sobrevive no corpo de um bloco em erro", () => {
    const d = comFalhaEm("sessoes")
    for (const bloco of [d.mudancas, d.serie, d.sinais, d.gargalos, d.risco]) {
      expect(contemDigito(corpo(bloco as unknown as Record<string, unknown>))).toBe(false)
    }
  })

  it("VARIÂNCIA — sem a falha, os mesmos blocos saem em ok e COM números", () => {
    const d = montarPadroesTendencias(fonteDaEntrada(cenarioAtivosMais3()))
    expect(d.mudancas.estado).toBe("ok")
    expect(contemDigito(corpo(d.mudancas as unknown as Record<string, unknown>))).toBe(true)
  })

  it("INVARIÂNCIA — falha só no roster invalida a tela inteira", () => {
    // Sem universo, todo denominador é chute. É o único caso em que o agregado
    // inteiro sai em erro, e é conservador de propósito.
    const d = comFalhaEm("roster")
    expect(d.estado).toBe("erro")
    expect(d.erro).toEqual(FALHA)
  })

  it("INVARIÂNCIA — falha PARCIAL não derruba a tela toda", () => {
    // Estado por bloco existe exatamente para isto: a §21 depende de matrículas,
    // a §17 não. Derrubar tudo por causa de uma chave seria perder informação
    // que a leitura entregou intacta.
    const d = comFalhaEm("matriculas")
    expect(d.estado).toBe("ok")
    expect(d.risco.estado).toBe("erro")
    expect(d.serie.estado).toBe("ok")
  })

  it("INVARIÂNCIA — nenhum arquivo desta tela desestrutura data sem error", () => {
    // COLISÃO REPORTADA, não silenciada: o teste que PROVA que o detector
    // enxerga a desestruturação proibida precisa conter a expressão proibida, e
    // por isso a varredura de produção exclui `__tests__`. Excluir a prova em
    // vez de excluir o diretório seria apagar a anti-vacuidade; varrer o
    // diretório inteiro reprovaria a própria prova. O código de PRODUÇÃO é
    // varrido por completo, que é o que o contrato quer dizer.
    const achados = casam(linhasDeProducao(), /const\s*\{\s*data\s*\}\s*=/)
    expect(achados.length, formatar(achados)).toBe(0)
  })

  it("VARIÂNCIA — a varredura enxergaria a desestruturação proibida", () => {
    // Sem esta prova, o zero acima poderia ser cegueira do padrão, não ausência
    // da violação.
    expect(/const\s*\{\s*data\s*\}\s*=/.test("const { data } = await db.from('x').select()")).toBe(
      true,
    )
    expect(ERRO_LEITURA.length).toBeGreaterThan(0)
  })
})
