import { describe, expect, it } from "vitest"
import { fonteDaEntradaMapa, montarMapaJornada } from "../index"
import type { ChaveFonteMapa, FonteMapaJornada } from "../index"
import { CAP_ANCORA, acrescentarPessoa, calcular, entradaBase } from "./contrato"
import type { EntradaMapaJornada } from "./contrato"

/**
 * F-21 · A existência do bloco §26 é CONDICIONAL, e o CTA carrega o total.
 *
 * INVARIÂNCIA: com 20% do roster no módulo âncora o bloco existe; com 19% não.
 *   O limiar é o MESMO `CONCENTRACAO_MODULO_PCT` (0.2) da §29 regra A — um
 *   segundo limiar com o mesmo significado é o defeito que esta régua evita.
 * VARIÂNCIA: o par 19%/20% move o bloco inteiro. E o CTA nunca espelha o corte:
 *   exibir 5 de N mantém `Ver pessoas (N)`.
 * DISCRIMINANTE (obrigatório): "ausente por não haver concentração" e "ausente
 *   por falha de leitura" são estados DIFERENTES e não podem colapsar. Sem
 *   isso, um erro de banco vira "está tudo bem, ninguém travou".
 */

/** 4 pessoas no âncora; N a mais no roster move o percentual sem mexer nelas. */
function comRosterDe(n: number): EntradaMapaJornada {
  let e = entradaBase()
  for (let i = 0; i < n; i++) {
    e = acrescentarPessoa(e, `X${i}`, `Extra ${i} Silva`, "C1-solucao-de-problemas")
  }
  return e
}

function comFalhaEm(e: EntradaMapaJornada, chave: ChaveFonteMapa): FonteMapaJornada {
  const fonte = fonteDaEntradaMapa(e)
  return {
    ...fonte,
    falhas: { ...fonte.falhas, [chave]: { codigo: "PGRST000", mensagem: "falha sintética" } },
  }
}

describe("F-21 · existência condicional do bloco e a contagem do CTA", () => {
  it("INVARIÂNCIA — com 20% de concentração o bloco existe", async () => {
    // 4 pessoas no âncora, roster 20 ⇒ exatamente 20%.
    const r = await calcular(comRosterDe(6))

    expect(r.contexto.totalAlunos).toBe(20)
    expect(r.gargalos.linhas[0]?.pessoas).toBe(4)
    expect(r.travados.presente).toBe(true)
    expect(r.travados.estado).toBe("ok")
    expect(r.travados.moduloTitulo).toBe("Executar as Ações Corretivas")
  })

  // O título fala do CONTEÚDO, não da superfície: com 19% o bloco não publica
  // âncora, lista nem CTA. O CARD continua na tela dizendo o porquê (§32) — o
  // lado de render está em `f-21-travados-vazio-fica-na-tela.test.tsx`.
  it("VARIÂNCIA — com 19% o bloco não publica concentração", async () => {
    // Mesmas 4 pessoas, roster 21 ⇒ 19%. O par 19/20 é a variância inteira.
    const r = await calcular(comRosterDe(7))

    expect(r.contexto.totalAlunos).toBe(21)
    expect(r.gargalos.linhas[0]?.pessoas).toBe(4)
    expect(r.gargalos.linhas[0]?.pct).toBe(19)
    expect(r.travados.presente).toBe(false)
    expect(r.travados.estado).toBe("vazio")
    expect(r.travados.motivoVazio).toBe("sem-gargalos")
    expect(r.travados.linhas).toHaveLength(0)
  })

  it("INVARIÂNCIA — o CTA carrega o total COMPLETO, nunca o corte exibido", async () => {
    const r = await calcular(entradaBase())

    expect(r.travados.ctaTotal).toBe(4)
    expect(r.travados.ctaTotal).toBe(r.gargalos.linhas[0]?.pessoas)
    // O corte exibido é o teto de linhas; o total é a população. Os dois
    // convivem na mesma tela e precisam ser distinguíveis.
    expect(r.travados.linhas.length).toBeLessThanOrEqual(r.travados.ctaTotal)
  })

  it("VARIÂNCIA — o CTA acompanha a população, não o número de linhas", async () => {
    let e = entradaBase()
    // Duas pessoas a mais paradas no âncora: população 4 → 6, corte segue 5.
    for (const [id, nome] of [
      ["T1", "Tereza Alencar"],
      ["T2", "Tulio Barros"],
    ] as const) {
      e = acrescentarPessoa(e, id, nome, "C1-solucao-de-problemas")
      e = {
        ...e,
        sessoes: [
          ...(e.sessoes ?? []),
          { alunoId: id, capituloId: CAP_ANCORA, criadaEmISO: "2026-05-01T10:00:00.000Z" },
        ],
      }
    }
    const r = await calcular(e)

    expect(r.travados.ctaTotal).toBe(6)
    expect(r.travados.linhas).toHaveLength(5)
  })

  it("DISCRIMINANTE — ausente por falta de concentração ≠ ausente por erro", () => {
    const semConcentracao = montarMapaJornada(fonteDaEntradaMapa(comRosterDe(7)), {
      cursoFiltroNome: null,
    })
    const comErro = montarMapaJornada(comFalhaEm(entradaBase(), "percorrido"), {
      cursoFiltroNome: null,
    })

    expect(semConcentracao.travados.presente).toBe(false)
    expect(comErro.travados.presente).toBe(false)

    // Os dois somem da tela. O estado NÃO pode ser o mesmo: um diz "não há
    // concentração", o outro diz "não sabemos". Colapsá-los apresenta falha de
    // banco como boa notícia.
    expect(semConcentracao.travados.estado).toBe("vazio")
    expect(comErro.travados.estado).toBe("erro")
    expect(comErro.travados.erro).not.toBeNull()
    expect(semConcentracao.travados.erro).toBeNull()
    expect(comErro.travados.textoVazio).not.toBe(semConcentracao.travados.textoVazio)
  })
})
