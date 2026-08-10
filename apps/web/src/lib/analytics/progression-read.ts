import { type InteractionPoint, type ProgressionResult, courseProgression } from "./progression"

/**
 * Percorrido x Progressão — LEITURA da progressão para a tabela do gestor.
 *
 * Contrato: `docs/architecture/percorrido-progressao-conclusao.md` §3.3.
 *
 * Progressão = interagiu com TODOS os pontos de interação existentes. Capítulo
 * sem ponto algum não entra no denominador, e curso sem ponto nenhum devolve
 * `null` ("sem dado").
 *
 * DEGRADAÇÃO GRACIOSA É REQUISITO: qualquer falha devolve Map vazio, e Map
 * vazio vira "sem dado" na UI. Esta leitura roda na página do gestor, usada por
 * cliente pagante, e não pode derrubá-la. Vale especialmente hoje: a coluna
 * `interaction_type` foi criada mas o recálculo ainda não rodou, então TODAS as
 * linhas estão sem tipo — o resultado correto é "sem dado", não um erro.
 */

/** Cliente reduzido ao que esta leitura usa (evita o TS2589 do tipo gerado). */
export interface ProgressionQueryClient {
  from(table: string): {
    select(columns: string): {
      in(column: string, values: string[]): PromiseLike<{ data: unknown[] | null; error: unknown }>
      eq(
        column: string,
        value: string,
      ): {
        in(
          column: string,
          values: string[],
        ): PromiseLike<{ data: unknown[] | null; error: unknown }>
      }
    }
  }
}

interface ChapterRow {
  id: string
  course_id: string
}

export async function readProgressionByStudent(
  client: ProgressionQueryClient,
  studentIds: string[],
  courseIdsByStudent: Map<string, Set<string>>,
): Promise<Map<string, ProgressionResult>> {
  const result = new Map<string, ProgressionResult>()
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

    // ---- Pontos EXISTENTES no conteúdo -------------------------------------
    // (a) slides marcados como ponto pela etapa 2/3
    const { data: pointSlides } = await client
      .from("chapter_slides")
      .select("id, chapter_id, interaction_type")
      .in("chapter_id", chapterIds)

    const slidePoints: InteractionPoint[] = (
      (pointSlides ?? []) as Array<{
        id: string
        chapter_id: string
        interaction_type: string | null
      }>
    )
      .filter((s) => s.interaction_type !== null)
      .map((s) => ({ chapterId: s.chapter_id, slideId: s.id, type: "reflection" as const }))

    // (b) um ponto socrático por capítulo com pergunta ativa
    const { data: activeQuestions } = await client
      .from("questions")
      .select("chapter_id, status")
      .in("chapter_id", chapterIds)

    const socraticChapterIds = new Set(
      ((activeQuestions ?? []) as Array<{ chapter_id: string; status: string }>)
        .filter((q) => q.status === "active")
        .map((q) => q.chapter_id),
    )

    const socraticPoints: InteractionPoint[] = [...socraticChapterIds].map((chapterId) => ({
      chapterId,
      slideId: null,
      type: "socratic" as const,
    }))

    const pointsByChapter = new Map<string, InteractionPoint[]>()
    for (const p of [...slidePoints, ...socraticPoints]) {
      const list = pointsByChapter.get(p.chapterId) ?? []
      list.push(p)
      pointsByChapter.set(p.chapterId, list)
    }

    // ---- O que os alunos RESPONDERAM ---------------------------------------
    const { data: reflections } = await client
      .from("slide_reflections")
      .select("student_id, slide_id")
      .in("student_id", studentIds)

    const reflectedByStudent = new Map<string, Set<string>>()
    for (const r of (reflections ?? []) as Array<{ student_id: string; slide_id: string | null }>) {
      if (!r.slide_id) continue
      const set = reflectedByStudent.get(r.student_id) ?? new Set<string>()
      set.add(r.slide_id)
      reflectedByStudent.set(r.student_id, set)
    }

    const { data: sessions } = await client
      .from("sessions")
      .select("student_id, chapter_id, status")
      .in("student_id", studentIds)

    const socraticDoneByStudent = new Map<string, Set<string>>()
    for (const s of (sessions ?? []) as Array<{
      student_id: string
      chapter_id: string | null
      status: string
    }>) {
      if (s.status !== "completed" || !s.chapter_id) continue
      const set = socraticDoneByStudent.get(s.student_id) ?? new Set<string>()
      set.add(s.chapter_id)
      socraticDoneByStudent.set(s.student_id, set)
    }

    // ---- Deriva por aluno ---------------------------------------------------
    for (const studentId of studentIds) {
      const studentChapterIds = [...(courseIdsByStudent.get(studentId) ?? [])].flatMap(
        (cid) => chapterIdsByCourse.get(cid) ?? [],
      )
      if (studentChapterIds.length === 0) continue

      const points = studentChapterIds.flatMap((cid) => pointsByChapter.get(cid) ?? [])

      result.set(
        studentId,
        courseProgression(
          points,
          {
            reflectedSlideIds: reflectedByStudent.get(studentId) ?? new Set(),
            completedSocraticChapterIds: socraticDoneByStudent.get(studentId) ?? new Set(),
          },
          studentChapterIds,
        ),
      )
    }

    return result
  } catch {
    // Tabela ausente, coluna nova ainda não recalculada, rede: some a métrica,
    // fica a página.
    return result
  }
}
