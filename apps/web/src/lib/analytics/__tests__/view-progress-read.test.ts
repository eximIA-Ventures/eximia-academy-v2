import { describe, expect, it } from "vitest"
import {
  type ViewProgressQueryClient,
  applyExerciseFloor,
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
// PISO POR EVIDÊNCIA DE EXERCÍCIO (Hugo, 2026-08-04).
//
// "Faça com que as pessoas sem dado tenham percorrido pelo menos até onde
// fizeram algum exercício." O invariante: interagir com um ponto PROVA presença
// nele — quem respondeu a reflexão do slide N passou pelos slides 0..N.
//
// A PRODUÇÃO NÃO EXERCITA ESTE CAMINHO HOJE (medido em 2026-08-04: 0 alunos com
// reflexão e sem telemetria; 0 pares aluno×capítulo). Por isso os casos abaixo
// são sintéticos de propósito — sem eles o código entraria sem uma única prova
// de que faz o que promete, e ninguém notaria por meses.
// ---------------------------------------------------------------------------

describe("applyExerciseFloor — o piso é piso, nunca teto", () => {
  const inScope = new Set(["c1"])
  const slidesTotal = new Map([["c1", 10]])

  it("par SEM telemetria e COM reflexão → o piso vira a linha", () => {
    const out = applyExerciseFloor([], new Map([["c1", 4]]), inScope, slidesTotal)

    expect(out).toHaveLength(1)
    expect(out[0].chapter_id).toBe("c1")
    expect(out[0].max_slide_index).toBe(4)
    // O piso NÃO fabrica conclusão: passar pelo slide 4 não é ter chegado ao fim.
    expect(out[0].reached_last_slide_at).toBeNull()
    // Denominador de hoje, não `floor + 1` — o slide 4 de um capítulo de 10.
    expect(out[0].slides_total_at_last_view).toBe(10)
  })

  it("par com telemetria MAIOR → a telemetria vence, o piso não rebaixa", () => {
    const telemetria = {
      chapter_id: "c1",
      max_slide_index: 8,
      slides_total_at_last_view: 10,
      reached_last_slide_at: null,
    }

    const out = applyExerciseFloor([telemetria], new Map([["c1", 4]]), inScope, slidesTotal)

    expect(out).toHaveLength(1)
    expect(out[0].max_slide_index).toBe(8)
    // E não mutou a linha que veio do banco — outra leitura pode olhar p/ ela.
    expect(telemetria.max_slide_index).toBe(8)
  })

  it("par com telemetria MENOR → o piso vence", () => {
    const out = applyExerciseFloor(
      [
        {
          chapter_id: "c1",
          max_slide_index: 1,
          slides_total_at_last_view: 10,
          reached_last_slide_at: null,
        },
      ],
      new Map([["c1", 6]]),
      inScope,
      slidesTotal,
    )

    expect(out).toHaveLength(1)
    expect(out[0].max_slide_index).toBe(6)
  })

  it("capítulo FORA da trilha do aluno não ganha linha por reflexão", () => {
    const out = applyExerciseFloor([], new Map([["c-de-outro-curso", 9]]), inScope, slidesTotal)
    expect(out).toHaveLength(0)
  })

  it("sem reflexão nenhuma, devolve exatamente o que recebeu", () => {
    const rows = [
      {
        chapter_id: "c1",
        max_slide_index: 2,
        slides_total_at_last_view: 10,
        reached_last_slide_at: null,
      },
    ]
    expect(applyExerciseFloor(rows, undefined, inScope, slidesTotal)).toBe(rows)
    expect(applyExerciseFloor(rows, new Map(), inScope, slidesTotal)).toBe(rows)
  })
})

describe("readViewProgressByStudent — piso ligado ponta a ponta", () => {
  const doisCapitulos = new Map([["s1", new Set(["course-1"])]])

  function clientComSlides(progresso: unknown[]) {
    return clientOf({
      chapters: {
        data: [
          { id: "c1", course_id: "course-1" },
          { id: "c2", course_id: "course-1" },
        ],
        error: null,
      },
      // c1 e c2 com 2 slides cada; `order` 0-based, a MESMA base de
      // `max_slide_index` (verificado no banco: capítulo de 4 slides → 0,1,2,3).
      chapter_slides: {
        data: [
          { id: "sl-c1-0", chapter_id: "c1", order: 0 },
          { id: "sl-c1-1", chapter_id: "c1", order: 1 },
          { id: "sl-c2-0", chapter_id: "c2", order: 0 },
          { id: "sl-c2-1", chapter_id: "c2", order: 1 },
        ],
        error: null,
      },
      chapter_view_progress: { data: progresso, error: null },
    })
  }

  it("aluno SEM telemetria mas COM reflexão no último slide deixa de ser 'sem dado'", async () => {
    const r = await readViewProgressByStudent(clientComSlides([]), ["s1"], doisCapitulos, [
      // Reflexão no slide 1 (o último) de c1 → percorreu c1 inteiro.
      { student_id: "s1", slide_id: "sl-c1-1" },
    ])

    const s1 = r.get("s1")
    expect(s1?.chaptersReached).toBe(1)
    expect(s1?.chaptersTotal).toBe(2)
    expect(s1?.pct).toBe(50)
  })

  it("reflexão no MEIO do capítulo não conclui o capítulo (piso, não atalho)", async () => {
    const r = await readViewProgressByStudent(clientComSlides([]), ["s1"], doisCapitulos, [
      { student_id: "s1", slide_id: "sl-c1-0" },
    ])

    // Slide 0 de 2 = 50% do capítulo → capítulo NÃO alcançado → 0 de 2.
    expect(r.get("s1")?.chaptersReached).toBe(0)
    expect(r.get("s1")?.pct).toBe(0)
  })

  it("reflexão sem slide_id, ou apontando p/ slide desconhecido, é ignorada", async () => {
    const r = await readViewProgressByStudent(clientComSlides([]), ["s1"], doisCapitulos, [
      { student_id: "s1", slide_id: null },
      { student_id: "s1", slide_id: "slide-que-nao-existe" },
    ])

    // Não dá para provar presença num ponto que não se sabe onde fica.
    expect(r.has("s1")).toBe(false)
  })

  it("com telemetria à frente da reflexão, o número não anda para trás", async () => {
    const r = await readViewProgressByStudent(
      clientComSlides([
        {
          student_id: "s1",
          chapter_id: "c1",
          max_slide_index: 1,
          slides_total_at_last_view: 2,
          reached_last_slide_at: "2026-07-30T12:00:00Z",
        },
        {
          student_id: "s1",
          chapter_id: "c2",
          max_slide_index: 1,
          slides_total_at_last_view: 2,
          reached_last_slide_at: "2026-07-30T12:00:00Z",
        },
      ]),
      ["s1"],
      doisCapitulos,
      [{ student_id: "s1", slide_id: "sl-c1-0" }],
    )

    // 2 de 2 antes, 2 de 2 depois — a reflexão no slide 0 não derruba c1.
    expect(r.get("s1")?.chaptersReached).toBe(2)
    expect(r.get("s1")?.pct).toBe(100)
  })
})
