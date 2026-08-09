import { describe, expect, it } from "vitest"
import {
  courseProgressPct,
  hasNewContentSince,
  moduleProgressPct,
  shouldAdvanceWatermark,
  summarizeCourseView,
} from "../view-progress"

/**
 * Percorrido x Elaborado — §5 do documento de arquitetura.
 * Os casos abaixo cobrem as três armadilhas do desenho: o curto-circuito do
 * `reached_last_slide_at`, o denominador móvel, e o "sem dado" que nunca pode
 * virar 0%.
 */

describe("moduleProgressPct", () => {
  it("trava em 100% quando o aluno alcançou o último slide", () => {
    expect(
      moduleProgressPct({
        maxSlideIndex: 8,
        slidesTotal: 9,
        reachedLastSlideAt: "2026-07-30T12:00:00Z",
      }),
    ).toBe(100)
  })

  it("permanece 100% mesmo se o capítulo GANHAR slides depois (P2: não rebaixa)", () => {
    // Alcançou o fim quando o capítulo tinha 9 slides; agora tem 14.
    expect(
      moduleProgressPct({
        maxSlideIndex: 8,
        slidesTotal: 14,
        reachedLastSlideAt: "2026-07-30T12:00:00Z",
      }),
    ).toBe(100)
  })

  it("calcula a fração quando o aluno está no meio do módulo", () => {
    // Índice 4 (0-based) = 5 slides vistos de 10.
    expect(moduleProgressPct({ maxSlideIndex: 4, slidesTotal: 10, reachedLastSlideAt: null })).toBe(
      50,
    )
  })

  it("cai naturalmente quando o capítulo cresce e o aluno estava no meio", () => {
    expect(moduleProgressPct({ maxSlideIndex: 4, slidesTotal: 20, reachedLastSlideAt: null })).toBe(
      25,
    )
  })

  it("nunca ultrapassa 100% quando o capítulo PERDE slides", () => {
    // Marca d'água em 9 num capítulo que agora só tem 3 slides.
    expect(moduleProgressPct({ maxSlideIndex: 9, slidesTotal: 3, reachedLastSlideAt: null })).toBe(
      100,
    )
  })

  it("devolve 0 quando não há denominador", () => {
    expect(moduleProgressPct({ maxSlideIndex: 0, slidesTotal: 0, reachedLastSlideAt: null })).toBe(
      0,
    )
  })
})

describe("courseProgressPct", () => {
  it("conta módulos alcançados, não média de percentuais", () => {
    expect(courseProgressPct(4, 8)).toBe(50)
  })

  it("devolve 0 para curso sem capítulos", () => {
    expect(courseProgressPct(0, 0)).toBe(0)
  })
})

describe("hasNewContentSince", () => {
  it("detecta que o capítulo mudou desde a passagem do aluno", () => {
    expect(hasNewContentSince(9, 14)).toBe(true)
  })

  it("não sinaliza quando o total é o mesmo", () => {
    expect(hasNewContentSince(9, 9)).toBe(false)
  })
})

describe("shouldAdvanceWatermark", () => {
  it("permite a primeira escrita da sessão", () => {
    expect(shouldAdvanceWatermark(0, null)).toBe(true)
  })

  it("permite quando o índice supera a marca", () => {
    expect(shouldAdvanceWatermark(7, 6)).toBe(true)
  })

  it("NÃO escreve ao revisitar um slide anterior", () => {
    expect(shouldAdvanceWatermark(2, 6)).toBe(false)
  })

  it("NÃO escreve ao permanecer no mesmo slide", () => {
    expect(shouldAdvanceWatermark(6, 6)).toBe(false)
  })
})

describe("summarizeCourseView", () => {
  const chapterIds = ["c1", "c2", "c3", "c4"]

  it("devolve pct null quando não há NENHUM dado — nunca 0%", () => {
    const r = summarizeCourseView([], chapterIds, new Map())
    expect(r.pct).toBeNull()
    expect(r.chaptersReached).toBe(0)
  })

  it("conta apenas os módulos efetivamente alcançados", () => {
    const rows = [
      {
        chapter_id: "c1",
        max_slide_index: 8,
        slides_total_at_last_view: 9,
        reached_last_slide_at: "2026-07-30T12:00:00Z",
      },
      {
        chapter_id: "c2",
        max_slide_index: 3,
        slides_total_at_last_view: 10,
        reached_last_slide_at: null,
      },
    ]
    const totals = new Map([
      ["c1", 9],
      ["c2", 10],
    ])
    const r = summarizeCourseView(rows, chapterIds, totals)
    expect(r.chaptersReached).toBe(1)
    expect(r.chaptersTotal).toBe(4)
    expect(r.pct).toBe(25)
  })

  it("sinaliza conteúdo novo sem rebaixar quem já concluiu", () => {
    const rows = [
      {
        chapter_id: "c1",
        max_slide_index: 8,
        slides_total_at_last_view: 9,
        reached_last_slide_at: "2026-07-30T12:00:00Z",
      },
    ]
    const totals = new Map([["c1", 14]]) // instrutor adicionou 5 slides
    const r = summarizeCourseView(rows, chapterIds, totals)
    expect(r.chaptersReached).toBe(1) // continua contando como alcançado
    expect(r.hasNewContent).toBe(true) // mas o gestor fica sabendo
  })
})
