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
  /**
   * Posição do capítulo no curso. Só presente desde o piso cumulativo; ausente
   * em qualquer duplo antigo, e a ausência degrada para o piso de slide (ver
   * {@link applyEvidenceFloor}) em vez de quebrar.
   */
  order?: number | null
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

/**
 * Uma sessão socrática, reduzida ao par que interessa aqui. Como a reflexão,
 * `chapter_id` é uma coluna a mais numa varredura que os três chamadores já
 * fazem, nunca uma consulta nova.
 *
 * `status` está declarado DE PROPÓSITO e NÃO é lido — ver a justificativa da
 * decisão em {@link sessionChaptersOf}. Quem vier trocar a regra encontra o
 * campo aqui, e o porquê de ele estar ignorado, no mesmo lugar.
 */
export interface SessionChapterRow {
  student_id: string
  chapter_id?: string | null
  status?: string | null
}

const PROGRESS_COLUMNS =
  "student_id, chapter_id, max_slide_index, slides_total_at_last_view, reached_last_slide_at"

export interface EvidenceFloorInput {
  /** Telemetria REAL do aluno, já filtrada para a trilha dele. */
  scopedRows: ChapterViewProgressRow[]
  /** chapter_id → maior `order` de slide COM reflexão deste aluno. */
  slideFloorByChapter: Map<string, number> | undefined
  /** Capítulos onde este aluno tem sessão socrática (qualquer status). */
  sessionChapters: Set<string> | undefined
  /** Capítulos da trilha do aluno (o piso não inventa capítulo fora dela). */
  inScope: Set<string>
  /** chapter_id → `chapters.order`. Vazio degrada para o piso de slide. */
  chapterOrderById: Map<string, number>
  /** course_id → capítulos daquele curso. */
  chapterIdsByCourse: Map<string, string[]>
  /** Cursos do aluno. O teto é POR CURSO — o módulo 4 de um não diz nada do outro. */
  courseIds: Iterable<string>
  /** Total ATUAL de slides por capítulo (denominador móvel, §5.3). */
  slidesTotalByChapter: Map<string, number>
}

/**
 * O PISO CUMULATIVO POR EVIDÊNCIA (Hugo, 2026-08-04).
 *
 * A regra, na fala do Hugo: *"se ela interagiu no módulo 4, até o módulo 4,
 * naquela interação tem que estar concluído pelo menos no percorrido"*. O piso
 * ATRAVESSA capítulos: evidência no módulo 4 implica os módulos 1, 2 e 3
 * percorridos, e o módulo 4 percorrido pelo menos até o ponto da interação.
 *
 * A PRIMEIRA VERSÃO ERA ESTREITA DEMAIS, e o número diz o tamanho do erro. Ela
 * só aplicava piso DENTRO do capítulo (reflexão no slide N ⇒ slides 0..N
 * daquele capítulo). Medido em produção em 2026-08-04:
 *
 * | Medição | Valor |
 * |:---|---:|
 * | Pares (aluno, capítulo) abaixo do teto de evidência SEM nenhuma linha de `chapter_view_progress` | **287** |
 * | Alunos afetados | **104** |
 * | Pares resgatados pelo piso só-dentro-do-capítulo (a versão anterior) | **0** |
 *
 * O piso anterior era inerte: resgatava 0 pares e 0 alunos. Este resgata 287
 * pares de 104 pessoas. Efeitos reais observados no Percorrido do aluno:
 * 13%→88%, 63%→100%, 25%→75%, 0%→25%.
 *
 * HONESTIDADE EPISTÊMICA — LEIA ANTES DE "CORRIGIR" ISTO. Foi verificado neste
 * repositório que **NÃO existe travamento sequencial de capítulos** (nenhuma
 * trava de navegação em `app/(platform)/courses`; um aluno pode, em tese,
 * abrir o módulo 4 sem passar pelos anteriores). Portanto *"interagiu no
 * módulo 4 ⇒ passou pelos módulos 1 a 3"* é uma **heurística defensável, não
 * uma prova**. É uma **decisão de produto do Hugo**, tomada com o número de
 * 287 pares na mesa: entre exibir "sem dado" para 104 pessoas que
 * comprovadamente usaram a ferramenta e assumir o caminho normal do curso, ele
 * escolheu o segundo. Quem quiser reverter está mexendo numa decisão, não
 * consertando uma dedução lógica errada.
 *
 * Três propriedades que não podem se perder:
 *  1. É PISO, com `max()`. Onde há telemetria maior, a telemetria vence. Um
 *     "piso" que rebaixasse alguém seria um teto disfarçado.
 *  2. O capítulo do TETO não é concluído automaticamente: ele recebe só o piso
 *     de SLIDE (até onde a reflexão prova presença). A interação pode ser no
 *     slide 3 de 25, e marcar o capítulo inteiro afirmaria o que não se sabe.
 *     A própria fala do Hugo fala do ponto da interação ("naquela interação"),
 *     não do fim do módulo.
 *  3. As linhas sintéticas existem SÓ EM MEMÓRIA, no momento da leitura. Nada
 *     é escrito em `chapter_view_progress` — o banco não muda.
 *
 * Pura: recebe estruturas já carregadas, devolve linhas. Exportada para poder
 * ser afirmada sem passar por um duplo de banco.
 */
