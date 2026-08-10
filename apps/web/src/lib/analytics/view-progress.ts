/**
 * Percorrido x Elaborado — cálculo DERIVADO da exposição por módulo.
 *
 * Contrato: docs/architecture/medicao-percorrido-vs-elaborado.md §5.
 *
 * Nada aqui é armazenado. O percentual é sempre derivado na leitura, de
 * propósito: percentual congelado divergindo do conteúdo é exatamente a doença
 * do `enrollments.progress` atual (que é o clique no botão "Módulo Concluído",
 * não leitura).
 *
 * O que este módulo NÃO faz, e não deve passar a fazer:
 *  - não classifica o aluno ("superficial", "passivo"). Devolve números; quem
 *    conclui é o gestor. Rótulo na pessoa vira estigma organizacional.
 *  - não mistura exposição com engajamento. São duas leituras distintas que
 *    convivem na mesma célula, nunca um score único que esconde a diferença.
 */

/** Linha de `chapter_view_progress` na forma que a leitura precisa. */
export interface ChapterViewProgressRow {
  chapter_id: string
  max_slide_index: number
  slides_total_at_last_view: number
  reached_last_slide_at: string | null
}

export interface ModuleProgressInput {
  maxSlideIndex: number
  /** Total de slides do capítulo AGORA, não no momento da passagem. */
  slidesTotal: number
  reachedLastSlideAt: string | null
}

/**
 * Percorrido de UM módulo, em 0..100.
 *
 * O curto-circuito no `reachedLastSlideAt` é o que dá estabilidade: uma vez que
 * o aluno chegou ao fim, o módulo está percorrido, mesmo que o instrutor
 * adicione slides depois (decisão de produto P2 — conteúdo novo não rebaixa
 * quem já concluiu; a sinalização fica por conta de `hasNewContentSince`).
 */
export function moduleProgressPct({
  maxSlideIndex,
  slidesTotal,
  reachedLastSlideAt,
}: ModuleProgressInput): number {
  if (reachedLastSlideAt) return 100
  if (!slidesTotal || slidesTotal <= 0) return 0
  const pct = ((maxSlideIndex + 1) / slidesTotal) * 100
  // O clamp absorve o caso de o capítulo ter PERDIDO slides depois da passagem.
  return Math.max(0, Math.min(100, pct))
}

/**
 * Percorrido do CURSO, em 0..100.
 *
 * Contagem por módulo alcançado, deliberadamente NÃO a média dos percentuais:
 * meio-caminho em oito módulos não equivale a quatro módulos percorridos, e
 * tratar como equivalente esconderia exatamente o padrão que se quer enxergar.
 */
export function courseProgressPct(chaptersReached: number, chaptersTotal: number): number {
  if (!chaptersTotal || chaptersTotal <= 0) return 0
  return Math.max(0, Math.min(100, (chaptersReached / chaptersTotal) * 100))
}

/**
 * O capítulo ganhou (ou perdeu) slides desde a última passagem deste aluno?
 * Alimenta a sinalização "há conteúdo novo desde a sua passagem" sem rebaixar
 * ninguém.
 */
export function hasNewContentSince(slidesTotalAtLastView: number, slidesTotalNow: number): boolean {
  if (!slidesTotalAtLastView || !slidesTotalNow) return false
  return slidesTotalNow !== slidesTotalAtLastView
}

/**
 * A marca d'água avançou? Usada pelo cliente ANTES de agendar qualquer escrita.
 *
 * `sentWatermark` é `null` enquanto nada foi enviado nesta sessão — o primeiro
 * slide já conta como avanço. Revisitar um slide anterior devolve `false`, que
 * é o que mantém a escrita proporcional ao progresso real e não à navegação.
 */
export function shouldAdvanceWatermark(
  currentIndex: number,
  sentWatermark: number | null,
): boolean {
  if (currentIndex < 0) return false
  if (sentWatermark === null) return true
  return currentIndex > sentWatermark
}

/**
 * Resultado da leitura de exposição para um aluno num curso.
 * `pct` é `null` quando NÃO há dado — e `null` deve virar "sem dado" na UI,
 * jamais "0%". A métrica nasce vazia para todos, e um zero mentiria sobre quem
 * estudou antes de a instrumentação existir.
 */
export interface CourseViewProgress {
  pct: number | null
  chaptersReached: number
  chaptersTotal: number
  hasNewContent: boolean
}

/**
 * Agrega as linhas de um aluno num curso.
 *
 * `slidesTotalByChapter` traz o total ATUAL de slides por capítulo, para o
 * denominador móvel ser resolvido na leitura (§5.3).
 */
export function summarizeCourseView(
  rows: ChapterViewProgressRow[],
  chapterIds: string[],
  slidesTotalByChapter: Map<string, number>,
): CourseViewProgress {
  const chaptersTotal = chapterIds.length
  if (rows.length === 0) {
    return { pct: null, chaptersReached: 0, chaptersTotal, hasNewContent: false }
  }

  const byChapter = new Map(rows.map((r) => [r.chapter_id, r]))
  let reached = 0
  let newContent = false

  for (const chapterId of chapterIds) {
    const row = byChapter.get(chapterId)
    if (!row) continue

    const slidesNow = slidesTotalByChapter.get(chapterId) ?? row.slides_total_at_last_view
    if (
      moduleProgressPct({
        maxSlideIndex: row.max_slide_index,
        slidesTotal: slidesNow,
        reachedLastSlideAt: row.reached_last_slide_at,
      }) >= 100
    ) {
      reached += 1
    }

    if (hasNewContentSince(row.slides_total_at_last_view, slidesNow)) newContent = true
  }

  return {
    pct: courseProgressPct(reached, chaptersTotal),
    chaptersReached: reached,
    chaptersTotal,
    hasNewContent: newContent,
  }
}
