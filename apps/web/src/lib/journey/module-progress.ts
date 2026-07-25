// ---------------------------------------------------------------------------
// JRN-E — Motor de progresso por módulo (contrato-progresso §6). PURO, sem I/O.
// ---------------------------------------------------------------------------
// Converte o resultado do motor JÁ EXISTENTE (`computeModuleJourney`,
// study-plan-dashboard.ts:60) + contagens reais por capítulo no
// `JourneyModuleProgress` do contrato.
//
// LIMITE DURO (Constitution, Artigo IV — No Invention): este arquivo NÃO deriva
// `done | doing | planned`. O status chega PRONTO em `journey[i].status`. O
// predicado de conclusão mora em `computeChapterCompletion`
// (study-plan-dashboard.ts), com dois chamadores e uma única fórmula.
// ---------------------------------------------------------------------------

import type { ModuleJourneyItem } from "@/lib/analytics/study-plan-dashboard"
import type { JourneyModuleProgress } from "./types"

/**
 * `completedRatio` = fração [0,1] do trabalho do módulo já feito.
 *
 * Numerador: sessões concluídas + reflexões respondidas neste capítulo.
 * Denominador: interações esperadas + reflexões esperadas (do próprio
 * `ModuleJourneyItem`, não de uma convenção nova).
 *
 * Dois casos deliberados:
 * - `status === "done"` força 1. A regra de conclusão do produto manda; um
 *   módulo concluído não pede tempo, mesmo que os contadores digam menos
 *   (R2 da JRN-E: "done" sai de UMA sessão concluída).
 * - denominador 0 → 0. Sem nada esperado, não há fração a medir; inventar 1
 *   travaria um módulo que ninguém mediu.
 *
 * O caso que este campo existe para capturar (R3): módulo com 4 de 4 reflexões
 * feitas e 0 interações fica `status: "planned"` (não trava), mas com
 * `completedRatio > 0` — a duração sugerida já sai proporcional ao que resta.
 */
function completedRatioOf(item: ModuleJourneyItem, done: number): number {
  if (item.status === "done") return 1
  const expected = item.interactionsExpected + item.reflectionsExpected
  if (expected <= 0) return 0
  return Math.min(1, Math.max(0, done / expected))
}

/**
 * Progresso real por capítulo, chaveado por `chapterId`.
 *
 * As contagens entram por parâmetro (mapas já agrupados pelo chamador SSR) —
 * esta função não conhece Supabase, não faz query e não estima nada.
 */
export function buildModuleProgress(
  journey: readonly ModuleJourneyItem[],
  sessionsByChapter: ReadonlyMap<string, number>,
  reflectionsByChapter: ReadonlyMap<string, number>,
): Map<string, JourneyModuleProgress> {
  const out = new Map<string, JourneyModuleProgress>()
  for (const item of journey) {
    const sessionsDone = sessionsByChapter.get(item.chapterId) ?? 0
    const reflectionsDone = reflectionsByChapter.get(item.chapterId) ?? 0
    out.set(item.chapterId, {
      status: item.status,
      sessionsDone,
      reflectionsDone,
      completedRatio: completedRatioOf(item, sessionsDone + reflectionsDone),
      // frozen ⟺ concluído. Único predicado desta camada, e ele é uma IGUALDADE
      // com o status que veio pronto, não uma regra nova de conclusão.
      frozen: item.status === "done",
    })
  }
  return out
}

/**
 * Fallback honesto para um capítulo que o motor de jornada não cobriu (curso
 * sem `startDate`/`targetCompletionDate` computável, ou capítulo publicado
 * entre a leitura dos capítulos e a das sessões). "planned", zerado — nunca
 * um "done" fabricado, que travaria um módulo que o aluno não fez.
 */
export const UNTOUCHED_MODULE_PROGRESS: JourneyModuleProgress = {
  status: "planned",
  sessionsDone: 0,
  reflectionsDone: 0,
  completedRatio: 0,
  frozen: false,
}
