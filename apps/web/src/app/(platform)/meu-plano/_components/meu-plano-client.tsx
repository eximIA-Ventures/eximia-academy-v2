"use client"

// ---------------------------------------------------------------------------
// MeuPlanoClient — "Meu plano de estudo" (SH-3.1 → SH-3.2, Hugo 2026-07-20)
// ---------------------------------------------------------------------------
// SH-3.2 REDESIGN (Krug — "Don't Make Me Think"): the screen no longer opens
// as a 5-step numbered form (recap → dias → intensidade → projeção →
// confirmação) that forced the student to process text + numbers + controls
// before doing anything. It now opens with ONE obvious path:
//
//   1. The suggested plan is ALREADY BUILT and visible (default Seg/Qua/Sex),
//      with a one-line verdict and one number. The primary action ("Confirmar
//      meu plano") is the loudest thing on screen — obvious in <3s, no reading.
//   2. Adjusting (days / sessions / reflection) is a SECONDARY, collapsed
//      disclosure ("Ajustar meu plano") — not a mandatory first step.
//   3. The full projection detail (the two bars + weeks-to-close) is ALSO a
//      collapsed disclosure ("Ver o cálculo completo"); the essential summary
//      (1 sentence + 1 number) is always visible above it.
//
// DATA SOURCE UNCHANGED: still `StudyPlanDiagnostic` (progressNow /
// progressTarget / reflNow / reflTotal / daysLeft — all from
// `computeStudentComparison`, see page.tsx) fed to the SAME pure engine
// `computeStudyPlanProjection`. Nothing about the calculation changed; only
// the presentation and the order in which decisions are surfaced.
//
// SCOPE BOUNDARY (still): "Confirmar meu plano" is LOCAL REACT STATE ONLY —
// no weekly-plan table, NO POST/fetch. Persisting the plan is a future story.
// ---------------------------------------------------------------------------

import { formatPctPtBR1 } from "@/components/analytics/comparison-insights-table"
import {
  DEFAULT_STUDY_PLAN_CHOICE,
  type StudyPlanChoice,
  type StudyPlanDiagnostic,
  WEEKDAY_LABELS,
  computeStudyPlanProjection,
} from "@/lib/analytics/study-plan-projection"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Switch,
  useToast,
} from "@eximia/ui"
import { BookOpen, Check, ChevronDown, ChevronLeft, Pencil, RotateCcw } from "lucide-react"
import { useMemo, useState } from "react"

const VERDICT_STYLE: Record<
  ReturnType<typeof computeStudyPlanProjection>["verdict"],
  { border: string; bg: string; text: string; dot: string }
> = {
  empty: {
    border: "border-border-subtle",
    bg: "bg-bg-card",
    text: "text-text-muted",
    dot: "bg-text-muted",
  },
  ok: {
    border: "border-semantic-success/45",
    bg: "bg-semantic-success/5",
    text: "text-semantic-success",
    dot: "bg-semantic-success",
  },
  "warn-progress": {
    border: "border-semantic-warning/45",
    bg: "bg-semantic-warning/5",
    text: "text-semantic-warning",
    dot: "bg-semantic-warning",
  },
  "warn-refl": {
    border: "border-semantic-warning/45",
    bg: "bg-semantic-warning/5",
    text: "text-semantic-warning",
    dot: "bg-semantic-warning",
  },
  bad: {
    border: "border-semantic-error/45",
    bg: "bg-semantic-error/5",
    text: "text-semantic-error",
    dot: "bg-semantic-error",
  },
  unknown: {
    border: "border-border-subtle",
    bg: "bg-bg-card",
    text: "text-text-secondary",
    dot: "bg-text-muted",
  },
}

function pct1(value: number): string {
  return formatPctPtBR1(value).replace(/,0$/, "")
}

