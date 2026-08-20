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
 * ═══ O QUE MUDOU EM 2026-08-19 (doutrina do texto) ══════════════════════════
 * A frase publicava PERCENTUAL ("20% travam no mesmo ponto") e endereçava o
 * módulo por NÚMERO ("(módulo 6)"). Ambos caíram: com 6 pessoas um percentual
 * amplia (uma pessoa vale 17 p.p.) e "módulo 6" é um endereço que nenhum gestor
 * tem na cabeça — ele sabe o que é "Executar Ações Corretivas". A frase passa a
 * trazer os dois lados absolutos e o TÍTULO. O achado A-3 continua sendo o
 * coração deste arquivo: o que mudou é a UNIDADE publicada, não a população.
 *
 * INVARIÂNCIA: a contagem da frase é a de travados-no-âncora, e é DIFERENTE da
 *   do gargalo do mesmo módulo.
 * VARIÂNCIA DIVERGENTE: transformar um travado em atrasado-mas-ativo derruba o
 *   insight e NÃO mexe no numerador do gargalo. É a prova de que as duas
 *   populações são de verdade diferentes, e não dois nomes para a mesma coisa.
 */
const contagemDaFrase = (texto: string | undefined): number | null => {
  const m = /(\d+) de \d+/.exec(texto ?? "")
  return m?.[1] === undefined ? null : Number(m[1])
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
  it("INVARIÂNCIA — a frase traz a contagem de TRAVADOS, não a do gargalo", async () => {
    const r = await calcular(entradaBase())
    const frase = r.insights.itens.find((i) => i.id === "gargalo")
    const gargalo = r.gargalos.linhas[0]

    expect(gargalo?.moduloId).toBe(CAP_ANCORA)
    // O módulo é endereçado pelo TÍTULO. "módulo 6" não é endereço de gestor.
    expect(frase?.texto).toContain(`"${gargalo?.titulo}"`)
    expect(frase?.texto).not.toMatch(/m[óo]dulo \d/i)
    expect(frase?.texto, "percentual em base pequena amplia").not.toMatch(/\d+%/)

    // 4 pessoas no gargalo do módulo 6, das quais 3 estão travadas, num roster
    // de 14. Se os dois batessem, o teste não distinguiria as duas populações —
    // por isso a desigualdade é a asserção.
    expect(gargalo?.pessoas).toBe(4)
    expect(contagemDaFrase(frase?.texto)).toBe(3)
    expect(frase?.texto).toContain(`de ${r.mapa.totalAlunos}`)
    expect(
      contagemDaFrase(frase?.texto),
      "gargalo e travados são populações diferentes no mesmo módulo (achado A-3)",
    ).not.toBe(gargalo?.pessoas)
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
    expect(contagemDaFrase(fraseDepois?.texto) ?? 0).toBeLessThan(
      contagemDaFrase(fraseAntes?.texto) ?? 0,
    )
  })

  it("VAZIO — sem módulo âncora o insight NÃO é emitido, e sobra a dispersão", async () => {
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
    // Antes o bloco saía com 2 itens porque um deles era o eco do tile
    // `Concluídos`. Morto o eco, sobra a dispersão — e ela sozinha é mais
    // informação que os dois eram juntos.
    expect(r.insights.itens.map((i) => i.id)).toEqual(["em-andamento"])
  })
})
