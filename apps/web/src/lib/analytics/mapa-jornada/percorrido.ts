// ---------------------------------------------------------------------------
// Percorrido POR CAPÍTULO — o que a matriz precisa e a leitura da casa descarta.
// ---------------------------------------------------------------------------
// `readViewProgressByStudent` (`view-progress-read.ts:324`) agrega para
// `CourseViewProgress` (percentual do CURSO) e joga fora o detalhe por
// capítulo. A matriz é exatamente esse detalhe. Este módulo chama o mesmo
// `applyEvidenceFloor` (o piso cumulativo por evidência, decisão do Senhor de
// 2026-08-04) e o mesmo `moduleProgressPct`, e devolve o percentual por par
// (pessoa, capítulo).
//
// PURO: recebe estruturas já carregadas, devolve mapas. Nenhuma consulta.
// ---------------------------------------------------------------------------

import { moduleProgressPct } from "@/lib/analytics/view-progress"
import type { ChapterViewProgressRow } from "@/lib/analytics/view-progress"
import { applyEvidenceFloor } from "@/lib/analytics/view-progress-read"
import type { LinhaPercorridoMapa } from "./fonte"

export interface EntradaPercorrido {
  /** Ids do roster (a ordem não importa). */
  alunoIds: readonly string[]
  /** Linhas reais de `chapter_view_progress`, do roster inteiro. */
  linhas: readonly LinhaPercorridoMapa[]
  /** `student_id → capítulos com sessão` (qualquer status). */
  sessoesPorAluno: ReadonlyMap<string, ReadonlySet<string>>
  /** `student_id → (chapter_id → maior order de slide com reflexão)`. */
  pisosPorAluno: ReadonlyMap<string, ReadonlyMap<string, number>>
  /** Capítulos da trilha de cada aluno (o piso não inventa capítulo fora dela). */
  capitulosDoAluno: ReadonlyMap<string, ReadonlySet<string>>
  /** Cursos de cada aluno. O teto do piso é POR CURSO. */
  cursosDoAluno: ReadonlyMap<string, ReadonlySet<string>>
  chapterOrderById: ReadonlyMap<string, number>
  chapterIdsByCourse: ReadonlyMap<string, readonly string[]>
  slidesTotalByChapter: ReadonlyMap<string, number>
}

/**
 * `student_id → (chapter_id → percorrido 0..100)`.
 *
 * Só entram capítulos com alguma linha (real ou sintética do piso). Ausência
 * NÃO vira `0` no mapa: quem consome trata a ausência como "sem dado", e a
 * célula correspondente é cinza (F-05), nunca "0%".
 */
export function percorridoPorCapitulo(e: EntradaPercorrido): Map<string, Map<string, number>> {
  const linhasPorAluno = new Map<string, ChapterViewProgressRow[]>()
  for (const l of e.linhas) {
    const lista = linhasPorAluno.get(l.student_id) ?? []
    lista.push({
      chapter_id: l.chapter_id,
      max_slide_index: l.max_slide_index,
      slides_total_at_last_view: l.slides_total_at_last_view,
      reached_last_slide_at: l.reached_last_slide_at,
    })
    linhasPorAluno.set(l.student_id, lista)
  }

  const out = new Map<string, Map<string, number>>()

  for (const alunoId of e.alunoIds) {
    const inScope = new Set(e.capitulosDoAluno.get(alunoId) ?? [])
    const scopedRows = (linhasPorAluno.get(alunoId) ?? []).filter((r) => inScope.has(r.chapter_id))

    const efetivas = applyEvidenceFloor({
      scopedRows,
      slideFloorByChapter: mapaMutavel(e.pisosPorAluno.get(alunoId)),
      sessionChapters: conjuntoMutavel(e.sessoesPorAluno.get(alunoId)),
      inScope,
      chapterOrderById: new Map(e.chapterOrderById),
      chapterIdsByCourse: new Map(
        [...e.chapterIdsByCourse].map(([curso, ids]) => [curso, [...ids]]),
      ),
      courseIds: e.cursosDoAluno.get(alunoId) ?? [],
      slidesTotalByChapter: new Map(e.slidesTotalByChapter),
    })

    const porCapitulo = new Map<string, number>()
    for (const linha of efetivas) {
      if (!inScope.has(linha.chapter_id)) continue
      const slidesAgora =
        e.slidesTotalByChapter.get(linha.chapter_id) ?? linha.slides_total_at_last_view
      porCapitulo.set(
        linha.chapter_id,
        moduleProgressPct({
          maxSlideIndex: linha.max_slide_index,
          slidesTotal: slidesAgora,
          reachedLastSlideAt: linha.reached_last_slide_at,
        }),
      )
    }
    out.set(alunoId, porCapitulo)
  }

  return out
}

/** `applyEvidenceFloor` recebe `Map`/`Set` mutáveis; a fonte aqui é readonly. */
function mapaMutavel(
  origem: ReadonlyMap<string, number> | undefined,
): Map<string, number> | undefined {
  return origem === undefined ? undefined : new Map(origem)
}

function conjuntoMutavel(origem: ReadonlySet<string> | undefined): Set<string> | undefined {
  return origem === undefined ? undefined : new Set(origem)
}
