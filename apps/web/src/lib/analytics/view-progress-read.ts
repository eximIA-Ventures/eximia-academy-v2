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
  /** Só presente desde o piso por exercício; ausente em qualquer duplo antigo. */
  id?: string | null
  order?: number | null
}

interface ProgressRow extends ChapterViewProgressRow {
  student_id: string
}

/**
 * Uma reflexão, reduzida ao par que interessa aqui. O chamador JÁ varre
 * `slide_reflections` para outras métricas — `slide_id` é uma coluna a mais na
 * MESMA projeção, nunca uma consulta nova.
 */
export interface ReflectionSlideRow {
  student_id: string
  slide_id?: string | null
}

const PROGRESS_COLUMNS =
  "student_id, chapter_id, max_slide_index, slides_total_at_last_view, reached_last_slide_at"

/**
 * O PISO POR EVIDÊNCIA DE EXERCÍCIO (Hugo, 2026-08-04).
 *
 * A regra, em uma frase: interagir com um ponto PROVA presença nele. Quem
 * respondeu uma reflexão no slide de índice N de um capítulo necessariamente
 * passou pelos slides 0..N — logo, na ausência de telemetria, a reflexão é um
 * PISO legítimo do percorrido daquele capítulo.
 *
 * Duas propriedades que não podem se perder:
 *  1. É PISO, com `max()`. Onde há telemetria, a telemetria vence se for maior.
 *     Um "piso" que rebaixasse alguém seria um teto disfarçado.
 *  2. Não fabrica conclusão. `reached_last_slide_at` continua `null` na linha
 *     sintética: chegar ao slide N não é ter chegado ao FIM do capítulo, e
 *     `moduleProgressPct` só devolve 100 por razão real (índice+1 == total).
 *
 * MEDIÇÃO ANTES DE ESCREVER (produção, 2026-08-04) — e ela importa para quem
 * ler isto depois: alunos com reflexão e NENHUMA linha de
 * `chapter_view_progress` = **0**. Pares (aluno, capítulo) com reflexão e sem
 * linha daquele capítulo = **0 pares, 0 alunos**. Ou seja: hoje este piso não
 * resgata ninguém, e ele NÃO é a explicação de nenhum "sem dado" observado
 * (aquele era o multi-hat, ver `area-gestor.ts`). Ele existe como seguro por
 * invariante — a telemetria de slides é recente e pode falhar, a reflexão é
 * escrita pelo próprio aluno e não falha —, não como correção de um problema
 * medido. Quem vier depois e encontrar isto ligado: não é daqui que vem o
 * número de alguém, salvo se a medição acima tiver mudado.
 *
 * Pura: recebe linhas já carregadas, devolve linhas. Exportada para poder ser
 * afirmada sem passar por um duplo de banco.
 */
export function applyExerciseFloor(
  scopedRows: ChapterViewProgressRow[],
  /** chapter_id → maior `order` de slide COM reflexão deste aluno. */
  floorByChapter: Map<string, number> | undefined,
  /** Capítulos em escopo (o piso não inventa capítulo fora da trilha). */
  inScope: Set<string>,
  slidesTotalByChapter: Map<string, number>,
): ChapterViewProgressRow[] {
  if (!floorByChapter || floorByChapter.size === 0) return scopedRows

  const byChapter = new Map(scopedRows.map((r) => [r.chapter_id, r]))
  const out = [...scopedRows]

  for (const [chapterId, floorIndex] of floorByChapter) {
    if (!inScope.has(chapterId)) continue
    const existing = byChapter.get(chapterId)

    if (!existing) {
      out.push({
        chapter_id: chapterId,
        max_slide_index: floorIndex,
        // Denominador de HOJE; quando desconhecido, `floorIndex + 1` é o mínimo
        // coerente com o que a evidência prova (ela não diz nada sobre o resto).
        slides_total_at_last_view: slidesTotalByChapter.get(chapterId) ?? floorIndex + 1,
        reached_last_slide_at: null,
      })
      continue
    }

    if (floorIndex > existing.max_slide_index) {
      // Substitui a linha, sem MUTAR a que veio do banco: outra leitura pode
      // estar olhando para o mesmo objeto.
      const idx = out.indexOf(existing)
      out[idx] = { ...existing, max_slide_index: floorIndex }
    }
  }

  return out
}