export function applyEvidenceFloor(input: EvidenceFloorInput): ChapterViewProgressRow[] {
  const {
    scopedRows,
    slideFloorByChapter,
    sessionChapters,
    inScope,
    chapterOrderById,
    chapterIdsByCourse,
    courseIds,
    slidesTotalByChapter,
  } = input

  // Capítulos com evidência DIRETA (reflexão ou sessão), dentro da trilha.
  //
  // ESCOLHA DE ESCOPO, considerada e não feita: uma LINHA DE TELEMETRIA num
  // capítulo adiantado também "prova" presença, e pela mesma heurística elevaria
  // o teto. Ela NÃO entra aqui de propósito. A medição dos 287 pares foi feita
  // com o teto definido por reflexão e sessão (os artefatos que o próprio aluno
  // cria); incluir telemetria mudaria mais números do que foi medido, e isso é
  // decisão de produto nova, não extensão desta. Registrado para quem vier: a
  // omissão é deliberada, não esquecimento.
  const evidence = new Set<string>()
  for (const chapterId of slideFloorByChapter?.keys() ?? []) {
    if (inScope.has(chapterId)) evidence.add(chapterId)
  }
  for (const chapterId of sessionChapters ?? []) {
    if (inScope.has(chapterId)) evidence.add(chapterId)
  }
  if (evidence.size === 0) return scopedRows

  const out = [...scopedRows]
  const indexByChapter = new Map<string, number>()
  out.forEach((row, i) => indexByChapter.set(row.chapter_id, i))

  /**
   * Eleva o percorrido de um capítulo até `floorIndex`, ou cria a linha
   * sintética se não houver telemetria. É AQUI que o `max()` mora — chamar
   * duas vezes com pisos diferentes deixa o maior, e a ordem das chamadas é
   * irrelevante.
   */
  const raiseTo = (chapterId: string, floorIndex: number) => {
    const at = indexByChapter.get(chapterId)

    if (at === undefined) {
      indexByChapter.set(chapterId, out.length)
      out.push({
        chapter_id: chapterId,
        max_slide_index: floorIndex,
        // CUIDADO — ESTE CAMPO NÃO É DECORATIVO. `summarizeCourseView` compara
        // `slides_total_at_last_view` com o total de HOJE para acender
        // `hasNewContent` ("há conteúdo novo desde a sua passagem"). Uma linha
        // sintética com um total mal escolhido faria a interface anunciar
        // conteúdo novo, falsamente, para as 104 pessoas resgatadas aqui. Ao
        // gravar exatamente o total de hoje, `hasNewContentSince(x, x)` é
        // sempre `false`. No fallback (capítulo sem slides conhecidos),
        // `summarizeCourseView` cai no PRÓPRIO valor da linha como denominador,
        // então os dois lados da comparação continuam idênticos.
        slides_total_at_last_view: slidesTotalByChapter.get(chapterId) ?? floorIndex + 1,
        // Não fabrica conclusão: `moduleProgressPct` só devolve 100 por razão
        // real (índice+1 == total), nunca por um carimbo inventado.
        reached_last_slide_at: null,
      })
      return
    }

    const existing = out[at]
    if (floorIndex > existing.max_slide_index) {
      // Substitui a linha, sem MUTAR a que veio do banco: outra leitura pode
      // estar olhando para o mesmo objeto. `slides_total_at_last_view` fica
      // como veio — é telemetria real, e `hasNewContent` continua dizendo a
      // verdade sobre a passagem que de fato aconteceu.
      out[at] = { ...existing, max_slide_index: floorIndex }
    }
  }

  // 1) O TETO, por curso. Todo capítulo estritamente ABAIXO dele conta como
  //    percorrido completo (o aluno teve de atravessá-lo para chegar lá).
  for (const courseId of courseIds) {
    const chapters = chapterIdsByCourse.get(courseId) ?? []

    let ceilingOrder: number | undefined
    for (const chapterId of chapters) {
      if (!evidence.has(chapterId)) continue
      const order = chapterOrderById.get(chapterId)
      if (order === undefined) continue
      if (ceilingOrder === undefined || order > ceilingOrder) ceilingOrder = order
    }
    // Sem `chapters.order` (duplo antigo, dado incompleto) não há teto a
    // determinar: degrada para o piso de slide do passo 2, nunca inventa ordem.
    if (ceilingOrder === undefined) continue

    for (const chapterId of chapters) {
      if (!inScope.has(chapterId)) continue
      const order = chapterOrderById.get(chapterId)
      if (order === undefined || order >= ceilingOrder) continue
      const slidesTotal = slidesTotalByChapter.get(chapterId)
      // Capítulo sem slides conhecidos não tem "completo" definível. Fica de
      // fora — direção conservadora, e a mesma que a telemetria real teria.
      if (!slidesTotal || slidesTotal <= 0) continue
      raiseTo(chapterId, slidesTotal - 1)
    }
  }

  // 2) O piso de SLIDE, dentro do capítulo. Vale para qualquer capítulo com
  //    reflexão, e é o único piso que o capítulo do teto recebe.
  for (const [chapterId, floorIndex] of slideFloorByChapter ?? []) {
    if (!inScope.has(chapterId)) continue
    raiseTo(chapterId, floorIndex)
  }

  return out
}

