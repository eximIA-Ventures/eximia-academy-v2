"use client"

// =============================================================================
// TeamEngagementHeader + BucketDrillModal — actionable team engagement header
// =============================================================================
//
// Renders the three actionable engagement buckets (accessed / devendo / inativos)
// as a COMPACT HORIZONTAL STRIP of chips (Iteração 2 redesign, 2026-07-02 —
// replaces the previous 3 large cards; owner feedback: they didn't match the
// "recorte da equipe" framing). Clicking a chip opens the SAME CLIENT-ONLY
// drill modal listing the students in that bucket; the modal footer dispatches
// an engagement nudge to the whole bucket via POST /api/analytics/manager/nudge.
// ALL acting functionality from the card version (expand/list + nudge dispatch)
// is preserved 1:1 — only the trigger's visual form changed.
//
// E9 INVARIANT: this component NEVER touches the router or the `?focus` URL param.
// `activeBucket` is local React state only — opening/closing the modal does not
// re-render the RSC tree or change the drill-down focus, so the E9 drill-down
// (handled by manager-team-dashboard-page.tsx) keeps working unchanged.
//
// The modal overlay mirrors the StudentModal in
// components/analytics/student-roster.tsx (fixed inset-0 z-50, bg-black/30
// backdrop-blur, stopPropagation on the panel, dedicated X button).
// =============================================================================

import type {
  DevendoReason,
  EngagementBucket,
  EngagementStudent,
  TeamEngagementBuckets,
} from "@/lib/engagement-helpers"
import type { NudgeType } from "@/types/notifications"
import { AlertTriangle, CheckCircle, Clock, Mail, X } from "lucide-react"
import { type ReactNode, useState } from "react"

// --- POST result shape (mirrors /api/analytics/manager/nudge response) ---
interface DispatchResult {
  inAppCreated: number
  emailsSent: number
  emailsFailed: number
  emailRowsFailed: number
  recipientsSkipped: number
  total: number
}

// --- Per-bucket presentation + default nudgeType (see plan SUBTAREFA 3) ---
// inativos -> "inactive" (the endpoint refines never_accessed for 0-session ids);
// devendo  -> "no_reflection" (owes a reflection / is behind);
// accessed -> "announcement" (no problem to fix, just reach out).
const BUCKET_CONFIG: Record<
  EngagementBucket,
  {
    label: string
    icon: ReactNode
    iconBg: string
    iconColor: string
    /** Small strip-chip dot color (Iteração 2 redesign) — same semantic hue
     * as `iconColor`, applied as a `bg-*` solid dot instead of an icon tile. */
    dotColor: string
    defaultNudgeType: NudgeType
  }
> = {
  accessed: {
    label: "Acessaram",
    icon: <CheckCircle size={22} aria-hidden="true" />,
    iconBg: "bg-semantic-success/15",
    iconColor: "text-semantic-success",
    dotColor: "bg-semantic-success",
    defaultNudgeType: "announcement",
  },
  devendo: {
    label: "Devendo",
    icon: <AlertTriangle size={22} aria-hidden="true" />,
    iconBg: "bg-accent-gold/15",
    iconColor: "text-accent-gold",
    dotColor: "bg-accent-gold",
    defaultNudgeType: "no_reflection",
  },
  inativos: {
    label: "Inativos",
    icon: <Clock size={22} aria-hidden="true" />,
    iconBg: "bg-semantic-error/15",
    iconColor: "text-semantic-error",
    dotColor: "bg-semantic-error",
    defaultNudgeType: "inactive",
  },
}

const DEVENDO_REASON_LABEL: Record<DevendoReason, string> = {
  sem_atividade_recente: "Sem atividade recente",
  atras_cronograma: "Atrás do cronograma",
}

// Nudge type options offered in the modal footer. The bucket default is preselected;
// a manager can always fall back to a free-form announcement / custom message.
const NUDGE_TYPE_OPTIONS: { value: NudgeType; label: string }[] = [
  { value: "inactive", label: "Reengajar inativo" },
  { value: "never_accessed", label: "Nunca acessou" },
  { value: "no_reflection", label: "Cobrar reflexão" },
  { value: "announcement", label: "Aviso" },
  { value: "custom", label: "Mensagem personalizada" },
]

interface TeamEngagementHeaderProps {
  buckets: TeamEngagementBuckets
}

