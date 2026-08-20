import { describe, expect, it } from "vitest"
import { computePadroesTendencias } from "../index"
import { BADGE_ALTA, BADGE_QUEDA } from "../sinais"
import { cenarioRegularidadeCai, cenarioRegularidadeSobe } from "./cenario"

/**
 * F-18 · Sinal por LIMIAR, e o contrato cruzado que ele carrega.
 *
 * O número da regularidade aparece em TRÊS lugares da tela: §16 (F-04), §18
 * (este) e §20 (F-31). Três lugares mostrando três valores para a mesma coisa é
 * o defeito clássico, e a única defesa é não haver três cálculos.
 *
 * ═══ O QUE MUDOU EM 2026-08-19, E POR QUE O TESTE PRECISOU MUDAR JUNTO ══════
 * Até aqui os três publicavam o MESMO `p.p.`, e este teste comparava os três
 * PRIMEIROS INTEIROS dos três textos. A doutrina D-1 matou a repetição: ler uma
 * fonte só resolvia a divergência, não resolvia o eco — o gestor lia o terceiro
 * card e concluía que a tela estava enrolando. §18 passou a dizer o que os
 * outros dois NÃO dizem: os dois lados em PESSOAS, com o denominador.
 *
 * O invariante NÃO morreu com a unidade. "Um cálculo só" continua sendo a
 * afirmação deste arquivo — o que mudou é que agora ela precisa ser verificada
 * ATRAVÉS das unidades, reconstituindo o p.p. dos vizinhos a partir das pessoas
 * que este card publica. Comparar dígito com dígito era o instrumento fácil, e
 * ele ficou cego no dia em que os cards deixaram de repetir: `4` e `40` são o
 * MESMO fato num recorte de 10, e a igualdade literal os declarava divergentes.
 *
 * A checagem de DIREÇÃO também trocou de âncora. Ela olhava a palavra
 * ("Redução de" / "Aumento de"), que a frase nova não usa; passa a olhar os
 * NÚMEROS e o badge, que é onde a direção de fato vive. Amarrar a direção à
 * ordem dos dois lados é mais forte que amarrá-la a um literal: uma frase pode
 * dizer "Redução" com os números subindo, e nenhum teste de literal perceberia.
 */

/** O primeiro inteiro de um texto. É assim que se compara o que a tela MOSTRA. */
function numeroDe(texto: string): number | null {
  const m = texto.match(/(\d+)/)
  return m?.[1] === undefined ? null : Number.parseInt(m[1], 10)
}

/** Os três números que a frase de §18 publica: de A para B, de C pessoas. */
interface LadosDoSinal {
  antes: number
  agora: number
  denominador: number
}

function ladosDe(descricao: string | undefined): LadosDoSinal | null {
  const m = /De (\d+) para (\d+) de (\d+)/.exec(descricao ?? "")
  if (m?.[1] === undefined || m[2] === undefined || m[3] === undefined) return null
  return { antes: Number(m[1]), agora: Number(m[2]), denominador: Number(m[3]) }
}

/** O p.p. que os DOIS LADOS em pessoas implicam. É a ponte entre as unidades. */
function ppImplicado(lados: LadosDoSinal): number {
  return Math.round((Math.abs(lados.antes - lados.agora) / lados.denominador) * 100)
}

function trio(entrada: ReturnType<typeof cenarioRegularidadeCai>) {
  const d = computePadroesTendencias(entrada)
  const mudanca = d.mudancas.itens.find((i) => i.id === "regularidade")
  const sinal = d.sinais.itens.find((i) => i.tipo === "limiar")
  return {
    emMudancas: mudanca === undefined ? null : numeroDe(mudanca.valorTexto),
    ladosEmSinais: ladosDe(sinal?.descricao),
    descricaoDoSinal: sinal?.descricao,
    emParticipacao: numeroDe(d.participacao.frase),
    deltaPp: d.participacao.deltaPp,
  }
}

describe("F-18 · sinal de limiar e o número único da regularidade", () => {
  it("INVARIÂNCIA — §16, §18 e §20 falam do MESMO fato, em duas unidades", () => {
    const t = trio(cenarioRegularidadeCai(4))

    expect(t.emMudancas).not.toBeNull()
    expect(t.ladosEmSinais, "sem o sinal em cena o teste seria vácuo").not.toBeNull()

    // §16 e §20 continuam publicando o mesmo p.p., lado a lado.
    expect(t.emParticipacao).toBe(t.emMudancas)
    expect(t.emMudancas).toBe(Math.abs(t.deltaPp ?? 0))

    // §18 publica pessoas — e elas reconstituem exatamente aquele p.p.
    expect(ppImplicado(t.ladosEmSinais as LadosDoSinal)).toBe(t.emMudancas)
  })

  it("INVARIÂNCIA — o sinal NÃO reimprime o p.p. dos vizinhos (D-1)", () => {
    const t = trio(cenarioRegularidadeCai(4))
    expect(t.descricaoDoSinal).not.toContain("p.p.")
    expect(t.descricaoDoSinal, "percentual aqui é o eco que D-1 matou").not.toMatch(/\d+\s*%/)
  })

  it("VARIÂNCIA — outra fixture move os três juntos", () => {
    const a = trio(cenarioRegularidadeCai(4))
    const b = trio(cenarioRegularidadeCai(6))

    expect(b.emMudancas).not.toBe(a.emMudancas)
    expect(b.emParticipacao).toBe(b.emMudancas)
    expect(ppImplicado(b.ladosEmSinais as LadosDoSinal)).toBe(b.emMudancas)
    // E o lado em pessoas se moveu de fato, não só o p.p. derivado dele.
    expect(b.ladosEmSinais?.antes).not.toBe(a.ladosEmSinais?.antes)
  })

  it("INVARIÂNCIA — na queda, os números DESCEM e o badge acompanha", () => {
    const d = computePadroesTendencias(cenarioRegularidadeCai(4))
    const sinal = d.sinais.itens.find((i) => i.tipo === "limiar")
    const lados = ladosDe(sinal?.descricao)

    expect(sinal?.titulo).toBe("Menor regularidade de estudos")
    expect(sinal?.badgeRotulo).toBe(BADGE_QUEDA)
    expect(lados, "sem os dois lados não há direção a verificar").not.toBeNull()
    expect((lados as LadosDoSinal).agora).toBeLessThan((lados as LadosDoSinal).antes)
  })

  it("VARIÂNCIA — na subida, os números SOBEM e o título espelha", () => {
    const d = computePadroesTendencias(cenarioRegularidadeSobe(4))
    const sinal = d.sinais.itens.find((i) => i.tipo === "limiar")
    const lados = ladosDe(sinal?.descricao)

    expect(sinal?.titulo).toBe("Maior regularidade de estudos")
    expect(sinal?.badgeRotulo).toBe(BADGE_ALTA)
    expect((lados as LadosDoSinal).agora).toBeGreaterThan((lados as LadosDoSinal).antes)
  })
})
