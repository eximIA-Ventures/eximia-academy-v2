/**
 * Percorrido x Progressão — cálculo DERIVADO da PROGRESSÃO.
 *
 * Contrato: `docs/architecture/percorrido-progressao-conclusao.md` §3.3.
 *
 * Definição do dono do produto (Hugo, 2026-07-31):
 *   **PROGRESSÃO = a pessoa interagiu com TODOS os pontos de interação.**
 *   É o TETO. `percorrido` (passar pelos slides) é o PISO.
 *   Invariante: `progressão ≤ percorrido`, sempre.
 *
 * A invariante NÃO é imposta aqui, e isso é deliberado: ela é garantida na
 * ESCRITA (ver `record-slide-presence.ts`, etapa 1), porque interagir com um
 * ponto registra presença no slide onde ele vive. Um cálculo que "corrigisse"
 * o número aqui estaria escondendo um defeito de captura em vez de expô-lo.
 *
 * Nada é armazenado. Deriva na leitura, mesma razão do percorrido: percentual
 * congelado diverge do conteúdo, e é exatamente a doença do
 * `enrollments.progress` atual.
 */

/** Um ponto de interação existente no conteúdo. */
export interface InteractionPoint {
  chapterId: string
  /** `slideId` para reflexão; para socrática, o ponto é do capítulo inteiro. */
  slideId: string | null
  type: "reflection" | "socratic" | "quiz" | "assignment" | "scenario"
}

/** O que o aluno de fato respondeu. */
export interface AnsweredPoints {
  /** Slides com reflexão registrada. */
  reflectedSlideIds: Set<string>
  /** Capítulos com sessão socrática concluída. */
  completedSocraticChapterIds: Set<string>
}

export interface ProgressionResult {
  /**
   * 0..100, ou **`null` quando NÃO HÁ NADA A MEDIR** (o conteúdo não tem
   * nenhum ponto de interação). `null` vira "sem dado" na UI — jamais 0%,
   * que acusaria o aluno de não fazer algo que não existe, e jamais 100%,
   * que daria mérito por nada.
   */
  pct: number | null
  answered: number
  total: number
  /** Capítulos que ficaram FORA do denominador por não terem ponto algum. */
  chaptersWithoutPoints: string[]
}

/**
 * Um ponto foi respondido?
 *
 * Reflexão: existe registro para aquele slide.
 * Socrática: existe sessão concluída naquele capítulo.
 */
function isAnswered(point: InteractionPoint, answered: AnsweredPoints): boolean {
  if (point.type === "socratic") {
    return answered.completedSocraticChapterIds.has(point.chapterId)
  }
  if (!point.slideId) return false
  return answered.reflectedSlideIds.has(point.slideId)
}

/**
 * Progressão de um curso.
 *
 * REGRA CENTRAL (§3.3): **capítulo sem nenhum ponto de interação não entra no
 * denominador.** Não se pode exigir "interagiu com tudo" onde não há nada a
 * fazer. Caso real: os capítulos 2, 4 e 5 do curso principal têm zero pontos, e
 * era isso que produzia número enganoso.
 *
 * `chapterIds` é o universo de capítulos do curso, usado apenas para relatar
 * quais ficaram de fora — o denominador vem dos PONTOS, não dos capítulos.
 */
export function courseProgression(
  points: InteractionPoint[],
  answered: AnsweredPoints,
  chapterIds: string[] = [],
): ProgressionResult {
  const chaptersWithPoints = new Set(points.map((p) => p.chapterId))
  const chaptersWithoutPoints = chapterIds.filter((id) => !chaptersWithPoints.has(id))

  const total = points.length

  // Conteúdo sem nenhum ponto: não há progressão a medir. "Sem dado" é a única
  // resposta honesta.
  if (total === 0) {
    return { pct: null, answered: 0, total: 0, chaptersWithoutPoints }
  }

  const answeredCount = points.filter((p) => isAnswered(p, answered)).length

  return {
    pct: Math.max(0, Math.min(100, (answeredCount / total) * 100)),
    answered: answeredCount,
    total,
    chaptersWithoutPoints,
  }
}

/**
 * Progressão de UM capítulo. Mesma regra: capítulo sem ponto devolve `null`,
 * nunca 0% nem 100%.
 */
export function chapterProgression(
  points: InteractionPoint[],
  answered: AnsweredPoints,
): ProgressionResult {
  return courseProgression(points, answered, [])
}
