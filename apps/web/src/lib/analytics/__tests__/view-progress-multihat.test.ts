// ---------------------------------------------------------------------------
// Percorrido do SUJEITO quando ele não é `role='student'` — o caso Rinaldo.
//
// O DEFEITO (Hugo, 2026-08-04): a home do aluno mostrava "sem dado" na linha
// Percorrido de quem TEM dado. Medido em produção antes de escrever este
// arquivo: Rinaldo (`55993f62…`) tem 6 linhas em `chapter_view_progress`, todas
// do curso em que está matriculado (8 capítulos), e mesmo assim a célula "EU"
// dizia "sem dado" enquanto a coluna TURMA mostrava 80%.
//
// A causa não é ausência de dado, é ausência do ALUNO na população consultada:
// ele é `role='manager'` (multi-hat — gestor que também estuda), e
// `loadOrgReference` monta `percorridoByStudent` só sobre `activeOrgStudentIds`,
// que nasce de `users … .eq("role","student")`. Quem não é `student` nunca entra
// no `.in("student_id", …)` da leitura em lote, e o que nunca foi perguntado
// volta como "sem dado".
//
// É a MESMA classe de bug que `student-home-indicators.ts` já documenta como
// BUG-1 ("o SUJEITO precisa ler as PRÓPRIAS linhas mesmo não estando em
// `orgStudentIds`") e resolve com `scope = org ∪ {studentId}` — só que o
// Percorrido, que chegou depois (B.6), não recebeu o mesmo tratamento.
//
// POR QUE UM MOCK NOVO, e não o `makeMockDb` de `area-gestor.test.ts`: aquele
// devolve as mesmas linhas para QUALQUER filtro. Sob ele, `.eq("role","student")`
// devolveria o gestor também, e o bug seria literalmente inexprimível. O duplo
// abaixo aplica `eq`/`neq`/`in` de verdade — é o que torna o vermelho possível.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest"
import { computeStudentComparison } from "../area-gestor"

const NOW = Date.parse("2026-08-04T12:00:00Z")
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

const TENANT = "t-multihat"
/** O gestor que também estuda — o Rinaldo deste cenário. */
const SUBJECT = "rin"
/** Um aluno comum, para a Turma não ficar vazia (e a média ter de quem sair). */
const PEER = "stu"
const COURSE = "c1"
/** 8 capítulos, como o curso real "Análise e Solução de Problemas". */
const CHAPTER_IDS = ["ch1", "ch2", "ch3", "ch4", "ch5", "ch6", "ch7", "ch8"]

type Row = Record<string, unknown>

/**
 * Duplo do service client que APLICA os filtros. Suporta o que este caminho usa:
 * `eq`/`neq`/`in` encadeados, `.limit()`, `.range()` (paginação de
 * `fetchAllRows`) e o próprio builder como thenable.
 */
function makeFilteringDb(dataByTable: Record<string, Row[]>) {
  const from = (table: string) => {
    const preds: Array<(r: Row) => boolean> = []
    const rows = () => (dataByTable[table] ?? []).filter((r) => preds.every((p) => p(r)))
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (col: string, val: unknown) => {
        preds.push((r) => r[col] === val)
        return builder
      },
      neq: (col: string, val: unknown) => {
        preds.push((r) => r[col] !== val)
        return builder
      },
      in: (col: string, vals: unknown[]) => {
        preds.push((r) => vals.includes(r[col]))
        return builder
      },
      limit: (n: number) => Promise.resolve({ data: rows().slice(0, n), error: null }),
      single: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
      range: (offset: number, to: number) =>
        Promise.resolve({ data: rows().slice(offset, to + 1), error: null }),
      // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock of the query builder
      then: (resolve: (v: { data: Row[]; error: null }) => unknown) =>
        Promise.resolve({ data: rows(), error: null }).then(resolve),
    }
    return builder
  }
  // biome-ignore lint/suspicious/noExplicitAny: loose service-client mock for the test
  return { from } as any
}

function viewRow(studentId: string, chapterId: string, reached: boolean): Row {
  return {
    student_id: studentId,
    chapter_id: chapterId,
    // 2 slides por capítulo neste cenário; quem "chegou ao fim" tem o carimbo.
    max_slide_index: reached ? 1 : 0,
    slides_total_at_last_view: 2,
    reached_last_slide_at: reached ? daysAgo(2) : null,
  }
}

/**
 * O cenário, montado sobre um `tenantId` recebido — o mesmo que a chamada usa.
 * Tenant novo por teste é o jeito de escapar do cache do `getOrgReference`, e a
 * fixture precisa acompanhar (o duplo aplica `.eq("tenant_id", …)` de verdade).
 *
 * `viewProgress` é sobrescrevível para o caso "ninguém tem linha nenhuma".
 */
