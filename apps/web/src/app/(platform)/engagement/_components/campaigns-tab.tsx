"use client"

// ---------------------------------------------------------------------------
// E7 — Aba Campanhas.
// ---------------------------------------------------------------------------
// Collective campaigns born from AUTO-GENERATED contextual cohorts of the
// current recorte (never "saved audiences" — kill list, Seção 16). Flow, in
// order, no step skippable (report Seção 12):
//   Ver alunos → Template → Origem → Canal → Preview → REVISÃO OBRIGATÓRIA → Enviar
//
// Security: the review list is resolved SERVER-SIDE via POST .../campaign in
// "preview" mode (never trusting a client-computed list, E7 AC4); the final
// send is "confirm" mode, only reachable from the review screen (E7 AC6). The
// server re-scopes both times, so a removed/foreign id can never slip in (AC9).
// Cap of 200 recipients is surfaced BEFORE any send attempt (AC7).
// ---------------------------------------------------------------------------

import type { NudgeType, SenderIdentity } from "@/types/notifications"
import { Badge, Button, EmptyState, Select, Skeleton, Textarea, useToast } from "@eximia/ui"
import { ArrowLeft, Megaphone, Users } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { withFocus } from "./engagement-fetch"
import { nudgeTypeLabel, nudgeTypeReason } from "./nudge-labels"
import type { CampaignsTabProps } from "./types"

const MAX_RECIPIENTS = 200 // mirrors the FinOps cap in api/engagement/campaign

// --- Local types (not in the shared types.ts — registered as a gap for the ---
// --- orchestrator to reconcile if these ever need to be shared). ------------

/** Minimal template shape consumed from GET /api/engagement/templates. */
interface CampaignTemplate {
  id: string
  key: string
  name: string
  intent: string | null
  tone: string | null
  bodyInapp: string | null
  channelInapp: boolean
  channelEmail: boolean
}

/** A recipient as resolved server-side by the campaign preview mode. */
interface PreviewRecipient {
  id: string
  fullName: string | null
  email: string | null
  reason: string
}

/** Result of a confirmed dispatch (mirrors dispatchTeamNudge return). */
interface ConfirmResult {
  inAppCreated: number
  emailsSent: number
  emailsFailed: number
  recipientsSkipped: number
  total: number
}

type Channel = "inapp" | "email"

/** Wizard steps, in the exact order the report (Seção 12) mandates. */
type WizardStep = "students" | "template" | "origin" | "channel" | "preview" | "review" | "done"

const STEP_ORDER: WizardStep[] = [
  "students",
  "template",
  "origin",
  "channel",
  "preview",
  "review",
  "done",
]

const STEP_LABEL: Record<WizardStep, string> = {
  students: "Ver alunos",
  template: "Escolher template",
  origin: "Origem da mensagem",
  channel: "Canal",
  preview: "Pré-visualizar",
  review: "Revisão obrigatória",
  done: "Enviada",
}

