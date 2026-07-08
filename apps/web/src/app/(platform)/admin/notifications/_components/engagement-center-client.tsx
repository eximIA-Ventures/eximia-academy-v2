"use client"

import type { NudgeEfficacyByType as EfficacyType } from "@/lib/notifications/efficacy"
import type { NotificationTemplateRow, NudgeSuggestionRow } from "@/types/notifications"
import { Badge, Button, Input, Textarea } from "@eximia/ui"
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Edit3,
  Eye,
  Globe,
  LayoutList,
  Mail,
  MessageSquare,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
  XCircle,
  Zap,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"

// ─── Data shapes from the server ────────────────────────────────────────────

interface HistoryRow {
  id: string
  recipient_id: string
  recipient_name: string | null
  recipient_email: string | null
  template_id: string | null
  channel: string
  origin: string
  title: string
  status: string
  created_at: string
  sent_at: string | null
  read_at: string | null
  acted_at: string | null
  returned_at: string | null
}

interface Audience {
  id: string
  name: string
  criteria: Record<string, unknown>
  created_at: string
}

interface Course {
  id: string
  title: string
}

interface Area {
  id: string
  name: string
}

interface Props {
  suggestions: NudgeSuggestionRow[]
  templates: NotificationTemplateRow[]
  // biome-ignore lint/suspicious/noExplicitAny: enriched server data from untyped Supabase response
  history: any[]
  efficacy: EfficacyType[]
  audiences: Audience[]
  courses: Course[]
  areas: Area[]
  /** admin|manager|instructor — gerar, aprovar e dispensar sugestões. */
  canManageSuggestions: boolean
  /** admin|manager — enviar campanhas manuais e editar templates. */
  canManageCampaigns: boolean
}

// ─── Nudge type metadata ─────────────────────────────────────────────────────

const NUDGE_META: Record<
  string,
  {
    label: string
    description: string
    icon: typeof Bell
    color: string
    dotColor: string
    iconColor: string
  }
> = {
  never_accessed: {
    label: "Nunca acessaram",
    description: "Alunos que nunca entraram na plataforma",
    icon: Bell,
    color: "bg-red-50 dark:bg-red-500/[0.06] ring-red-100 dark:ring-red-500/10",
    dotColor: "bg-red-500",
    iconColor: "text-red-500",
  },
  inactive: {
    label: "Inativos +14 dias",
    description: "Alunos que pararam de acessar",
    icon: Clock,
    color: "bg-amber-50 dark:bg-amber-500/[0.06] ring-amber-100 dark:ring-amber-500/10",
    dotColor: "bg-amber-500",
    iconColor: "text-amber-500",
  },
  no_reflection: {
    label: "Sem reflexões",
    description: "Sessões feitas, reflexões pendentes",
    icon: RotateCcw,
    color: "bg-blue-50 dark:bg-blue-500/[0.06] ring-blue-100 dark:ring-blue-500/10",
    dotColor: "bg-blue-500",
    iconColor: "text-blue-500",
  },
  top_performer: {
    label: "Destaques",
    description: "Alunos com alto engajamento",
    icon: Trophy,
    color: "bg-emerald-50 dark:bg-emerald-500/[0.06] ring-emerald-100 dark:ring-emerald-500/10",
    dotColor: "bg-emerald-500",
    iconColor: "text-emerald-500",
  },
  announcement: {
    label: "Comunicado",
    description: "Mensagem geral para todos",
    icon: Globe,
    color: "bg-violet-50 dark:bg-violet-500/[0.06] ring-violet-100 dark:ring-violet-500/10",
    dotColor: "bg-violet-500",
    iconColor: "text-violet-500",
  },
  custom: {
    label: "Personalizado",
    description: "Nudge de tipo customizado",
    icon: Sparkles,
    color: "bg-gray-50 dark:bg-white/[0.04] ring-gray-100 dark:ring-white/[0.06]",
    dotColor: "bg-gray-400",
    iconColor: "text-text-muted",
  },
}

