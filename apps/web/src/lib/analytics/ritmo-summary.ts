// ---------------------------------------------------------------------------
// ritmo-summary — SH-1.5: the personal paragraph below the "Meu ritmo" table
// ---------------------------------------------------------------------------
// A PURE, DETERMINISTIC composer (no LLM, no I/O, no RNG): the same indicators
// always produce the same paragraph, so it is testable by exact equality (AC8).
//
// The paragraph has three moving parts, each derived ONLY from the already-computed
// indicators + the real rank signal (AC9):
//   1. Opening — conditioned on the REAL engagement rank FIRST, then on the OVERALL
//      tone (`summaryToneOf`). SH-2.5 (Hugo 2026-07-19) — two live corrections on
//      top of SH-2.3:
//        • rank #1 (isTopEngagement) → "você é o aluno mais engajado da turma"
//        • overall tone "behind" → ONE direct opening (mild/severe no longer
//          exist as separate tones, item 1 of SH-2.5): "{Nome}, para retomar o
//          seu ritmo de estudos" — the Hugo explicitly rejected the softened
//          "um lembrete gentil..." wording ("nao tem dessa de 'lembrete
//          gentil', tem que ser direto ao ponto"). NEVER praises when the
//          overall picture is bad, even if engagement alone is above average.
//        • above the class average in engagement AND tone is not "behind" →
//          "seu engajamento está acima da média da turma" (never claims "mais
//          engajado" — AC7/AC9 cenário B)
//        • otherwise → a neutral, encouraging opening (no false praise)
//   2. Pace/activity clauses — from progress vs org avg. Recency (SH-2.5 item 3)
//        no longer compares against the org avg at all — it uses the SAME
//        absolute-band reading the table now uses (`recencyReadingFor`).
//   3. Opportunity — DYNAMIC: it names the metric(s) where the student is actually
//        BEHIND, never a hardcoded metric. "atividade recente" now comes from
//        `recencyReadingFor` (absolute bands), not from `winnerOf` vs the org
//        average (SH-2.5 item 3 — recency isn't a "vs average" metric anymore).
//        If the student is behind in NOTHING, the closing is positive.
//
// House rule: copy uses commas, never the em dash (—). Reuses `winnerOf`/
// `recencyReadingFor` (the same functions the table computes with) so the summary
// never contradicts the per-row reading.
// ---------------------------------------------------------------------------

import {
  type Leitura,
  leituraFor,
  recencyReadingFor,
  winnerOf,
} from "@/components/analytics/comparison-insights-table"
import type { StudentHomeIndicators } from "@/types/analytics"

/** The metrics the opportunity clause can point at, in a stable display order. */
type BehindMetric = "progresso" | "interações" | "reflexões" | "engajamento" | "atividade recente"