export function CampaignsTab({
  initialCohorts,
  context,
  senderOptions,
  canManageCampaigns,
  focus,
}: CampaignsTabProps) {
  const { toast } = useToast()

  // Cohort currently being turned into a campaign (null = list view).
  const [activeCohort, setActiveCohort] = useState<
    CampaignsTabProps["initialCohorts"][number] | null
  >(null)
  const [step, setStep] = useState<WizardStep>("students")

  // Wizard selections.
  const [templates, setTemplates] = useState<CampaignTemplate[] | null>(null)
  const [templateKey, setTemplateKey] = useState<string | null>(null)
  const [identity, setIdentity] = useState<SenderIdentity>(senderOptions.defaultIdentity)
  const [channel, setChannel] = useState<Channel>("inapp")
  const [message, setMessage] = useState<string>("")

  // Server-resolved preview + review state.
  const [previewLoading, setPreviewLoading] = useState(false)
  const [recipients, setRecipients] = useState<PreviewRecipient[]>([])
  const [previewTotal, setPreviewTotal] = useState(0)
  const [previewCapped, setPreviewCapped] = useState(false)
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())

  // Confirm state.
  const [sending, setSending] = useState(false)
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null)

  // Load templates once, lazily, when the user first opens a cohort.
  const loadTemplates = useCallback(async () => {
    if (templates !== null) return
    try {
      const res = await fetch("/api/engagement/templates")
      if (!res.ok) throw new Error("Falha ao carregar templates")
      const data = (await res.json()) as { templates: CampaignTemplate[] }
      setTemplates(data.templates ?? [])
    } catch {
      setTemplates([])
      toast({ variant: "error", title: "Não foi possível carregar os templates" })
    }
  }, [templates, toast])

  useEffect(() => {
    if (activeCohort) void loadTemplates()
  }, [activeCohort, loadTemplates])

  function resetWizard() {
    setActiveCohort(null)
    setStep("students")
    setTemplateKey(null)
    setIdentity(senderOptions.defaultIdentity)
    setChannel("inapp")
    setMessage("")
    setRecipients([])
    setPreviewTotal(0)
    setPreviewCapped(false)
    setRemovedIds(new Set())
    setConfirmResult(null)
  }

  // Resolve the recipient list SERVER-SIDE (preview mode) — E7 AC4.
  const runPreview = useCallback(
    async (cohortType: NudgeType) => {
      setPreviewLoading(true)
      try {
        const res = await fetch("/api/engagement/campaign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "preview",
            nudgeType: cohortType,
            senderIdentity: identity,
            criteria: { risk: cohortType },
          }),
        })
        if (!res.ok) throw new Error("preview failed")
        const data = (await res.json()) as {
          total: number
          capped: boolean
          recipients: PreviewRecipient[]
        }
        setRecipients(data.recipients ?? [])
        setPreviewTotal(data.total ?? 0)
        setPreviewCapped(Boolean(data.capped))
        setRemovedIds(new Set())
        setStep("review")
      } catch {
        toast({ variant: "error", title: "Não foi possível carregar os destinatários" })
      } finally {
        setPreviewLoading(false)
      }
    },
    [identity, toast],
  )

  // Final dispatch (confirm mode) — only reachable from the review screen (AC6).
  const runConfirm = useCallback(async () => {
    if (!activeCohort) return
    const finalIds = recipients.map((r) => r.id).filter((id) => !removedIds.has(id))
    if (finalIds.length === 0) {
      toast({ variant: "warning", title: "Nenhum destinatário selecionado" })
      return
    }
    if (finalIds.length > MAX_RECIPIENTS) {
      toast({
        variant: "error",
        title: `Máximo de ${MAX_RECIPIENTS} destinatários por campanha`,
        description: "Remova alunos da lista ou envie em lotes menores.",
      })
      return
    }
    setSending(true)
    try {
      // Rodada 3: gate the dispatch to the current drill-down node (server
      // re-scopes the reviewed ids against it; a forged/absent focus is a no-op).
      const res = await fetch(withFocus("/api/engagement/campaign", focus), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "confirm",
          nudgeType: activeCohort.type,
          studentIds: finalIds,
          templateKey,
          message: message.trim() ? message.trim() : null,
          senderIdentity: identity,
        }),
      })
      const data = (await res.json()) as ConfirmResult & { error?: string }
      if (!res.ok) {
        toast({ variant: "error", title: data.error ?? "Falha ao enviar a campanha" })
        return
      }
      setConfirmResult({
        inAppCreated: data.inAppCreated ?? 0,
        emailsSent: data.emailsSent ?? 0,
        emailsFailed: data.emailsFailed ?? 0,
        recipientsSkipped: data.recipientsSkipped ?? 0,
        total: data.total ?? finalIds.length,
      })
      setStep("done")
    } catch {
      toast({ variant: "error", title: "Falha ao enviar a campanha" })
    } finally {
      setSending(false)
    }
  }, [activeCohort, recipients, removedIds, templateKey, message, identity, toast, focus])

  // --- Guards --------------------------------------------------------------

  if (!canManageCampaigns) {
    return (
      <EmptyState
        className="rounded-2xl bg-bg-card shadow-card"
        icon={<Megaphone size={28} />}
        title="Campanhas indisponíveis"
        description="Apenas gestores e administradores podem enviar campanhas coletivas."
      />
    )
  }

  // --- Cohort list (no active campaign) ------------------------------------

  if (!activeCohort) {
    // AC2: never show an empty cohort. The server already excludes zero-count
    // cohorts, but guard defensively against a stray empty group.
    const cohorts = initialCohorts.filter((c) => c.targetStudentIds.length > 0)
    if (cohorts.length === 0) {
      return (
        <EmptyState
          className="rounded-2xl bg-bg-card shadow-card"
          icon={<Megaphone size={28} />}
          title="Nenhuma lista para acionar"
          description={
            context.tenantWide
              ? "Nenhum critério de engajamento reúne alunos para campanha no momento."
              : "Nenhum critério de engajamento reúne alunos para campanha no recorte atual."
          }
        />
      )
    }
    return (
      <div className="space-y-3">
        {/* E12 item 4: the word "grupo" alone told the manager nothing. Each row
            IS a named engagement criterion (e.g. "Inativos há mais de 14 dias")
            with its count — the copy now says so instead of a bare "grupo". */}
        <p className="text-sm text-text-secondary">
          Listas montadas automaticamente por critério de engajamento no recorte atual. Toda
          campanha passa por uma tela de revisão antes do envio.
        </p>
        {cohorts.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-4 rounded-2xl bg-bg-card p-5 shadow-card"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: "rgba(230,126,34,0.12)", color: "#e67e22" }}
                >
                  <Users size={18} />
                </span>
                <h3 className="truncate text-sm font-semibold text-text-primary">
                  {nudgeTypeLabel(c.type)}
                </h3>
                <Badge variant="info" badgeSize="sm">
                  {c.targetStudentIds.length}
                </Badge>
              </div>
              {c.rationale ? (
                <p className="text-xs text-text-muted">{c.rationale}</p>
              ) : (
                <p className="text-xs text-text-muted">
                  {/* Name the criterion, not a bare "grupo" (E12 item 4). */}
                  {nudgeTypeReason(c.type)} · {c.targetStudentIds.length} aluno
                  {c.targetStudentIds.length === 1 ? "" : "s"}
                </p>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => {
                setActiveCohort(c)
                setStep("students")
              }}
            >
              Acionar lista
            </Button>
          </div>
        ))}
      </div>
    )
  }

  // --- Active campaign wizard ----------------------------------------------

  const stepIndex = STEP_ORDER.indexOf(step)
  const cohortType = activeCohort.type
  const availableTemplates = (templates ?? []).filter((t) =>
    channel === "inapp" ? t.channelInapp : t.channelEmail,
  )
  const selectedTemplate = (templates ?? []).find((t) => t.key === templateKey) ?? null
  const finalRecipients = recipients.filter((r) => !removedIds.has(r.id))

  return (
    <div className="space-y-5">
      {/* Wizard header + stepper */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={resetWizard}>
          <ArrowLeft size={16} /> Voltar às listas
        </Button>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text-primary">{nudgeTypeLabel(cohortType)}</h3>
          <Badge variant="info" badgeSize="sm">
            {activeCohort.targetStudentIds.length} aluno
            {activeCohort.targetStudentIds.length === 1 ? "" : "s"}
          </Badge>
        </div>
      </div>

      <ol className="flex flex-wrap gap-2 text-xs">
        {STEP_ORDER.filter((s) => s !== "done").map((s, i) => {
          const active = s === step
          const complete = i < stepIndex
          return (
            <li
              key={s}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1"
              style={{
                backgroundColor: active
                  ? "rgba(230,126,34,0.12)"
                  : complete
                    ? "rgba(39,174,96,0.10)"
                    : "transparent",
                color: active ? "#e67e22" : complete ? "#27ae60" : undefined,
              }}
            >
              <span className="font-semibold">{i + 1}.</span>
              <span className={active || complete ? "font-medium" : "text-text-muted"}>
                {STEP_LABEL[s]}
              </span>
            </li>
          )
        })}
      </ol>

      <div className="rounded-2xl bg-bg-card p-6 shadow-card">
        {/* STEP 1 — Ver alunos (the group members, before any message) */}
        {step === "students" && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-text-primary">Alunos desta lista</h4>
              <p className="mt-1 text-xs text-text-muted">
                {activeCohort.targetStudentIds.length} aluno
                {activeCohort.targetStudentIds.length === 1 ? "" : "s"} · critério:{" "}
                {nudgeTypeReason(cohortType)}
              </p>
            </div>
            <p className="text-xs text-text-secondary">
              A lista final e definitiva de destinatários será resolvida pelo servidor na tela de
              revisão, respeitando o seu recorte atual.
            </p>
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setStep("template")}>
                Escolher template
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2 — Escolher template */}
        {step === "template" && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-text-primary">Escolher template</h4>
            {templates === null ? (
              <Skeleton className="h-11 w-full rounded-xl" />
            ) : (
              <>
                <Select
                  value={templateKey ?? ""}
                  onChange={(e) => setTemplateKey(e.target.value || null)}
                >
                  <option value="">Sem template (mensagem personalizada)</option>
                  {availableTemplates.map((t) => (
                    <option key={t.id} value={t.key}>
                      {t.name}
                    </option>
                  ))}
                </Select>
                {templateKey && selectedTemplate?.bodyInapp ? (
                  <p className="rounded-xl bg-bg-elevated p-3 text-xs text-text-secondary">
                    {selectedTemplate.bodyInapp}
                  </p>
                ) : null}
              </>
            )}
            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => setStep("students")}>
                <ArrowLeft size={16} /> Voltar
              </Button>
              <Button size="sm" onClick={() => setStep("origin")}>
                Escolher origem
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3 — Origem da mensagem */}
        {step === "origin" && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-text-primary">Origem da mensagem</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <OriginOption
                selected={identity === "platform"}
                title="Plataforma"
                description="A mensagem sai em nome da exímIA Academy."
                onSelect={() => setIdentity("platform")}
              />
              <OriginOption
                selected={identity === "manager"}
                disabled={!senderOptions.managerName}
                title={
                  senderOptions.managerName
                    ? `Gestor (${senderOptions.managerName})`
                    : "Gestor (indisponível)"
                }
                description={
                  senderOptions.managerName
                    ? "A mensagem sai assinada em seu nome."
                    : "Sua identidade de gestor não está disponível neste recorte."
                }
                onSelect={() => senderOptions.managerName && setIdentity("manager")}
              />
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => setStep("template")}>
                <ArrowLeft size={16} /> Voltar
              </Button>
              <Button size="sm" onClick={() => setStep("channel")}>
                Selecionar canal
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4 — Canal */}
        {step === "channel" && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-text-primary">Canal de envio</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <OriginOption
                selected={channel === "inapp"}
                title="In-app"
                description="Notificação dentro da plataforma."
                onSelect={() => {
                  setChannel("inapp")
                  if (templateKey && selectedTemplate && !selectedTemplate.channelInapp)
                    setTemplateKey(null)
                }}
              />
              <OriginOption
                selected={channel === "email"}
                title="Email"
                description="Enviado do remetente da plataforma."
                onSelect={() => {
                  setChannel("email")
                  if (templateKey && selectedTemplate && !selectedTemplate.channelEmail)
                    setTemplateKey(null)
                }}
              />
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => setStep("origin")}>
                <ArrowLeft size={16} /> Voltar
              </Button>
              <Button size="sm" onClick={() => setStep("preview")}>
                Pré-visualizar
              </Button>
            </div>
          </div>
        )}

        {/* STEP 5 — Pré-visualizar a mensagem final */}
        {step === "preview" && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-text-primary">Pré-visualizar mensagem</h4>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <dt className="text-text-muted">Template</dt>
              <dd className="text-text-primary">{selectedTemplate?.name ?? "Personalizada"}</dd>
              <dt className="text-text-muted">Origem</dt>
              <dd className="text-text-primary">
                {identity === "manager"
                  ? `Gestor${senderOptions.managerName ? ` (${senderOptions.managerName})` : ""}`
                  : "Plataforma"}
              </dd>
              <dt className="text-text-muted">Canal</dt>
              <dd className="text-text-primary">{channel === "inapp" ? "In-app" : "Email"}</dd>
            </dl>
            <div className="space-y-1.5">
              <label htmlFor="campaign-message" className="text-xs font-medium text-text-secondary">
                Mensagem (edite se desejar; vazio usa o corpo do template)
              </label>
              <Textarea
                id="campaign-message"
                rows={4}
                placeholder={selectedTemplate?.bodyInapp ?? "Escreva a mensagem da campanha…"}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => setStep("channel")}>
                <ArrowLeft size={16} /> Voltar
              </Button>
              <Button
                size="sm"
                isLoading={previewLoading}
                onClick={() => void runPreview(cohortType)}
              >
                Ir para revisão
              </Button>
            </div>
          </div>
        )}

        {/* STEP 6 — REVISÃO OBRIGATÓRIA (destinatários + motivo + remover) */}
        {step === "review" && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-text-primary">Revisão obrigatória</h4>
              <p className="mt-1 text-xs text-text-muted">
                Confirme quem vai receber a campanha. Você pode remover alunos antes de enviar.
              </p>
            </div>

            {/* AC7 — cap communicated BEFORE any send attempt. */}
            {previewCapped && (
              <div
                className="rounded-xl p-3 text-xs"
                style={{ backgroundColor: "rgba(230,126,34,0.10)", color: "#e67e22" }}
              >
                Esta lista tem {previewTotal} alunos, acima do limite de {MAX_RECIPIENTS} por
                campanha. Apenas os primeiros {MAX_RECIPIENTS} estão listados. Remova alunos ou
                envie em lotes menores.
              </div>
            )}

            <dl className="grid grid-cols-2 gap-2 text-xs">
              <dt className="text-text-muted">Mensagem</dt>
              <dd className="text-text-primary">
                {message.trim() || selectedTemplate?.bodyInapp || "(corpo do template)"}
              </dd>
              <dt className="text-text-muted">Origem</dt>
              <dd className="text-text-primary">
                {identity === "manager"
                  ? `Gestor${senderOptions.managerName ? ` (${senderOptions.managerName})` : ""}`
                  : "Plataforma"}
              </dd>
              <dt className="text-text-muted">Canal</dt>
              <dd className="text-text-primary">{channel === "inapp" ? "In-app" : "Email"}</dd>
            </dl>

            <div className="rounded-xl border border-border-subtle">
              <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
                <span className="text-xs font-semibold text-text-secondary">
                  Destinatários ({finalRecipients.length})
                </span>
              </div>
              {finalRecipients.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-text-muted">
                  Nenhum destinatário selecionado. Volte e escolha outra lista.
                </p>
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {finalRecipients.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-text-primary">
                          {r.fullName ?? r.email ?? r.id}
                        </p>
                        <p className="truncate text-xs text-text-muted">
                          {nudgeTypeReason(r.reason)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRemovedIds((prev) => new Set(prev).add(r.id))}
                      >
                        Remover
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => setStep("preview")}>
                <ArrowLeft size={16} /> Voltar
              </Button>
              <Button
                size="sm"
                isLoading={sending}
                disabled={finalRecipients.length === 0 || finalRecipients.length > MAX_RECIPIENTS}
                onClick={() => void runConfirm()}
              >
                Enviar campanha ({finalRecipients.length})
              </Button>
            </div>
          </div>
        )}

        {/* STEP 7 — Confirmação pós-envio */}
        {step === "done" && confirmResult && (
          <div className="space-y-4 text-center">
            <div
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(39,174,96,0.12)", color: "#27ae60" }}
            >
              <Megaphone size={22} />
            </div>
            <h4 className="text-sm font-semibold text-text-primary">Campanha enviada</h4>
            <dl className="mx-auto grid max-w-xs grid-cols-2 gap-1.5 text-xs">
              <dt className="text-text-muted text-left">Notificações in-app</dt>
              <dd className="text-right text-text-primary">{confirmResult.inAppCreated}</dd>
              <dt className="text-text-muted text-left">Emails enviados</dt>
              <dd className="text-right text-text-primary">{confirmResult.emailsSent}</dd>
              {confirmResult.emailsFailed > 0 && (
                <>
                  <dt className="text-left" style={{ color: "#e74c3c" }}>
                    Emails com falha
                  </dt>
                  <dd className="text-right" style={{ color: "#e74c3c" }}>
                    {confirmResult.emailsFailed}
                  </dd>
                </>
              )}
              {confirmResult.recipientsSkipped > 0 && (
                <>
                  <dt className="text-text-muted text-left">Ignorados</dt>
                  <dd className="text-right text-text-primary">
                    {confirmResult.recipientsSkipped}
                  </dd>
                </>
              )}
            </dl>
            <Button size="sm" onClick={resetWizard}>
              Voltar às listas
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// --- Origin/channel option card (shared between steps 3 and 4) --------------

function OriginOption({
  selected,
  title,
  description,
  onSelect,
  disabled,
}: {
  selected: boolean
  title: string
  description: string
  onSelect: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className="rounded-xl border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        borderColor: selected ? "#e67e22" : "var(--border-subtle, rgba(0,0,0,0.08))",
        backgroundColor: selected ? "rgba(230,126,34,0.06)" : undefined,
      }}
    >
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      <p className="mt-1 text-xs text-text-muted">{description}</p>
    </button>
  )
}
