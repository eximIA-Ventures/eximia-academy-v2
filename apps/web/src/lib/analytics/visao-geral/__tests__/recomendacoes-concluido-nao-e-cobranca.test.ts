import { describe, expect, it } from "vitest"
import {
  type AtividadeBruta,
  type EntradaVisaoGeral,
  NOMES_ENTRADA_PRINCIPAL,
  carregarModulo,
  chamar,
  diasAtras,
  entradaBase,
  resolverExport,
} from "./contrato"

/**
 * "O que fazer agora" — quem CONCLUIU nunca é alvo de apoio, reativação ou
 * verificação.
 *
 * DEFEITO QUE ESTE ARQUIVO TRANCA (dono do produto, 2026-08-17, tenant Cory
 * Alimentos em produção): a tela exibiu
 *
 *     "Apoiar 4 pessoas paradas em 'Padronização'"
 *
 * e as 4 pessoas eram exatamente as 4 com `enrollments.status = 'completed'` e
 * 100% de progresso. Elas "pararam" porque TERMINARAM. A §29 regra A filtrava
 * apenas o estado `"sustentando"` e nunca excluía `"concluido"` — que existe e é
 * projetado em `base.ts` (`projetarEstado`). O gestor foi instruído a cobrar
 * quem concluiu.
 *
 * Este é o pior defeito possível nesta tela porque não produz número errado:
 * produz AÇÃO ERRADA SOBRE PESSOA REAL, e viola o princípio declarado da spec
 * (§2 Regra 2 "dados para apoiar, não vigiar"; §10.2 ações neutras).
 *
 * INVARIÂNCIA: nenhuma pessoa com estado `"concluido"` aparece em `alunosAlvo`
 *   de recomendação de cobrança/apoio/reativação. A lista de regras POSITIVAS é
 *   uma allowlist fechada — regra nova nasce sujeita ao invariante (fail-closed).
 *
 * CONTROLE POSITIVO (o que impede o verde por vacuidade e o verde por
 *   demolição): cada cenário afirma, ANTES da invariância, que (a) existem
 *   concluídos na saída e (b) a regra sob teste DISPAROU. Os cenários 1 e 2 são
 *   montados com concluídos E não-concluídos no mesmo alvo, de modo que a regra
 *   continua disparando depois da correção, com a lista menor — apagar a regra
 *   para ficar verde reprova no controle. O cenário 3 é um par-espelho: duas
 *   entradas idênticas exceto por `status: "completed"`, e é a diferença entre
 *   elas que discrimina.
 *
 * Fonte: SPEC-FUNCIONAL.md §2 Regra 2, §10.2, §29 regras A–D.
 */

// ---------------------------------------------------------------------------
// Forma mínima da saída consumida aqui
// ---------------------------------------------------------------------------

interface RecomendacaoSaida {
  id: string
  titulo: string
  alunosAlvo: readonly string[]
}

interface AlunoSaida {
  id: string
  nome: string
  estado: string
}

