// ---------------------------------------------------------------------------
// ritmo-summary — SH-1.5: the personal paragraph below the "Meu ritmo" table
// ---------------------------------------------------------------------------
// A PURE, DETERMINISTIC composer (no LLM, no I/O, no RNG): the same indicators
// always produce the same paragraph, so it is testable by exact equality (AC8).
//
// The paragraph has three moving parts, each derived ONLY from the already-computed
// indicators + the real rank signal (AC9):
//   1. Opening — conditioned on the REAL engagement rank:
//        • rank #1 (isTopEngagement) → "você é o aluno mais engajado da turma"
//        • above the class average but NOT #1 → "seu engajamento está acima da
//          média da turma" (never claims "mais engajado" — AC7/AC9 cenário B)
//        • otherwise → a neutral, encouraging opening (no false praise)
//   2. Pace/activity clauses — from progress vs org avg and recency vs org avg.
//   3. Opportunity — DYNAMIC: it names the metric(s) where the student is actually
//        BEHIND (winnerOf === "reference"), never a hardcoded metric. If the student
//        is behind in NOTHING, the closing is positive (no invented weak spot).
//
// House rule: copy uses commas, never the em dash (—). Reuses `winnerOf` (the same
// direction-aware winner the table computes) so the summary never contradicts the
// per-row reading.
// ---------------------------------------------------------------------------

import { winnerOf } from "@/components/analytics/comparison-insights-table"
import type { StudentHomeIndicators } from "@/types/analytics"

/** The metrics the opportunity clause can point at, in a stable display order. */
type BehindMetric = "progresso" | "interações" | "reflexões" | "engajamento" | "atividade recente"

/**
 * The metrics where the student is BEHIND the org average (winnerOf === "reference"),
 * in a STABLE order (deterministic output). "atividade recente" is direction "lower"
 * (fewer days since last access is better); the rest are "higher". A null value on
 * either side yields no "behind" for that metric (no reading possible, not a loss).
 */
export function behindMetricsOf(indicators: StudentHomeIndicators): BehindMetric[] {
  const s = indicators.subject
  const r = indicators.reference
  const behind: BehindMetric[] = []
  if (winnerOf(s.progressPct, r.progressAvgPct, "higher") === "reference") behind.push("progresso")
  if (winnerOf(s.interactions, r.interactionsAvg, "higher") === "reference")
    behind.push("interações")
  if (winnerOf(s.reflections, r.reflectionsAvg, "higher") === "reference") behind.push("reflexões")
  if (winnerOf(s.engagement, r.engagementAvg, "higher") === "reference") behind.push("engajamento")
  if (winnerOf(s.lastAccessDays, r.lastAccessAvgDays, "lower") === "reference")
    behind.push("atividade recente")
  return behind
}

/** "a e b", "a, b e c" — a comma-joined list with "e" before the last item (no em dash). */
function joinPt(items: string[]): string {
  if (items.length === 0) return ""
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`
}

/** The first token of a name, trimmed; empty/absent → null (opening omits the name). */
function firstNameOf(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0]
  return first ? first : null
}

/**
 * Compose the personal "Meu ritmo" summary paragraph. PURE + deterministic.
 *
 * @param indicators  the already-computed Você vs org indicators.
 * @param studentFirstName  the student's name (only the first token is used); absent → the
 *   opening drops the name ("Parabéns, ...").
 */
export function buildRitmoSummary(
  indicators: StudentHomeIndicators,
  studentFirstName?: string | null,
): string {
  const s = indicators.subject
  const r = indicators.reference
  const name = firstNameOf(studentFirstName)
  const hi = name ? `Parabéns ${name}, ` : "Parabéns, "

  // 1 — opening, conditioned on the REAL rank (AC7/AC9). isTopEngagement is a
  // strict #1 (no tie, AC12); it is the ONLY unlock for "mais engajado da turma".
  const aboveAvgEngagement = winnerOf(s.engagement, r.engagementAvg, "higher") === "subject"
  let opening: string
  if (s.isTopEngagement === true) {
    opening = `${hi}você é o aluno mais engajado da turma`
  } else if (aboveAvgEngagement) {
    opening = `${hi}seu engajamento está acima da média da turma`
  } else {
    opening = `${hi}bom te ver de volta ao seu ritmo de estudos`
  }

  // 2 — pace + recency clauses (comparadas com a média da org).
  const clauses: string[] = []
  const progressWinner = winnerOf(s.progressPct, r.progressAvgPct, "higher")
  if (progressWinner === "subject") clauses.push("seu ritmo está acima da média")
  else if (progressWinner === null) clauses.push("seu ritmo acompanha a média")

  const recencyWinner = winnerOf(s.lastAccessDays, r.lastAccessAvgDays, "lower")
  if (recencyWinner === "subject") clauses.push("você se mantém ativo com atividades recentes")

  // 3 — opportunity, DYNAMIC (never hardcoded): the metric(s) actually behind.
  const behind = behindMetricsOf(indicators)
  const opportunity =
    behind.length > 0
      ? `Sua oportunidade de melhoria é evoluir em ${joinPt(behind)}.`
      : "Continue nesse ritmo, você está à frente da turma em tudo que acompanhamos."

  const firstSentence = clauses.length > 0 ? `${opening}, ${clauses.join(", ")}.` : `${opening}.`
  return `${firstSentence} ${opportunity}`
}
