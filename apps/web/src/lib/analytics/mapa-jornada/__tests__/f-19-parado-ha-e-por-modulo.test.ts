import { describe, expect, it } from "vitest"
import { CAPS_B, CAP_ANCORA, calcular, diasAtras, entradaBase } from "./contrato"

/**
 * F-19 · Coluna "Parado há" — É O NÚMERO MAIS FÁCIL DE ERRAR DESTA TELA.
 *
 * No PNG de referência, Artur está "parado há 93 dias" e a "última atividade"
 * dele foi "14 dias atrás". Os dois só são coerentes se medirem coisas
 * diferentes: `Parado há` conta desde a última evidência NAQUELE MÓDULO;
 * `Última atividade` conta desde a última atividade em QUALQUER lugar.
 *
 * A fixture reproduz exatamente esse par com P04: evidência no módulo 6 há 93
 * dias, atividade em OUTRO CURSO há 40 dias.
 *
 * VARIÂNCIA CRUZADA, e as duas metades são obrigatórias:
 *   (a) mexer na evidência DO MÓDULO muda `Parado há` e NÃO muda `Última
 *       atividade`;
 *   (b) mexer na atividade FORA do módulo muda `Última atividade` e NÃO muda
 *       `Parado há`.
 * Se as duas colunas fossem a mesma consulta com dois rótulos, uma das duas
 * metades reprovaria.
 */
const linhaDe = (r: Awaited<ReturnType<typeof calcular>>, alunoId: string) =>
  r.travados.linhas.find((l) => l.alunoId === alunoId)

describe("F-19 · Parado há é POR MÓDULO", () => {
  it("INVARIÂNCIA — reproduz o par do mockup: 93 dias parado, 40 dias sem acessar", async () => {
    const r = await calcular(entradaBase())
    const p04 = linhaDe(r, "P04")

    expect(p04?.paradoHaDias).toBe(93)
    expect(p04?.paradoHaLabel).toBe("93 dias")
    expect(p04?.ultimaAtividadeLabel).toBe("40 dias atrás")
    expect(
      p04?.paradoHaLabel,
      "as duas colunas não podem ser a mesma consulta com dois rótulos",
    ).not.toBe(p04?.ultimaAtividadeLabel)
  })

  it("VARIÂNCIA (a) — mexer no módulo âncora muda `Parado há` e não `Última atividade`", async () => {
    const base = entradaBase()
    const antes = linhaDe(await calcular(base), "P04")

    const aproximado = {
      ...base,
      sessoes: (base.sessoes ?? []).map((s) =>
        s.alunoId === "P04" && s.capituloId === CAP_ANCORA
          ? { ...s, criadaEmISO: diasAtras(41) }
          : s,
      ),
    }
    const depois = linhaDe(await calcular(aproximado), "P04")

    expect(depois?.paradoHaDias).toBe(41)
    expect(depois?.ultimaAtividadeLabel).toBe(antes?.ultimaAtividadeLabel)
  })

  it("VARIÂNCIA (b) — mexer fora do módulo muda `Última atividade` e não `Parado há`", async () => {
    const base = entradaBase()
    const antes = linhaDe(await calcular(base), "P04")

    // 35 dias, e não 20, e o porquê importa: a atividade fora do módulo tem de
    // se mover SEM reclassificar a pessoa. Aos 20 dias, o retorno de P04 (que
    // vinha de 93 dias de lacuna) cai DENTRO da janela de 30 dias e o estado
    // dela vira `retomando` — que não é `parado` nem `perdendo-ritmo`, logo ela
    // sai do numerador do gargalo (F-08) e some da lista inteira. O
    // comportamento está certo; o valor 20 é que escolhia o dia errado para
    // isolar a variável. Aos 35 dias o retorno fica FORA da janela, o estado
    // permanece `parado`, e a variância mede o que pretende medir. O teste
    // CONTROLE abaixo registra a reclassificação, para 35 não parecer
    // conveniência escolhida depois do vermelho.
    const outraAtividade = {
      ...base,
      sessoes: (base.sessoes ?? []).map((s) =>
        s.alunoId === "P04" && s.capituloId === CAPS_B[0]
          ? { ...s, criadaEmISO: diasAtras(35) }
          : s,
      ),
    }
    const depois = linhaDe(await calcular(outraAtividade), "P04")

    expect(depois?.paradoHaDias).toBe(antes?.paradoHaDias)
    expect(depois?.ultimaAtividadeLabel).toBe("35 dias atrás")
    expect(depois?.ultimaAtividadeLabel).not.toBe(antes?.ultimaAtividadeLabel)
  })

  it("CONTROLE — a reclassificação por janela é comportamento, não acidente", async () => {
    const base = entradaBase()
    const dentroDaJanela = {
      ...base,
      sessoes: (base.sessoes ?? []).map((s) =>
        s.alunoId === "P04" && s.capituloId === CAPS_B[0]
          ? { ...s, criadaEmISO: diasAtras(20) }
          : s,
      ),
    }
    const r = await calcular(dentroDaJanela)

    expect(
      linhaDe(r, "P04"),
      "retomar dentro da janela não é estar parado: a pessoa sai da fila de triagem",
    ).toBeUndefined()
    expect(r.mapa.linhas.find((l) => l.alunoId === "P04")?.estado).toBe("retomando")
  })

  it("VAZIO — sem evidência no âncora, travessão; jamais `0 dias`", async () => {
    const r = await calcular(entradaBase())
    const semEvidencia = r.travados.linhas.filter((l) => l.paradoHaDias === null)
    for (const l of semEvidencia) {
      expect(l.paradoHaLabel).toBe("—")
    }
    expect(r.travados.linhas.map((l) => l.paradoHaLabel)).not.toContain("0 dias")
  })
})