interface Resultado {
  roster: readonly AlunoSaida[]
  recomendacoes: { recomendacoes: readonly RecomendacaoSaida[] }
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
 * Regras cujo alvo é um ELOGIO. Allowlist FECHADA de propósito: uma regra §29
 * futura entra automaticamente no lado sujeito ao invariante. O default seguro é
 * "isto cobra alguém", não "isto elogia alguém".
 */
const REGRAS_POSITIVAS = new Set(["reconhecer-ritmo"])

const idsDas = (r: Resultado): string[] => r.recomendacoes.recomendacoes.map((x) => x.id)

/** Os concluídos como a TELA os declara — nunca reimplementando a projeção. */
function concluidosNaSaida(r: Resultado): Map<string, string> {
  return new Map(
    r.roster.filter((a) => a.estado === "concluido").map((a) => [a.id, a.nome] as const),
  )
}

/** Toda recomendação que NÃO é elogio: apoiar, verificar, reativar. */
function recomendacoesDeCobranca(r: Resultado): readonly RecomendacaoSaida[] {
  return r.recomendacoes.recomendacoes.filter((x) => !REGRAS_POSITIVAS.has(x.id))
}

function violacoes(r: Resultado): string[] {
  const concluidos = concluidosNaSaida(r)
  const out: string[] = []
  for (const rec of recomendacoesDeCobranca(r)) {
    for (const alunoId of rec.alunosAlvo) {
      const nome = concluidos.get(alunoId)
      if (nome !== undefined) {
        out.push(
          `"${rec.titulo}" (regra ${rec.id}) tem como alvo ${nome} [${alunoId}], que CONCLUIU`,
        )
      }
    }
  }
  return out
}

/** O numeral do título tem de bater com a lista: meia-correção é detectável. */
function tituloDivergeDaLista(rec: RecomendacaoSaida): string | null {
  const numeral = rec.titulo.match(/\d+/)
  if (numeral === null) return null
  const declarado = Number(numeral[0])
  if (declarado === rec.alunosAlvo.length) return null
  return `"${rec.titulo}" anuncia ${declarado}, mas alunosAlvo tem ${rec.alunosAlvo.length}`
}

// ---------------------------------------------------------------------------
// Cenário 1 — regra A (concentração no mesmo módulo), o defeito de produção
// ---------------------------------------------------------------------------
/**
 * Quatro pessoas no módulo "Padronização": P3 e P5 CONCLUÍRAM (matrícula
 * `completed`, 100%), P2 e P4 estão genuinamente perdendo ritmo.
 *
 * A mistura é deliberada. Antes da correção a regra emite as 4 (67% da equipe) —
 * o print de produção. Depois da correção ela emite 2 (33%, ainda acima do corte
 * de 20% da §29), e continua disparando: o cenário discrimina "excluiu o
 * concluído" de "matou a regra".
 */
function entradaComConcluidosNoMesmoModulo(): EntradaVisaoGeral & Record<string, unknown> {
  const base = entradaBase()
  const noModulo = new Set(["P2", "P3", "P4", "P5"])
  const concluiram = new Set(["P3", "P5"])
  return {
    ...base,
    atividades: base.atividades.map((a) =>
      noModulo.has(a.studentId) ? { ...a, chapterId: "CAP2" } : a,
    ),
    matriculas: base.matriculas.map((m) =>
      concluiram.has(m.studentId)
        ? { ...m, status: "completed" as const, progressPercent: 100 }
        : m,
    ),
    capitulos: [
      { id: "CAP1", courseId: "C1", titulo: "Fundamentos", ordem: 1 },
      { id: "CAP2", courseId: "C1", titulo: "Padronização", ordem: 2 },
    ],
  }
}

// ---------------------------------------------------------------------------
// Cenário 2 — regra B (queda de pessoas ativas)
// ---------------------------------------------------------------------------
/**
 * P2, P3 e P4 sumiram; P5 sumiu porque CONCLUIU. Só P1 seguiu ativo.
 *
 * Mesma mistura do cenário 1: depois da correção a regra continua disparando
 * (P2, P3 e P4 seguem sendo gente para verificar), sem P5.
 */
function entradaComConcluidoNaQuedaDeAtivos(): EntradaVisaoGeral & Record<string, unknown> {
  const base = entradaBase()
  const atividades: AtividadeBruta[] = [
    // P1 — ativo nas DUAS janelas: é ele que impede a queda de virar 100%.
    { studentId: "P1", createdAt: diasAtras(2), tipo: "sessao", questionId: "Q1" },
    { studentId: "P1", createdAt: diasAtras(40), tipo: "sessao", questionId: "Q1" },
    // P2, P3, P4 — ativos só na janela anterior: sumiram de verdade.
    { studentId: "P2", createdAt: diasAtras(35), tipo: "sessao", questionId: "Q1" },
    { studentId: "P3", createdAt: diasAtras(38), tipo: "sessao", questionId: "Q1" },
    { studentId: "P4", createdAt: diasAtras(45), tipo: "sessao", questionId: "Q1" },
    // P5 — última sessão na janela anterior porque TERMINOU o curso.
    { studentId: "P5", createdAt: diasAtras(33), tipo: "sessao", questionId: "Q1" },
  ]
  return {
    ...base,
    atividades,
    matriculas: base.matriculas.map((m) =>
      m.studentId === "P5" ? { ...m, status: "completed" as const, progressPercent: 100 } : m,
    ),
  }
}

// ---------------------------------------------------------------------------
// Cenário 3 — par-espelho: a queda é causada SÓ por quem concluiu
// ---------------------------------------------------------------------------
/**
 * As duas entradas são idênticas byte a byte, exceto o `status` da matrícula de
 * P5 (`active` vs `completed`). É a única variável que muda — e é ela que tem
 * de decidir se a regra dispara. Sem o par, "a regra não disparou" seria
 * indistinguível de "o cenário nunca armou a regra".
 */
function quedaCausadaSoPorP5(p5Concluiu: boolean): EntradaVisaoGeral & Record<string, unknown> {
  const ids = ["P1", "P2", "P3", "P4", "P5"] as const
  const base = entradaBase()
  const atividades: AtividadeBruta[] = ids.flatMap((id): AtividadeBruta[] =>
    id === "P5"
      ? // P5 fecha o curso e para: presente só na janela anterior.
        [{ studentId: id, createdAt: diasAtras(33), tipo: "sessao", questionId: "Q1" }]
      : [
          { studentId: id, createdAt: diasAtras(2), tipo: "sessao", questionId: "Q1" },
          { studentId: id, createdAt: diasAtras(40), tipo: "sessao", questionId: "Q1" },
        ],
  )
  return {
    ...base,
    escopo: [...ids],
    alunos: base.alunos.filter((a) => (ids as readonly string[]).includes(a.id)),
    atividades,
    matriculas: ids.map((id) => ({
      studentId: id,
      courseId: "C1",
      status: id === "P5" && p5Concluiu ? ("completed" as const) : ("active" as const),
      createdAt: diasAtras(60),
      progressPercent: id === "P5" ? 100 : 80,
    })),
  }
}

// ---------------------------------------------------------------------------

describe("O que fazer agora · quem concluiu não é alvo de cobrança", () => {
  it("CONTROLE — cenário 1 tem concluídos na saída E a regra de concentração disparou", async () => {
    const r = await calcular(entradaComConcluidosNoMesmoModulo())

    const concluidos = concluidosNaSaida(r)
    expect(
      [...concluidos.keys()].sort(),
      "sem concluído na saída, o invariante seria verdade por ausência de sujeito",
    ).toEqual(["P3", "P5"])

    expect(
      idsDas(r),
      `regra de concentração não disparou — recomendações: ${JSON.stringify(idsDas(r))}`,
    ).toContain("concentracao-modulo")

    // Guarda contra o "verde por demolição": excluir o concluído não pode
    // apagar a regra. Sobram P2 e P4, que continuam precisando de apoio.
    const rec = r.recomendacoes.recomendacoes.find((x) => x.id === "concentracao-modulo")
    expect(rec?.alunosAlvo.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  it("INVARIÂNCIA — cenário 1 não manda apoiar quem concluiu", async () => {
    const r = await calcular(entradaComConcluidosNoMesmoModulo())
    expect(violacoes(r)).toEqual([])
  })

  it("CONTROLE — cenário 2 tem concluído na saída E a regra de queda disparou", async () => {
    const r = await calcular(entradaComConcluidoNaQuedaDeAtivos())

    expect([...concluidosNaSaida(r).keys()]).toEqual(["P5"])
    expect(
      idsDas(r),
      `regra de queda não disparou — recomendações: ${JSON.stringify(idsDas(r))}`,
    ).toContain("queda-de-ativos")

    const rec = r.recomendacoes.recomendacoes.find((x) => x.id === "queda-de-ativos")
    expect(rec?.alunosAlvo.length ?? 0).toBeGreaterThanOrEqual(3)
  })

  it("INVARIÂNCIA — cenário 2 não manda verificar quem concluiu", async () => {
    const r = await calcular(entradaComConcluidoNaQuedaDeAtivos())
    expect(violacoes(r)).toEqual([])
  })

  it("PAR-ESPELHO — a mesma queda dispara com P5 ativo e NÃO dispara com P5 concluído", async () => {
    const comAtivo = await calcular(quedaCausadaSoPorP5(false))
    const comConcluido = await calcular(quedaCausadaSoPorP5(true))

    // Controle: a queda EXISTE nos dois lados (mesmos carimbos, mesma janela).
    expect(
      idsDas(comAtivo),
      "o cenário nunca armou a regra: a ausência do outro lado não provaria nada",
    ).toContain("queda-de-ativos")

    // A única diferença entre as duas entradas é o `status` da matrícula de P5.
    expect(idsDas(comConcluido)).not.toContain("queda-de-ativos")
  })

  it("COERÊNCIA — o numeral do título bate com o tamanho de alunosAlvo", async () => {
    for (const entrada of [
      entradaComConcluidosNoMesmoModulo(),
      entradaComConcluidoNaQuedaDeAtivos(),
    ]) {
      const r = await calcular(entrada)
      const divergencias = recomendacoesDeCobranca(r)
        .map(tituloDivergeDaLista)
        .filter((x): x is string => x !== null)

      // Filtrar a lista e esquecer a contagem seria meia-correção: a tela
      // continuaria anunciando "4 pessoas" com 2 nomes atrás.
      expect(divergencias).toEqual([])
    }
  })
})