export function MeuPlanoClient({
  diagnostic,
  studentFirstName,
}: {
  diagnostic: StudyPlanDiagnostic
  studentFirstName: string | null
}) {
  const [choice, setChoice] = useState<StudyPlanChoice>(DEFAULT_STUDY_PLAN_CHOICE)
  const [confirmed, setConfirmed] = useState(false)
  const { toast } = useToast()

  const projection = useMemo(
    () => computeStudyPlanProjection(diagnostic, choice),
    [diagnostic, choice],
  )

  function toggleDay(index: number) {
    setConfirmed(false)
    setChoice((prev) => ({
      ...prev,
      days: prev.days.map((d, i) => (i === index ? !d : d)),
    }))
  }

  function setSessionsPerDay(next: number) {
    setConfirmed(false)
    setChoice((prev) => ({ ...prev, sessionsPerDay: Math.min(5, Math.max(1, next)) }))
  }

  function setReflFocus(next: boolean) {
    setConfirmed(false)
    setChoice((prev) => ({ ...prev, reflFocus: next }))
  }

  function reset() {
    setConfirmed(false)
    setChoice({ ...DEFAULT_STUDY_PLAN_CHOICE, days: [...DEFAULT_STUDY_PLAN_CHOICE.days] })
  }

  function confirm() {
    if (projection.chosenDays === 0) return
    // SH-3.1 SCOPE BOUNDARY: local-only. No fetch/POST — persisting the
    // weekly commitment is a future story (schema not yet decided with Hugo).
    setConfirmed(true)
    const daysTxt = choice.days
      .map((on, i) => (on ? WEEKDAY_LABELS[i] : null))
      .filter(Boolean)
      .join(", ")
    toast({
      variant: "success",
      title: "Plano confirmado",
      description: `${daysTxt} — ${projection.sessionsPerWeek} sessões${
        projection.reflPerWeek > 0 ? ` e ${projection.reflPerWeek} reflexões` : ""
      } por semana.`,
    })
  }

  const style = VERDICT_STYLE[projection.verdict]
  const firstName = studentFirstName ?? "Você"

  return (
    <div className="mx-auto max-w-2xl px-6 pb-24 pt-6">
      {/* breadcrumb — "‹ Meu ritmo / Meu plano" */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard" className="inline-flex items-center gap-1">
              <ChevronLeft size={15} aria-hidden="true" />
              Meu ritmo
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Meu plano</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* título curto — sem parágrafo de instrução (a tela se explica sozinha) */}
      <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-text-primary">
        Seu plano de estudo desta semana
      </h1>

      {/* ------------------------------------------------------------------ */}
      {/* O PLANO PRONTO — o caminho óbvio. Card único, veredito + 1 frase + */}
      {/* 1 número, e o botão principal. Autoevidente em <3s, sem ler texto. */}
      {/* ------------------------------------------------------------------ */}
      <div
        data-testid="plan-projection"
        data-verdict={projection.verdict}
        className={`mt-5 rounded-3xl border p-6 shadow-card transition-colors ${style.border} ${style.bg}`}
      >
        <div className="flex items-center gap-2.5">
          <span className={`h-2.5 w-2.5 flex-none rounded-full ${style.dot}`} aria-hidden="true" />
          <p className={`text-lg font-extrabold leading-tight ${style.text}`}>
            {verdictHeadline(projection.verdict)}
          </p>
        </div>

        {/* resumo essencial: 1 frase + 1 número, sempre visível */}
        <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">
          {planSummary(firstName, choice, projection, diagnostic)}
        </p>

        {/* fita de dias escolhidos — leitura instantânea, sem controles */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {WEEKDAY_LABELS.map((label, i) => {
            const on = choice.days[i]
            return (
              <span
                key={label}
                className={`inline-flex h-8 items-center rounded-lg px-2.5 text-[11px] font-bold uppercase tracking-wide ${
                  on
                    ? "bg-cerrado-600 text-white"
                    : "bg-bg-elevated text-text-muted line-through opacity-60"
                }`}
              >
                {label}
              </span>
            )
          })}
        </div>

        {/* AÇÃO PRINCIPAL — a coisa mais alta da tela */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={confirm} disabled={projection.chosenDays === 0}>
            <Check size={18} aria-hidden="true" />
            Confirmar meu plano
          </Button>
          {confirmed ? (
            <span
              data-testid="plan-confirmed"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-semantic-success"
            >
              <Check size={15} aria-hidden="true" />
              Confirmado (local, ainda não salvo)
            </span>
          ) : (
            <span className="text-xs text-text-muted">
              Protótipo: o plano ainda não é salvo no seu perfil.
            </span>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* AJUSTAR — secundário, recolhido. Só quem quer mexer abre. */}
      {/* ------------------------------------------------------------------ */}
      <Disclosure summary="Ajustar meu plano" hint="dias, sessões e foco em reflexão">
        {/* dias */}
        <p className="text-xs font-semibold text-text-primary">Dias em que você consegue estudar</p>
        <div className="mt-2.5 grid grid-cols-7 gap-1.5">
          {choice.days.map((on, i) => {
            const isRefl = on && choice.reflFocus
            return (
              <button
                key={WEEKDAY_LABELS[i]}
                type="button"
                aria-pressed={on}
                onClick={() => toggleDay(i)}
                className={`flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-xl border px-1 py-2 text-center transition-transform hover:-translate-y-0.5 ${
                  on
                    ? "border-cerrado-600/55 bg-cerrado-600/[0.07]"
                    : "border-border-subtle bg-bg-card"
                }`}
              >
                <span
                  className={`text-[10px] font-bold uppercase tracking-wide ${
                    on ? "text-cerrado-500" : "text-text-muted"
                  }`}
                >
                  {WEEKDAY_LABELS[i]}
                </span>
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${
                    isRefl
                      ? "border-semantic-warning bg-semantic-warning text-black"
                      : on
                        ? "border-cerrado-600 bg-cerrado-600 text-white"
                        : "border-border-medium text-text-muted"
                  }`}
                >
                  {on ? isRefl ? <Pencil size={13} /> : <BookOpen size={13} /> : "+"}
                </span>
              </button>
            )
          })}
        </div>

        {/* sessões + reflexão, lado a lado */}
        <div className="mt-4 flex flex-wrap gap-3">
          <div className="min-w-[200px] flex-1 rounded-xl border border-border-subtle bg-bg-elevated p-4">
            <p className="text-xs font-semibold text-text-primary">Sessões por dia de estudo</p>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                aria-label="menos sessões"
                disabled={choice.sessionsPerDay <= 1}
                onClick={() => setSessionsPerDay(choice.sessionsPerDay - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-medium bg-bg-card text-text-primary transition-colors hover:bg-bg-hover disabled:opacity-35"
              >
                –
              </button>
              <span className="min-w-[28px] text-center font-display text-xl font-extrabold text-text-primary tabular-nums">
                {choice.sessionsPerDay}
              </span>
              <button
                type="button"
                aria-label="mais sessões"
                disabled={choice.sessionsPerDay >= 5}
                onClick={() => setSessionsPerDay(choice.sessionsPerDay + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-medium bg-bg-card text-text-primary transition-colors hover:bg-bg-hover disabled:opacity-35"
              >
                +
              </button>
              <span className="text-xs text-text-muted">sessões / dia</span>
            </div>
          </div>
          <div className="min-w-[200px] flex-1 rounded-xl border border-border-subtle bg-bg-elevated p-4">
            <p className="flex items-center gap-2 text-xs font-semibold text-text-primary">
              Foco em reflexão
              <span className="rounded bg-semantic-warning/15 px-1.5 py-0.5 text-[8.5px] font-bold uppercase text-semantic-warning">
                seu gap real
              </span>
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Switch
                checked={choice.reflFocus}
                onCheckedChange={setReflFocus}
                aria-label="Priorizar reflexão"
              />
              <span className="text-xs font-semibold text-text-primary">
                {choice.reflFocus ? "1 reflexão em cada dia" : "reflexão desligada"}
              </span>
            </div>
          </div>
        </div>

        <Button variant="ghost" size="sm" className="mt-4" onClick={reset}>
          <RotateCcw size={15} aria-hidden="true" />
          Voltar ao plano sugerido
        </Button>
      </Disclosure>

      {/* ------------------------------------------------------------------ */}
      {/* VER O CÁLCULO — o detalhe rico (barras) fica disponível, não forçado */}
      {/* ------------------------------------------------------------------ */}
      <Disclosure summary="Ver o cálculo completo" hint="progresso, reflexões e prazo">
        <div className="rounded-xl border border-semantic-warning/25 bg-semantic-warning/[0.06] p-3.5">
          <p className="text-[13px] leading-relaxed text-text-secondary">
            <b className="text-text-primary">
              {firstName}, seu progresso está em {pct1(diagnostic.progressNow)}%
            </b>
            {diagnostic.reflTotal != null && diagnostic.reflNow != null && (
              <>
                {" "}
                e suas reflexões em{" "}
                <b className="text-text-primary">
                  {diagnostic.reflDoneCount}/{diagnostic.reflTotal}
                </b>{" "}
                ({pct1(diagnostic.reflNow)}%).
              </>
            )}
            {diagnostic.progressTarget != null && (
              <> O ritmo esperado nesta altura da trilha é {pct1(diagnostic.progressTarget)}%.</>
            )}
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <ProjectionBar
            label="Progresso do curso"
            now={diagnostic.progressNow}
            target={diagnostic.progressTarget}
            projected={projection.progressProj}
            ok={projection.progressOk}
          />
          {diagnostic.reflTotal != null ? (
            <ProjectionBar
              label="Reflexões"
              now={diagnostic.reflNow ?? 0}
              target={diagnostic.reflTarget}
              projected={projection.reflProj}
              ok={projection.reflOk}
            />
          ) : (
            <p className="text-xs italic text-text-muted">
              Sem denominador de reflexões da sua trilha ainda — essa projeção fica de fora até
              haver dado suficiente.
            </p>
          )}
        </div>

        {diagnostic.daysLeft != null && (
          <p className="mt-4 border-t border-border-subtle pt-3 text-xs text-text-muted">
            Faltam <b className="text-text-secondary tabular-nums">{diagnostic.daysLeft} dias</b>{" "}
            até o fim do curso
            {diagnostic.weeksLeft != null && <> (≈ {diagnostic.weeksLeft} semanas)</>}.
          </p>
        )}
      </Disclosure>
    </div>
  )
}

/**
 * Native progressive-disclosure block (Krug: hide secondary complexity behind
 * an obvious, self-labeling toggle). Uses `<details>`/`<summary>` — semantic,
 * keyboard-accessible, zero extra dependency, closed by default.
 */
function Disclosure({
  summary,
  hint,
  children,
}: {
  summary: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <details className="group mt-3 rounded-2xl border border-border-subtle bg-bg-card shadow-card [&_svg.disclosure-chevron]:open:rotate-180">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="flex flex-col">
          <span className="text-sm font-bold text-text-primary">{summary}</span>
          <span className="text-xs text-text-muted">{hint}</span>
        </span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className="disclosure-chevron flex-none text-text-muted transition-transform"
        />
      </summary>
      <div className="border-t border-border-subtle px-5 pb-5 pt-4">{children}</div>
    </details>
  )
}

function ProjectionBar({
  label,
  now,
  target,
  projected,
  ok,
}: {
  label: string
  now: number
  target: number | null
  projected: number | null
  ok: boolean | null
}) {
  const fillColor =
    ok === true ? "bg-semantic-success" : ok === false ? "bg-semantic-error" : "bg-cerrado-600"
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold text-text-primary">{label}</span>
        <span className="font-semibold text-text-secondary tabular-nums">
          hoje {pct1(now)}% → projeção{" "}
          <span className="font-extrabold text-text-primary">
            {projected != null ? `${pct1(projected)}%` : "—"}
          </span>
        </span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full border border-border-subtle bg-bg-elevated">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-text-muted/50"
          style={{ width: `${Math.min(100, now)}%` }}
        />
        {projected != null && (
          <span
            className={`absolute inset-y-0 left-0 rounded-full transition-all ${fillColor}`}
            style={{ width: `${Math.min(100, projected)}%` }}
          />
        )}
        {target != null && (
          <span
            className="absolute top-0 bottom-0 w-0.5 bg-text-primary/80"
            style={{ left: `${Math.min(100, target)}%` }}
          />
        )}
      </div>
    </div>
  )
}

function verdictHeadline(
  verdict: ReturnType<typeof computeStudyPlanProjection>["verdict"],
): string {
  switch (verdict) {
    case "empty":
      return "Nenhum dia escolhido ainda"
    case "ok":
      return "Esse plano fecha o seu gap"
    case "warn-progress":
      return "Reflexão fecha, mas falta ritmo de conteúdo"
    case "warn-refl":
      return "Progresso fecha, mas a reflexão ainda não"
    case "bad":
      return "Esse ritmo não fecha o gap a tempo"
    case "unknown":
      return "Seu plano sugerido está pronto"
  }
}

/**
 * The one-sentence + one-number summary that lives ALWAYS visible under the
 * verdict (Krug: communicate the essential without forcing the detail). Reads
 * from the same projection the bars use — no separate data path.
 */
function planSummary(
  firstName: string,
  choice: StudyPlanChoice,
  projection: ReturnType<typeof computeStudyPlanProjection>,
  diagnostic: StudyPlanDiagnostic,
): string {
  if (projection.chosenDays === 0) {
    return "Você desligou todos os dias. Abra “Ajustar meu plano” e escolha pelo menos um."
  }

  const weeksToCloseLabel = Number.isFinite(projection.weeksToClose)
    ? `${projection.weeksToClose} semanas`
    : "algum tempo"
  const load = `${projection.sessionsPerWeek} sessões${
    projection.reflPerWeek > 0 ? ` e ${projection.reflPerWeek} reflexões` : ""
  } por semana`

  switch (projection.verdict) {
    case "ok":
      return `${firstName}, ${load} fecham o que falta em cerca de ${weeksToCloseLabel}. É só confirmar.`
    case "warn-progress":
    case "warn-refl":
    case "bad":
      return `${firstName}, ${load} ainda não fecham tudo a tempo${
        diagnostic.daysLeft != null ? ` (${diagnostic.daysLeft} dias restantes)` : ""
      }. Confirme assim ou abra “Ajustar” para apertar o passo.`
    default:
      // unknown — no deadline/denominator to judge sufficiency
      return `${firstName}, montamos ${load} para você. Ainda não dá pra projetar se fecha o gap (sem prazo suficiente), mas já vale como compromisso.`
  }
}