/**
 * The metrics where the student is BEHIND, in a STABLE order (deterministic
 * output). SH-2.5 — "atividade recente" is no longer a `winnerOf` comparison
 * against the org average; it comes from `recencyReadingFor` (absolute bands,
 * item 3), decoupled from the Turma. The rest keep comparing against the org
 * average with `winnerOf` (now tolerance-aware, item 1). A null value on either
 * side yields no "behind" for that metric (no reading possible, not a loss).
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
  if (recencyReadingFor(s.lastAccessDays).winner === "reference") behind.push("atividade recente")
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
  // SH-2.3 — o ramo "atrás" não abre com "Parabéns" (soaria dissonante logo
  // antes de um convite de retomada); usa só o nome como vocativo. SH-2.5 (Hugo
  // 2026-07-19): a REDAÇÃO do próprio convite também mudou — "nao tem dessa de
  // 'um lembrete gentil' tem que ser direto ao ponto" — ver o ramo `behind` abaixo.
  const nameLead = name ? `${name}, ` : ""

  // 1 — opening, conditioned on the REAL rank (AC7/AC9) FIRST, then on the
  // OVERALL tone (`summaryToneOf`). SH-2.3 (achado do Espelho): a abertura antiga
  // decidia só a partir de `aboveAvgEngagement` — UM dos 5 indicadores —
  // enquanto `summaryToneOf` já olhava os 5 com a hierarquia certa e já
  // governava o ícone/glow do painel. A abertura consome `summaryToneOf` como
  // critério PRIMÁRIO (depois do override real de #1), então NUNCA elogia
  // engajamento isolado quando o tom geral é de atraso. SH-2.5 (item 1): o tom
  // "behind" deixou de ter duas variantes (mild/severe) — collapsa os 2 ramos
  // antigos (2 e 3) num só, com a copy DIRETA que o Hugo pediu.
  const tone = summaryToneOf(indicators)
  const aboveAvgEngagement = winnerOf(s.engagement, r.engagementAvg, "higher") === "subject"
  let opening: string
  if (s.isTopEngagement === true) {
    // 1 — override real de #1 (AC7/AC9 da SH-1.5), intocado.
    opening = `${hi}você é o aluno mais engajado da turma`
  } else if (tone === "behind") {
    // 2 — atrás domina: nunca elogiar quando o tom geral é ruim. SH-2.5 (Hugo,
    // feedback ao vivo): "nao tem dessa de 'um lembrete gentil' tem que ser
    // direto ao ponto 'Rinaldo, para retomar seu ritimo de estudos'" — redação
    // direta, sem suavização, embora o SENTIDO geral continue não-punitivo
    // (convite, nunca repreensão).
    opening = `${nameLead}para retomar o seu ritmo de estudos`
  } else if (aboveAvgEngagement) {
    // 3 — só dispara agora quando o tom geral NÃO é atrás (corrige o bug
    // secundário que o Espelho achou: antes disparava mesmo com o aluno atrás
    // em tudo mais).
    opening = `${hi}seu engajamento está acima da média da turma`
  } else {
    // 4 — tom win genérico, tie ou none: ramo neutro, sem alegação falsa.
    opening = `${hi}bom te ver de volta ao seu ritmo de estudos`
  }

  // 2 — pace + recency clauses. SH-2.5 (item 3): a cláusula de recência não
  // compara mais com a média da org — usa a MESMA leitura por faixa absoluta
  // que a tabela usa (`recencyReadingFor`), decoupled da Turma.
  const clauses: string[] = []
  const progressWinner = winnerOf(s.progressPct, r.progressAvgPct, "higher")
  if (progressWinner === "subject") clauses.push("seu ritmo está acima da média")
  else if (progressWinner === null) clauses.push("seu ritmo acompanha a média")

  const recencyWinner = recencyReadingFor(s.lastAccessDays).winner
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
// a celebratory override, reusing the SAME per-row tone the table already computes (so
// the illustration NEVER contradicts what the rows show). Precedence:
//   1. `isTopEngagement` (real, strict #1) → "win" — the celebratory peak; the student is
//      literally the most engaged of the class, the illustration should celebrate that.
//   2. any row "behind" → "behind" — one bad gap dominates; showing a trophy while the
//      student is badly behind somewhere would be dishonest coaching.
//   3. any row "win" (ahead somewhere, nothing behind) → "win".
//   4. all comparable rows "tie" → "tie" — squarely on the class pace.
//   5. otherwise (only "none": no data / first access) → "none" — still discovering.
// SH-2.5 (Hugo 2026-07-19) — step 2 used to split into "behind-severe"/"behind-mild"
// (two precedence rungs); that distinction was REMOVED (item 1 of SH-2.5, "atrás" é
// só vermelho agora, sem gradiente), so the precedence collapsed from 6 steps to 5.
// The "Última sessão de estudo" row ALSO stopped feeding this from `leituraFor`
// (comparative) and now feeds from `recencyReadingFor` (absolute bands, item 3) —
// see `rowTonesOf` below.
// Rationale: the panel's own paragraph already praises AND names the opportunity; an
// illustration that reflects the WORST area (when there is one) is coherent with that
// dual nature, and honest — it points the eye at what needs attention. The #1 override
// keeps the true high point celebratory. Pure + deterministic (exact-equality testable).
// ---------------------------------------------------------------------------
export type SummaryTone = Leitura["tone"]

/**
 * The five row tones of the "Meu ritmo" table, in the fixed display order.
 * SH-2.5 — "lastAccess" reads from `recencyReadingFor` (absolute recency bands),
 * NOT `leituraFor` (comparative vs the org average) — item 3 decouples this row
 * from the Turma entirely, same as the table itself does.
 */
function rowTonesOf(indicators: StudentHomeIndicators): Leitura["tone"][] {
  const s = indicators.subject
  const r = indicators.reference
  const top = s.isTopEngagement
  return [
    recencyReadingFor(s.lastAccessDays).leitura.tone,
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
  // 2 — any bad gap dominates (SH-2.5: single "behind", no mild/severe split).
  if (tones.includes("behind")) return "behind"
  // 3 — ahead somewhere, nothing behind.
  if (tones.includes("win")) return "win"
  // 4 — everything on the class pace.
  if (tones.includes("tie")) return "tie"
  // 5 — no comparable data (first access / missing).
  return "none"
}
