// ---------------------------------------------------------------------------
// F-46 · as duas séries do §17 contam o MESMO universo de eventos.
// ---------------------------------------------------------------------------
// O DEFEITO QUE ESTE ARQUIVO MEDE (2026-08-20). O cabeçalho de `serie.ts` afirma
// que as duas séries "dividem o mesmo universo e contam coisas DIFERENTES":
// "Alunos ativos" deduplica por PESSOA, "Sessões realizadas" conta a atividade
// de sessão. Dessa afirmação sai uma consequência que a tela publica sem dizer:
// ninguém está ativo sem uma sessão, logo `ativos ≤ sessoes` em toda semana.
//
// A implementação alimentava as duas com universos diferentes:
//
//     ativos  ← [created_at, updated_at]     (base.ts, o laço dos carimbos)
//     sessoes ← created_at                   (base.ts, a lista `criacoes`)
//
// Uma sessão criada há 40 dias e retomada esta semana (o caso Rinaldo, que
// `last-activity.ts` documenta e que a sessão socrática produz em toda conversa)
// põe a pessoa na série de ativos da semana corrente e não põe sessão alguma.
// Resultado: `ativos = 1, sessoes = 0` — impossível pelas definições declaradas.
//
// POR QUE NINGUÉM VIU. Com barras agrupadas ou com duas linhas coladas o gestor
// lê "praticamente iguais" e segue. Com um desenho que separa as séries, a série
// de pessoas passa POR CIMA da de sessões e a contradição fica na cara.
//
// ═══ POR QUE ESTE ARQUIVO TRAZ O PRÓPRIO MUNDO ══════════════════════════════
// `cenario.ts`, o construtor que os outros 45 arquivos desta pasta usam, NUNCA
// preenche `updatedAt` — `grep -c updatedAt` na pasta devolvia 0. Ou seja: a
// régua inteira era cega a este defeito por construção, não por descuido de uma
// asserção. Nenhum dos 210 testes conseguia produzir `ativos > sessoes`.
//
// O mundo abaixo é o menor que produz o caso, e o teste de VARIÂNCIA prova que
// ele não é decoração: tirar o `mexidaEm` muda o que a série devolve.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest"
import type { EntradaVisaoGeral } from "../entrada"
import { computePadroesTendencias } from "../index"

const AGORA = "2026-08-17T12:00:00.000Z"

/**
 * Uma sessão do jeito que o banco a entrega: um carimbo de criação imutável e um
 * de última mexida, que a sessão reusada empurra sozinho.
 */
interface SessaoBruta {
  aluno: string
  criadaEm: string
  /** `undefined` ⇒ `updated_at` nulo, que é tudo que `cenario.ts` sabe produzir. */
  mexidaEm?: string
}

/**
 * O período é de 30 dias, então a série cobre 8 semanas (§`semanasDaSerie`:
 * atual + anterior, com teto). O índice 7 é a semana que termina em `AGORA`.
 */
function mundo(sessoes: readonly SessaoBruta[]): EntradaVisaoGeral {
  const alunos = [...new Set(sessoes.map((s) => s.aluno))]
  return {
    agoraISO: AGORA,
    periodoDias: 30,
    gestorId: "gestor-1",
    escopo: alunos,
    alunos: alunos.map((id) => ({ id, nome: `Pessoa ${id}` })),
    atividades: sessoes.map((s) => ({
      studentId: s.aluno,
      createdAt: s.criadaEm,
      updatedAt: s.mexidaEm ?? null,
      tipo: "sessao" as const,
    })),
    acionamentos: [],
    matriculas: alunos.map((id) => ({
      studentId: id,
      courseId: "c1",
      status: "active" as const,
      createdAt: "2026-04-19T10:00:00.000Z",
      progressPercent: 10,
    })),
    cursos: [{ id: "c1", deadlineDays: null }],
    capitulos: [],
    tenantId: "t1",
  }
}

/**
 * O caso Rinaldo, mínimo: UMA sessão criada há 40 dias (semana 2) e retomada
 * ontem (semana 7). A segunda pessoa existe para a série ter mais de um ponto
 * com dado e o gráfico não cair no estado vazio da §32.
 */