/**
 * `student_id → (chapter_id → maior order com reflexão)`. Reflexão sem
 * `slide_id`, ou apontando para slide fora do universo carregado, é ignorada —
 * não dá para provar presença num ponto que não se sabe onde fica.
 */
function exerciseFloors(
  reflections: ReflectionSlideRow[],
  slideById: Map<string, { chapterId: string; order: number }>,
): Map<string, Map<string, number>> {
  const byStudent = new Map<string, Map<string, number>>()
  for (const r of reflections) {
    if (!r.slide_id) continue
    const slide = slideById.get(r.slide_id)
    if (!slide) continue
    const chapters = byStudent.get(r.student_id) ?? new Map<string, number>()
    const prev = chapters.get(slide.chapterId)
    if (prev === undefined || slide.order > prev) chapters.set(slide.chapterId, slide.order)
    byStudent.set(r.student_id, chapters)
  }
  return byStudent
}

/**
 * Devolve o percorrido por aluno. Alunos sem dado simplesmente NÃO aparecem no
 * Map — o chamador trata a ausência como "sem dado", nunca como 0%.
 *
 * `reflections` é opcional: com ele, entra o piso por evidência de exercício
 * (ver {@link applyExerciseFloor}); sem ele, o comportamento é exatamente o de
 * antes. Todo chamador desta função já varre `slide_reflections` por outro
 * motivo, então ligá-lo custa uma coluna a mais na projeção, não uma consulta.
 */
export async function readViewProgressByStudent(
  client: ViewProgressQueryClient,
  studentIds: string[],
  courseIdsByStudent: Map<string, Set<string>>,
  reflections?: ReflectionSlideRow[],
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
    //
    // `id` e `order` entram na MESMA varredura (nenhuma consulta nova) porque o
    // piso por exercício precisa saber onde cada slide fica: reflexão → slide →
    // (capítulo, posição). `order` vai entre aspas por ser palavra reservada no
    // PostgREST, a mesma forma usada em `area-gestor.ts`.
    const { data: slideData } = await client
      .from("chapter_slides")
      .select('id, chapter_id, "order"')
      .in("chapter_id", chapterIds)

    const slidesTotalByChapter = new Map<string, number>()
    const slideById = new Map<string, { chapterId: string; order: number }>()
    for (const s of (slideData ?? []) as SlideRow[]) {
      slidesTotalByChapter.set(s.chapter_id, (slidesTotalByChapter.get(s.chapter_id) ?? 0) + 1)
      // `order` é 0-based no banco (verificado: um capítulo de 4 slides traz
      // 0,1,2,3), a MESMA base de `max_slide_index` — comparar os dois é
      // comparar a mesma régua, sem correção de índice.
      if (s.id && typeof s.order === "number") {
        slideById.set(s.id, { chapterId: s.chapter_id, order: s.order })
      }
    }
    const floorsByStudent = exerciseFloors(reflections ?? [], slideById)

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
      const floors = floorsByStudent.get(studentId)
      // Nem telemetria nem evidência de exercício = de fato sem dado. A segunda
      // metade da condição é o que abre a porta do piso: antes, quem só tinha
      // reflexão parava aqui e virava "sem dado" sem que ninguém perguntasse.
      if ((!rows || rows.length === 0) && (!floors || floors.size === 0)) continue

      const studentChapterIds = [...(courseIdsByStudent.get(studentId) ?? [])].flatMap(
        (cid) => chapterIdsByCourse.get(cid) ?? [],
      )
      if (studentChapterIds.length === 0) continue

      const inScope = new Set(studentChapterIds)
      const scopedRows = (rows ?? []).filter((r) => inScope.has(r.chapter_id))
      const effectiveRows = applyExerciseFloor(scopedRows, floors, inScope, slidesTotalByChapter)

      result.set(
        studentId,
        summarizeCourseView(effectiveRows, studentChapterIds, slidesTotalByChapter),
      )
    }

    return result
  } catch {
    // Rede, tabela ausente, schema divergente: a métrica some, a página fica.
    return result
  }
}
