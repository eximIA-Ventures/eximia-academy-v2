import { describe, expect, it } from "vitest"
import type { ChapterViewProgressRow } from "../view-progress"
import {
  type EvidenceFloorInput,
  type ViewProgressQueryClient,
  applyEvidenceFloor,
  readViewProgressByStudent,
} from "../view-progress-read"

/**
 * O caso que mais importa aqui é o ESTADO REAL de hoje: a tabela
 * `chapter_view_progress` ainda não existe em produção. A leitura tem de
 * devolver "sem dado" sem derrubar a página do gestor.
 */

type TableData = Record<string, { data: unknown[] | null; error: unknown }>

function clientOf(tables: TableData, throwOn?: string): ViewProgressQueryClient {
  return {
    from(table: string) {
      return {
        select(_columns: string) {
          return {
            in(_column: string, _values: string[]) {
              if (throwOn === table) throw new Error("relation does not exist")
              return Promise.resolve(tables[table] ?? { data: [], error: null })
            },
          }
        },
      }
    },
  }
}

const courseIdsByStudent = new Map([["s1", new Set(["course-1"])]])

describe("readViewProgressByStudent", () => {
  it("devolve Map vazio quando a tabela de progresso ERRA (migration não aplicada)", async () => {
    const client = clientOf({
      chapters: { data: [{ id: "c1", course_id: "course-1" }], error: null },
      chapter_slides: { data: [{ chapter_id: "c1" }], error: null },
      chapter_view_progress: { data: null, error: { code: "42P01" } },
    })

    const r = await readViewProgressByStudent(client, ["s1"], courseIdsByStudent)
    expect(r.size).toBe(0)
  })

  it("não propaga exceção quando a query LANÇA", async () => {
    const client = clientOf(
      { chapters: { data: [{ id: "c1", course_id: "course-1" }], error: null } },
      "chapter_view_progress",
    )

    await expect(readViewProgressByStudent(client, ["s1"], courseIdsByStudent)).resolves.toEqual(
      new Map(),
    )
  })

  it("calcula o percorrido usando o total ATUAL de slides", async () => {
    const client = clientOf({
      chapters: {
        data: [
          { id: "c1", course_id: "course-1" },
          { id: "c2", course_id: "course-1" },
        ],
        error: null,
      },
      // c1 tem 2 slides hoje, c2 tem 1
      chapter_slides: {
        data: [{ chapter_id: "c1" }, { chapter_id: "c1" }, { chapter_id: "c2" }],
        error: null,
      },
      chapter_view_progress: {
        data: [
          {
            student_id: "s1",
            chapter_id: "c1",
            max_slide_index: 1,
            slides_total_at_last_view: 2,
            reached_last_slide_at: "2026-07-30T12:00:00Z",
          },
        ],
        error: null,
      },
    })

    const r = await readViewProgressByStudent(client, ["s1"], courseIdsByStudent)
    const s1 = r.get("s1")
    expect(s1?.chaptersReached).toBe(1)
    expect(s1?.chaptersTotal).toBe(2)
    expect(s1?.pct).toBe(50)
    expect(s1?.hasNewContent).toBe(false)
  })

  it("sinaliza conteúdo novo quando o capítulo cresceu depois da passagem", async () => {
    const client = clientOf({
      chapters: { data: [{ id: "c1", course_id: "course-1" }], error: null },
      // capítulo agora tem 5 slides; o aluno passou quando tinha 2
      chapter_slides: {
        data: [1, 2, 3, 4, 5].map(() => ({ chapter_id: "c1" })),
        error: null,
      },
      chapter_view_progress: {
        data: [
          {
            student_id: "s1",
            chapter_id: "c1",
            max_slide_index: 1,
            slides_total_at_last_view: 2,
            reached_last_slide_at: "2026-07-30T12:00:00Z",
          },
        ],
        error: null,
      },
    })

    const r = await readViewProgressByStudent(client, ["s1"], courseIdsByStudent)
    const s1 = r.get("s1")
    expect(s1?.chaptersReached).toBe(1) // não rebaixa
    expect(s1?.hasNewContent).toBe(true) // mas avisa
  })

  it("omite aluno sem nenhuma linha, para virar 'sem dado' e não 0%", async () => {
    const client = clientOf({
      chapters: { data: [{ id: "c1", course_id: "course-1" }], error: null },
      chapter_slides: { data: [{ chapter_id: "c1" }], error: null },
      chapter_view_progress: { data: [], error: null },
    })

    const r = await readViewProgressByStudent(client, ["s1"], courseIdsByStudent)
    expect(r.has("s1")).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// PISO CUMULATIVO POR EVIDÊNCIA (Hugo, 2026-08-04).
//
// A fala: "se ela interagiu no módulo 4, até o módulo 4, naquela interação tem
// que estar concluído pelo menos no percorrido". O piso ATRAVESSA capítulos.
//
// A PRIMEIRA VERSÃO (piso só DENTRO do capítulo) era inerte: medida em produção
// em 2026-08-04, resgatava 0 pares e 0 alunos. O piso cumulativo resgata 287
// pares (aluno, capítulo) de 104 pessoas — pares abaixo do teto de evidência e
// sem nenhuma linha de `chapter_view_progress`.
//
// RESSALVA QUE OS TESTES TAMBÉM GUARDAM: não há travamento sequencial de
// capítulos neste repositório (verificado). "Interagiu no 4 ⇒ passou por 1..3"
// é heurística de produto decidida pelo Hugo com o 287 na mesa, não dedução.
// ---------------------------------------------------------------------------

/** Curso de 8 capítulos (order 0..7), 4 slides cada — a forma dos cursos reais. */
const CAPITULOS = ["ch1", "ch2", "ch3", "ch4", "ch5", "ch6", "ch7", "ch8"]

const baseDoCurso: Omit<EvidenceFloorInput, "scopedRows" | "slideFloorByChapter"> & {
  sessionChapters: Set<string> | undefined
} = {
  sessionChapters: undefined,
  inScope: new Set(CAPITULOS),
  chapterOrderById: new Map(CAPITULOS.map((id, i) => [id, i])),
  chapterIdsByCourse: new Map([["course-1", CAPITULOS]]),
  courseIds: ["course-1"],
  slidesTotalByChapter: new Map(CAPITULOS.map((id) => [id, 4])),
}

/**
 * Encontra a linha de um capítulo no resultado (ou `undefined`). Tipado com a
 * linha REAL, e não com `{ chapter_id }`: um helper frouxo aqui deixaria as
 * asserções de `max_slide_index` invisíveis ao `tsc`.
 */
const linhaDe = (rows: ChapterViewProgressRow[], chapterId: string) =>
  rows.find((r) => r.chapter_id === chapterId)

describe("applyEvidenceFloor — cumulativo, e ainda assim piso", () => {
  it("teto no MEIO do curso: anteriores completos, o do teto só no piso de slide", () => {
    // Reflexão no slide 1 (de 4) do capítulo 4. Teto = ch4.
    const out = applyEvidenceFloor({
      ...baseDoCurso,
      scopedRows: [],
      slideFloorByChapter: new Map([["ch4", 1]]),
    })

    // ch1..ch3 percorridos INTEIROS: o aluno teve de atravessá-los.
    for (const ch of ["ch1", "ch2", "ch3"]) {
      expect(linhaDe(out, ch)?.max_slide_index).toBe(3) // 3 = 4 slides - 1 → 100%
    }
    // ch4 fica NO PONTO DA INTERAÇÃO, não no fim. Marcar o capítulo inteiro
    // afirmaria o que não se sabe (a interação pode ser no slide 1 de 4).
    expect(linhaDe(out, "ch4")?.max_slide_index).toBe(1)
    // E nada ACIMA do teto é inventado.
    for (const ch of ["ch5", "ch6", "ch7", "ch8"]) {
      expect(linhaDe(out, ch)).toBeUndefined()
    }
    // Nenhuma linha sintética fabrica conclusão por carimbo.
    expect(out.every((r) => r.reached_last_slide_at === null)).toBe(true)
  })

  it("telemetria MAIOR que o piso vence — piso que rebaixa é teto disfarçado", () => {
    const telemetria = {
      chapter_id: "ch4",
      max_slide_index: 3,
      slides_total_at_last_view: 4,
      reached_last_slide_at: null,
    }

    const out = applyEvidenceFloor({
      ...baseDoCurso,
      scopedRows: [telemetria],
      slideFloorByChapter: new Map([["ch4", 1]]),
    })

    expect(linhaDe(out, "ch4")?.max_slide_index).toBe(3)
    // E não mutou a linha que veio do banco — outra leitura pode olhar p/ ela.
    expect(telemetria.max_slide_index).toBe(3)
  })

  it("telemetria MENOR é elevada pelo teto (o capítulo ficou para trás)", () => {
    const out = applyEvidenceFloor({
      ...baseDoCurso,
      scopedRows: [
        {
          chapter_id: "ch2",
          max_slide_index: 0,
          slides_total_at_last_view: 4,
          reached_last_slide_at: null,
        },
      ],
      // Evidência lá na frente: ch2 está abaixo do teto.
      slideFloorByChapter: new Map([["ch5", 2]]),
    })

    expect(linhaDe(out, "ch2")?.max_slide_index).toBe(3)
    // A linha elevada preserva o denominador REAL da passagem — é telemetria,
    // e `hasNewContent` continua dizendo a verdade sobre ela.
    expect(linhaDe(out, "ch2")?.slides_total_at_last_view).toBe(4)
  })

  it("evidência SÓ por sessão eleva o teto, mas não afirma nada dentro do capítulo", () => {
    const out = applyEvidenceFloor({
      ...baseDoCurso,
      scopedRows: [],
      slideFloorByChapter: undefined,
      sessionChapters: new Set(["ch4"]),
    })

    for (const ch of ["ch1", "ch2", "ch3"]) {
      expect(linhaDe(out, ch)?.max_slide_index).toBe(3)
    }
    // A sessão não tem granularidade de slide: o capítulo dela fica SEM linha.
    expect(linhaDe(out, "ch4")).toBeUndefined()
    expect(out).toHaveLength(3)
  })

  it("sem `chapters.order`, degrada para o piso de slide em vez de inventar ordem", () => {
    const out = applyEvidenceFloor({
      ...baseDoCurso,
      chapterOrderById: new Map(),
      scopedRows: [],
      slideFloorByChapter: new Map([["ch4", 1]]),
    })

    expect(out).toHaveLength(1)
    expect(linhaDe(out, "ch4")?.max_slide_index).toBe(1)
  })

  it("o teto é POR CURSO — o módulo 4 de um não diz nada sobre o outro", () => {
    const out = applyEvidenceFloor({
      ...baseDoCurso,
      inScope: new Set([...CAPITULOS, "outro-1", "outro-2"]),
      chapterOrderById: new Map([
        ...CAPITULOS.map((id, i) => [id, i] as [string, number]),
        ["outro-1", 0],
        ["outro-2", 1],
      ]),
      chapterIdsByCourse: new Map([
        ["course-1", CAPITULOS],
        ["course-2", ["outro-1", "outro-2"]],
      ]),
      courseIds: ["course-1", "course-2"],
      slidesTotalByChapter: new Map([
        ...CAPITULOS.map((id) => [id, 4] as [string, number]),
        ["outro-1", 4],
        ["outro-2", 4],
      ]),
      scopedRows: [],
      slideFloorByChapter: new Map([["ch4", 1]]),
    })

    expect(linhaDe(out, "ch1")?.max_slide_index).toBe(3)
    expect(linhaDe(out, "outro-1")).toBeUndefined()
  })

  it("capítulo FORA da trilha do aluno não vira evidência nem ganha linha", () => {
    const out = applyEvidenceFloor({
      ...baseDoCurso,
      scopedRows: [],
      slideFloorByChapter: new Map([["c-de-outro-curso", 2]]),
      sessionChapters: new Set(["c-de-outro-curso-2"]),
    })
    expect(out).toHaveLength(0)
  })

  it("sem evidência nenhuma, devolve exatamente o que recebeu", () => {
    const rows = [
      {
        chapter_id: "ch1",
        max_slide_index: 2,
        slides_total_at_last_view: 4,
        reached_last_slide_at: null,
      },
    ]
    expect(
      applyEvidenceFloor({ ...baseDoCurso, scopedRows: rows, slideFloorByChapter: undefined }),
    ).toBe(rows)
    expect(
      applyEvidenceFloor({ ...baseDoCurso, scopedRows: rows, slideFloorByChapter: new Map() }),
    ).toBe(rows)
  })
})

describe("readViewProgressByStudent — piso cumulativo ligado ponta a ponta", () => {
  const umCurso = new Map([["s1", new Set(["course-1"])]])
  /** 4 capítulos (order 0..3). `slidesPorCapitulo` controla o denominador. */
  function clientDoCurso(progresso: unknown[], slidesPorCapitulo = 2) {
    const caps = ["c1", "c2", "c3", "c4"]
    return clientOf({
      chapters: {
        data: caps.map((id, i) => ({ id, course_id: "course-1", order: i })),
        error: null,
      },
      // `order` do slide é 0-based, a MESMA base de `max_slide_index`
      // (verificado no banco: capítulo de 4 slides → 0,1,2,3).
      chapter_slides: {
        data: caps.flatMap((ch) =>
          Array.from({ length: slidesPorCapitulo }, (_, o) => ({
            id: `${ch}-s${o}`,
            chapter_id: ch,
            order: o,
          })),
        ),
        error: null,
      },
      chapter_view_progress: { data: progresso, error: null },
    })
  }

  it("reflexão no MEIO do módulo 3 conclui os módulos 1 e 2 (o pedido do Hugo)", async () => {
    const r = await readViewProgressByStudent(clientDoCurso([]), ["s1"], umCurso, [
      // Slide 0 (de 2) de c3 — o ponto exato da interação.
      { student_id: "s1", slide_id: "c3-s0" },
    ])

    const s1 = r.get("s1")
    // c1 e c2 percorridos; c3 em 50% (não conta); c4 intocado → 2 de 4.
    expect(s1?.chaptersReached).toBe(2)
    expect(s1?.chaptersTotal).toBe(4)
    expect(s1?.pct).toBe(50)
    // ANTES desta mudança, o piso só valia dentro de c3: 0 de 4 → 0%.
  })

  it("evidência SÓ por sessão socrática (sem reflexão nenhuma) já conta", async () => {
    const r = await readViewProgressByStudent(
      clientDoCurso([]),
      ["s1"],
      umCurso,
      [],
      // Sessão ABANDONADA de propósito: a pergunta é "chegou até aqui?", não
      // "terminou?". Ver a justificativa em `sessionChaptersOf`.
      [{ student_id: "s1", chapter_id: "c3", status: "abandoned" }],
    )

    const s1 = r.get("s1")
    expect(s1?.chaptersReached).toBe(2)
    expect(s1?.pct).toBe(50)
  })

  it("telemetria à frente da evidência vence; atrás, é elevada", async () => {
    const r = await readViewProgressByStudent(
      clientDoCurso([
        // c1 atrás do teto e incompleto → será elevado a completo.
        {
          student_id: "s1",
          chapter_id: "c1",
          max_slide_index: 0,
          slides_total_at_last_view: 2,
          reached_last_slide_at: null,
        },
        // c4 ADIANTE do teto e completo → a telemetria manda, e permanece.
        {
          student_id: "s1",
          chapter_id: "c4",
          max_slide_index: 1,
          slides_total_at_last_view: 2,
          reached_last_slide_at: "2026-07-30T12:00:00Z",
        },
      ]),
      ["s1"],
      umCurso,
      [{ student_id: "s1", slide_id: "c2-s0" }],
    )

    // c1 (elevado) + c2? não: c2 é o teto, fica em 50%. c4 (telemetria) → 2 de 4.
    const s1 = r.get("s1")
    expect(s1?.chaptersReached).toBe(2)
    expect(s1?.pct).toBe(50)
  })

  it("aluno SEM evidência nenhuma continua 'sem dado' — jamais 0% (B9)", async () => {
    const r = await readViewProgressByStudent(clientDoCurso([]), ["s1"], umCurso, [], [])
    expect(r.has("s1")).toBe(false)
  })

  it("sessão no PRIMEIRO módulo não afirma nada, e isso também é 'sem dado'", async () => {
    // Sabe-se que ele esteve em c1; NÃO se sabe até onde dentro dele, e não há
    // capítulo anterior a concluir. Nada afirmável ⇒ ausência, nunca 0%.
    const r = await readViewProgressByStudent(
      clientDoCurso([]),
      ["s1"],
      umCurso,
      [],
      [{ student_id: "s1", chapter_id: "c1", status: "in_progress" }],
    )
    expect(r.has("s1")).toBe(false)
  })

  it("reflexão sem slide_id, ou apontando p/ slide desconhecido, é ignorada", async () => {
    const r = await readViewProgressByStudent(clientDoCurso([]), ["s1"], umCurso, [
      { student_id: "s1", slide_id: null },
      { student_id: "s1", slide_id: "slide-que-nao-existe" },
    ])

    // Não dá para provar presença num ponto que não se sabe onde fica.
    expect(r.has("s1")).toBe(false)
  })

  it("linha SINTÉTICA não acende 'conteúdo novo' falsamente", async () => {
    // O capítulo tem 5 slides HOJE e a reflexão está no slide 0. Se a linha
    // sintética nascesse com `slides_total_at_last_view = floor + 1` (= 1),
    // `hasNewContentSince(1, 5)` acenderia o aviso "há conteúdo novo desde a
    // sua passagem" para as 104 pessoas resgatadas pelo piso — gente que nunca
    // "passou" por ali com telemetria alguma. Gravar o total de HOJE fecha isso.
    const r = await readViewProgressByStudent(clientDoCurso([], 5), ["s1"], umCurso, [
      { student_id: "s1", slide_id: "c3-s0" },
    ])

    const s1 = r.get("s1")
    expect(s1?.hasNewContent).toBe(false)
    // Não-vacuidade: as linhas sintéticas existem mesmo (c1 e c2 concluídos).
    expect(s1?.chaptersReached).toBe(2)
    // E o mecanismo em si continua vivo para telemetria REAL — ver o caso
    // "sinaliza conteúdo novo quando o capítulo cresceu depois da passagem".
  })
})