function scenario(TENANT: string, viewProgress?: Row[]) {
  return makeFilteringDb({
    users: [
      // O SUJEITO é `manager`, não `student` — é este campo, e só ele, que o
      // separava da leitura do Percorrido.
      { id: SUBJECT, tenant_id: TENANT, role: "manager", last_seen_at: daysAgo(1) },
      { id: PEER, tenant_id: TENANT, role: "student", last_seen_at: daysAgo(1) },
    ],
    sessions: [
      {
        student_id: SUBJECT,
        tenant_id: TENANT,
        status: "completed",
        chapter_id: "ch1",
        created_at: daysAgo(3),
        updated_at: daysAgo(3),
        analytics: null,
      },
      {
        student_id: PEER,
        tenant_id: TENANT,
        status: "completed",
        chapter_id: "ch1",
        created_at: daysAgo(3),
        updated_at: daysAgo(3),
        analytics: null,
      },
    ],
    slide_reflections: [],
    enrollments: [
      {
        student_id: SUBJECT,
        tenant_id: TENANT,
        status: "active",
        course_id: COURSE,
        created_at: daysAgo(30),
        progress: 0,
      },
      {
        student_id: PEER,
        tenant_id: TENANT,
        status: "active",
        course_id: COURSE,
        created_at: daysAgo(30),
        progress: 0,
      },
    ],
    courses: [{ id: COURSE, tenant_id: TENANT, status: "published", deadline_days: null }],
    chapters: CHAPTER_IDS.map((id, i) => ({
      id,
      course_id: COURSE,
      tenant_id: TENANT,
      order: i,
      title: `Módulo ${i + 1}`,
    })),
    chapter_slides: CHAPTER_IDS.flatMap((ch, i) =>
      [0, 1].map((o) => ({
        id: `${ch}-s${o}`,
        chapter_id: ch,
        tenant_id: TENANT,
        order: o,
        text_content: `conteúdo ${i}`,
      })),
    ),
    chapter_view_progress: viewProgress ?? [
      // O SUJEITO: 6 linhas num curso de 8 capítulos, 4 delas alcançadas → 50%.
      // Mesma forma do caso real (6 linhas, curso de 8, todas em escopo).
      viewRow(SUBJECT, "ch1", true),
      viewRow(SUBJECT, "ch2", true),
      viewRow(SUBJECT, "ch3", true),
      viewRow(SUBJECT, "ch4", true),
      viewRow(SUBJECT, "ch5", false),
      viewRow(SUBJECT, "ch6", false),
      // O aluno comum: 2 de 8 → 25%. É ele, sozinho, quem forma a média da Turma.
      viewRow(PEER, "ch1", true),
      viewRow(PEER, "ch2", true),
    ],
    questions: [],
    areas: [],
  })
}

describe("Percorrido do sujeito multi-hat (caso Rinaldo)", () => {
  it("aluno com 6 linhas num curso de 8 capítulos NÃO pode chegar como 'sem dado'", async () => {
    const T = `${TENANT}-a`
    const result = await computeStudentComparison(scenario(T), T, SUBJECT, { now: NOW })

    // O que a tela mostrava: null → "sem dado". O que o dado diz: 4 de 8 = 50%.
    expect(result.indicators?.subject.percorridoPct).toBe(50)
  })

  it("a média da TURMA continua contando só quem é aluno (o gestor não entra)", async () => {
    const T = `${TENANT}-b`
    const result = await computeStudentComparison(scenario(T), T, SUBJECT, { now: NOW })

    // A correção dá ao sujeito o direito de ler o PRÓPRIO número; ela não o
    // matricula na Turma. A média segue sendo a do único `role='student'` com
    // dado (25%), não a de (50+25)/2 = 38%.
    expect(result.indicators?.reference.percorridoAvgPct).toBe(25)
  })

  it("aluno comum (role=student) continua lendo o próprio percorrido", async () => {
    const T = `${TENANT}-c`
    const result = await computeStudentComparison(scenario(T), T, PEER, { now: NOW })

    // Guarda de não-regressão: o caminho que já funcionava não pode ter mudado.
    expect(result.indicators?.subject.percorridoPct).toBe(25)
  })

  it("quem não tem NENHUMA linha continua em 'sem dado' — jamais 0% (B9)", async () => {
    const T = `${TENANT}-d`
    const result = await computeStudentComparison(scenario(T, []), T, SUBJECT, { now: NOW })

    // Sem linha nenhuma, "sem dado" é a resposta CORRETA — o alvo desta
    // correção é o falso "sem dado", nunca transformar ausência em zero.
    expect(result.indicators?.subject.percorridoPct ?? null).toBeNull()
  })
})