const COM_RETOMADA: readonly SessaoBruta[] = [
  { aluno: "a", criadaEm: "2026-07-08T10:00:00.000Z", mexidaEm: "2026-08-16T10:00:00.000Z" },
  { aluno: "b", criadaEm: "2026-08-03T10:00:00.000Z" },
]

/** O MESMO mundo sem a retomada: a diferença é um campo, e só ele. */
const SEM_RETOMADA: readonly SessaoBruta[] = COM_RETOMADA.map(({ aluno, criadaEm }) => ({
  aluno,
  criadaEm,
}))

function pontos(sessoes: readonly SessaoBruta[]) {
  return computePadroesTendencias(mundo(sessoes)).serie.pontos
}

describe("F-46 · as duas séries do gráfico contam o mesmo universo", () => {
  it("INVARIÂNCIA — ninguém está ativo sem uma sessão: ativos ≤ sessoes em toda semana", () => {
    const contraditorias = pontos(COM_RETOMADA)
      .filter((p) => p.ativos > p.sessoes)
      .map((p) => `${p.rotulo}: ativos ${p.ativos} > sessões ${p.sessoes}`)

    // Cada linha desta lista é uma semana em que a tela afirma duas coisas que
    // não podem ser verdade ao mesmo tempo.
    expect(contraditorias).toEqual([])
  })

  it("a semana da retomada conta a sessão que foi retomada, e conta UMA", () => {
    const semana = pontos(COM_RETOMADA)[7]
    expect(semana).toBeDefined()
    // A pessoa estudou nesta semana, numa sessão criada há 40 dias. As duas
    // séries têm que enxergar o mesmo evento.
    expect([semana?.ativos, semana?.sessoes]).toEqual([1, 1])
  })

  it("VARIÂNCIA — o `updated_at` é o que move o resultado, e a fixture antiga não o tinha", () => {
    const com = pontos(COM_RETOMADA).map((p) => `${p.ativos}/${p.sessoes}`)
    const sem = pontos(SEM_RETOMADA).map((p) => `${p.ativos}/${p.sessoes}`)

    // Se as duas listas fossem iguais, este arquivo estaria medindo um mundo em
    // que o campo do defeito não faz diferença — exatamente o buraco de
    // `cenario.ts`, que nunca preenche `updatedAt`.
    expect(com).not.toEqual(sem)
    // E sem a retomada a semana 7 não tem ninguém: o ponto extra vem do campo.
    expect(sem[7]).toBe("0/0")
  })

  it("INVARIÂNCIA — criada e retomada na MESMA semana continua sendo UMA sessão", () => {
    // O contrato de F-12 ("5 sessões da mesma pessoa na mesma semana contam 5")
    // exige que a correção não passe a contar a mesma linha duas vezes dentro do
    // mesmo balde. A dedupe é por (sessão, semana), não por sessão.
    const mesmaSemana = pontos([
      { aluno: "a", criadaEm: "2026-08-12T10:00:00.000Z", mexidaEm: "2026-08-16T10:00:00.000Z" },
      { aluno: "b", criadaEm: "2026-08-03T10:00:00.000Z" },
    ])
    expect(mesmaSemana[7]?.sessoes).toBe(1)
  })

  it("INVARIÂNCIA — sessão sem `updated_at` conta exatamente como antes", () => {
    // A correção não pode mexer no que a produção já entregava para as linhas em
    // que os dois carimbos coincidem ou o segundo é nulo — que é o mundo inteiro
    // dos outros 45 arquivos desta pasta.
    const cinco: readonly SessaoBruta[] = [
      { aluno: "a", criadaEm: "2026-08-16T10:00:00.000Z" },
      { aluno: "a", criadaEm: "2026-08-15T10:00:00.000Z" },
      { aluno: "a", criadaEm: "2026-08-14T10:00:00.000Z" },
      { aluno: "a", criadaEm: "2026-08-13T10:00:00.000Z" },
      { aluno: "a", criadaEm: "2026-08-12T10:00:00.000Z" },
      { aluno: "b", criadaEm: "2026-08-03T10:00:00.000Z" },
    ]
    expect([pontos(cinco)[7]?.ativos, pontos(cinco)[7]?.sessoes]).toEqual([1, 5])
  })
})
