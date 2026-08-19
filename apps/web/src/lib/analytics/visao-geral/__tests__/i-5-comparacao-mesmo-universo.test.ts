import { describe, expect, it } from "vitest"
import {
  type AtividadeBruta,
  type EntradaVisaoGeral,
  NOMES_ENTRADA_PRINCIPAL,
  carregarModulo,
  chamar,
  clonarPopulacao,
  diasAtras,
  entradaBase,
  espelharNoPeriodoAnterior,
  resolverExport,
} from "./contrato"

/**
 * I-5 · Comparação de período compara o mesmo universo.
 *
 * INVARIÂNCIA (testes 1, 2 e 3): mudar o ESCOPO sem mudar o comportamento não
 *   move o delta; espelhar o comportamento atual na janela anterior zera todo
 *   delta; e isso vale para mais de uma duração de período (paridade de
 *   duração, correção FORM-07).
 * VARIÂNCIA (testes 4 e 5): mudar o COMPORTAMENTO da janela anterior move o
 *   delta. Sem isto, `deltaPp = 0` sempre passaria nos três primeiros — a
 *   armadilha desta tarefa na sua forma mais literal.
 * ANTI-CONSTANTE (teste 6): a fixture base produz pelo menos um delta ≠ 0,
 *   senão o teste 2 ("espelhar zera") estaria confirmando um zero que já
 *   existia.
 *
 * Fonte: INVARIANTES.md I-5 · aggregate/route.ts:1056-1092 (FORM-07).
 *
 * ═══ CORREÇÃO DE 2026-08-19 — DOIS MUTADORES NÃO FAZIAM O QUE O NOME DIZIA ══
 * Quatro destes seis testes estavam vermelhos, e o vermelho apontava para o
 * denominador vitalício das §8.2/§8.5 ("total de pessoas que já iniciaram").
 * A medida refutou essa causa: `montarMetrica` divide os DOIS lados do delta
 * pelo MESMO `e.base`, então o denominador nunca difere entre as janelas — o
 * delta jamais mede crescimento de matrícula. Quem se movia era o VALOR de
 * hoje, e ele se movia porque os mutadores mudavam mais do que anunciavam:
 *
 *   • `espelharNoPeriodoAnterior` ANEXAVA em vez de espelhar, deixando a janela
 *     anterior como superconjunto estrito da atual (ver a justificativa longa em
 *     `contrato.ts`). Corrigido lá, e com ele os testes 2 e 3 ficaram verdes sem
 *     uma linha de produção mudar.
 *
 *   • `adensarPeriodoAnterior` (abaixo) injetava atividade passada para TODO
 *     mundo, inclusive P6, cujo papel na fixture é "nunca iniciou". Dar uma
 *     sessão de 40 dias atrás a P6 não muda só o passado: muda QUEM já iniciou,
 *     ou seja, muda o universo. O denominador ia a 6 e "Sem acesso" a 3 porque
 *     hoje passou a haver 6 pessoas que iniciaram e 3 sumidas há 14+ dias — a
 *     tela estava certa. Corrigido para adensar só quem já iniciou.
 *
 *   • O teste 1 comparava `valorPrincipal` string a string. Desde a decisão
 *     `mostrarAbsoluto` (2026-08-17) esse campo publica a base ("4 de 6 · 67%"),
 *     e dobrar a população dobra a base POR CONSTRUÇÃO. Passou a comparar o
 *     percentual (invariante) e a exigir escala ×2 exata em numerador e base —
 *     detector mais estreito que a igualdade de string, não mais frouxo.
 *
 * O que NENHUMA destas correções resolve, e é decisão da §8, não defeito: o
 * NÍVEL exibido cai quando alguém novo inicia a jornada, sem ninguém ter
 * parado. É o preço do denominador vitalício, e o `mostrarAbsoluto` é o que
 * torna esse movimento legível ("2 de 5 · 40%" → "2 de 6 · 33%"). Mudar isso
 * exige mudar a §8, que é do dono.
 */

interface Metrica {
  id: string
  valorPrincipal: string
  numerador: number
  baseDenominador: number
  deltaPp: number | null
  deltaDirecao: "up" | "down" | null
}

interface Resultado {
  placar: { metricas: readonly Metrica[] }
}

async function calcular(entrada: EntradaVisaoGeral): Promise<Resultado> {
  const mod = await carregarModulo()
  const fn = resolverExport<(e: EntradaVisaoGeral) => unknown>(
    mod,
    "entrada principal da Visão geral",
    NOMES_ENTRADA_PRINCIPAL,
  )
  return chamar<Resultado>(fn, entrada)
}

/** Delta COM SINAL. A fixture guarda magnitude em `deltaPp` e sinal em `deltaDirecao`. */
function deltasDe(r: Resultado): Record<string, number | null> {
  const out: Record<string, number | null> = {}
  for (const m of r.placar.metricas) {
    out[m.id] =
      m.deltaPp === null || m.deltaPp === undefined
        ? null
        : m.deltaDirecao === "down"
          ? -m.deltaPp
          : m.deltaPp
  }
  return out
}

function taxasDe(r: Resultado): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of r.placar.metricas) out[m.id] = m.valorPrincipal
  return out
}

/**
 * Só o percentual do valor exibido. `valorPrincipal` também carrega a base
 * ("4 de 6 · 67%") quando `mostrarAbsoluto` está ligado, e a base descreve o
 * TAMANHO do recorte — que muda de propósito quando o recorte muda.
 */
