import {
  type ChapterViewProgressRow,
  type CourseViewProgress,
  summarizeCourseView,
} from "./view-progress"

/**
 * Percorrido x Elaborado — LEITURA da exposição para a tabela do gestor.
 *
 * Contrato: docs/architecture/medicao-percorrido-vs-elaborado.md §5.
 *
 * DEGRADAÇÃO GRACIOSA É REQUISITO, NÃO ZELO EXTRA: a tabela
 * `chapter_view_progress` pode não existir ainda no ambiente (a migration é
 * aplicada separadamente, por decisão de governança). Qualquer falha de leitura
 * devolve "sem dado" e a página do gestor continua de pé — ela é usada por
 * cliente pagante e não pode quebrar por causa de uma métrica nova.
 */

/**
 * Cliente Supabase reduzido ao que esta leitura usa. Deliberadamente estrutural
 * para o teste poder injetar um duplo sem carregar o tipo gerado inteiro.
 */
export interface ViewProgressQueryClient {
  from(table: string): {
    select(columns: string): {
      in(column: string, values: string[]): PromiseLike<{ data: unknown[] | null; error: unknown }>
    }
  }
}

interface ChapterRow {
  id: string
  course_id: string
}

interface SlideRow {
  chapter_id: string
}

interface ProgressRow extends ChapterViewProgressRow {
  student_id: string
}

const PROGRESS_COLUMNS =
  "student_id, chapter_id, max_slide_index, slides_total_at_last_view, reached_last_slide_at"

/**
 * Devolve o percorrido por aluno. Alunos sem dado simplesmente NÃO aparecem no
 * Map — o chamador trata a ausência como "sem dado", nunca como 0%.
 */
export async function readViewProgressByStudent(
  client: ViewProgressQueryClient,
  studentIds: string[],
  courseIdsByStudent: Map<string, Set<string>>,
): Promise<Map<string, CourseViewProgress>> {
  const result = new Map<string, CourseViewProgress>()
  if (studentIds.length === 0) return result

  const allCourseIds = [...new Set([...courseIdsByStudent.values()].flatMap((s) => [...s]))]
  if (allCourseIds.length === 0) return result

  try {
    const { data: chapterData, error: chapterErr } = await client
      .from("chapters")
      .select("id, course_id")
      .in("course_id", allCourseIds)

    if (chapterErr || !chapterData) return result

    const chapters = chapterData as ChapterRow[]
    if (chapters.length === 0) return result

    const chapterIds = chapters.map((c) => c.id)
    const chapterIdsByCourse = new Map<string, string[]>()
    for (const c of chapters) {
      const list = chapterIdsByCourse.get(c.course_id) ?? []
      list.push(c.id)
      chapterIdsByCourse.set(c.course_id, list)
    }

    // Denominador ATUAL de cada capítulo (§5.3, denominador móvel): o total de
    // slides de hoje, não o do momento em que o aluno passou.
    const { data: slideData } = await client
      .from("chapter_slides")
      .select("chapter_id")
      .in("chapter_id", chapterIds)

    const slidesTotalByChapter = new Map<string, number>()
    for (const s of (slideData ?? []) as SlideRow[]) {
      slidesTotalByChapter.set(s.chapter_id, (slidesTotalByChapter.get(s.chapter_id) ?? 0) + 1)
    }

    const { data: progressData, error: progressErr } = await client
      .from("chapter_view_progress")
      .select(PROGRESS_COLUMNS)
      .in("student_id", studentIds)

    // Tabela ainda não aplicada, sem permissão, ou qualquer outra falha:
    // "sem dado" para todos, sem exceção propagada.
    if (progressErr || !progressData) return result

    const rowsByStudent = new Map<string, ProgressRow[]>()
    for (const r of progressData as ProgressRow[]) {
      const list = rowsByStudent.get(r.student_id) ?? []
      list.push(r)
      rowsByStudent.set(r.student_id, list)
    }

    for (const studentId of studentIds) {
      const rows = rowsByStudent.get(studentId)
      if (!rows || rows.length === 0) continue

      const studentChapterIds = [...(courseIdsByStudent.get(studentId) ?? [])].flatMap(
        (cid) => chapterIdsByCourse.get(cid) ?? [],
      )
      if (studentChapterIds.length === 0) continue

      const inScope = new Set(studentChapterIds)
      const scopedRows = rows.filter((r) => inScope.has(r.chapter_id))

      result.set(
        studentId,
        summarizeCourseView(scopedRows, studentChapterIds, slidesTotalByChapter),
      )
    }

    return result
  } catch {
    // Rede, tabela ausente, schema divergente: a métrica some, a página fica.
    return result
  }
}