export function TeamEngagementHeader({ buckets }: TeamEngagementHeaderProps) {
  // CLIENT-ONLY state — never written to the URL (preserves E9 drill-down).
  const [activeBucket, setActiveBucket] = useState<EngagementBucket | null>(null)

  const chips: { key: EngagementBucket; value: number }[] = [
    { key: "accessed", value: buckets.summary.accessedCount },
    { key: "devendo", value: buckets.summary.devendoCount },
    { key: "inativos", value: buckets.summary.inativosCount },
  ]

  return (
    <>
      {/* Compact strip (Iteração 2 redesign): one row of dot+count chips
          instead of 3 large cards. Same click-to-open-modal + nudge behavior
          as before — only the visual weight changed, to sit discretely inside
          the "Recorte da equipe" section instead of dominating it. */}
      <div
        className="flex flex-wrap items-center gap-2 rounded-xl bg-bg-surface px-3 py-2"
        aria-label="Resumo de engajamento da equipe"
      >
        {chips.map(({ key, value }) => {
          const cfg = BUCKET_CONFIG[key]
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveBucket(key)}
              aria-label={`${cfg.label}: ${value} alunos. Abrir lista e disparar engajamento.`}
              className="group flex items-center gap-1.5 rounded-lg bg-bg-card px-2.5 py-1.5 text-xs font-medium text-text-secondary shadow-card transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-cerrado-600 focus-visible:ring-offset-1"
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${cfg.dotColor}`}
                aria-hidden="true"
              />
              {cfg.label} <span className="font-semibold text-text-primary">{value}</span>
            </button>
          )
        })}
        <span className="ml-auto text-[11px] text-text-muted">
          de {buckets.summary.teamTotal} {buckets.summary.teamTotal === 1 ? "aluno" : "alunos"}
        </span>
      </div>

      {activeBucket && (
        <BucketDrillModal
          bucket={activeBucket}
          students={buckets[activeBucket]}
          onClose={() => setActiveBucket(null)}
        />
      )}
    </>
  )
}

// --- Friendly "last activity" label for a roster row. ---
function activityLabel(days: number | null): string {
  if (days === null) return "Nunca acessou"
  if (days === 0) return "Hoje"
  return `${days}d`
}

function BucketDrillModal({
  bucket,
  students,
  onClose,
}: {
  bucket: EngagementBucket
  students: EngagementStudent[]
  onClose: () => void
}) {
  const cfg = BUCKET_CONFIG[bucket]
  const [nudgeType, setNudgeType] = useState<NudgeType>(cfg.defaultNudgeType)
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<DispatchResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const studentIds = students.map((s) => s.id)
  const canSend = studentIds.length > 0 && !sending

  async function handleDispatch() {
    if (!canSend) return
    setSending(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch("/api/analytics/manager/nudge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds,
          nudgeType,
          message: message.trim() ? message.trim() : null,
        }),
      })
      const data = (await res.json().catch(() => null)) as
        | (DispatchResult & { error?: string })
        | { error?: string }
        | null
      if (!res.ok) {
        setError((data && "error" in data && data.error) || "Falha ao disparar engajamento.")
        return
      }
      setResult(data as DispatchResult)
    } catch {
      setError("Erro de rede ao disparar engajamento.")
    } finally {
      setSending(false)
    }
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: overlay de fundo de modal; o fechamento por teclado é tratado pelo botão X dedicado
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: apenas stopPropagation (impede fechar ao clicar no conteúdo), não é elemento interativo */}
      <div
        className="relative max-h-[85vh] w-full overflow-y-auto rounded-t-[2rem] bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl dark:bg-bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-black/10" />
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200"
        >
          <X size={14} className="text-gray-500" />
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-3">
          <div className="flex items-center gap-3.5">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${cfg.iconBg} ${cfg.iconColor}`}
              aria-hidden="true"
            >
              {cfg.icon}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-gray-900 dark:text-text-primary">
                {cfg.label}
              </h2>
              <p className="text-[11px] text-gray-500">{students.length} alunos neste grupo</p>
            </div>
          </div>
        </div>

        {/* Student list */}
        <div className="px-6 pb-3">
          {students.length === 0 ? (
            <div className="rounded-xl bg-gray-50 px-4 py-6 text-center dark:bg-white/[0.04]">
              <p className="text-sm text-text-muted">Nenhum aluno neste grupo.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-border-subtle">
              {students.map((student) => (
                <li key={student.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{student.name}</p>
                    <p className="truncate text-[11px] text-text-muted">{student.email}</p>
                    {bucket === "devendo" &&
                      student.devendoReasons &&
                      student.devendoReasons.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {student.devendoReasons.map((reason) => (
                            <span
                              key={reason}
                              className="inline-flex items-center rounded-full bg-accent-gold/10 px-2 py-0.5 text-[10px] font-medium text-accent-gold"
                            >
                              {DEVENDO_REASON_LABEL[reason]}
                            </span>
                          ))}
                        </div>
                      )}
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-[11px] text-text-muted tabular-nums">
                    {activityLabel(student.daysSinceLastActivity)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Dispatch footer */}
        {students.length > 0 && (
          <div className="border-t border-gray-100 px-6 py-4 dark:border-border-subtle">
            {result ? (
              <div className="rounded-xl bg-semantic-success/5 px-4 py-3">
                <p className="flex items-center gap-2 text-sm font-medium text-semantic-success">
                  <CheckCircle size={16} /> Engajamento disparado
                </p>
                <p className="mt-1 text-[11px] text-text-secondary">
                  {result.inAppCreated} notificações criadas · {result.emailsSent} e-mails enviados
                  {result.recipientsSkipped > 0 && ` · ${result.recipientsSkipped} ignorados`}
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-3 w-full rounded-xl bg-cerrado-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cerrado-700"
                >
                  Concluir
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="nudge-type"
                    className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-muted"
                  >
                    Tipo de mensagem
                  </label>
                  <select
                    id="nudge-type"
                    value={nudgeType}
                    onChange={(e) => setNudgeType(e.target.value as NudgeType)}
                    disabled={sending}
                    className="w-full rounded-xl border border-gray-200 bg-bg-card px-3 py-2 text-sm text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-cerrado-600 dark:border-border-subtle"
                  >
                    {NUDGE_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="nudge-message"
                    className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-muted"
                  >
                    Mensagem (opcional)
                  </label>
                  <textarea
                    id="nudge-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={sending}
                    rows={2}
                    placeholder="Deixe em branco para usar o modelo padrão."
                    className="w-full resize-none rounded-xl border border-gray-200 bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-cerrado-600 dark:border-border-subtle"
                  />
                </div>

                {error && <p className="text-[11px] font-medium text-semantic-error">{error}</p>}

                <button
                  type="button"
                  onClick={handleDispatch}
                  disabled={!canSend}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-cerrado-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-cerrado-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Mail size={14} />
                  {sending
                    ? "Disparando…"
                    : `Disparar engajamento para estes ${studentIds.length} alunos`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
