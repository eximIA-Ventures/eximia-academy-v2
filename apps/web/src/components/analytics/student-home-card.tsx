"use client"

// ---------------------------------------------------------------------------
// StudentHomeCard — the student home card (OFFICIAL: the comparison)
// ---------------------------------------------------------------------------
// SH-1.4 + UX rework (Hugo, 2026-07-11). Hugo's definitive call: the "Meu
// progresso" view was a panel addition he never asked for; the COMPARISON
// (Você vs Média) is the official view. So this card now shows the comparison
// as its DEFAULT and ONLY content — no intent toggle, no progress view.
//
//   student-dashboard → StudentComparison (fetch wrapper) → StudentHomeCard
//     ├─ NextStepBar ("Próximo passo / Continuar agora")   — the single CTA
//     └─ comparison card
//          ├─ [Turma] (default)     → ComparisonInsightsTable (Você vs Turma)
//          └─ [Meu plano]           → PlanComparisonPanel (Você vs a sua jornada)
//
// ROUND 28 (Hugo 2026-07-28, ao vivo em localhost:3002) — o toggle "Gráficos" (a
// visão de barras, SignalRowsView/buildSignalRows) foi REMOVIDO deste card: "tira e
// exclui os gráficos". O grupo de toggle passou de 3 para 2 opções, que agora formam
// um PAR de comparação nomeado sob o rótulo "Comparar com:" — "Turma" (era "Visão
// detalhada") e "Meu plano" (era "Comparativo com a Jornada"), lendo como "estou vendo
// em relação à turma ou ao meu plano" (intenção literal do Hugo). `SignalRowsView`/
// `buildSignalRows` NÃO foram apagados do repo — `StudentComparisonView`
// (student-comparison-view.tsx) ainda os usa para outro card (`/dev/preview-desempenho`
// e qualquer call site futuro dessa view completa) — só o USO e o TOGGLE aqui, neste
// componente, saíram. Ver o relatório da story para o aviso explícito ao Capataz/Lupa.
//
// NOTE (flagged to Capataz + Lupa): removing the progress view leaves
// StudentProgressHeadline (SH-1.3) UNUSED by the app. It is NOT deleted here —
// only the IndicatorComparisonTable prune was authorized. `buildProgressHeadline`
// is still used to derive the CTA coaching line.
// ---------------------------------------------------------------------------

import { type SummaryTone, buildRitmoSummary, summaryToneOf } from "@/lib/analytics/ritmo-summary"
import type { ComparableMetricBlock, StudentHomeIndicators } from "@/types/analytics"
import { Card, CardContent, CardHeader } from "@eximia/ui"
import type { LucideIcon } from "lucide-react"
import { AlertCircle, Compass, Minus, TrendingUp } from "lucide-react"
import { useState } from "react"
import { ComparisonInsightsTable } from "./comparison-insights-table"
import { PlanComparisonPanel } from "./plan-comparison-panel"
import { DEFAULT_CONTINUE_HREF } from "./student-comparison-view"

type CompareView = "table" | "plan"

// Active-pill literal (theme.css --color-cerrado-600). Carried INLINE, per the
// house CSS-STALE IMMUNITY pattern (see student-comparison-view.tsx): the active
// state is critical, and a stale/tree-shaken `bg-cerrado-600` must never leave
// the selected toggle looking unselected. The class stays as progressive
// enhancement; the inline style is the guarantee.
const SEG_ACTIVE_BG = "oklch(0.64 0.17 42)"

function SegButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={active ? { backgroundColor: SEG_ACTIVE_BG, color: "#ffffff" } : undefined}
      // SH-3.4 — max-lg:h-11: alvo de toque ≥44px no mobile/tablet; h-9 intacto
      // em lg+ (desktop aprovado). O wrap dos 3 toggles já vem do flex-wrap do
      // header (flex-col lg:flex-row no CardHeader).
      className={`inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors max-lg:h-11 ${
        active
          ? "bg-cerrado-600 text-white"
          : "bg-black/5 text-text-secondary hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  )
}

export function StudentHomeCard({
  indicators,
  continueHref = DEFAULT_CONTINUE_HREF,
  interactionHref,
  reflectionHref,
  studentFirstName,
  courseOptions = [],
  selectedCourseId = null,
  onSelectCourse,
}: {
  /**
   * ROUND 28 (Hugo 2026-07-28) — `student`/`unit` deixaram de ser DESESTRUTURADOS
   * aqui: eram usados SÓ para alimentar `buildSignalRows` (a visão "Gráficos", agora
   * removida deste card). Mantidos no TIPO para não quebrar os call sites existentes
   * (student-comparison.tsx, dev/preview-desempenho/page.tsx) — o TypeScript não
   * exige que uma prop declarada seja desestruturada no corpo da função.
   */
  student: ComparableMetricBlock
  unit: ComparableMetricBlock
  indicators: StudentHomeIndicators
  continueHref?: string
  /**
   * SH-3.3 (Hugo 2026-07-21) — deep-link to the next PENDING socratic
   * interaction chapter (threaded from `computeStudentComparison`). Absent/null
   * → the interaction/progress/engagement rows fall back to `continueHref`.
   */
  interactionHref?: string | null
  /**
   * SH-3.3 — deep-link to the next PENDING reflection slide. Absent/null → the
   * reflections row falls back to `continueHref`.
   */
  reflectionHref?: string | null
  /**
   * PONTO 1 (Hugo 2026-07-14) — protagonismo: o PRIMEIRO nome do aluno logado
   * (o mesmo da saudação) vira a label da linha do sujeito: "Eu (Rinaldo)".
   * Opcional: ausente → a linha degrada para "Eu".
   */
  studentFirstName?: string | null
  /**
   * DEPRECATED desde ROUND 18 (Hugo 2026-07-18): antes suprimia a NextStepBar/CTA do
   * painel de resumo. O CTA "Continuar agora" foi REMOVIDO do painel nesta rodada (o CTA
   * por linha da tabela cobre a ação), então este prop virou no-op. Mantido no tipo só
   * para não quebrar call sites que ainda o passam (student-comparison.tsx); pode ser
   * removido numa limpeza futura junto com o call site.
   */
  showNextStep?: boolean
  /**
   * JRN-D (Hugo 2026-07-24) — seletor de curso do card "Meu ritmo": define QUAL
   * matrícula alimenta as 3 visões. `null` = "Todos os cursos" (agregado/líder,
   * comportamento original, zero mudança sem interação). Visível com 1+ curso
   * (correção ao vivo Hugo 2026-07-24: antes escondia com <2, o que privava o
   * aluno de 1 matrícula do controle); some só com 0 cursos.
   */
  courseOptions?: { courseId: string; courseTitle: string }[]
  selectedCourseId?: string | null
  onSelectCourse?: (courseId: string | null) => void
}) {
  const [compareView, setCompareView] = useState<CompareView>("table")

  return (
    <div className="space-y-4" data-testid="student-home-card">
      {/* The comparison — the DEFAULT and ONLY view. Same card finish as the
          manager "Tabela simplificada" (student-insights-table.tsx). */}
      <Card>
        {/* M4 — COMPACT header, single row: title/subtitle (left) · controls
            (right), no dead vertical space before the table. The controls group
            holds only the view toggle (Hugo, 2026-07-14: the decorative
            Buscar/Exportar were removed from the student screen; the real ones
            live in the manager view, student-insights-table.tsx). */}
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight text-text-primary">Meu ritmo</h2>
              {/* Ajuste fino (Hugo 2026-07-14): subtítulo ENXUTO, só a frase em
                  1ª pessoa. ROUND 18 (Hugo 2026-07-18): trocado para "Como estou na
                  minha jornada" (sem ponto final, conforme a captura). */}
              <p className="mt-1 text-xs text-text-muted">Como estou na minha jornada</p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              {/* JRN-D (correção Hugo 2026-07-24, ao vivo) — seletor de curso,
                  junto aos toggles. Fica SEMPRE visível com 1+ curso (antes `> 1`
                  o escondia p/ o aluno de 1 matrícula, que era exatamente o
                  Rinaldo do teste). "Todos os cursos" = default (null), zero
                  mudança de comportamento/dado sem interação — com 1 curso o
                  default agregado já é o próprio curso. Some só com 0 cursos. */}
              {courseOptions.length > 0 && onSelectCourse && (
                <label className="group relative inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-elevated px-3 text-sm max-lg:h-11 lg:h-9">
                  <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Curso
                  </span>
                  <select
                    aria-label="Filtrar por curso"
                    value={selectedCourseId ?? ""}
                    onChange={(e) => onSelectCourse(e.target.value || null)}
                    className="max-w-[11rem] cursor-pointer appearance-none truncate bg-transparent pr-4 font-semibold text-text-primary focus:outline-none"
                  >
                    <option value="">Todos os cursos</option>
                    {courseOptions.map((o) => (
                      <option key={o.courseId} value={o.courseId}>
                        {o.courseTitle}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {/* ROUND 28 (Hugo 2026-07-28) — "Comparar com:" rotula o PAR de toggles
                  restante (o toggle "Gráficos" saiu do grupo, ver o cabeçalho do
                  arquivo). O rótulo fica ACIMA do grupo de toggles especificamente —
                  não ao lado do seletor de curso, que é um controle independente. */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Comparar com:
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Era "Visão detalhada" — renomeado (Hugo): o par de toggles agora lê
                      como "estou vendo em relação à turma ou ao meu plano". */}
                  <SegButton
                    active={compareView === "table"}
                    onClick={() => setCompareView("table")}
                  >
                    Turma
                  </SegButton>
                  {/* SH-3.3 R5 (Hugo 2026-07-21) — compara Você vs A SUA PRÓPRIA
                      JORNADA (não a Turma). JRN-D (Hugo 2026-07-24): o "combinado"
                      agora vem da JORNADA PERSISTIDA (study_plans), não mais do
                      ritmo semanal default — "não é mais plano, é minha jornada".
                      Ver plan-comparison-panel.tsx. ROUND 28 (Hugo 2026-07-28):
                      rótulo renomeado de "Comparativo com a Jornada" para "Meu
                      plano", coerente com o par "Turma"/"Meu plano". */}
                  <SegButton active={compareView === "plan"} onClick={() => setCompareView("plan")}>
                    Meu plano
                  </SegButton>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-5 pb-5">
          {compareView === "table" && (
            <>
              <ComparisonInsightsTable
                indicators={indicators}
                studentFirstName={studentFirstName}
                continueHref={continueHref}
                interactionHref={interactionHref}
                reflectionHref={reflectionHref}
              />
              {/* SH-1.5 R2 (Hugo 2026-07-18) — the personal, deterministic summary
                  paragraph (pure buildRitmoSummary), only under "Turma" (era "Visão
                  detalhada"), in a dark, emphasised panel. ROUND 18 (Hugo 2026-07-18): the
                  "Continuar agora" CTA was REMOVED from this panel (it duplicated the
                  per-row CTA that every table row already carries since R4/R6), and a
                  REACTIVE Noodle illustration was added in its place — the glyph reflects
                  the student's OVERALL tone (summaryToneOf, severity-first with a #1
                  celebratory override). */}
              <RitmoSummaryPanel
                summary={buildRitmoSummary(indicators, studentFirstName)}
                tone={summaryToneOf(indicators)}
              />
            </>
          )}
          {compareView === "plan" && (
            <PlanComparisonPanel
              continueHref={continueHref}
              interactionHref={interactionHref}
              reflectionHref={reflectionHref}
              courseId={selectedCourseId}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// RitmoSummaryPanel — SH-1.5 R2, illustration added in ROUND 18, simplified to an
// icon in ROUND 19, redesigned as a personal headline card in ROUND 20 (Hugo
// 2026-07-18).
//
// R2 shipped this as a dark panel with the deterministic summary + a "Continuar agora"
// CTA in the corner. Round 18 removed the CTA and added 5 Noodle illustrations. Round
// 19 swapped the illustrations for one reactive Lucide icon.
//
// ROUND 20 — "ainda não tá legal esse visual... tem que ser algo que o cara olhe e
// pense 'caralho, captei vossa mensagem'", narrowed to "to falando só da frase, acho
// que podemos mudar o visual do card da frase" (the ASK is about the card's
// PRESENTATION, not the table or the Round 19 icon). Offered 3 directions — (a) a
// tone-tinted glow/gradient instead of flat black, (b) drop the quote-mark/testimonial
// format for a personal 1st-person headline with the key line in bold/colour, (c) more
// physical presence (shadow/border/glow) — Hugo: "me surpreende, só não exagera".
//
// DECISION — ONE idea, applied consistently, not three separate effects stacked:
// the reactive TONE becomes the card's whole colour language. Two concrete moves
// carry that idea (not three independent tricks):
//   1. The quote format is GONE. `buildRitmoSummary`'s two-sentence contract (opening
//      + clauses, then the opportunity clause — see the function's own
//      `${firstSentence} ${opportunity}` return) is split for PRESENTATION ONLY
//      (`splitHeadline`, below — a plain string split on the sentence boundary the
//      function already produces; it does NOT touch `buildRitmoSummary`'s logic, only
//      how the existing string is laid out on screen). The first sentence renders as a
//      bold, larger HEADLINE in the tone's own colour (the "you got it" read: the
//      claim that matters is the first thing the eye hits, in the colour that already
//      means something everywhere else in this table); the closing "oportunidade"
//      sentence renders small and muted underneath, in a supporting role instead of
//      competing for attention.
//   2. A soft radial glow, tinted by the SAME tone, replaces the flat `bg-neutral-900`
//      backdrop — direction (a). ONE glow in one corner, low opacity (16-18%), no
//      second light source, no border, no extra ring: option (c) (border + stronger
//      shadow) was DELIBERATELY DROPPED to avoid stacking a third device on top of the
//      other two — the brief was "one or two strong moves", not every good idea at
//      once.
// The Round 19 icon STAYS (Hugo's call: "pode continuar existindo... ou sair, sua
// decisão") but shrinks slightly (h-14→h-12, 26px→22px glyph) so it reads as a quiet
// accent next to the now-louder coloured headline, not a second competing focal point.
//
// WHY oklch-with-alpha inline, not a Tailwind opacity class: the glow needs a colour
// fraction that may not already exist as a literal string elsewhere in the app (the
// EXACT failure mode documented in Round 16 — Tailwind v4 only generates CSS for an
// opacity fraction it finds scanned in source; an unscanned `/NN` silently renders
// transparent). Hardcoding the full `oklch(L C H / alpha%)` string as an inline
// `backgroundImage` sidesteps the scanner entirely — same "CSS-STALE IMMUNITY" inline
// pattern this file already uses for `SEG_ACTIVE_BG` above, applied to a gradient
// instead of a solid fill. Tie and behind-mild share the SAME warning token at
// different alpha (16% vs 18%), the same "one token, two opacities" device Round 14/15
// used to distinguish the two ambers without inventing a second yellow.
//
// ROUND 21 (Hugo 2026-07-18, screenshot: "tem muito verde, então coloca por padrão no
// laranja da academy" + "pode deixar um pouco menor") — TWO changes, both presentation:
//   1. `win`'s colour (icon tint, headline, glow) moved from `semantic-success` (green)
//      to `cerrado-600` (the SAME brand orange `SEG_ACTIVE_BG` above already hardcodes —
//      literally the same oklch triple, `0.64 0.17 42`), mirroring the identical change
//      made to the table's `LEITURA_CHIP`/`WIN_BG`/`ACTION_TONE` in
//      comparison-insights-table.tsx (Round 21). No collision with `none` HERE: `none`'s
//      colour in this panel is neutral white (`bg-white/10 text-white/70`), not cerrado —
//      unlike the table's action button, this component has no win↔none ambiguity to
//      resolve, so win uses the full `cerrado-600` (not a lighter `-500` shade).
//   2. The headline shrank one step (`text-lg`/`sm:text-xl` → `text-base`/`sm:text-lg`) —
//      the screenshot showed the personal headline reading as too dominant relative to the
//      support line and icon beside it. Still bold (the Round 20 idea is untouched), just
//      less loud. [Tone-coloured at the time of writing — see ROUND 23 below, which
//      later dropped the colour from the headline text specifically.]
// The global `--color-semantic-success` token is NOT touched — this recolours `win` only
// inside this component, same scope discipline as the table's Round 21 change.
//
// ROUND 22 — SCOPE CORRECTION, CONFIRMS THIS FILE UNCHANGED: Round 21 read Hugo's request as
// "the whole component" and recoloured `win` both HERE and in the table
// (comparison-insights-table.tsx). Hugo's actual ask ("cara, o laranja era só na frase, o
// resto era para manter verde") was narrower — only THIS panel's headline/glow. Round 22
// reverted the table back to green and left THIS file exactly as Round 21 made it: the
// cerrado orange here was the ONE thing correctly scoped from the start.
//
// ROUND 23 (Hugo 2026-07-18, "to achando que o texto em branco talvez fique melhor") — a
// pontual, targeted ask about the HEADLINE TEXT specifically, looking at the panel live.
// `headlineClassName` (the per-tone text colour, `text-cerrado-600`/`text-semantic-warning`/
// `text-semantic-error`/`text-white` depending on tone) is REMOVED from `RITMO_TONE_STYLE`
// and the headline is now plain, fixed `text-white` — full 100% opacity, vs. the support
// line's `text-white/60`. Hierarchy is preserved through THREE other signals instead of
// colour: size (`text-base`/`sm:text-lg` vs `text-sm`), weight (`font-bold` vs regular), and
// opacity (100% vs 60%) — the headline still reads unmistakably as the stronger line, it just
// stopped being the ONE place carrying the tone's colour in text form.
//
// SCOPE, EXPLICITLY NARROW (per Hugo's request): ONLY the headline text colour changed. The
// glow (background, still `oklch(... / alpha%)` tinted per tone) and the icon
// (`iconClassName`, still tone-tinted) are UNTOUCHED — they keep carrying the reactive tone
// signal. This does dilute the "one colour idea, three places" design of Round 20 down to
// "two places" (glow + icon), but that dilution is the explicit, deliberate outcome of a
// direct ask about the text specifically, not an oversight.
// ---------------------------------------------------------------------------

/** Splits `buildRitmoSummary`'s output into headline + support line (ROUND 20,
 * PRESENTATION ONLY). Relies on the function's own contract — exactly one period ends
 * the first sentence, then a space, then the closing "oportunidade" sentence — so this
 * never touches or re-derives what `buildRitmoSummary` decides to say, only how the
 * fixed two-sentence shape is laid out visually. */
function splitHeadline(summary: string): { headline: string; support: string } {
  const match = summary.match(/^(.*?\.)\s+(.*)$/s)
  if (!match) return { headline: summary, support: "" }
  return { headline: match[1], support: match[2] }
}

/** The reactive style per overall tone (ROUND 20; headline colour REMOVED in ROUND 23,
 * see below). One glow + one icon, both derived from the SAME tone. `Icon`/icon
 * `className` are UNCHANGED from Round 19. */
const RITMO_TONE_STYLE: Record<
  SummaryTone,
  { Icon: LucideIcon; iconClassName: string; glow: string; alt: string }
> = {
  win: {
    Icon: TrendingUp,
    iconClassName: "bg-cerrado-600/10 text-cerrado-600",
    glow: "radial-gradient(120% 140% at 100% 0%, oklch(0.64 0.17 42 / 18%) 0%, transparent 60%)",
    alt: "Você está à frente da turma",
  },
  tie: {
    Icon: Minus,
    iconClassName: "bg-semantic-warning/15 text-semantic-warning",
    glow: "radial-gradient(120% 140% at 100% 0%, oklch(0.8 0.15 70 / 16%) 0%, transparent 60%)",
    alt: "Você está no ritmo da turma",
  },
  // SH-2.5 (Hugo 2026-07-19) — `behind-mild`/`behind-severe` consolidados num
  // único `behind`, visual do antigo `behind-severe` (vermelho, AlertCircle),
  // mesma decisão de `LEITURA_CHIP`/`ACTION_TONE` em comparison-insights-table.tsx
  // — a distinção mild/severe deixou de existir em toda a feature "Meu ritmo".
  behind: {
    Icon: AlertCircle,
    iconClassName: "bg-semantic-error/10 text-semantic-error",
    glow: "radial-gradient(120% 140% at 100% 0%, oklch(0.6 0.22 25 / 18%) 0%, transparent 60%)",
    alt: "Hora de retomar o ritmo",
  },
  none: {
    Icon: Compass,
    iconClassName: "bg-white/10 text-white/70",
    glow: "radial-gradient(120% 140% at 100% 0%, oklch(1 0 0 / 6%) 0%, transparent 60%)",
    alt: "Começando a sua jornada",
  },
}

function RitmoSummaryPanel({
  summary,
  tone,
}: {
  summary: string
  tone: SummaryTone
}) {
  const { Icon, iconClassName, glow, alt } = RITMO_TONE_STYLE[tone]
  const { headline, support } = splitHeadline(summary)
  return (
    <div
      className="relative mt-5 flex flex-col gap-5 overflow-hidden rounded-2xl bg-neutral-900 px-5 py-5 dark:bg-black/40 dark:ring-1 dark:ring-white/10 sm:flex-row sm:items-center sm:gap-6 sm:px-6 sm:py-6"
      style={{ backgroundImage: glow }}
    >
      {/* ROUND 20 — no more quote marks: a bold HEADLINE (the claim that matters, first
          thing the eye hits) + a small muted support line (the opportunity clause),
          instead of one flat quoted paragraph. ROUND 23 — the headline is plain WHITE
          (not tone-coloured anymore, see the block above `RITMO_TONE_STYLE`); it stays
          the stronger line via full-opacity white + bold + larger size, vs. the support
          line's 60%-opacity white. */}
      <div data-testid="ritmo-summary" className="flex-1">
        <p className="text-base font-bold leading-snug text-white sm:text-lg">{headline}</p>
        <p className="mt-2 text-sm leading-relaxed text-white/60">{support}</p>
      </div>
      {/* ROUND 19 — the tone-reactive icon stays, shrunk slightly (Round 20) so it
          reads as a quiet accent beside the now-coloured headline. */}
      <div
        data-testid="ritmo-icon"
        data-tone={tone}
        aria-label={alt}
        className={`flex h-12 w-12 shrink-0 items-center justify-center self-end rounded-full sm:self-center ${iconClassName}`}
      >
        <Icon size={22} aria-hidden="true" />
      </div>
    </div>
  )
}
