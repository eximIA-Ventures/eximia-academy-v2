"use client"

// ---------------------------------------------------------------------------
// EPIC-JORNADA (JRN-C.1, Trilha C) — Dashboard RICO da jornada ativa.
// ---------------------------------------------------------------------------
// Porta a composição da demo aprovada (SPEC round 14/16/18): hero escuro →
// 3 stat cards → Sua semana + acompanhamento → fileira "Leitura da IA" +
// "Visão de Ritmo" → "Sua jornada planejada" (reancorada em moduleDurations).
// Terminologia SEMPRE "jornada". Todo número vem do view-model puro
// (dashboard-model.ts), que só usa motores reais — zero fabricação. Motion
// Coreografia 100% nativo (motion.module.css + count-up rAF com reduced-motion).
// ---------------------------------------------------------------------------

import { Button } from "@eximia/ui"
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Compass,
  Flag,
  Gauge,
  PenSquare,
  Pencil,
  Sparkles,
  TrendingUp,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import {
  type AiReading,
  type DashModuleRow,
  type DashboardModel,
  type RitmoView,
  type TextRun,
  formatJourneyDate,
} from "./dashboard-model"
import styles from "./motion.module.css"

export interface JourneyDashboardHrefs {
  continueHref: string
  interactionHref: string | null
  reflectionHref: string | null
}

/** count-up 1x por montagem: ~70%→valor, ease-out, com guarda reduced-motion +
 *  seguro setTimeout anti-rAF-congelado (SPEC round 18). */
function useCountUp(target: number, enabled: boolean): number {
  const [value, setValue] = useState(() => target)
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    if (!enabled || reduce || target <= 0) {
      setValue(target)
      return
    }
    const from = Math.round(target * 0.7)
    const dur = 500
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur)
      const eased = 1 - (1 - p) ** 3
      setValue(Math.round(from + (target - from) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const safety = setTimeout(() => {
      cancelAnimationFrame(raf)
      setValue(target)
    }, dur + 250)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(safety)
    }
  }, [target, enabled])
  return value
}

function Runs({ runs }: { runs: TextRun[] }) {
  return (
    <>
      {runs.map((r, i) => {
        // chave estável por conteúdo+posição (runs nunca reordenam num render).
        const key = `${i}:${r.t}`
        if (r.strong || r.tone) {
          const cls =
            r.tone === "ok"
              ? "font-bold text-semantic-success"
              : r.tone === "warn"
                ? "font-bold text-semantic-warning"
                : "font-bold text-text-primary"
          return (
            <b key={key} className={cls}>
              {r.t}
            </b>
          )
        }
        return <span key={key}>{r.t}</span>
      })}
    </>
  )
}

/** JRN-E — o hero não pode dizer "começa hoje" para uma jornada montada há
 *  semanas e parada: dia 0 aqui é do DELTA, não do calendário. */
function heroStatus(model: DashboardModel): string {
  const anchorIso = model.anchorDateIso ?? model.startDateIso
  if (!model.isDayZero) return "Sua jornada está em andamento"
  if ((model.daysSinceAnchor ?? 0) > 0) {
    return `Jornada montada em ${formatJourneyDate(anchorIso)} · nada registrado ainda`
  }
  return `Sua jornada começa hoje, ${formatJourneyDate(anchorIso)}`
}

/** plural seco, sem inventar unidade nova. */
function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

