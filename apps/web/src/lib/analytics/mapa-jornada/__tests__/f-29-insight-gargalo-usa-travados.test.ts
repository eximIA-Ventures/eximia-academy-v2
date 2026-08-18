import { describe, expect, it } from "vitest"
import { CAP_ANCORA, calcular, diasAtras, entradaBase } from "./contrato"
import type { EntradaMapaJornada } from "./contrato"

/**
 * F-29 · O insight do gargalo usa a população de TRAVADOS, não a do gargalo.
 *
 * ACHADO A-3, registrado em código para ninguém "consertar" de volta. O mockup
 * diz, no mesmo módulo: `16 (40%)` no gargalo e `20% travam no mesmo ponto`.
 * Não é erro de conta — são DUAS populações. O gargalo (§24) conta parados
 * **ou** atrasados; os travados (§25) contam só quem está sem atividade há mais
 * de 14 dias. Igualar os dois números "para ficar coerente" apaga a distinção
 * que a spec fez de propósito.
 *
 * INVARIÂNCIA: o percentual da frase é o de travados-no-âncora, e é DIFERENTE
 *   do percentual do gargalo do mesmo módulo.
 * VARIÂNCIA DIVERGENTE: transformar um travado em atrasado-mas-ativo derruba o
 *   insight e NÃO mexe no numerador do gargalo. É a prova de que as duas
 *   populações são de verdade diferentes, e não dois nomes para a mesma coisa.
 */
const pctDaFrase = (texto: string | undefined): number | null => {
  const m = /(\d+)%/.exec(texto ?? "")
  return m ? Number(m[1]) : null
}

/**
 * Escada de sessões sem lacuna de 14 dias: a pessoa fica ATIVA (deixa de ser
 * travada) e continua atrasada — logo `perdendo-ritmo`, que segue dentro do
 * gargalo. Um único acesso de hoje não serviria: o retorno após 90 dias cairia
 * na janela e o estado viraria `retomando`, que sai do gargalo e contaminaria a
 * variância com um segundo efeito.
 */
function reativar(e: EntradaMapaJornada, alunoId: string): EntradaMapaJornada {
  const semAntigas = (e.sessoes ?? []).filter((s) => s.alunoId !== alunoId)
  return {
    ...e,
    sessoes: [
      ...semAntigas,
      ...[20, 13, 6, 1].map((dias) => ({
        alunoId,
        capituloId: CAP_ANCORA,
        criadaEmISO: diasAtras(dias),
      })),
    ],
  }
}

describe("F-29 · o insight do gargalo usa travados", () => {
  it("INVARIÂNCIA — a frase traz o percentual de TRAVADOS, não o do gargalo", async () => {
    const r = await calcular(entradaBase())
    const frase = r.insights.itens.find((i) => i.id === "gargalo")
    const gargalo = r.gargalos.linhas[0]

    expect(gargalo?.moduloId).toBe(CAP_ANCORA)
    expect(frase?.texto).toContain(`(módulo ${gargalo?.numero})`)

    // 4 pessoas no gargalo do módulo 6, das quais 3 estão travadas, num roster
    // de 14: 29% contra 21%. Se os dois batessem, o teste não distinguiria as
    // duas populações — por isso a desigualdade é a asserção.
    expect(gargalo?.pessoas).toBe(4)
    expect(gargalo?.pct).toBe(29)
    expect(pctDaFrase(frase?.texto)).toBe(21)
    expect(
      pctDaFrase(frase?.texto),
      "gargalo e travados são populações diferentes no mesmo módulo (achado A-3)",
    ).not.toBe(gargalo?.pct)
  })

  it("VARIÂNCIA DIVERGENTE — reativar um travado derruba o insight e NÃO o gargalo", async () => {
    const antes = await calcular(entradaBase())
    const depois = await calcular(reativar(entradaBase(), "P05"))

    const gargaloAntes = antes.gargalos.linhas.find((g) => g.moduloId === CAP_ANCORA)
    const gargaloDepois = depois.gargalos.linhas.find((g) => g.moduloId === CAP_ANCORA)
    const fraseAntes = antes.insights.itens.find((i) => i.id === "gargalo")
    const fraseDepois = depois.insights.itens.find((i) => i.id === "gargalo")

    expect(
      gargaloDepois?.pessoas,
      "atrasado-mas-ativo continua no gargalo: o numerador não pode se mover",
    ).toBe(gargaloAntes?.pessoas)
    expect(pctDaFrase(fraseDepois?.texto) ?? 0).toBeLessThan(pctDaFrase(fraseAntes?.texto) ?? 0)
  })

  it("VAZIO — sem módulo âncora o insight NÃO é emitido, e o bloco sai com 2", async () => {
    // 4 pessoas no âncora com roster de 21 ⇒ 19%, abaixo dos 20% da §29 regra A.
    let e = entradaBase()
    for (let i = 0; i < 7; i++) {
      e = {
        ...e,
        escopo: [...e.escopo, `X${i}`],
        alunos: [...e.alunos, { id: `X${i}`, nome: `Extra ${i} Silva` }],
        matriculas: [
          ...e.matriculas,
          {
            alunoId: `X${i}`,
            cursoId: "C1-solucao-de-problemas",
            status: "active" as const,
            criadaEmISO: diasAtras(300),
          },
        ],
      }
    }
    const r = await calcular(e)

    expect(r.travados.presente).toBe(false)
    expect(r.insights.itens.map((i) => i.id)).toEqual(["concluiu", "em-andamento"])
    expect(r.insights.itens).toHaveLength(2)
  })
})
