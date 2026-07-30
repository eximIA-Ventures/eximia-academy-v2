import { describe, expect, it } from "vitest"
import { type ViewProgressQueryClient, readViewProgressByStudent } from "../view-progress-read"

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
