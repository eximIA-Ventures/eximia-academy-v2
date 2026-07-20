"use client"

// ---------------------------------------------------------------------------
// MeuPlanoClient — "Monte o seu plano de estudo" (SH-3.1, Hugo 2026-07-20)
// ---------------------------------------------------------------------------
// Real, navigable implementation of the validated mockup
// (JARVIS/apps/hub-discovery/meu-plano-tela-configuracao.html): 5 numbered
// sections inside a dedicated page frame (breadcrumb "‹ Meu ritmo / Montar
// meu plano"), all backed by REAL diagnostic data (see page.tsx) and all
// interactivity as real React state, mirroring the mockup's live recompute.
//
// SCOPE BOUNDARY (explicit, per the story): "Confirmar meu plano" below is
// LOCAL REACT STATE ONLY. There is no weekly-plan table yet and this
// component makes NO POST/fetch call — persisting the committed plan is a
// deliberately separate, FUTURE story (schema not decided with Hugo yet).
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
import { BookOpen, Check, ChevronLeft, Pencil, RotateCcw } from "lucide-react"
import { useMemo, useState } from "react"

const VERDICT_STYLE: Record<
  ReturnType<typeof computeStudyPlanProjection>["verdict"],
  { border: string; bg: string; text: string }
> = {
  empty: {
    border: "border-border-subtle",
    bg: "bg-bg-card",
    text: "text-text-muted",
  },
  ok: {
    border: "border-semantic-success/45",
    bg: "bg-semantic-success/5",
    text: "text-semantic-success",
  },
  "warn-progress": {
    border: "border-semantic-warning/45",
    bg: "bg-semantic-warning/5",
    text: "text-semantic-warning",
  },
  "warn-refl": {
    border: "border-semantic-warning/45",
    bg: "bg-semantic-warning/5",
    text: "text-semantic-warning",
  },
  bad: {
    border: "border-semantic-error/45",
    bg: "bg-semantic-error/5",
    text: "text-semantic-error",
  },
  unknown: {
    border: "border-border-subtle",
    bg: "bg-bg-card",
    text: "text-text-secondary",
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
  const weeksToCloseLabel = Number.isFinite(projection.weeksToClose)
    ? `${projection.weeksToClose} semanas`
    : "—"

  return (
    <div className="mx-auto max-w-3xl px-6 pb-24 pt-6">
      {/* topo: prazo real (quando disponível) */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-text-primary">
            exím<span className="font-extrabold">IA</span> · Meu plano de estudo
          </p>
          <p className="mt-0.5 text-xs text-text-secondary">
            Você programa como vai estudar. O sistema mostra se fecha o seu gap.
          </p>
        </div>
        {diagnostic.daysLeft != null && (
          <div className="flex flex-none items-center gap-2 rounded-full border border-cerrado-600/30 bg-cerrado-600/10 px-3 py-2">
            <span className="font-display text-base font-extrabold text-cerrado-500 tabular-nums">
              {diagnostic.daysLeft}
            </span>
            <span className="text-[11px] font-semibold text-text-secondary">
              dias até o fim do curso
            </span>
          </div>
        )}
      </div>

      {/* breadcrumb — "‹ Meu ritmo / Montar meu plano" */}
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
            <BreadcrumbPage>Montar meu plano</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* cabeçalho de página */}
      <header className="mt-4 border-b border-border-subtle pb-6">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-cerrado-600/25 bg-cerrado-600/10 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-cerrado-600">
          <Check size={13} aria-hidden="true" />
          Montando seu plano de estudo
        </span>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-text-primary">
          Monte o seu plano de estudo
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-text-secondary">
          A partir do seu <b className="text-text-primary">diagnóstico no Meu ritmo</b>, defina como
          você vai estudar: escolha os dias que consegue de verdade e quanto entrega em cada um. A
          gente te mostra, ao vivo, se essa escolha fecha o que está faltando até o fim do curso.
        </p>
      </header>

      {/* 1 · recap do diagnóstico */}
      <Section
        number={1}
        title="De onde você parte hoje"
        subtitle="Calculado do seu Meu ritmo, não é conselho genérico."
      >
        <div className="rounded-2xl border border-border-subtle bg-bg-card p-5 shadow-card">
          <div className="flex gap-3 rounded-xl border border-semantic-warning/25 bg-semantic-warning/[0.08] p-4">
            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-semantic-warning/15 text-semantic-warning">
              <BookOpen size={16} aria-hidden="true" />
            </div>
            <p className="text-[13px] leading-relaxed text-text-secondary">
              <b className="text-text-primary">
                {studentFirstName ?? "Você"}, seu progresso está em {pct1(diagnostic.progressNow)}%
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
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <DiagMetric
              label="Progresso"
              value={`${pct1(diagnostic.progressNow)}%`}
              compare={
                diagnostic.progressTarget != null
                  ? `esperado ${pct1(diagnostic.progressTarget)}%`
                  : "sem meta de ritmo calculável"
              }
              behind={
                diagnostic.progressTarget != null &&
                diagnostic.progressNow < diagnostic.progressTarget
              }
            />
            <DiagMetric
              label="Reflexões"
              value={diagnostic.reflTotal != null ? `${pct1(diagnostic.reflNow ?? 0)}%` : "—"}
              compare={
                diagnostic.reflTotal != null
                  ? `${diagnostic.reflDoneCount}/${diagnostic.reflTotal} feitas`
                  : "sem denominador da trilha"
              }
              behind={
                diagnostic.reflTarget != null &&
                diagnostic.reflNow != null &&
                diagnostic.reflNow < diagnostic.reflTarget
              }
            />
            <DiagMetric
              label="Prazo"
              value={diagnostic.daysLeft != null ? `${diagnostic.daysLeft}d` : "—"}
              compare={
                diagnostic.weeksLeft != null
                  ? `≈ ${diagnostic.weeksLeft} semanas`
                  : "sem prazo computável"
              }
              behind={false}
            />
          </div>
        </div>
      </Section>

      {/* 2 · escolha dos dias */}
      <Section
        number={2}
        title="Que dias você consegue estudar?"
        subtitle="Toque nos dias em que você consegue sentar pra estudar de verdade."
      >
        <div className="rounded-2xl border border-border-subtle bg-bg-card p-5 shadow-card">
          <div className="grid grid-cols-7 gap-2">
            {choice.days.map((on, i) => {
              const isRefl = on && choice.reflFocus
              return (
                <button
                  key={WEEKDAY_LABELS[i]}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleDay(i)}
                  className={`flex min-h-[92px] flex-col items-center gap-2 rounded-xl border px-1 py-3 text-center transition-transform hover:-translate-y-0.5 ${
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
                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                      isRefl
                        ? "border-semantic-warning bg-semantic-warning text-black"
                        : on
                          ? "border-cerrado-600 bg-cerrado-600 text-white"
                          : "border-border-medium text-text-muted"
                    }`}
                  >
                    {on ? isRefl ? <Pencil size={14} /> : <BookOpen size={14} /> : "+"}
                  </span>
                  <span className="min-h-[26px] text-[10.5px] font-semibold text-text-secondary">
                    {on
                      ? `${choice.sessionsPerDay} ${choice.sessionsPerDay > 1 ? "sessões" : "sessão"}${
                          choice.reflFocus ? " + 1 refl." : ""
                        }`
                      : "livre"}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </Section>

      {/* 3 · intensidade e foco */}
      <Section
        number={3}
        title="Quanto você entrega em cada dia"
        subtitle="Calibre a densidade — e priorize reflexão, seu ponto de atenção."
      >
        <div className="flex flex-wrap gap-4 rounded-2xl border border-border-subtle bg-bg-card p-5 shadow-card">
          <div className="min-w-[220px] flex-1 rounded-xl border border-border-subtle bg-bg-elevated p-4">
            <p className="text-xs font-semibold text-text-primary">Sessões por dia de estudo</p>
            <p className="mt-1.5 text-[11.5px] text-text-muted">
              Quantas sessões de conteúdo você faz em cada dia escolhido.
            </p>
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
          <div className="min-w-[220px] flex-1 rounded-xl border border-border-subtle bg-bg-elevated p-4">
            <p className="flex items-center gap-2 text-xs font-semibold text-text-primary">
              Foco em reflexão
              <span className="rounded bg-semantic-warning/15 px-1.5 py-0.5 text-[8.5px] font-bold uppercase text-semantic-warning">
                seu gap real
              </span>
            </p>
            <p className="mt-1.5 text-[11.5px] text-text-muted">
              Ativa 1 reflexão em cada dia de estudo escolhido.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Switch
                checked={choice.reflFocus}
                onCheckedChange={setReflFocus}
                aria-label="Priorizar reflexão"
              />
              <span className="text-xs font-semibold text-text-primary">
                {choice.reflFocus
                  ? `1 reflexão em cada um dos ${projection.chosenDays || "seus"} dias`
                  : "reflexão desligada"}
              </span>
            </div>
          </div>
        </div>
      </Section>

      {/* 4 · projeção ao vivo */}
      <Section
        number={4}
        title="Isso fecha o seu gap?"
        subtitle="Cada dia ou sessão que você mexe recalcula até onde você chega antes do prazo acabar."
      >
        <div
          data-testid="plan-projection"
          data-verdict={projection.verdict}
          className={`rounded-2xl border p-5 shadow-card transition-colors ${style.border} ${style.bg}`}
        >
          <p className={`text-base font-extrabold ${style.text}`}>
            {verdictHeadline(projection.verdict)}
          </p>
          <p className="mt-1.5 text-[13px] text-text-secondary">
            {verdictSubline(projection, diagnostic, weeksToCloseLabel)}
          </p>

          <div className="mt-5 flex flex-col gap-4">
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
        </div>
      </Section>

      {/* 5 · confirmação */}
      <div className="mt-9 rounded-2xl border border-cerrado-600/25 bg-gradient-to-br from-cerrado-600/[0.08] to-bg-card/40 p-5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-cerrado-600">
          Passo final · seu compromisso da semana
        </p>
        <p className="mt-2.5 text-[15px] leading-relaxed text-text-secondary">
          {commitLine(choice, projection)}
        </p>
        <p className="mt-3 border-t border-border-subtle pt-3 text-xs text-text-muted">
          {/* SH-3.1: nenhuma escrita acontece — texto deixa isso explícito ao aluno. */}
          Este é um plano de exemplo (protótipo): ainda não é salvo no seu perfil.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={confirm} disabled={projection.chosenDays === 0}>
            <Check size={16} aria-hidden="true" />
            Confirmar meu plano
          </Button>
          <Button variant="ghost" onClick={reset}>
            <RotateCcw size={16} aria-hidden="true" />
            Recomeçar
          </Button>
          {confirmed && (
            <span
              data-testid="plan-confirmed"
              className="text-xs font-semibold text-semantic-success"
            >
              Confirmado (local, não salvo ainda)
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({
  number,
  title,
  subtitle,
  children,
}: {
  number: number
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-8">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-cerrado-600 text-xs font-extrabold text-white">
          {number}
        </span>
        <div>
          <h2 className="font-display text-lg font-extrabold tracking-tight text-text-primary">
            {title}
          </h2>
          <p className="mt-1 text-xs text-text-muted">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function DiagMetric({
  label,
  value,
  compare,
  behind,
}: {
  label: string
  value: string
  compare: string
  behind: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        behind
          ? "border-semantic-warning/30 bg-semantic-warning/10"
          : "border-border-subtle bg-bg-elevated"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <p
        className={`mt-1.5 font-display text-xl font-extrabold tabular-nums ${
          behind ? "text-semantic-warning" : "text-text-primary"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-text-muted">{compare}</p>
    </div>
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
      return "Plano montado — sem prazo suficiente pra projetar"
  }
}

function verdictSubline(
  projection: ReturnType<typeof computeStudyPlanProjection>,
  diagnostic: StudyPlanDiagnostic,
  weeksToCloseLabel: string,
): string {
  if (projection.verdict === "empty") {
    return "Toque em pelo menos um dia lá em cima para o plano ganhar vida."
  }
  if (projection.verdict === "unknown") {
    return "Sem prazo/denominador suficiente para calcular se fecha — mas o plano abaixo já vale como compromisso."
  }
  const sessionsTxt = `${projection.sessionsPerWeek} sessões`
  const reflTxt = projection.reflPerWeek > 0 ? ` e ${projection.reflPerWeek} reflexões` : ""
  if (projection.verdict === "ok") {
    return `${sessionsTxt}${reflTxt} por semana fecham seu gap em cerca de ${weeksToCloseLabel}.`
  }
  return `${sessionsTxt}${reflTxt} por semana ainda não fecham tudo a tempo (${diagnostic.daysLeft ?? "?"} dias restantes). Ajuste dias, sessões ou reflexão.`
}

function commitLine(
  choice: StudyPlanChoice,
  projection: ReturnType<typeof computeStudyPlanProjection>,
): string {
  if (projection.chosenDays === 0) return "Escolha seus dias acima para montar o compromisso."
  const daysTxt = choice.days
    .map((on, i) => (on ? WEEKDAY_LABELS[i] : null))
    .filter(Boolean)
    .join(" · ")
  const sessTxt = `${choice.sessionsPerDay} ${choice.sessionsPerDay > 1 ? "sessões" : "sessão"}`
  const reflTxt = choice.reflFocus ? " e 1 reflexão em cada um" : ""
  return `Eu me comprometo a estudar em ${daysTxt}, com ${sessTxt} por dia${reflTxt}. Isso são ${projection.sessionsPerWeek} sessões${
    projection.reflPerWeek > 0 ? ` e ${projection.reflPerWeek} reflexões` : ""
  } por semana.`
}