export function JourneyDashboard({
  model,
  hrefs,
  onBackToHub,
  onRevisar,
}: {
  model: DashboardModel
  hrefs: JourneyDashboardHrefs
  onBackToHub: () => void
  onRevisar: () => void
}) {
  const progress = useCountUp(Math.round(model.progressPct), !model.isDayZero)

  return (
    <div
      data-mo="enter"
      data-testid="journey-dashboard"
      className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6"
    >
      {/* voltar discreto → Minhas jornadas */}
      <button
        type="button"
        onClick={onBackToHub}
        data-testid="dash-back-to-hub"
        className={`${styles.press} inline-flex items-center gap-1 text-sm font-medium text-text-secondary transition-colors hover:text-cerrado-500`}
      >
        <ChevronLeft size={15} aria-hidden="true" />
        Minhas jornadas
      </button>

      {/* ===== hero escuro neutro-quente ===== */}
      <section
        data-testid="journey-hero"
        className={`${styles.rise} relative mt-4 overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900 p-5 shadow-elevated sm:p-8`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cerrado-600/[0.14] via-transparent to-neutral-950/60"
        />
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-semantic-success/40 bg-semantic-success/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-semantic-success">
              <span className="h-1.5 w-1.5 rounded-full bg-semantic-success" aria-hidden="true" />
              Jornada ativa
            </span>
            <h1 className="mt-3.5 font-display text-2xl font-bold text-white sm:text-3xl">
              {model.courseTitle}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-neutral-300">
              {heroStatus(model)} · {model.moduleCount} módulos · {model.totalItems} itens de estudo
            </p>
          </div>
          <Button
            onClick={onRevisar}
            data-testid="hero-revisar-cta"
            className={`${styles.press} min-h-[44px] w-full sm:w-auto`}
          >
            Revisar jornada
            <ArrowRight size={15} aria-hidden="true" />
          </Button>
        </div>
      </section>

      {/* ===== JRN-E: Ponto de partida (À PARTE, nunca somado ao realizado) ===== */}
      {model.startingPoint && (
        <StartingPointStrip startingPoint={model.startingPoint} sinceJourney={model.sinceJourney} />
      )}

      {/* ===== 3 stat cards ===== */}
      <section className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <StatCard
          delay={40}
          icon={<Compass size={16} aria-hidden="true" />}
          label="Módulo atual"
          value={model.currentModule ? `Módulo ${model.currentModule.order}` : "—"}
          sub={
            model.currentModule
              ? `${model.currentModule.title}${
                  model.currentModule.deadlineIso
                    ? ` · até ${formatJourneyDate(model.currentModule.deadlineIso)}`
                    : ""
                }`
              : undefined
          }
        />
        <StatCard
          delay={80}
          icon={<TrendingUp size={16} aria-hidden="true" />}
          label="Progresso do curso"
          value={model.isDayZero && !model.startingPoint ? "Ponto de partida" : `${progress}%`}
          sub={progressSub(model)}
          barPct={model.isDayZero && !model.startingPoint ? undefined : model.progressPct}
          expectedPct={model.isDayZero ? undefined : (model.expectedPct ?? undefined)}
          baselinePct={model.startingPoint?.progressPct}
        />
        <StatCard
          delay={120}
          icon={<Gauge size={16} aria-hidden="true" />}
          label="Ritmo escolhido"
          value={`${model.sessionsPerWeek}`}
          valueSuffix="sessões / semana"
          sub={
            model.isDayZero
              ? "Seg · Qua · Sex — a primeira vem aí"
              : model.sinceJourney && model.startingPoint
                ? `Seg · Qua · Sex · ${count(model.sinceJourney.sessionsDone, "sessão", "sessões")} nesta jornada`
                : `Seg · Qua · Sex · ${count(model.sessionsDone, "sessão concluída", "sessões concluídas")}`
          }
        />
      </section>

      {/* ===== Sua semana + Acompanhamento ===== */}
      <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Sua semana" description="O que te recoloca no ritmo agora.">
          <SuaSemana model={model} hrefs={hrefs} />
        </Panel>
        <Panel title="Seu acompanhamento" description="Sua jornada × o seu realizado.">
          <Acompanhamento model={model} onRevisar={onRevisar} />
        </Panel>
      </section>

      {/* ===== fileira da IA: Leitura da IA + Visão de Ritmo (round 14) ===== */}
      <section className="mt-4 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <LeituraIA ai={model.ai} />
        <VisaoRitmo ritmo={model.ritmo} sinceMounting={model.startingPoint != null} />
      </section>

      {/* ===== Sua jornada planejada (reancorada) ===== */}
      <section className="mt-4">
        <Panel
          title="Sua jornada planejada"
          description="Cada módulo, com o prazo que você definiu. Concluído não tem prazo futuro."
        >
          {model.modules.length > 0 ? (
            <ModuleTable modules={model.modules} />
          ) : (
            <p className="text-sm text-text-muted">
              Ainda não há capítulos suficientes na sua trilha para montar a jornada por módulo.
            </p>
          )}
        </Panel>
      </section>
    </div>
  )
}

// --- JRN-E: Ponto de partida -----------------------------------------------
// Decisão D3 do Hugo: o progresso anterior à jornada é mostrado À PARTE, com o
// rótulo do que ele é — histórico —, e nunca somado ao realizado do plano.

function progressSub(model: DashboardModel): string | undefined {
  if (model.startingPoint) {
    const delta = Math.round(model.sinceJourney?.progressPct ?? 0)
    const desde =
      delta > 0 ? `+${delta} pontos desde a montagem` : "nada desde a montagem desta jornada"
    return model.expectedPct != null
      ? `${desde} · esperado no curso: ${Math.round(model.expectedPct)}%`
      : desde
  }
  if (model.isDayZero) return "seu avanço aparece aqui a cada sessão"
  return model.expectedPct != null
    ? `esperado no curso: ${Math.round(model.expectedPct)}%`
    : undefined
}

function StartingPointStrip({
  startingPoint,
  sinceJourney,
}: {
  startingPoint: NonNullable<DashboardModel["startingPoint"]>
  sinceJourney: DashboardModel["sinceJourney"]
}) {
  const delta = Math.round(sinceJourney?.progressPct ?? 0)
  return (
    <section
      data-testid="starting-point"
      className={`${styles.rise} mt-3.5 flex flex-col gap-3 rounded-2xl border border-dashed border-border-medium bg-bg-elevated/40 p-4 sm:flex-row sm:items-center sm:justify-between`}
      style={{ animationDelay: "30ms" }}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-text-muted/12 text-text-secondary">
          <Flag size={15} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="text-[10.5px] font-bold uppercase tracking-wide text-text-muted">
            Ponto de partida
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
            Quando você montou esta jornada, em {formatJourneyDate(startingPoint.capturedAt)}, já
            tinha{" "}
            <b className="font-bold text-text-primary" data-testid="starting-point-pct">
              {Math.round(startingPoint.progressPct)}% do curso concluído
            </b>{" "}
            · {count(startingPoint.modulesDone, "módulo", "módulos")} ·{" "}
            {count(startingPoint.sessionsDone, "sessão", "sessões")} ·{" "}
            {count(startingPoint.reflectionsDone, "reflexão", "reflexões")}. Esse é o seu histórico:
            a jornada mede o que vem daqui para frente.
          </p>
        </div>
      </div>
      <div
        data-testid="starting-point-delta"
        className="flex flex-none items-center gap-2 self-start rounded-xl border border-border-subtle bg-bg-card px-3.5 py-2 sm:self-center"
      >
        <span className="text-[10.5px] font-bold uppercase tracking-wide text-text-muted">
          Desde a montagem
        </span>
        <b
          className={`font-display text-base font-bold tabular-nums ${delta > 0 ? "text-semantic-success" : "text-text-secondary"}`}
        >
          +{delta}%
        </b>
      </div>
    </section>
  )
}

// --- Sua semana ------------------------------------------------------------

function SuaSemana({
  model,
  hrefs,
}: {
  model: DashboardModel
  hrefs: JourneyDashboardHrefs
}) {
  const w = model.weekly
  const nothingDone = !w || w.realized.sessions === 0
  const ctaLabel = nothingDone ? "Fazer minha primeira sessão" : "Continuar jornada"
  return (
    <>
      {w ? (
        <div className="flex flex-col gap-2">
          <WeekAction
            done={w.realized.sessions >= w.planned.sessions}
            title="Sessões da semana"
            subtitle={`${w.realized.sessions} de ${w.planned.sessions} combinadas`}
            href={hrefs.interactionHref ?? hrefs.continueHref}
            icon={<PenSquare size={15} aria-hidden="true" />}
          />
          {w.planned.reflections > 0 && (
            <WeekAction
              done={w.realized.reflections >= w.planned.reflections}
              title="Reflexões da semana"
              subtitle={`${w.realized.reflections} de ${w.planned.reflections} combinadas`}
              href={hrefs.reflectionHref ?? hrefs.continueHref}
              icon={<Pencil size={15} aria-hidden="true" />}
            />
          )}
        </div>
      ) : (
        <p className="text-sm text-text-muted">
          Comece por aqui: sua primeira sessão abre o acompanhamento da semana.
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <Link
          href={hrefs.continueHref}
          data-testid="week-cta"
          className={`${styles.press} inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-border-medium bg-transparent px-5 py-2 text-sm font-semibold text-text-primary transition-colors hover:border-cerrado-500/40 hover:bg-cerrado-500/10 hover:text-cerrado-500`}
        >
          {ctaLabel}
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </>
  )
}

function WeekAction({
  done,
  title,
  subtitle,
  href,
  icon,
}: {
  done: boolean
  title: string
  subtitle: string
  href: string
  icon: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`group flex min-h-[44px] items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors ${
        done
          ? "border-semantic-success/30 bg-semantic-success/[0.06] hover:border-semantic-success/50"
          : "border-border-subtle bg-bg-elevated hover:border-cerrado-500/40 hover:bg-bg-hover"
      }`}
    >
      <span
        className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg border ${
          done
            ? "border-semantic-success/40 bg-semantic-success/15 text-semantic-success"
            : "border-border-subtle bg-bg-card text-text-secondary"
        }`}
      >
        {done ? <CheckCircle2 size={15} aria-hidden="true" /> : icon}
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={`text-[13px] font-semibold ${done ? "text-text-secondary line-through decoration-text-muted/60" : "text-text-primary"}`}
        >
          {title}
        </div>
        <div className="mt-0.5 text-[11.5px] text-text-muted">{subtitle}</div>
      </div>
      <ChevronRight
        size={16}
        aria-hidden="true"
        className="flex-none text-text-muted transition-colors group-hover:text-cerrado-500"
      />
    </Link>
  )
}

// --- Acompanhamento --------------------------------------------------------

function Acompanhamento({
  model,
  onRevisar,
}: {
  model: DashboardModel
  onRevisar: () => void
}) {
  if (model.isDayZero || !model.weekly) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-border-medium bg-bg-elevated/40 px-4 py-5 text-sm text-text-secondary">
        <Circle size={16} className="flex-none text-text-muted" aria-hidden="true" />
        <span>
          Sua jornada começa agora. Depois da sua primeira sessão, você acompanha aqui sua jornada ×
          o seu realizado.
        </span>
      </div>
    )
  }
  const w = model.weekly
  const rows = [
    {
      key: "sessions",
      label: "Sessões de estudo",
      planned: w.planned.sessions,
      realized: w.realized.sessions,
    },
    ...(w.planned.reflections > 0 || w.realized.reflections > 0
      ? [
          {
            key: "reflections",
            label: "Reflexões",
            planned: w.planned.reflections,
            realized: w.realized.reflections,
          },
        ]
      : []),
  ]
  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border-subtle">
        <table className="w-full min-w-[380px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-bg-surface">
              {["Atividade", "Combinado", "Realizado", "Situação"].map((h, i) => (
                <th
                  key={h}
                  className={`px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-wide text-text-muted ${i === 3 || i === 0 ? "text-left" : "text-center"}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const ok = r.realized >= r.planned
              const gap = r.planned - r.realized
              return (
                <tr key={r.key} className="border-t border-border-subtle">
                  <td className="px-3.5 py-2.5 font-semibold text-text-primary">{r.label}</td>
                  <td className="px-3.5 py-2.5 text-center font-bold text-text-secondary tabular-nums">
                    {r.planned}
                  </td>
                  <td className="px-3.5 py-2.5 text-center font-bold text-text-secondary tabular-nums">
                    {r.realized}
                  </td>
                  <td className="px-3.5 py-2.5">
                    {ok ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-semantic-success/14 px-2.5 py-1 text-[10.5px] font-bold text-semantic-success">
                        <CheckCircle2 size={11} aria-hidden="true" />
                        em dia
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-semantic-warning/14 px-2.5 py-1 text-[10.5px] font-bold text-caatinga-700">
                        {gap} pendente{gap === 1 ? "" : "s"}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {w.situation === "pendente" && (
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Button
            onClick={onRevisar}
            data-testid="acomp-revisar"
            className={`${styles.press} min-h-[44px]`}
          >
            Revisar jornada
          </Button>
        </div>
      )}
    </>
  )
}

// --- Leitura da IA ---------------------------------------------------------

function LeituraIA({ ai }: { ai: AiReading }) {
  return (
    <div
      data-testid="leitura-ia"
      data-state={ai.state}
      className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-cerrado-600/25 bg-bg-card p-5 shadow-card"
      style={{
        backgroundImage:
          "radial-gradient(130% 130% at 100% 0%, oklch(0.64 0.17 42 / 8%) 0%, transparent 55%)",
      }}
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-cerrado-600/12 text-cerrado-500">
          <Sparkles size={14} aria-hidden="true" />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wide text-cerrado-500">
          Leitura da IA
        </span>
      </div>
      <p className="mt-3 text-[14px] leading-relaxed text-text-primary">
        <Runs runs={ai.read} />
      </p>
      <div className="mt-4 rounded-xl border border-border-subtle bg-bg-elevated/60 px-3.5 py-3">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-text-secondary">
          <CheckCircle2 size={12} aria-hidden="true" className="text-cerrado-500" />
          {ai.actionLabel}
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">
          <Runs runs={ai.action} />
        </p>
      </div>
    </div>
  )
}

// --- Visão de Ritmo --------------------------------------------------------

function VisaoRitmo({
  ritmo,
  sinceMounting,
}: {
  ritmo: RitmoView
  /** JRN-E — há ponto de partida: todo número desta caixa é DESDE a montagem. */
  sinceMounting: boolean
}) {
  const deg = Math.round(ritmo.ringPct * 3.6)
  const ringColor = ritmo.ringOnTrack ? "oklch(0.65 0.19 155)" : "oklch(0.62 0.13 78)"
  const scope = sinceMounting ? " desde a montagem" : ""
  return (
    <div
      data-testid="visao-ritmo"
      data-state={ritmo.state}
      className="flex h-full flex-col rounded-2xl border border-border-subtle bg-bg-card p-5 shadow-card"
    >
      <h3 className="font-display text-base font-bold text-text-primary">Visão de Ritmo</h3>

      {ritmo.state === "day0" ? (
        <p className="mt-4 text-sm text-text-secondary">
          Seu ritmo aparece aqui, semana a semana. A sua jornada pede{" "}
          <b className="font-bold text-text-primary">
            ~{ritmo.dayZeroPacePerWeek ?? "—"} itens/semana
          </b>
          .
        </p>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-4">
            <div
              className="relative flex h-[84px] w-[84px] flex-none items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(${ringColor} 0deg ${deg}deg, var(--color-bg-elevated) ${deg}deg 360deg)`,
              }}
              title={`${ritmo.ringPct}% do combinado${scope}`}
            >
              <div className="flex h-[64px] w-[64px] flex-col items-center justify-center rounded-full bg-bg-card">
                <b className="font-display text-lg font-bold text-text-primary tabular-nums">
                  {ritmo.ringPct}%
                </b>
                <span className="text-[9px] font-medium text-text-muted">do combinado</span>
              </div>
            </div>
            <div className="min-w-0 text-[13px] leading-relaxed">
              {ritmo.donePerWeek != null && (
                <div className="text-text-primary">
                  {sinceMounting ? "Seu ritmo nesta jornada:" : "Seu ritmo:"}{" "}
                  <em className="font-semibold not-italic">{ritmo.donePerWeek} itens/semana</em>
                </div>
              )}
              {ritmo.combinedPerWeek != null && (
                <div className="mt-0.5 text-text-secondary">
                  combinado{sinceMounting ? " desde a montagem" : " até aqui"}:{" "}
                  <b className="font-semibold">{ritmo.combinedPerWeek}/semana</b>
                </div>
              )}
              {ritmo.needLabel && <div className="mt-0.5 text-text-muted">{ritmo.needLabel}</div>}
            </div>
          </div>

          {ritmo.weekSessions && (
            <div className="mt-4 rounded-xl border border-border-subtle bg-bg-elevated/50 px-3.5 py-3">
              <div className="flex items-center justify-between text-[11.5px] text-text-secondary">
                <span>Esta semana · sessões</span>
                <span className="font-bold tabular-nums text-text-primary">
                  {ritmo.weekSessions.realized} de {ritmo.weekSessions.planned}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full border border-border-subtle bg-bg-card">
                <span
                  className={`${styles.barFill} block h-full rounded-full ${
                    ritmo.weekSessions.realized >= ritmo.weekSessions.planned
                      ? "bg-semantic-success"
                      : "bg-cerrado-600"
                  }`}
                  style={{
                    transform: `scaleX(${
                      ritmo.weekSessions.planned > 0
                        ? Math.min(1, ritmo.weekSessions.realized / ritmo.weekSessions.planned)
                        : 0
                    })`,
                  }}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// --- Sua jornada planejada -------------------------------------------------

function ModuleTable({ modules }: { modules: DashModuleRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border-subtle">
      <table className="w-full min-w-[520px] border-collapse text-[13px]">
        <thead>
          <tr className="bg-bg-surface">
            {["Módulo", "Prazo", "Inter.", "Reflex.", "Status"].map((h, i) => (
              <th
                key={h}
                className={`px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-wide text-text-muted ${i === 2 || i === 3 ? "text-center" : "text-left"}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modules.map((m, i) => (
            <tr
              key={m.chapterId}
              data-frozen={m.frozen === true ? "true" : undefined}
              className={`${styles.row} border-t border-border-subtle`}
              style={{ animationDelay: `${Math.min(i, 8) * 25}ms` }}
            >
              <td className="px-3.5 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border text-[11px] font-bold ${
                      m.status === "done"
                        ? "border-semantic-success bg-semantic-success text-black"
                        : m.status === "doing"
                          ? "border-cerrado-500 bg-cerrado-600 text-white"
                          : "border-border-medium bg-bg-elevated text-text-secondary"
                    }`}
                  >
                    {m.status === "done" ? <CheckCircle2 size={12} aria-hidden="true" /> : m.order}
                  </span>
                  <span className="font-semibold text-text-primary">{m.title}</span>
                </div>
              </td>
              <td
                className="px-3.5 py-2.5 text-text-secondary"
                title={m.frozen === true ? "concluído — sem prazo futuro" : undefined}
              >
                {formatJourneyDate(m.deadlineIso)}
              </td>
              <td className="px-3.5 py-2.5 text-center font-bold text-text-secondary tabular-nums">
                {m.interactionsExpected}
              </td>
              <td className="px-3.5 py-2.5 text-center font-bold text-text-secondary tabular-nums">
                {m.reflectionsExpected}
              </td>
              <td className="px-3.5 py-2.5">
                {m.status === "done" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-semantic-success/14 px-2.5 py-1 text-[10.5px] font-bold text-semantic-success">
                    <CheckCircle2 size={11} aria-hidden="true" />
                    concluído
                  </span>
                ) : m.status === "doing" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-cerrado-600/13 px-2.5 py-1 text-[10.5px] font-bold text-cerrado-500">
                    <PenSquare size={11} aria-hidden="true" />
                    em andamento
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-text-muted/14 px-2.5 py-1 text-[10.5px] font-bold text-text-secondary">
                    planejado
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// --- shared primitives -----------------------------------------------------

function Panel({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-border-subtle bg-bg-card p-5 shadow-card">
      <div className="mb-4">
        <h3 className="font-display text-base font-bold text-text-primary">{title}</h3>
        <p className="mt-1 text-xs text-text-muted">{description}</p>
      </div>
      {children}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  valueSuffix,
  sub,
  barPct,
  expectedPct,
  baselinePct,
  delay,
}: {
  icon: React.ReactNode
  label: string
  value: string
  valueSuffix?: string
  sub?: string
  barPct?: number
  expectedPct?: number
  /** JRN-E — marca de onde a jornada COMEÇOU. Contexto na barra, não conquista. */
  baselinePct?: number
  delay: number
}) {
  return (
    <div
      className={`${styles.rise} flex flex-col gap-2.5 rounded-2xl border border-border-subtle bg-bg-card p-4 shadow-card`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-cerrado-600/12 text-cerrado-500">
          {icon}
        </span>
        <span className="text-[10.5px] font-bold uppercase tracking-wide text-text-muted">
          {label}
        </span>
      </div>
      <div className="font-display text-lg font-bold leading-tight text-text-primary">
        {value}
        {valueSuffix && (
          <small className="ml-1 text-xs font-medium text-text-secondary">{valueSuffix}</small>
        )}
      </div>
      {sub && <div className="text-[11.5px] font-medium text-text-secondary">{sub}</div>}
      {barPct != null && (
        <div className="relative h-1.5 overflow-hidden rounded-full border border-border-subtle bg-bg-elevated">
          <span
            className={`${styles.barFill} block h-full rounded-full bg-cerrado-600`}
            style={{ transform: `scaleX(${Math.min(100, Math.max(0, barPct)) / 100})` }}
          />
          {baselinePct != null && (
            <span
              aria-hidden="true"
              data-testid="baseline-marker"
              className="absolute top-0 h-full w-0.5 bg-text-muted"
              style={{ left: `${Math.min(100, Math.max(0, baselinePct))}%` }}
              title={`ponto de partida: ${Math.round(baselinePct)}%`}
            />
          )}
          {expectedPct != null && (
            <span
              aria-hidden="true"
              className="absolute top-0 h-full w-0.5 bg-caatinga-700"
              style={{ left: `${Math.min(100, Math.max(0, expectedPct))}%` }}
              title={`esperado: ${Math.round(expectedPct)}%`}
            />
          )}
        </div>
      )}
    </div>
  )
}
