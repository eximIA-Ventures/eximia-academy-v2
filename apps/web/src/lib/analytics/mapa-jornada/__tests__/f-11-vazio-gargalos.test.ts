import { describe, expect, it } from "vitest"
import {
  CAPS_A,
  CAP_ANCORA,
  calcular,
  contemNumeralSolto,
  darAtividadeHoje,
  diasAtras,
  entradaBase,
} from "./contrato"

const LITERAL = "Nenhum gargalo relevante foi identificado neste período."

/**
 * F-11 · Estado vazio do bloco de gargalos (§32, literal).
 *
 * INVARIÂNCIA: todo mundo com atividade recente ⇒ `vazio` / `sem-gargalos` /
 *   a string da §32, e NENHUM numeral solto na saída do bloco (é a mesma
 *   asserção anti-`0` de `i-3-ausencia-nao-vira-zero`).
 * VARIÂNCIA: um único parado tira o bloco de `vazio`. Um bloco que sempre
 *   mostra o texto é a função constante.
 */
/**
 * Todo mundo com atividade de hoje E matrícula recente. As duas coisas são
 * necessárias: atividade de hoje mata `parado`, mas `perdendo-ritmo` (atrasado
 * vs. prazo) sobrevive a ela — e o gargalo da §24 é "paradas OU atrasadas".
 */
function todosAtivos() {
  let e = entradaBase()
  for (const alunoId of e.escopo) e = darAtividadeHoje(e, alunoId, CAPS_A[0] as string)
  return {
    ...e,
    matriculas: e.matriculas.map((m) => ({ ...m, criadaEmISO: diasAtras(1) })),
  }
}

describe("F-11 · vazio dos gargalos", () => {
  it("INVARIÂNCIA — sem ninguém parado, o literal da §32 e nenhum numeral", async () => {
    const r = await calcular(todosAtivos())
    expect(r.gargalos.estado).toBe("vazio")
    expect(r.gargalos.motivoVazio).toBe("sem-gargalos")
    expect(r.gargalos.textoVazio).toBe(LITERAL)
    expect(r.gargalos.linhas).toHaveLength(0)
    expect(contemNumeralSolto(r.gargalos)).toEqual([])
  })

  it("VARIÂNCIA — um único parado tira o bloco do vazio", async () => {
    const e = todosAtivos()
    // Remove a atividade de hoje de uma pessoa só: ela volta a estar parada.
    const semAtividadeDeP05 = {
      ...e,
      sessoes: (e.sessoes ?? []).filter(
        (s) => !(s.alunoId === "P05" && s.capituloId === CAPS_A[0]),
      ),
    }
    const r = await calcular(semAtividadeDeP05)

    expect(r.gargalos.estado).toBe("ok")
    expect(r.gargalos.linhas.length).toBeGreaterThan(0)
    expect(r.gargalos.textoVazio).toBeNull()
  })

  it("VARIÂNCIA — o bloco base NÃO está vazio (anti-vacuidade do par)", async () => {
    const r = await calcular(entradaBase())
    expect(r.gargalos.estado).toBe("ok")
    expect(r.gargalos.linhas[0]?.moduloId).toBe(CAP_ANCORA)
  })
})
