"use client"

// ---------------------------------------------------------------------------
// NextBestAction — Item 1.3 extension
// ---------------------------------------------------------------------------
// Two sections, visually unified under one header:
//
//   1. OPERATIONAL NUDGES (existing — email/notify roster-based)
//      Generated locally from rosterStudents / unitStats, no fetch.
//
//   2. ADVANCED PEDAGOGICAL ACTIONS (new — POST /api/analytics/pedagogical-actions)
//      a) reopen_reflection  — deterministic (no loading state)
//      b) concept_clinic     — AI-based (loading state rendered)
//      c) reflection_to_case — AI-based (loading state rendered)
//
// The two sections share the same card layout / severity colours.
// Existing actions are preserved as-is; the new section appends below them.
// ---------------------------------------------------------------------------

import type { ModuleIndicator, PedagogicalAction } from "@/types/analytics"
import {
  BookOpen,
  Brain,
  Loader2,
  Mail,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Trophy,
  Zap,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import type { StudentRosterEntry } from "./student-roster"
import type { UnitStats } from "./unit-comparison"

// ---------------------------------------------------------------------------
// Operational action (local, existing)
// ---------------------------------------------------------------------------
interface OperationalAction {
  priority: "high" | "medium" | "low"
  text: string
  count: number
  actionLabel: string
  actionIcon: typeof Mail
  studentIds?: string[]
  emailSubject?: string
  emailMessage?: string
}

function generateOperationalActions(
  roster: StudentRosterEntry[],
  _units: UnitStats[],
): OperationalAction[] {
  const actions: OperationalAction[] = []

  const neverAccessed = roster.filter((s) => s.risk === "never_accessed")
  if (neverAccessed.length > 0) {
    actions.push({
      priority: "high",
      count: neverAccessed.length,
      text: "nunca acessaram a plataforma",
      actionLabel: "Enviar nudge",
      actionIcon: Mail,
      studentIds: neverAccessed.map((s) => s.id),
      emailSubject: "Seu acesso à plataforma está disponível!",
      emailMessage:
        "Olá! Notamos que você ainda não acessou a plataforma de aprendizagem. Seu acesso está pronto e esperando por você. Entre agora e comece sua jornada de desenvolvimento!",
    })
  }

  const inactive = roster.filter(
    (s) =>
      s.daysSinceLastActivity !== null &&
      s.daysSinceLastActivity > 14 &&
      s.risk !== "never_accessed",
  )
  if (inactive.length > 0) {
    actions.push({
      priority: "high",
      count: inactive.length,
      text: "inativos há mais de 14 dias",
      actionLabel: "Notificar",
      actionIcon: MessageSquare,
      studentIds: inactive.map((s) => s.id),
      emailSubject: "Sentimos sua falta na plataforma!",
      emailMessage:
        "Olá! Faz mais de 14 dias desde seu último acesso à plataforma. Tem novos conteúdos esperando por você. Que tal retomar de onde parou?",
    })
  }

  const noRefl = roster.filter((s) => s.completedSessions >= 2 && s.reflectionsCount === 0)
  if (noRefl.length > 0) {
    actions.push({
      priority: "medium",
      count: noRefl.length,
      text: "sem reflexões após sessões",
      actionLabel: "Lembrar",
      actionIcon: RotateCcw,
      studentIds: noRefl.map((s) => s.id),
      emailSubject: "Suas reflexões estão pendentes",
      emailMessage:
        "Olá! Você completou suas sessões de aprendizagem, mas ainda não registrou suas reflexões. As reflexões são parte essencial do processo — reserve alguns minutos para consolidar o que aprendeu.",
    })
  }

  const top = roster
    .filter((s) => s.completedSessions >= 3 && s.reflectionsCount >= 2)
    .sort(
      (a, b) =>
        b.completedSessions + b.reflectionsCount - (a.completedSessions + a.reflectionsCount),
    )
    .slice(0, 3)
  if (top.length > 0) {
    actions.push({
      priority: "low",
      count: top.length,
      text: "destaques para reconhecer",
      actionLabel: "Parabenizar",
      actionIcon: Trophy,
      studentIds: top.map((s) => s.id),
      emailSubject: "Parabéns pelo seu desempenho!",
      emailMessage:
        "Olá! Queremos reconhecer seu excelente engajamento na plataforma. Seu esforço e dedicação nas sessões e reflexões estão fazendo a diferença. Continue assim!",
    })
  }

  return actions
}

// ---------------------------------------------------------------------------
// Severity / priority colours (shared by both sections)
// ---------------------------------------------------------------------------
const SEVERITY_BG: Record<string, string> = {
  critico: "bg-red-50 dark:bg-red-500/[0.06]",
  atencao: "bg-amber-50 dark:bg-amber-500/[0.06]",
  positivo: "bg-emerald-50 dark:bg-emerald-500/[0.06]",
  high: "bg-red-50 dark:bg-red-500/[0.06]",
  medium: "bg-amber-50 dark:bg-amber-500/[0.06]",
  low: "bg-emerald-50 dark:bg-emerald-500/[0.06]",
}

const SEVERITY_BADGE: Record<string, string> = {
  critico: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
  atencao: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  positivo: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
  high: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
}

// Map PedagogicalActionKind to an icon
function pedagogicalIcon(kind: string): typeof Mail {
  if (kind === "reopen_reflection") return RefreshCw
  if (kind === "concept_clinic") return Brain
  if (kind === "reflection_to_case") return BookOpen
  return Zap
}

// Map AlertSeverity to priority tier label
function severityLabel(sev?: string): string {
  if (sev === "critico") return "Crítico"
  if (sev === "atencao") return "Atenção"
  if (sev === "positivo") return "Positivo"
  return "Ação"
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface NextBestActionProps {
  rosterStudents: StudentRosterEntry[]
  unitStats: UnitStats[]
  /**
   * 1.3 — Optional per-module indicators forwarded to the pedagogical-actions
   * endpoint. Pass aggregateResponse.indicators.perModule when available.
   * When absent, only the AI-based pedagogical actions are requested.
   */
  perModule?: ModuleIndicator[]
  /** Optional course / area narrowing for the pedagogical actions endpoint. */
  courseId?: string
  areaId?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function NextBestAction({
  rosterStudents,
  unitStats,
  perModule,
  courseId,
  areaId,
}: NextBestActionProps) {
  const router = useRouter()
  const operationalActions = generateOperationalActions(rosterStudents, unitStats)

  // Stable key derived from perModule chapter ids — changes only when the module
  // list itself changes, avoiding referential instability on every render.
  const perModuleKey = useMemo(
    () =>
      (perModule ?? [])
        .map((m) => m.chapterId)
        .sort()
        .join(","),
    [perModule],
  )

  // Stable request body for the pedagogical-actions fetch. Recomputed only when the
  // module list (via perModuleKey), courseId or areaId actually change — never on
  // every parent re-render. This keeps the fetch effect from refiring spuriously.
  // perModule itself is intentionally tracked via the stable perModuleKey proxy.
  // biome-ignore lint/correctness/useExhaustiveDependencies: perModuleKey is the stable proxy for perModule (referentially unstable)
  const pedRequestBody = useMemo(() => {
    const body: Record<string, unknown> = {}
    if (perModule && perModule.length > 0) body.perModule = perModule
    if (courseId) body.courseId = courseId
    if (areaId) body.areaId = areaId
    return body
  }, [perModuleKey, courseId, areaId])

  // 1.3 — pedagogical actions state
  const [pedActions, setPedActions] = useState<PedagogicalAction[] | null>(null)
  const [pedLoading, setPedLoading] = useState(false)
  const [pedError, setPedError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setPedLoading(true)
    setPedError(false)

    fetch("/api/analytics/pedagogical-actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pedRequestBody),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.json() as Promise<{ actions: PedagogicalAction[] }>
      })
      .then(({ actions }) => {
        if (!cancelled) setPedActions(actions)
      })
      .catch(() => {
        if (!cancelled) setPedError(true)
      })
      .finally(() => {
        if (!cancelled) setPedLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [pedRequestBody])

  const hasSomething =
    operationalActions.length > 0 || pedLoading || (pedActions && pedActions.length > 0) || pedError
  if (!hasSomething) return null

  // Motor de Engajamento (novo fluxo): cada card acima é um DIAGNÓSTICO de um segmento
  // (ex.: "5 inativos há mais de 14 dias"). A ação NÃO dispara um nudge isolado para
  // aquele segmento — ela aciona a geração do conjunto completo de sugestões por cohort
  // (endpoint tenant-wide, por design) e leva o admin ao Centro de Engajamento para
  // revisar e aprovar (IA sugere → admin aprova). O parâmetro de ação é intencionalmente
  // ignorado: o endpoint generate opera sobre todos os cohorts, não sobre um segmento só.
  async function handleGenerateSuggestions() {
    try {
      await fetch("/api/admin/engagement/suggestions/generate", { method: "POST" })
    } catch {
      // Se a geração falhar, ainda navega — o admin pode gerar manualmente no Centro.
    }
    router.push("/admin/notifications")
  }

  return (
    <div className="pt-4 mt-2 space-y-4">
      {/* ─── Section header ─── */}
      <div className="flex items-center gap-2">
        <div className="h-5 w-5 rounded-md bg-cerrado-600 flex items-center justify-center">
          <Zap size={11} className="text-white" />
        </div>
        <span className="text-xs font-semibold text-text-primary">Próxima Melhor Ação</span>
      </div>

      {/* ─── Operational nudges (existing) ─── */}
      {operationalActions.length > 0 && (
        <p className="text-[10px] text-text-muted leading-snug">
          Cada cartão é um diagnóstico de um segmento de alunos. A ação gera o conjunto de sugestões
          por cohort para você revisar e aprovar no Centro de Engajamento.
        </p>
      )}
      {operationalActions.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {operationalActions.map((action) => {
            const Icon = action.actionIcon
            return (
              <div
                key={action.text}
                className={`rounded-xl ${SEVERITY_BG[action.priority]} p-3.5 flex items-center gap-3`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${SEVERITY_BADGE[action.priority]}`}
                    >
                      {action.count}
                    </span>
                    <p className="text-[11px] font-medium text-text-primary truncate">
                      {action.text}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateSuggestions}
                  title="Gera o conjunto de sugestões por cohort para revisão no Centro de Engajamento"
                  className="shrink-0 flex items-center gap-1.5 text-[11px] font-semibold rounded-lg px-3 py-1.5 bg-cerrado-600 text-white hover:bg-cerrado-700 active:scale-[0.96] transition-all shadow-sm shadow-cerrado-600/20"
                >
                  <Icon size={11} />
                  {action.actionLabel}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ─── Advanced pedagogical actions (1.3) ─── */}
      {pedLoading && (
        <div className="flex items-center gap-2 text-[11px] text-text-muted py-2">
          <Loader2 size={13} className="animate-spin" />
          <span>Analisando ações pedagógicas…</span>
        </div>
      )}

      {!pedLoading && pedError && (
        <p className="text-[10px] text-text-muted italic">
          Ações pedagógicas indisponíveis no momento.
        </p>
      )}

      {!pedLoading && pedActions && pedActions.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            Ações Pedagógicas
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {pedActions.map((action) => {
              const Icon = pedagogicalIcon(action.kind)
              const sevKey = action.severity ?? "atencao"
              const isAI = action.kind === "concept_clinic" || action.kind === "reflection_to_case"

              return (
                <div
                  key={`${action.kind}-${(action.targetIds ?? []).join("-")}`}
                  className={`rounded-xl ${SEVERITY_BG[sevKey]} p-3.5 space-y-1.5`}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 h-5 w-5 rounded-md bg-white/60 dark:bg-white/[0.06] flex items-center justify-center shrink-0">
                      <Icon size={11} className="text-text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${SEVERITY_BADGE[sevKey]}`}
                        >
                          {severityLabel(action.severity)}
                        </span>
                        {isAI && (
                          <span className="text-[9px] text-text-muted font-medium px-1.5 py-0.5 rounded bg-[#8b5cf6]/10 text-[#8b5cf6]">
                            IA
                          </span>
                        )}
                        <p className="text-[11px] font-semibold text-text-primary">
                          {action.title}
                        </p>
                      </div>
                      <p className="text-[10px] text-text-secondary leading-snug">
                        {action.detail}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
