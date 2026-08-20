import { describe, expect, it } from "vitest"
import {
  type EntradaVisaoGeral,
  NOMES_ENTRADA_PRINCIPAL,
  carregarModulo,
  chamar,
  diasAtras,
  entradaBase,
  resolverExport,
} from "./contrato"

/**
 * "O que fazer agora" — a POSIÇÃO é única, a gravidade não vai à tela.
 *
 * DEFEITO QUE ESTE ARQUIVO TRANCA (dono do produto, 2026-08-16): com dado real
 * do tenant Cory a tela desenhou os badges `1, 1, 2` e o React avisou
 * "Encountered two children with the same key, `1`" — comportamento indefinido
 * (pode duplicar ou omitir filhos). A causa não era a `key`: era `recomendacoes.ts`
 * emitir GRAVIDADE (A=1, C=1, B=2, D=3) no campo `prioridade`, que é o ordinal
 * de exibição da §11 (1, 2 e 3 em três linhas de uma lista de no máximo três).
 * Duas regras críticas viravam dois "1".
 *
 * INVARIÂNCIA: sejam quais forem as regras §29 que disparem, as prioridades
 *   saem `1..n` sem repetição e cada recomendação tem `id` próprio.
 * CONTROLE POSITIVO (o que impede o verde por vacuidade): o cenário abaixo é
 *   construído para fazer DUAS regras de mesma gravidade dispararem juntas —
 *   e o teste 2 verifica que elas de fato dispararam. É exatamente o cenário
 *   em que o código anterior produzia `1, 1`: sem ele, o teste 1 passaria em
 *   qualquer implementação, inclusive na defeituosa.
 *
 * Fonte: SPEC-FUNCIONAL.md §11 (coluna "Prioridade") e §29 (regras A–D, que
 * NÃO atribuem número nenhum).
 */

interface Recomendacao {
  id: string
  prioridade: number
  badgeTom: string
  titulo: string
}

interface Resultado {
  recomendacoes: { recomendacoes: readonly Recomendacao[] }
  [k: string]: unknown
}

async function calcular(entrada: unknown): Promise<Resultado> {
  const mod = await carregarModulo()
  const fn = resolverExport<(e: unknown) => unknown>(
    mod,
    "entrada principal da Visão geral",
    NOMES_ENTRADA_PRINCIPAL,
  )
  return chamar<Resultado>(fn, entrada)
}

/**
 * Cenário de COLISÃO: as regras A (concentração no mesmo módulo) e C (sem
 * acesso há 14+ dias) disparam juntas, e ambas são de gravidade máxima.
 *
 * Como cada peça é armada:
 *   • P3 e P5 param de acessar há 30 e 20 dias — passam de 14, é a regra C.
 *     `progressPercent` alto de propósito: a triagem canônica só classifica
 *     como "sem acesso" quem NÃO está atrasado; com progresso baixo os dois
 *     cairiam em "atrasado" e a regra C não dispararia.
 *   • as sessões dos dois carregam o mesmo `chapterId`, e nenhum dos dois está
 *     sustentando — 2 de 6 pessoas (33%) passam do corte de 20% da regra A.
 */
function entradaComDuasRegrasCriticas(): EntradaVisaoGeral & Record<string, unknown> {
  const base = entradaBase()
  return {
    ...base,
    atividades: base.atividades.map((a) =>
      a.studentId === "P3" || a.studentId === "P5" ? { ...a, chapterId: "CAP2" } : a,
    ),
    matriculas: base.matriculas.map((m) =>
      m.studentId === "P3" || m.studentId === "P5" ? { ...m, progressPercent: 95 } : m,
    ),
    capitulos: [
      { id: "CAP1", courseId: "C1", titulo: "Fundamentos", ordem: 1 },
      { id: "CAP2", courseId: "C1", titulo: "Rotinas de segurança", ordem: 2 },
    ],
    acionamentos: [{ recipientId: "P3", sentAt: diasAtras(9), sentByManager: "G1" }],
  }
}

describe("O que fazer agora · posição é ordinal único, não gravidade", () => {
  it("CONTROLE — o cenário faz DUAS regras de mesma gravidade dispararem", async () => {
    const r = await calcular(entradaComDuasRegrasCriticas())
    const itens = r.recomendacoes.recomendacoes

    // Sem isto, o teste seguinte passaria sobre uma lista de 0 ou 1 item, e o
    // verde não significaria nada.
    expect(itens.length).toBeGreaterThanOrEqual(2)

    // `badgeTom: "red"` é a assinatura da gravidade máxima (regras A e C). Duas
    // vermelhas na mesma lista É a colisão: era aqui que nasciam dois badges "1".
    const criticas = itens.filter((i) => i.badgeTom === "red")
    expect(
      criticas.length,
      `cenário não colidiu — recomendações: ${JSON.stringify(itens.map((i) => [i.id, i.badgeTom, i.prioridade]))}`,
    ).toBeGreaterThanOrEqual(2)
  })

  it("INVARIÂNCIA — prioridades são 1..n sem repetição, e cada item tem id próprio", async () => {
    const r = await calcular(entradaComDuasRegrasCriticas())
    const itens = r.recomendacoes.recomendacoes

    const prioridades = itens.map((i) => i.prioridade)
    expect(prioridades).toEqual(itens.map((_, indice) => indice + 1))
    expect(new Set(prioridades).size).toBe(itens.length)

    // A chave de lista do React. `id` é a regra que emitiu; duas regras
    // diferentes nunca compartilham identidade.
    const ids = itens.map((i) => i.id)
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(true)
    expect(new Set(ids).size).toBe(itens.length)
  })

  it("INVARIÂNCIA — vale também na população base, com outra combinação de regras", async () => {
    const r = await calcular(entradaBase())
    const itens = r.recomendacoes.recomendacoes
    expect(itens.map((i) => i.prioridade)).toEqual(itens.map((_, indice) => indice + 1))
    expect(new Set(itens.map((i) => i.id)).size).toBe(itens.length)
  })
})