const STATUS_BADGE: Record<
  string,
  { label: string; variant: "success" | "warning" | "error" | "default" }
> = {
  sent: { label: "Enviado", variant: "success" },
  read: { label: "Lido", variant: "success" },
  acted: { label: "Clicado", variant: "success" },
  queued: { label: "Na fila", variant: "warning" },
  pending: { label: "Pendente", variant: "warning" },
  approved: { label: "Aprovado", variant: "success" },
  dismissed: { label: "Dispensado", variant: "default" },
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

type Tab = "suggestions" | "campaigns" | "history" | "templates"

const TABS: { id: Tab; label: string; icon: typeof Bell }[] = [
  { id: "suggestions", label: "Sugestões", icon: Zap },
  { id: "campaigns", label: "Campanhas", icon: Send },
  { id: "history", label: "Histórico & Métricas", icon: TrendingUp },
  { id: "templates", label: "Templates", icon: LayoutList },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function fmtDateShort(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
}

// ─── Main component ──────────────────────────────────────────────────────────

export function EngagementCenterClient({
  suggestions: initialSuggestions,
  templates,
  history: initialHistory,
  efficacy: initialEfficacy,
  audiences: initialAudiences,
  courses,
  areas,
  canManageSuggestions,
  canManageCampaigns,
}: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>("suggestions")
  const [suggestions, setSuggestions] = useState(initialSuggestions)
  const [history, setHistory] = useState(initialHistory)
  const [efficacy, setEfficacy] = useState(initialEfficacy)
  const [audiences, setAudiences] = useState(initialAudiences)

  // Campaign state.
  const [campaignAudienceId, setCampaignAudienceId] = useState("")
  const [campaignTemplateKey, setCampaignTemplateKey] = useState("")
  const [campaignResult, setCampaignResult] = useState<{
    inAppCreated?: number
    emailsSent?: number
    emailsFailed?: number
    error?: string
  } | null>(null)
  const [campaignPending, startCampaign] = useTransition()

  // Template edit state.
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplateRow | null>(null)
  const [editPending, startEdit] = useTransition()
  const [editResult, setEditResult] = useState<{ ok?: boolean; error?: string } | null>(null)

  // Suggestion action state (per id).
  const [actingId, setActingId] = useState<string | null>(null)
  const [suggestionPending, startSuggestion] = useTransition()
  const [actionResult, setActionResult] = useState<{
    id: string
    success: boolean
    error?: string
  } | null>(null)
  const [generatePending, startGenerate] = useTransition()
  const [generateResult, setGenerateResult] = useState<{
    created?: number
    skipped?: string[]
    error?: string
  } | null>(null)

  // ─── Suggestion actions ────────────────────────────────────────────────────

  const handleSuggestionAction = (id: string, action: "approve" | "dismiss") => {
    setActingId(id)
    setActionResult(null)
    startSuggestion(async () => {
      try {
        const res = await fetch(`/api/admin/engagement/suggestions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        })
        const data = await res.json()
        if (res.ok) {
          setSuggestions((prev) => prev.filter((s) => s.id !== id))
          setActionResult({ id, success: true })
          router.refresh()
        } else {
          setActionResult({ id, success: false, error: data.error })
        }
      } catch {
        setActionResult({ id, success: false, error: "Erro ao processar" })
      } finally {
        setActingId(null)
      }
    })
  }

  const handleGenerate = () => {
    setGenerateResult(null)
    startGenerate(async () => {
      const res = await fetch("/api/admin/engagement/suggestions/generate", { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        setGenerateResult({ created: data.created, skipped: data.skipped })
        router.refresh()
      } else {
        setGenerateResult({ error: data.error })
      }
    })
  }

  // Re-sincroniza a lista com o servidor após router.refresh() (gerar/aprovar/
  // dispensar). Sem isto, `suggestions` ficaria preso ao valor de montagem e a
  // tela não refletiria as sugestões recém-geradas ou processadas.
  useEffect(() => {
    setSuggestions(initialSuggestions)
  }, [initialSuggestions])

  // Geração PROATIVA: ao abrir o painel sem nenhuma sugestão pendente, dispara a
  // análise do roster automaticamente (uma vez) para quem pode agir — a IA já
  // entrega o trabalho pronto em vez de uma tela vazia. A cadência de 24h do
  // engine torna a chamada idempotente (não re-sugere cohorts recentes).
  const proactiveRan = useRef(false)
  useEffect(() => {
    if (proactiveRan.current || !canManageSuggestions || initialSuggestions.length > 0) return
    proactiveRan.current = true
    startGenerate(async () => {
      try {
        const res = await fetch("/api/admin/engagement/suggestions/generate", { method: "POST" })
        if (!res.ok) return
        const data = await res.json()
        if (data.created > 0) {
          setGenerateResult({ created: data.created, skipped: data.skipped })
          router.refresh()
        }
      } catch {
        // best-effort — geração proativa silenciosa
      }
    })
  }, [canManageSuggestions, initialSuggestions.length, router])

  // ─── Campaign send ─────────────────────────────────────────────────────────

  const handleCampaignSend = () => {
    if (!campaignAudienceId || !campaignTemplateKey) return
    setCampaignResult(null)
    startCampaign(async () => {
      const res = await fetch("/api/admin/engagement/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audienceId: campaignAudienceId, templateKey: campaignTemplateKey }),
      })
      const data = await res.json()
      if (res.ok) {
        setCampaignResult({
          inAppCreated: data.inAppCreated,
          emailsSent: data.emailsSent,
          emailsFailed: data.emailsFailed,
        })
        setCampaignAudienceId("")
        setCampaignTemplateKey("")
        router.refresh()
      } else {
        setCampaignResult({ error: data.error })
      }
    })
  }

  // ─── Template edit ─────────────────────────────────────────────────────────

  const handleSaveTemplate = () => {
    if (!editingTemplate) return
    setEditResult(null)
    startEdit(async () => {
      const res = await fetch("/api/admin/engagement/templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingTemplate.id,
          name: editingTemplate.name,
          title: editingTemplate.title,
          body_inapp: editingTemplate.body_inapp,
          email_subject: editingTemplate.email_subject,
          channel_inapp: editingTemplate.channel_inapp,
          channel_email: editingTemplate.channel_email,
          is_active: editingTemplate.is_active,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setEditResult({ ok: true })
        setEditingTemplate(null)
        router.refresh()
      } else {
        setEditResult({ error: data.error })
      }
    })
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const activeTemplates = templates.filter((t) => t.is_active)
  const totalNotifications = history.length
  const readRate =
    totalNotifications > 0
      ? Math.round((history.filter((h) => h.read_at).length / totalNotifications) * 100)
      : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Centro de Engajamento</h1>
          <p className="text-sm text-text-muted mt-1">
            Nudges assistidos por IA, campanhas manuais e métricas de eficácia
          </p>
        </div>
        {/* Top metrics */}
        <div className="hidden sm:flex items-center gap-4 shrink-0">
          <div className="text-right">
            <p className="text-xs text-text-muted">Sugestões pendentes</p>
            <p className="text-xl font-bold text-cerrado-600">{suggestions.length}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-text-muted">Taxa de leitura</p>
            <p className="text-xl font-bold text-text-primary">{readRate}%</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-bg-elevated rounded-xl p-1 w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-bg-card text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-primary hover:bg-bg-card/50"
              }`}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.id === "suggestions" && suggestions.length > 0 && (
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                    isActive ? "bg-cerrado-600 text-white" : "bg-amber-400 text-amber-900"
                  }`}
                >
                  {suggestions.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── TAB: SUGGESTIONS ── */}
      {activeTab === "suggestions" && (
        <div className="space-y-4">
          {/* Generate toolbar */}
          {canManageSuggestions && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-muted">
                {suggestions.length === 0
                  ? "Nenhuma sugestão pendente. Gere novos nudges analisando o roster."
                  : `${suggestions.length} sugestão${suggestions.length !== 1 ? "ões" : ""} aguardando aprovação.`}
              </p>
              <Button
                variant="outline"
                onClick={handleGenerate}
                isLoading={generatePending}
                className="gap-1.5 text-xs"
              >
                <RefreshCw size={13} />
                Analisar roster
              </Button>
            </div>
          )}

          {generateResult && (
            <div
              className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
                generateResult.error
                  ? "bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400"
              }`}
            >
              {generateResult.error ? (
                <>
                  <XCircle size={15} />
                  <span>{generateResult.error}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  <span>
                    {generateResult.created} nova{generateResult.created !== 1 ? "s" : ""} sugestão
                    {generateResult.created !== 1 ? "ões" : ""} criada
                    {generateResult.created !== 1 ? "s" : ""}.
                    {(generateResult.skipped?.length ?? 0) > 0 &&
                      ` ${generateResult.skipped?.length} já existia${(generateResult.skipped?.length ?? 0) !== 1 ? "m" : ""}.`}
                  </span>
                </>
              )}
            </div>
          )}

          {actionResult && (
            <div
              className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
                actionResult.success
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {actionResult.success ? (
                <>
                  <CheckCircle2 size={15} />
                  <span>Sugestão processada com sucesso.</span>
                </>
              ) : (
                <>
                  <XCircle size={15} />
                  <span>{actionResult.error}</span>
                </>
              )}
            </div>
          )}

          {suggestions.length === 0 ? (
            <div className="rounded-xl bg-bg-card shadow-card p-12 text-center">
              <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-cerrado-600/10 flex items-center justify-center">
                <Zap size={24} className="text-cerrado-600" />
              </div>
              <p className="text-sm font-semibold text-text-primary">Nenhuma sugestão pendente</p>
              <p className="text-xs text-text-muted mt-1 max-w-xs mx-auto">
                {canManageSuggestions
                  ? 'Clique em "Analisar roster" para gerar nudges a partir da análise de risco dos alunos.'
                  : "As sugestões de nudges aparecem aqui quando um gestor analisa o roster. Seu acesso a este painel é somente leitura."}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {suggestions.map((s) => {
                const meta = NUDGE_META[s.type] ?? NUDGE_META.custom
                const Icon = meta.icon
                const isActing = actingId === s.id && suggestionPending

                return (
                  <div
                    key={s.id}
                    className={`rounded-xl shadow-card bg-bg-card p-5 ring-1 transition-all ${meta.color}`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${meta.dotColor}/10`}
                      >
                        <Icon size={18} className={meta.iconColor} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-text-primary">
                                {meta.label}
                              </p>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${meta.dotColor}`}
                              >
                                {s.target_student_ids.length} aluno
                                {s.target_student_ids.length !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <p className="text-xs text-text-muted mt-1">{s.rationale}</p>
                            {s.template_key && (
                              <p className="text-[10px] text-text-muted/70 mt-1">
                                Template: <code className="font-mono">{s.template_key}</code>
                              </p>
                            )}
                          </div>
                          {canManageSuggestions && (
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                variant="outline"
                                onClick={() => handleSuggestionAction(s.id, "dismiss")}
                                disabled={isActing}
                                className="text-xs h-8 px-3"
                              >
                                <XCircle size={13} className="mr-1" />
                                Dispensar
                              </Button>
                              <Button
                                onClick={() => handleSuggestionAction(s.id, "approve")}
                                isLoading={isActing && actingId === s.id}
                                disabled={isActing || !s.template_key}
                                className="text-xs h-8 px-3 gap-1.5 bg-cerrado-600 hover:bg-cerrado-700 text-white"
                              >
                                <Check size={13} />
                                Aprovar e disparar
                              </Button>
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] text-text-muted/60 mt-2">
                          Sugerido em {fmtDate(s.suggested_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: CAMPAIGNS ── */}
      {activeTab === "campaigns" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Campaign composer */}
          <div className="rounded-xl shadow-card bg-bg-card p-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Envio manual</h2>
              <p className="text-xs text-text-muted mt-0.5">
                Escolha uma audiência e um template para disparar.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="campaign-audience"
                  className="text-xs font-medium text-text-secondary"
                >
                  Audiência
                </label>
                {audiences.length === 0 ? (
                  <p className="text-xs text-text-muted rounded-lg bg-bg-elevated px-3 py-2">
                    Nenhuma audiência disponível.
                  </p>
                ) : (
                  <select
                    id="campaign-audience"
                    value={campaignAudienceId}
                    onChange={(e) => setCampaignAudienceId(e.target.value)}
                    className="w-full rounded-lg bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-cerrado-600/50 border border-border-soft"
                  >
                    <option value="">Selecionar audiência...</option>
                    {audiences.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="campaign-template"
                  className="text-xs font-medium text-text-secondary"
                >
                  Template
                </label>
                <select
                  id="campaign-template"
                  value={campaignTemplateKey}
                  onChange={(e) => setCampaignTemplateKey(e.target.value)}
                  className="w-full rounded-lg bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-cerrado-600/50 border border-border-soft"
                >
                  <option value="">Selecionar template...</option>
                  {activeTemplates.map((t) => (
                    <option key={t.id} value={t.key}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {campaignTemplateKey && (
                <TemplatePreview
                  template={templates.find((t) => t.key === campaignTemplateKey) ?? null}
                />
              )}

              {campaignResult && (
                <div
                  className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm ${
                    campaignResult.error
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : (campaignResult.emailsFailed ?? 0) > 0
                        ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  }`}
                >
                  {campaignResult.error ? (
                    <>
                      <XCircle size={14} />
                      <span className="text-xs">{campaignResult.error}</span>
                    </>
                  ) : (campaignResult.emailsFailed ?? 0) > 0 ? (
                    <>
                      <AlertTriangle size={14} />
                      <span className="text-xs">
                        {campaignResult.inAppCreated} in-app
                        {(campaignResult.emailsSent ?? 0) > 0
                          ? ` · ${campaignResult.emailsSent} emails enviados`
                          : ""}{" "}
                        · {campaignResult.emailsFailed} email
                        {campaignResult.emailsFailed !== 1 ? "s" : ""} falharam.
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span className="text-xs">
                        {campaignResult.inAppCreated} in-app
                        {(campaignResult.emailsSent ?? 0) > 0
                          ? ` · ${campaignResult.emailsSent} emails`
                          : ""}{" "}
                        enviados.
                      </span>
                    </>
                  )}
                </div>
              )}

              <Button
                onClick={handleCampaignSend}
                disabled={
                  !campaignAudienceId ||
                  !campaignTemplateKey ||
                  campaignPending ||
                  !canManageCampaigns
                }
                isLoading={campaignPending}
                className="w-full gap-2"
              >
                <Send size={14} />
                Enviar campanha
              </Button>
            </div>
          </div>

          {/* Saved audiences list */}
          <div className="rounded-xl shadow-card bg-bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">Audiências salvas</h2>
              <Badge badgeSize="sm" variant="default">
                {audiences.length}
              </Badge>
            </div>

            {audiences.length === 0 ? (
              <div className="rounded-lg bg-bg-elevated px-4 py-8 text-center">
                <Users size={24} className="mx-auto mb-2 text-text-muted" />
                <p className="text-xs text-text-muted">Nenhuma audiência disponível.</p>
                <p className="text-[10px] text-text-muted/70 mt-0.5">
                  As audiências elegíveis aparecem aqui quando existem para este escopo.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {audiences.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`w-full text-left flex items-center gap-3 rounded-lg px-3 py-2.5 ring-1 transition-all ${
                      campaignAudienceId === a.id
                        ? "bg-cerrado-600/10 ring-cerrado-600/30"
                        : "bg-bg-elevated ring-transparent hover:ring-border-soft"
                    }`}
                    onClick={() => setCampaignAudienceId(a.id)}
                    aria-pressed={campaignAudienceId === a.id}
                  >
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                        campaignAudienceId === a.id
                          ? "bg-cerrado-600"
                          : "bg-gray-100 dark:bg-white/[0.06]"
                      }`}
                    >
                      <Users
                        size={14}
                        className={campaignAudienceId === a.id ? "text-white" : "text-text-muted"}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{a.name}</p>
                      <p className="text-[10px] text-text-muted">{fmtDateShort(a.created_at)}</p>
                    </div>
                    <ChevronRight size={14} className="text-text-muted shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: HISTORY & METRICS ── */}
      {activeTab === "history" && (
        <div className="space-y-6">
          {/* Efficacy cards */}
          {efficacy.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
                Eficácia por tipo (retorno pós-nudge)
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {efficacy.map((e) => {
                  const meta = e.templateKey
                    ? (NUDGE_META[
                        e.templateKey
                          .replace("_14d", "")
                          .replace("_generic", "")
                          .replace("_recognition", "")
                          .replace("session_no_reflection", "no_reflection")
                      ] ?? NUDGE_META.custom)
                    : NUDGE_META.custom
                  return (
                    <div
                      key={e.templateKey ?? "custom"}
                      className="rounded-xl bg-bg-card shadow-card p-4 space-y-2"
                    >
                      <p className="text-[10px] font-medium text-text-muted truncate">
                        {e.templateKey ?? "Sem template"}
                      </p>
                      <div className="flex items-end gap-1.5">
                        <span className="text-2xl font-bold text-text-primary">
                          {e.returnRatePct}%
                        </span>
                        <span className="text-xs text-text-muted mb-0.5">retorno</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full ${meta.dotColor}`}
                          style={{ width: `${Math.min(e.returnRatePct, 100)}%` }}
                        />
                      </div>
                      <p className="text-[9px] text-text-muted">
                        {e.returned}/{e.sent} alunos retornaram
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* History timeline */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
              Notificações recentes
            </h2>
            {history.length === 0 ? (
              <div className="rounded-xl bg-bg-card shadow-card p-10 text-center">
                <MessageSquare size={24} className="mx-auto mb-2 text-text-muted" />
                <p className="text-sm text-text-muted">Nenhuma notificação ainda.</p>
              </div>
            ) : (
              <div className="rounded-xl shadow-card bg-bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-soft bg-bg-elevated">
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        Destinatário
                      </th>
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        Título
                      </th>
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted hidden sm:table-cell">
                        Canal
                      </th>
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted hidden md:table-cell">
                        Origem
                      </th>
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted hidden lg:table-cell">
                        Eficácia
                      </th>
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted hidden sm:table-cell">
                        Data
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-soft">
                    {history.map((h) => {
                      const statusInfo = STATUS_BADGE[h.status] ?? {
                        label: h.status,
                        variant: "default" as const,
                      }
                      return (
                        <tr key={h.id} className="hover:bg-bg-elevated/50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="text-xs font-medium text-text-primary truncate max-w-[140px]">
                              {h.recipient_name ?? h.recipient_email ?? h.recipient_id.slice(0, 8)}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-text-secondary truncate max-w-[180px]">
                              {h.title}
                            </p>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className="flex items-center gap-1 text-xs text-text-muted">
                              {h.channel === "inapp" ? <Bell size={11} /> : <Mail size={11} />}
                              {h.channel}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="text-xs text-text-muted capitalize">{h.origin}</span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={statusInfo.variant} badgeSize="sm">
                              {statusInfo.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            {h.returned_at ? (
                              <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                <CheckCircle2 size={10} /> Retornou
                              </span>
                            ) : h.sent_at ? (
                              <span className="text-[10px] text-text-muted">Aguardando</span>
                            ) : (
                              <span className="text-[10px] text-text-muted">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell text-xs text-text-muted whitespace-nowrap">
                            {fmtDate(h.created_at)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: TEMPLATES ── */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-muted">
              {templates.length} template{templates.length !== 1 ? "s" : ""} ·{" "}
              {activeTemplates.length} ativo{activeTemplates.length !== 1 ? "s" : ""}
            </p>
          </div>

          {editResult && (
            <div
              className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
                editResult.error
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}
            >
              {editResult.error ? (
                <>
                  <XCircle size={14} />
                  <span className="text-xs">{editResult.error}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span className="text-xs">Template atualizado.</span>
                </>
              )}
            </div>
          )}

          {editingTemplate ? (
            <TemplateEditor
              template={editingTemplate}
              onChange={setEditingTemplate}
              onSave={handleSaveTemplate}
              onCancel={() => {
                setEditingTemplate(null)
                setEditResult(null)
              }}
              isPending={editPending}
            />
          ) : (
            <div className="grid gap-3">
              {templates.map((t) => {
                const catColor =
                  t.category === "nudge"
                    ? "bg-cerrado-600"
                    : t.category === "announcement"
                      ? "bg-violet-500"
                      : "bg-gray-400"
                return (
                  <div
                    key={t.id}
                    className="rounded-xl shadow-card bg-bg-card p-4 flex items-start gap-4"
                  >
                    <div
                      className={`h-9 w-9 rounded-xl ${catColor} flex items-center justify-center shrink-0`}
                    >
                      <LayoutList size={15} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-text-primary">{t.name}</p>
                        <Badge variant={t.is_active ? "success" : "default"} badgeSize="sm">
                          {t.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                        <Badge variant="default" badgeSize="sm" className="capitalize">
                          {t.category}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-text-muted mt-0.5 font-mono">{t.key}</p>
                      <p className="text-xs text-text-secondary mt-1 line-clamp-1">{t.title}</p>
                      <div className="flex items-center gap-3 mt-2">
                        {t.channel_inapp && (
                          <span className="flex items-center gap-1 text-[10px] text-text-muted">
                            <Bell size={10} /> In-app
                          </span>
                        )}
                        {t.channel_email && (
                          <span className="flex items-center gap-1 text-[10px] text-text-muted">
                            <Mail size={10} /> Email
                          </span>
                        )}
                      </div>
                    </div>
                    {canManageCampaigns && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTemplate(t)
                          setEditResult(null)
                        }}
                        className="shrink-0 flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors px-2 py-1 rounded-lg hover:bg-bg-elevated"
                      >
                        <Edit3 size={13} />
                        Editar
                      </button>
                    )}
                  </div>
                )
              })}
              {templates.length === 0 && (
                <div className="rounded-xl bg-bg-card shadow-card p-10 text-center">
                  <LayoutList size={24} className="mx-auto mb-2 text-text-muted" />
                  <p className="text-sm text-text-muted">Nenhum template encontrado.</p>
                  <p className="text-xs text-text-muted/70 mt-1">
                    Os templates são criados pela migration de configuração do tenant.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TemplatePreview({ template }: { template: NotificationTemplateRow | null }) {
  if (!template) return null
  return (
    <div className="rounded-lg bg-bg-elevated border border-border-soft p-3 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Eye size={11} className="text-text-muted" />
        <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
          Preview
        </span>
      </div>
      <p className="text-xs font-semibold text-text-primary">{template.title}</p>
      {template.body_inapp && (
        <p className="text-[11px] text-text-secondary line-clamp-2">{template.body_inapp}</p>
      )}
      <div className="flex gap-2 mt-1">
        {template.channel_inapp && (
          <span className="text-[9px] bg-cerrado-600/10 text-cerrado-600 px-1.5 py-0.5 rounded font-medium">
            In-app
          </span>
        )}
        {template.channel_email && (
          <span className="text-[9px] bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-medium">
            Email
          </span>
        )}
      </div>
    </div>
  )
}

interface TemplateEditorProps {
  template: NotificationTemplateRow
  onChange: (t: NotificationTemplateRow) => void
  onSave: () => void
  onCancel: () => void
  isPending: boolean
}

function TemplateEditor({ template, onChange, onSave, onCancel, isPending }: TemplateEditorProps) {
  const field = <K extends keyof NotificationTemplateRow>(
    key: K,
    value: NotificationTemplateRow[K],
  ) => onChange({ ...template, [key]: value })

  return (
    <div className="rounded-xl shadow-card bg-bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Editando template</h2>
          <p className="text-[10px] text-text-muted font-mono mt-0.5">{template.key}</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-text-muted hover:text-text-primary"
        >
          Cancelar
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="tpl-name" className="text-xs font-medium text-text-secondary">
            Nome
          </label>
          <Input
            id="tpl-name"
            value={template.name}
            onChange={(e) => field("name", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="tpl-title" className="text-xs font-medium text-text-secondary">
            Título (in-app, curto)
          </label>
          <Input
            id="tpl-title"
            value={template.title ?? ""}
            onChange={(e) => field("title", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="tpl-body" className="text-xs font-medium text-text-secondary">
          Corpo in-app
        </label>
        <Textarea
          id="tpl-body"
          value={template.body_inapp ?? ""}
          onChange={(e) => field("body_inapp", e.target.value)}
          rows={3}
          placeholder="Corpo da notificação in-app. Use {{primeiro_nome}}, {{curso}}, etc."
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="tpl-email-subject" className="text-xs font-medium text-text-secondary">
          Assunto do email
        </label>
        <Input
          id="tpl-email-subject"
          value={template.email_subject ?? ""}
          onChange={(e) => field("email_subject", e.target.value)}
          placeholder="Assunto do email (opcional)"
        />
      </div>

      <div className="flex items-center gap-6">
        <label htmlFor="tpl-ch-inapp" className="flex items-center gap-2 cursor-pointer">
          <input
            id="tpl-ch-inapp"
            type="checkbox"
            checked={template.channel_inapp}
            onChange={(e) => field("channel_inapp", e.target.checked)}
            className="rounded border-border-medium text-cerrado-600 focus:ring-cerrado-600/50"
          />
          <span className="text-xs text-text-secondary">Canal in-app</span>
        </label>
        <label htmlFor="tpl-ch-email" className="flex items-center gap-2 cursor-pointer">
          <input
            id="tpl-ch-email"
            type="checkbox"
            checked={template.channel_email}
            onChange={(e) => field("channel_email", e.target.checked)}
            className="rounded border-border-medium text-cerrado-600 focus:ring-cerrado-600/50"
          />
          <span className="text-xs text-text-secondary">Canal email</span>
        </label>
        <label htmlFor="tpl-active" className="flex items-center gap-2 cursor-pointer">
          <input
            id="tpl-active"
            type="checkbox"
            checked={template.is_active}
            onChange={(e) => field("is_active", e.target.checked)}
            className="rounded border-border-medium text-cerrado-600 focus:ring-cerrado-600/50"
          />
          <span className="text-xs text-text-secondary">Ativo</span>
        </label>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={isPending}>
          Cancelar
        </Button>
        <Button onClick={onSave} isLoading={isPending}>
          Salvar template
        </Button>
      </div>
    </div>
  )
}