/**
 * `student_id → (chapter_id → maior order com reflexão)`. Reflexão sem
 * `slide_id`, ou apontando para slide fora do universo carregado, é ignorada —
 * não dá para provar presença num ponto que não se sabe onde fica.
 */
function slideFloorsOf(
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
 * `student_id → capítulos onde ele tem sessão socrática`.
 *
 * DECISÃO: **qualquer `status` conta**, não só `completed`. Justificativa, e é
 * deliberada, não desatenção:
 *
 *  - A pergunta que a sessão responde aqui é *"o aluno chegou até este
 *    módulo?"*, não *"o aluno terminou este módulo?"*. Uma sessão existir já
 *    prova que ele abriu o exercício socrático daquele capítulo. Exigir
 *    `completed` trocaria a pergunta por outra (conclusão), e deixaria de fora
 *    exatamente quem começou e parou — que é presença igualmente comprovada.
 *  - É a MESMA régua que a casa já aplica: `whereStoppedChapterIdOf`
 *    (area-gestor.ts) deriva "onde o aluno parou" da sessão mais recente com
 *    capítulo, **qualquer status**, com o mesmo raciocínio.
 *
 * O conservadorismo é aplicado do outro lado, onde ele de fato protege: a
 * sessão entra SÓ na determinação do teto e **não** define piso de slide dentro
 * do próprio capítulo do teto (ela não tem granularidade de slide). Ou seja,
 * ela é permissiva sobre "esteve aqui" — que é literalmente o pedido — e
 * silenciosa sobre "até que ponto dentro do capítulo", que ninguém sabe.
 */
function sessionChaptersOf(sessions: SessionChapterRow[]): Map<string, Set<string>> {
  const byStudent = new Map<string, Set<string>>()
  for (const s of sessions) {
    if (!s.chapter_id) continue
    const chapters = byStudent.get(s.student_id) ?? new Set<string>()
    chapters.add(s.chapter_id)
    byStudent.set(s.student_id, chapters)
  }
  return byStudent
}

/**
 * Devolve o percorrido por aluno. Alunos sem dado simplesmente NÃO aparecem no
 * Map — o chamador trata a ausência como "sem dado", nunca como 0%.
 *
 * `reflections` e `sessions` são opcionais: com eles entra o piso cumulativo
 * por evidência (ver {@link applyEvidenceFloor}); sem eles, o comportamento é
 * exatamente o de antes. Todo chamador desta função já varre `slide_reflections`
 * e `sessions` por outro motivo, então ligá-los custa UMA COLUNA a mais na
 * projeção (`slide_id`, `chapter_id`), nunca uma consulta nova.
 */
export async function readViewProgressByStudent(
  client: ViewProgressQueryClient,
  studentIds: string[],
  courseIdsByStudent: Map<string, Set<string>>,
  reflections?: ReflectionSlideRow[],
  sessions?: SessionChapterRow[],
): Promise<Map<string, CourseViewProgress>> {
  const result = new Map<string, CourseViewProgress>()
  if (studentIds.length === 0) return result

  const allCourseIds = [...new Set([...courseIdsByStudent.values()].flatMap((s) => [...s]))]
  if (allCourseIds.length === 0) return result

  try {
    // `order` entra na MESMA varredura (nenhuma consulta nova) porque o piso
    // CUMULATIVO precisa saber a posição do capítulo no curso: evidência no
    // módulo 4 só é dizível como "1, 2 e 3 percorridos" se houver ordem. Vai
    // entre aspas por ser palavra reservada no PostgREST, a mesma forma usada
    // em `area-gestor.ts`.
    const { data: chapterData, error: chapterErr } = await client
      .from("chapters")
      .select('id, course_id, "order"')
      .in("course_id", allCourseIds)

    if (chapterErr || !chapterData) return result

    const chapters = chapterData as ChapterRow[]
    if (chapters.length === 0) return result

    const chapterIds = chapters.map((c) => c.id)
    const chapterIdsByCourse = new Map<string, string[]>()
    const chapterOrderById = new Map<string, number>()
    for (const c of chapters) {
      const list = chapterIdsByCourse.get(c.course_id) ?? []
      list.push(c.id)
      chapterIdsByCourse.set(c.course_id, list)
      if (typeof c.order === "number") chapterOrderById.set(c.id, c.order)
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
    const slideFloorsByStudent = slideFloorsOf(reflections ?? [], slideById)
    const sessionChaptersByStudent = sessionChaptersOf(sessions ?? [])

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
      const slideFloors = slideFloorsByStudent.get(studentId)
      const sessionChapters = sessionChaptersByStudent.get(studentId)
      // Nem telemetria nem evidência de interação = de fato sem dado. A segunda
      // metade da condição é o que abre a porta do piso: antes, quem só tinha
      // reflexão ou sessão parava aqui e virava "sem dado" sem que ninguém
      // perguntasse.
      if (
        (!rows || rows.length === 0) &&
        (!slideFloors || slideFloors.size === 0) &&
        (!sessionChapters || sessionChapters.size === 0)
      ) {
        continue
      }

      const studentCourseIds = courseIdsByStudent.get(studentId) ?? new Set<string>()
      const studentChapterIds = [...studentCourseIds].flatMap(
        (cid) => chapterIdsByCourse.get(cid) ?? [],
      )
      if (studentChapterIds.length === 0) continue

      const inScope = new Set(studentChapterIds)
      const scopedRows = (rows ?? []).filter((r) => inScope.has(r.chapter_id))
      const effectiveRows = applyEvidenceFloor({
        scopedRows,
        slideFloorByChapter: slideFloors,
        sessionChapters,
        inScope,
        chapterOrderById,
        chapterIdsByCourse,
        courseIds: studentCourseIds,
        slidesTotalByChapter,
      })

      // Nada afirmável (ex.: evidência SÓ de sessão no primeiro capítulo — sabe-se
      // que ele esteve lá, não até onde). Ausência do Map continua sendo "sem
      // dado" para o chamador; jamais 0%, que acusaria quem de fato estudou (B9).
      if (effectiveRows.length === 0) continue

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
