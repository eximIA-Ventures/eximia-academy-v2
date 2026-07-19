// ---------------------------------------------------------------------------
// ritmo-summary — SH-1.5: the personal paragraph below the "Meu ritmo" table
// ---------------------------------------------------------------------------
// A PURE, DETERMINISTIC composer (no LLM, no I/O, no RNG): the same indicators
// always produce the same paragraph, so it is testable by exact equality (AC8).
//
// The paragraph has three moving parts, each derived ONLY from the already-computed
// indicators + the real rank signal (AC9):
//   1. Opening — conditioned on the REAL engagement rank FIRST, then on the OVERALL
//      tone (`summaryToneOf`, SH-2.3 — Hugo 2026-07-19):
//        • rank #1 (isTopEngagement) → "você é o aluno mais engajado da turma"
//        • overall tone "behind-severe" → honest, non-punitive nudge ("hora de
//          retomar o seu ritmo de estudos") — NEVER praises when the overall
//          picture is bad, even if engagement alone is above average.
//        • overall tone "behind-mild" → gentler honest nudge ("um lembrete
//          gentil para retomar o seu ritmo de estudos")
//        • above the class average in engagement AND tone is not "behind" →
//          "seu engajamento está acima da média da turma" (never claims "mais
//          engajado" — AC7/AC9 cenário B)
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

import {
  type Leitura,
  leituraFor,
  winnerOf,
} from "@/components/analytics/comparison-insights-table"
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
  // SH-2.3 — os 2 ramos "atrás" (behind-severe/behind-mild) não abrem com
  // "Parabéns" (soaria dissonante logo antes de "hora de retomar"); usam só o
  // nome como vocativo, espelhando o exemplo literal aprovado pelo Hugo.
  const nameLead = name ? `${name}, ` : ""

  // 1 — opening, conditioned on the REAL rank (AC7/AC9) FIRST, then on the
  // OVERALL tone (`summaryToneOf`, SH-2.3). SH-2.3 (Hugo 2026-07-19, achado do
  // Espelho): a abertura antiga decidia só a partir de `aboveAvgEngagement` — UM
  // dos 5 indicadores — enquanto `summaryToneOf` já olhava os 5 com a hierarquia
  // de severidade certa (behind-severe > behind-mild > win > tie > none) e já
  // governava o ícone/glow do painel. Duas fontes de verdade concorrentes, o
  // texto usava a mais pobre — um aluno podia estar "acima da média" só em
  // engajamento e MUITO atrás em tudo mais, e ainda ler um elogio isolado. A
  // abertura agora consome `summaryToneOf` como critério PRIMÁRIO (depois do
  // override real de #1), então NUNCA elogia engajamento isolado quando o tom
  // geral é de atraso — e nunca deixa de nomear honestamente um atraso severo.
  const tone = summaryToneOf(indicators)
  const aboveAvgEngagement = winnerOf(s.engagement, r.engagementAvg, "higher") === "subject"
  let opening: string
  if (s.isTopEngagement === true) {
    // 1 — override real de #1 (AC7/AC9 da SH-1.5), intocado.
    opening = `${hi}você é o aluno mais engajado da turma`
  } else if (tone === "behind-severe") {
    // 2 — atrás severo domina: nunca elogiar quando o tom geral é ruim. Ecoa o
    // alt do ícone `behind-severe` ("Hora de retomar o ritmo").
    opening = `${nameLead}hora de retomar o seu ritmo de estudos`
  } else if (tone === "behind-mild") {
    // 3 — atrás moderado: convite mais leve, nunca punitivo. Ecoa o alt do
    // ícone `behind-mild` ("Um lembrete gentil para retomar").
    opening = `${nameLead}um lembrete gentil para retomar o seu ritmo de estudos`
  } else if (aboveAvgEngagement) {
    // 4 — só dispara agora quando o tom geral NÃO é atrás (corrige o bug
    // secundário: antes disparava mesmo com o aluno atrás em tudo mais).
    opening = `${hi}seu engajamento está acima da média da turma`
  } else {
    // 5 — tom win genérico, tie ou none: ramo neutro, sem alegação falsa.
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

// ---------------------------------------------------------------------------
// ROUND 18 (Hugo 2026-07-18) — the general tone that governs the summary panel's
// reactive illustration. The table colours EACH ROW by its own tone (Leitura["tone"]);
// the summary panel is about the student's OVERALL standing, so it needs ONE tone
// distilled from the five rows.
//
// DECISION (documented — this is the main judgement of the round): SEVERITY-FIRST with
// a celebratory override, reusing the SAME `leituraFor` the table already computes (so
// the illustration NEVER contradicts what the rows show). Precedence:
//   1. `isTopEngagement` (real, strict #1) → "win" — the celebratory peak; the student is
//      literally the most engaged of the class, the illustration should celebrate that.
//   2. any row "behind-severe" → "behind-severe" — one severe gap dominates; showing a
//      trophy while the student is badly behind somewhere would be dishonest coaching.
//   3. any row "behind-mild" → "behind-mild" — a gentle-nudge state.
//   4. any row "win" (ahead somewhere, nothing behind) → "win".
//   5. all comparable rows "tie" → "tie" — squarely on the class pace.
//   6. otherwise (only "none": no data / first access) → "none" — still discovering.
// Rationale: the panel's own paragraph already praises AND names the opportunity; an
// illustration that reflects the WORST area (when there is one) is coherent with that
// dual nature, and honest — it points the eye at what needs attention. The #1 override
// keeps the true high point celebratory. Pure + deterministic (exact-equality testable).
// ---------------------------------------------------------------------------
export type SummaryTone = Leitura["tone"]

/** The five row tones of the "Meu ritmo" table, in the fixed display order. */
function rowTonesOf(indicators: StudentHomeIndicators): Leitura["tone"][] {
  const s = indicators.subject
  const r = indicators.reference
  const top = s.isTopEngagement
  return [
    leituraFor("lastAccess", s.lastAccessDays, r.lastAccessAvgDays, "lower", top).tone,
    leituraFor("progress", s.progressPct, r.progressAvgPct, "higher", top).tone,
    leituraFor("sessions", s.interactions, r.interactionsAvg, "higher", top).tone,
    leituraFor("reflections", s.reflections, r.reflectionsAvg, "higher", top).tone,
    leituraFor("engagement", s.engagement, r.engagementAvg, "higher", top).tone,
  ]
}

/**
 * The single tone that governs the summary panel illustration (ROUND 18). Severity-first
 * with a #1 celebratory override — see the block above. Pure + deterministic.
 */
export function summaryToneOf(indicators: StudentHomeIndicators): SummaryTone {
  // 1 — real #1 of the class: celebrate.
  if (indicators.subject.isTopEngagement === true) return "win"
  const tones = rowTonesOf(indicators)
  // 2/3 — worst behind dominates.
  if (tones.includes("behind-severe")) return "behind-severe"
  if (tones.includes("behind-mild")) return "behind-mild"
  // 4 — ahead somewhere, nothing behind.
  if (tones.includes("win")) return "win"
  // 5 — everything on the class pace.
  if (tones.includes("tie")) return "tie"
  // 6 — no comparable data (first access / missing).
  return "none"
}