function percentuaisDe(r: Resultado): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of r.placar.metricas) {
    out[m.id] = m.valorPrincipal.match(/-?\d+%\s*$/)?.[0] ?? m.valorPrincipal
  }
  return out
}

/** Numerador e base de cada métrica, para pinar a ESCALA e não só a taxa. */
function contagensDe(r: Resultado): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = {}
  for (const m of r.placar.metricas) out[m.id] = [m.numerador, m.baseDenominador]
  return out
}

/**
 * Injeta atividade SÓ na janela anterior, e SÓ de quem já iniciou a jornada.
 *
 * O recorte por "já iniciou" não é detalhe: dar uma sessão de 40 dias atrás a
 * quem nunca iniciou muda o UNIVERSO (§8.2 e §8.5 contam "quem já iniciou"), e
 * aí a taxa de hoje se mexe com razão — não por a janela atual estar lendo o
 * passado, que é o que este par de testes existe para pegar. Um mutador que
 * muda o universo enquanto anuncia mudar só o comportamento reprova o código
 * por um defeito que ele mesmo plantou.
 */
function adensarPeriodoAnterior(e: EntradaVisaoGeral): EntradaVisaoGeral {
  const jaIniciou = new Set(e.atividades.map((a) => a.studentId))
  const extras: AtividadeBruta[] = []
  for (const aluno of e.alunos) {
    if (!jaIniciou.has(aluno.id)) continue
    for (const d of [33, 36, 40, 43, 47, 50]) {
      extras.push({
        studentId: aluno.id,
        createdAt: diasAtras(d),
        tipo: "sessao",
        questionId: "Q1",
      })
    }
  }
  return { ...e, atividades: [...e.atividades, ...extras] }
}

describe("I-5 · comparação de período compara o mesmo universo", () => {
  it("INVARIÂNCIA — duplicar a população não move nenhum delta nem nenhuma taxa", async () => {
    const base = entradaBase()
    const a = await calcular(base)
    const b = await calcular(clonarPopulacao(base))

    // Cada pessoa ganhou um gêmeo com carimbos idênticos: o comportamento
    // agregado é o mesmo, só o tamanho do recorte mudou.
    expect(deltasDe(b)).toEqual(deltasDe(a))
    expect(percentuaisDe(b)).toEqual(percentuaisDe(a))

    // E a base tem de acompanhar o recorte EXATAMENTE, sem sobra: numerador e
    // denominador dobram juntos. Um denominador que dobrasse sozinho (ou que
    // não dobrasse) manteria o percentual estável por acidente e escaparia da
    // asserção de cima.
    const antes = contagensDe(a)
    const depois = contagensDe(b)
    for (const [id, [numerador, base]] of Object.entries(antes)) {
      expect(depois[id], `métrica "${id}" ao dobrar a população`).toEqual([numerador * 2, base * 2])
    }
  })

  it("INVARIÂNCIA — espelhar o comportamento na janela anterior zera todo delta", async () => {
    const espelhado = espelharNoPeriodoAnterior(entradaBase())
    const deltas = deltasDe(await calcular(espelhado))

    for (const [id, delta] of Object.entries(deltas)) {
      if (delta === null) continue // métrica sem histórico reconstruível (ex.: "No ritmo")
      expect(delta, `métrica "${id}" com comportamento idêntico nas duas janelas`).toBe(0)
    }
  })

  it("INVARIÂNCIA — a paridade de duração vale para períodos diferentes", async () => {
    for (const periodoDias of [7, 30]) {
      const base = { ...entradaBase(), periodoDias }
      const deltas = deltasDe(await calcular(espelharNoPeriodoAnterior(base)))
      for (const [id, delta] of Object.entries(deltas)) {
        if (delta === null) continue
        expect(delta, `período ${periodoDias}d, métrica "${id}"`).toBe(0)
      }
    }
  })

  it("VARIÂNCIA — adensar SÓ a janela anterior move pelo menos um delta", async () => {
    const base = entradaBase()
    const antes = deltasDe(await calcular(base))
    const depois = deltasDe(await calcular(adensarPeriodoAnterior(base)))

    const mudou = Object.keys(antes).some((id) => antes[id] !== depois[id])
    expect(
      mudou,
      `nenhum delta se moveu ao mudar o comportamento passado: ${JSON.stringify(antes)} → ` +
        `${JSON.stringify(depois)}. Delta constante passa em qualquer teste de invariância.`,
    ).toBe(true)
  })

  it("VARIÂNCIA — as taxas do período atual NÃO se movem quando só o passado muda", async () => {
    const base = entradaBase()
    const antes = taxasDe(await calcular(base))
    const depois = taxasDe(await calcular(adensarPeriodoAnterior(base)))

    // Contrapartida do teste anterior: o delta muda, o valor exibido não.
    // Se o valor atual se mexer, a janela atual está capturando o passado.
    expect(depois).toEqual(antes)
  })

  it("ANTI-CONSTANTE — a fixture base produz pelo menos um delta diferente de zero", async () => {
    const deltas = deltasDe(await calcular(entradaBase()))
    const naoZero = Object.entries(deltas).filter(([, v]) => v !== null && v !== 0)

    expect(
      naoZero.length,
      `todos os deltas da fixture base são 0 ou null (${JSON.stringify(deltas)}): o teste de espelhamento estaria confirmando um zero que já existia`,
    ).toBeGreaterThan(0)
  })
})
