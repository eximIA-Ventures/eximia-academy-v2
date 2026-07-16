"use client"

// ---------------------------------------------------------------------------
// E17 — Aba Campanhas (redesign E13).
// ---------------------------------------------------------------------------
// The campaign is a "lote de ações individuais revisáveis com loop fechado"
// (E13 §2.1), NOT "1 mensagem → N pessoas". Flow (E13 §5.1):
//   1. ENTRAR PELO SEMÁFORO   — the 3 unified-semáforo states with counts
//      (🔴 Atenção · 🟡 Sem acesso · 🟢 No ritmo), NOT the 5 nudgeTypes (E13 §4).
//   2. PREPARAR (server)      — POST .../campaign preview?segment= resolves the
//      scoped students, each pre-filled with a per-aluno nudgeType + rendered text.
//   3. REVISAR INDIVIDUALMENTE (obrigatória) — a table of N lines; per line the
//      manager edits the text, removes the aluno. Origem/canal in the header.
//      Cap of 200 surfaced BEFORE any send (E13 §6 inegociável 1).
//   4. DISPARAR (confirm)     — one click sends the array `recipients`; the server
//      re-scopes AGAIN (a removed/foreign id never re-enters — E13 §6 inegociável
//      3) and stamps every notification with the same campaign_id.
//   5. ACOMPANHAR (aberta)    — the campaign becomes an OPEN object: "N enviadas ·
//      M lidas · aguardando retorno até {window_end}" (E16).
//   6. ENCERRAR (resultado)   — on the window or manual close: "Rodou de X a Y ·
//      M de N voltaram (%)" (E16). The manager can "encerrar agora".
//
// SECURITY: the UI NEVER fabricates destinatários (E13 §4.4/§6 inegociável 4).
// Preview + confirm are re-scoped server-side; the UI only renders what the server
// returns and lets the manager edit/remove per line. The mandatory review remains
// (E13 §6 inegociável 2) — the confirm is only reachable from the review table.
// ---------------------------------------------------------------------------

import { TRIAGE_COLORS } from "@/lib/triage-colors"
import type { CampaignSegment, SenderIdentity } from "@/types/notifications"
import { Badge, Button, EmptyState, Skeleton, Textarea, useToast } from "@eximia/ui"
import { AlertTriangle, ArrowLeft, CheckCircle2, Megaphone, TrendingUp, UserX } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { withFocus } from "./engagement-fetch"
import { nudgeTypeReason } from "./nudge-labels"
import type { CampaignsTabProps } from "./types"

const MAX_RECIPIENTS = 200 // mirrors the FinOps cap in api/engagement/campaign

// --- The 3 unified-semáforo segments (E13 §4 / E17 AC1) ---------------------

interface SegmentSpec {
  key: CampaignSegment
  label: string
  description: string
  icon: React.ReactNode
  color: string
  bg: string
  /** D3: 🟢 no_ritmo is an OPTIONAL reconhecimento segment, shown last. */
  optional?: boolean
}

const SEGMENTS: SegmentSpec[] = [
  {
    key: "atencao",
    label: "Atenção",
    description: "Atrasados no plano ou que nunca começaram — o alvo mais urgente.",
    icon: <AlertTriangle size={18} />,
    color: TRIAGE_COLORS.atencao.color,
    bg: TRIAGE_COLORS.atencao.bg,
  },
  {
    key: "sem_acesso",
    label: "Sem acesso",
    description: "Sumidos há 14+ dias, mas em dia no curso — um lembrete costuma bastar.",
    icon: <UserX size={18} />,
    color: TRIAGE_COLORS.sem_acesso.color,
    bg: TRIAGE_COLORS.sem_acesso.bg,
  },
  {
    key: "no_ritmo",
    label: "No ritmo",
    description: "Alunos em dia — reconhecer o engajamento reforça a motivação.",
    icon: <TrendingUp size={18} />,
    color: TRIAGE_COLORS.no_ritmo.color,
    bg: TRIAGE_COLORS.no_ritmo.bg,
    optional: true,
  },
]

// --- Server contracts consumed ---------------------------------------------

/** A recipient line resolved by the segment PREVIEW (E15 AC2). */
interface PreviewLine {
  id: string
  fullName: string | null
  email: string | null
  reason: string
  nudgeType: string
  templateKey: string | null
  renderedText: string
}

/** Result of a confirmed dispatch (mirrors the confirm response). */
interface ConfirmResult {
  campaignId: string
  windowEnd: string | null
  status: string
  inAppCreated: number
  emailsSent: number
  recipientsSkipped: number
  total: number
}

/** GET /api/engagement/campaign/:id — the loop-closing result (E16). */
interface CampaignResultResponse {
  campaign: {
    id: string
    segment: string
    status: string
    windowStart: string
    windowEnd: string | null
    closedAt: string | null
    closedReason: string | null
  }
  state: "open" | "closed"
  result: {
    recipients: number
    readCount: number
    returnedCount: number
    notReturned: number
    returnRate: number | null
  }
}

type Screen = "segments" | "review" | "result"
type Channel = "inapp" | "email"

/** Per-line edited state: the (possibly hand-edited) text + removed flag. */
interface LineState {
  text: string
  removed: boolean
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

export function CampaignsTab({
  segmentCounts,
  context,
  senderOptions,
  canManageCampaigns,
  focus,
  scopedSegment,
}: CampaignsTabProps) {
  const { toast } = useToast()

  const [screen, setScreen] = useState<Screen>("segments")
  const [activeSegment, setActiveSegment] = useState<CampaignSegment | null>(null)
  // Fatia 10 (bug real, Hugo ao vivo): tracks whether the LAST openSegment
  // attempt in scoped mode failed, so the scoped-loading branch can offer a
  // retry instead of silently sitting on a dead skeleton forever.
  const [scopedError, setScopedError] = useState(false)

  // Header choices (origem + canal), applied to the whole batch (E13 §5.1 passo 4).
  const [identity, setIdentity] = useState<SenderIdentity>(senderOptions.defaultIdentity)
  const [channel, setChannel] = useState<Channel>("inapp")

  // Preview + review state.
  const [previewLoading, setPreviewLoading] = useState(false)
  const [lines, setLines] = useState<PreviewLine[]>([])
  const [lineState, setLineState] = useState<Record<string, LineState>>({})
  const [previewTotal, setPreviewTotal] = useState(0)
  const [previewCapped, setPreviewCapped] = useState(false)

  // Dispatch + result state.
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<CampaignResultResponse | null>(null)
  const [closing, setClosing] = useState(false)

  const reset = useCallback(() => {
    setScreen("segments")
    setActiveSegment(null)
    setIdentity(senderOptions.defaultIdentity)
    setChannel("inapp")
    setLines([])
    setLineState({})
    setPreviewTotal(0)
    setPreviewCapped(false)
    setResult(null)
  }, [senderOptions.defaultIdentity])

  // Fatia 10 (bug real, Hugo ao vivo): GUARD CONTRA RESPOSTAS OBSOLETAS. The
  // custom `Tabs`/`TabsContent` in @eximia/ui (packages/ui/src/components/
  // tabs.tsx) is NOT Radix — `TabsContent` literally `return null`s (fully
  // UNMOUNTS its children, no `forceMount`) whenever it isn't the active tab.
  // If `CampaignsTab` unmounts while an `openSegment` fetch is in flight and
  // remounts before that fetch resolves (confirmed root cause: root fiber
  // teardown resets ALL local state, including `autoOpenedRef` — a fresh
  // `false` re-arms the auto-open effect below, firing a SECOND overlapping
  // request), whichever response lands LAST wins by accident, and if the
  // FIRST (now-superseded) request's promise settles after the component has
  // already unmounted again, its `setScreen("review")` call is silently
  // discarded by React (no error, no visible effect) — the manager is left
  // staring at a spinner that will never resolve, because the request whose
  // response COULD have unstuck the UI already lost the race.
  //
  // Fix: a monotonic sequence ref + AbortController. Only the response of the
  // MOST RECENT call may ever mutate state; any earlier in-flight request is
  // both aborted (saves wasted network/server work) AND ignored on arrival
  // even if it somehow still resolves.
  const requestSeqRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  // --- PREPARAR (server preview by segment) — E13 §5.1 passo 3 ----------------
  const openSegment = useCallback(
    async (segment: CampaignSegment) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const seq = ++requestSeqRef.current

      setActiveSegment(segment)
      setPreviewLoading(true)
      setScopedError(false)
      try {
        const res = await fetch(withFocus("/api/engagement/campaign", focus), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "preview", segment }),
          signal: controller.signal,
        })
        if (seq !== requestSeqRef.current) return // superseded by a newer call
        if (!res.ok) throw new Error("preview failed")
        const data = (await res.json()) as {
          total: number
          capped: boolean
          recipients: PreviewLine[]
        }
        if (seq !== requestSeqRef.current) return // superseded while awaiting res.json()
        const recips = data.recipients ?? []
        setLines(recips)
        setLineState(
          Object.fromEntries(recips.map((r) => [r.id, { text: r.renderedText, removed: false }])),
        )
        setPreviewTotal(data.total ?? recips.length)
        setPreviewCapped(Boolean(data.capped))
        setScreen("review")
      } catch {
        if (controller.signal.aborted) return // cancelled on purpose, not a real failure
        if (seq !== requestSeqRef.current) return
        toast({ variant: "error", title: "Não foi possível preparar a campanha" })
        setActiveSegment(null)
        setScopedError(true)
      } finally {
        if (seq === requestSeqRef.current) setPreviewLoading(false)
      }
    },
    [focus, toast],
  )

  // Cards Mestre-Detalhe (fatia 3/6, doc 03 §4 decisão 1; renamed to
  // `scopedSegment` in fatia 10): when set (e.g. the "Reconhecer em lote" tab
  // for the "No ritmo" card), skip the segment picker and open that segment's
  // review straight away. A ref (not a dep-array trick) guards this to fire
  // ONCE per mount — `openSegment` is recreated whenever `focus` changes, so
  // keying the effect on it directly would silently re-open the segment (and
  // reset any in-progress edits) on every drill-down navigation.
  //
  // `canManageCampaigns` MUST gate this: hooks run unconditionally on every
  // render regardless of the `!canManageCampaigns` early return further down
  // — without this check, a caller who lacks campaign access (e.g. an
  // instructor) would still silently fire a real POST /api/engagement/campaign
  // preview (student names/emails/rendered text into component state) purely
  // because the component mounted, even though the render they actually see
  // is the "Campanhas indisponíveis" EmptyState.
  //
  // `openSegment` is intentionally excluded from the deps below — it is
  // recreated whenever `focus` changes, and the ref guard (not the dep array)
  // is what makes this effect fire once PER MOUNT. It is NOT, on its own, a
  // guard against a full unmount+remount cycle (a remount gets a fresh ref) —
  // that class of bug is what the request-id/AbortController guard above
  // fixes instead.
  const autoOpenedRef = useRef(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
  useEffect(() => {
    if (scopedSegment && canManageCampaigns && !autoOpenedRef.current) {
      autoOpenedRef.current = true
      void openSegment(scopedSegment)
    }
  }, [scopedSegment, canManageCampaigns])

  // --- DISPARAR (confirm with the reviewed per-line variation) ---------------
  const confirm = useCallback(async () => {
    if (!activeSegment) return
    const recipients = lines
      .filter((l) => !lineState[l.id]?.removed)
      .map((l) => {
        const edited = lineState[l.id]?.text ?? l.renderedText
        // D4: send a `message` override ONLY when the manager changed the text;
        // an untouched line rides the derived template (message omitted).
        const isOverride = edited.trim() !== (l.renderedText ?? "").trim()
        return {
          studentId: l.id,
          templateKey: l.templateKey ?? undefined,
          ...(isOverride ? { message: edited } : {}),
        }
      })

    if (recipients.length === 0) {
      toast({ variant: "warning", title: "Nenhum destinatário selecionado" })
      return
    }
    if (recipients.length > MAX_RECIPIENTS) {
      toast({
        variant: "error",
        title: `Máximo de ${MAX_RECIPIENTS} destinatários por campanha`,
        description: "Remova alunos da lista ou envie em lotes menores.",
      })
      return
    }
    setSending(true)
    try {
      const res = await fetch(withFocus("/api/engagement/campaign", focus), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "confirm",
          segment: activeSegment,
          recipients,
          senderIdentity: identity,
          channel,
        }),
      })
      const data = (await res.json()) as ConfirmResult & { error?: string }
      if (!res.ok) {
        toast({ variant: "error", title: data.error ?? "Falha ao enviar a campanha" })
        return
      }
      // Fetch the fresh campaign result so the OPEN state renders (E13 §5.1 passo 6).
      await loadResult(data.campaignId)
      setScreen("result")
    } catch {
      toast({ variant: "error", title: "Falha ao enviar a campanha" })
    } finally {
      setSending(false)
    }
  }, [activeSegment, lines, lineState, identity, channel, focus, toast])

  const loadResult = useCallback(async (campaignId: string) => {
    try {
      const res = await fetch(`/api/engagement/campaign/${campaignId}`)
      if (!res.ok) throw new Error("result failed")
      setResult((await res.json()) as CampaignResultResponse)
    } catch {
      // Non-fatal: the send succeeded even if the result read hiccups; the manager
      // sees a minimal confirmation and can revisit later.
      setResult(null)
    }
  }, [])

  // --- ENCERRAR (manual close) — E13 §5.1 passo 7 ----------------------------
  const closeNow = useCallback(async () => {
    if (!result) return
    setClosing(true)
    try {
      const res = await fetch(`/api/engagement/campaign/${result.campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      })
      if (!res.ok) throw new Error("close failed")
      await loadResult(result.campaign.id)
    } catch {
      toast({ variant: "error", title: "Não foi possível encerrar a campanha" })
    } finally {
      setClosing(false)
    }
  }, [result, loadResult, toast])

  // --- Guards ----------------------------------------------------------------

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

  // --- Screen: SCOPED LOADING/RETRY (fatia 10) --------------------------------
  // In scoped mode, the 3-segment picker below is NEVER shown, not even
  // transiently — this branch intercepts `screen === "segments"` (the
  // pre-fetch default) and renders ONLY a loading skeleton or, on failure, a
  // retry specific to THIS segment (no "back to segments" — there is no other
  // segment to go back to in this mode). Once `openSegment` succeeds it moves
  // `screen` to "review" and this branch stops matching.
  if (scopedSegment && screen === "segments") {
    if (scopedError) {
      const segSpec = SEGMENTS.find((s) => s.key === scopedSegment)
      return (
        <EmptyState
          className="rounded-2xl bg-bg-card shadow-card"
          icon={<Megaphone size={28} />}
          title="Não foi possível preparar"
          description={`Falha ao carregar ${segSpec?.label ?? "este segmento"}. Tente de novo.`}
          actionLabel="Tentar de novo"
          onAction={() => void openSegment(scopedSegment)}
        />
      )
    }
    return (
      <div className="space-y-3 rounded-2xl bg-bg-card p-5 shadow-card">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  // --- Screen: SEGMENTS (entry) ---------------------------------------------

  if (screen === "segments") {
    const withCount = SEGMENTS.map((s) => ({
      ...s,
      count:
        s.key === "atencao"
          ? segmentCounts.atencao
          : s.key === "sem_acesso"
            ? segmentCounts.semAcesso
            : segmentCounts.noRitmo,
    }))
    const anyActionable = withCount.some((s) => !s.optional && s.count > 0)
    return (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Escolha um estado do semáforo para preparar uma campanha. Cada aluno entra com uma
          mensagem já preenchida, que você revisa e ajusta antes de enviar tudo junto.
        </p>
        {!anyActionable && (
          <EmptyState
            className="rounded-2xl bg-bg-card shadow-card"
            icon={<CheckCircle2 size={28} />}
            title="Nada urgente no momento"
            description={
              context.tenantWide
                ? "Nenhum aluno em atenção ou sem acesso agora."
                : "Nenhum aluno do seu recorte em atenção ou sem acesso agora."
            }
          />
        )}
        <div className="space-y-3">
          {withCount.map((s) => {
            const empty = s.count === 0
            return (
              <div
                key={s.key}
                className="flex items-center justify-between gap-4 rounded-2xl bg-bg-card p-5 shadow-card"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: s.bg, color: s.color }}
                  >
                    {s.icon}
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-text-primary">
                        {s.label}
                      </h3>
                      <Badge variant="info" badgeSize="sm">
                        {s.count}
                      </Badge>
                      {s.optional && (
                        <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
                          opcional
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted">{s.description}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={s.optional ? "ghost" : "default"}
                  disabled={empty || previewLoading}
                  isLoading={previewLoading && activeSegment === s.key}
                  onClick={() => void openSegment(s.key)}
                >
                  {s.key === "no_ritmo" ? "Reconhecer" : "Preparar campanha"}
                </Button>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // --- Screen: REVIEW (mandatory per-line review) ----------------------------

  if (screen === "review") {
    const segSpec = SEGMENTS.find((s) => s.key === activeSegment)
    const activeLines = lines.filter((l) => !lineState[l.id]?.removed)
    const finalCount = activeLines.length

    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          {/* Fatia 10: no "back to segments" in scoped mode — there is no
              other segment to go back to; the manager switches TABS instead. */}
          {!scopedSegment && (
            <Button variant="ghost" size="sm" onClick={reset}>
              <ArrowLeft size={16} /> Voltar aos segmentos
            </Button>
          )}
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-text-primary">{segSpec?.label}</h3>
            <Badge variant="info" badgeSize="sm">
              {finalCount} aluno{finalCount === 1 ? "" : "s"}
            </Badge>
          </div>
        </div>

        {/* Header: origem + canal (batch-level — E13 §5.1 passo 4). */}
        <div className="rounded-2xl bg-bg-card p-5 shadow-card">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <span className="text-xs font-medium text-text-secondary">Origem da mensagem</span>
              <div className="flex gap-2">
                <HeaderOption
                  selected={identity === "platform"}
                  label="Plataforma"
                  onSelect={() => setIdentity("platform")}
                />
                <HeaderOption
                  selected={identity === "manager"}
                  disabled={!senderOptions.managerName}
                  label={senderOptions.managerName ? "Gestor" : "Gestor (indisponível)"}
                  onSelect={() => senderOptions.managerName && setIdentity("manager")}
                />
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-xs font-medium text-text-secondary">Canal</span>
              <div className="flex gap-2">
                <HeaderOption
                  selected={channel === "inapp"}
                  label="In-app"
                  onSelect={() => setChannel("inapp")}
                />
                <HeaderOption
                  selected={channel === "email"}
                  label="Email"
                  onSelect={() => setChannel("email")}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Cap of 200 — surfaced BEFORE any send (E13 §6 inegociável 1). Fatia
            9a: reaproveita o mesmo padrão de aviso já usado em
            message-preview-panel.tsx (bg-semantic-warning/ring-semantic-warning),
            em vez do hex laranja ad-hoc que colidia com o estado "selecionado"
            do HeaderOption abaixo (mesma cor, 2 significados diferentes). */}
        {previewCapped && (
          <div className="rounded-xl bg-semantic-warning/10 p-3 text-xs text-text-secondary ring-1 ring-semantic-warning/30">
            Este segmento tem {previewTotal} alunos, acima do limite de {MAX_RECIPIENTS} por
            campanha. Apenas os primeiros {MAX_RECIPIENTS} estão listados. Remova alunos ou envie em
            lotes menores.
          </div>
        )}

        {/* The per-line review table (E13 §5.1 passo 4 / §2.2). */}
        <div className="rounded-2xl bg-bg-card shadow-card">
          <div className="border-b border-border-subtle px-5 py-3">
            <h4 className="text-sm font-semibold text-text-primary">Revisão obrigatória</h4>
            <p className="mt-0.5 text-xs text-text-muted">
              Cada linha já vem preenchida. Edite o texto de quem você quiser tratar diferente, ou
              remova um aluno. O resto vai com a mensagem sugerida.
            </p>
          </div>
          {activeLines.length === 0 ? (
            <p className="px-5 py-8 text-center text-xs text-text-muted">
              {scopedSegment
                ? "Nenhum destinatário selecionado."
                : "Nenhum destinatário selecionado. Volte e escolha outro segmento."}
            </p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {activeLines.map((l) => (
                <li key={l.id} className="space-y-2 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {l.fullName ?? l.email ?? l.id}
                      </p>
                      <p className="truncate text-xs text-text-muted">
                        {nudgeTypeReason(l.reason)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setLineState((prev) => ({
                          ...prev,
                          [l.id]: { text: prev[l.id]?.text ?? l.renderedText, removed: true },
                        }))
                      }
                    >
                      Remover
                    </Button>
                  </div>
                  <Textarea
                    rows={3}
                    value={lineState[l.id]?.text ?? l.renderedText}
                    onChange={(e) =>
                      setLineState((prev) => ({
                        ...prev,
                        [l.id]: { text: e.target.value, removed: false },
                      }))
                    }
                    aria-label={`Mensagem para ${l.fullName ?? l.id}`}
                    className="resize-y text-sm"
                  />
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between gap-3 border-t border-border-subtle px-5 py-3">
            <span className="text-xs text-text-muted">
              {finalCount} de {previewTotal} · canal {channel === "inapp" ? "in-app" : "email"}
            </span>
            <Button
              size="sm"
              isLoading={sending}
              disabled={finalCount === 0 || finalCount > MAX_RECIPIENTS}
              onClick={() => void confirm()}
            >
              Enviar campanha ({finalCount})
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // --- Screen: RESULT (aberta / encerrada — loop fechado, E16) ---------------

  const r = result
  const isClosed = r?.state === "closed"
  return (
    <div className="space-y-5">
      {/* Fatia 10: same as the review screen — no "back to segments" in
          scoped mode, nothing to go back to; switch tabs instead. */}
      {!scopedSegment && (
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={reset}>
            <ArrowLeft size={16} /> Voltar aos segmentos
          </Button>
        </div>
      )}

      <div className="space-y-4 rounded-2xl bg-bg-card p-6 shadow-card">
        <div className="flex items-center gap-3">
          {/* Fatia 9a: replaces the ad-hoc indigo hex (no other meaning in the
              app) with the design system's generic completion/informational
              tokens — "encerrada" is a completed state (semantic-success),
              "aberta" is in-progress/awaiting (semantic-info). Deliberately
              NOT the triage green (TRIAGE_COLORS.no_ritmo): a closed campaign
              is a different concept from a student's engagement level, and
              conflating the two would invent a relationship the product
              never asked for. */}
          <span
            className={`flex h-11 w-11 items-center justify-center rounded-full ${
              isClosed
                ? "bg-semantic-success/15 text-semantic-success"
                : "bg-semantic-info/15 text-semantic-info"
            }`}
          >
            <Megaphone size={22} />
          </span>
          <div>
            <h4 className="text-sm font-semibold text-text-primary">
              {isClosed ? "Campanha encerrada" : "Campanha enviada"}
            </h4>
            <p className="text-xs text-text-muted">
              {r
                ? isClosed
                  ? `Rodou de ${formatDate(r.campaign.windowStart)} a ${formatDate(r.campaign.windowEnd)}`
                  : `Aguardando retorno até ${formatDate(r.campaign.windowEnd)}`
                : "Enviada."}
            </p>
          </div>
        </div>

        {r && (
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Stat label="Enviadas" value={r.result.recipients} />
            <Stat label="Lidas" value={r.result.readCount} />
            <Stat
              label="Voltaram a estudar"
              value={r.result.returnedCount}
              emphasis
              // Base N always explicit alongside the % (disciplina E8/E16).
              hint={
                r.result.recipients > 0
                  ? `de ${r.result.recipients}${
                      r.result.returnRate != null
                        ? ` (${Math.round(r.result.returnRate * 100)}%)`
                        : ""
                    }`
                  : undefined
              }
            />
            <Stat label="Sem resposta" value={r.result.notReturned} />
          </dl>
        )}

        {r && !isClosed && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" isLoading={closing} onClick={() => void closeNow()}>
              Encerrar campanha agora
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// --- Small presentational helpers ------------------------------------------

// Fatia 9a: "selected" now uses the SAME cerrado pattern already established
// for this exact concept ("Escrever do zero"/"Usar template" toggle) in
// send-center-tab.tsx — the single action/interaction colour (princípio 3),
// instead of the ad-hoc orange hex that ALSO meant "cap of 200 warning"
// above (2 different concepts, 1 colour — the collision this fatia fixes).
function HeaderOption({
  selected,
  label,
  onSelect,
  disabled,
}: {
  selected: boolean
  label: string
  onSelect: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
        selected
          ? "border-cerrado-600 bg-cerrado-600/10 text-cerrado-700 ring-1 ring-cerrado-600/30"
          : "border-border-subtle text-text-secondary hover:border-cerrado-600/40"
      }`}
    >
      {label}
    </button>
  )
}

function Stat({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string
  value: number
  hint?: string
  /** Fatia 9c (Apple-style, princípio 2): "Voltaram a estudar" is the metric
   *  that CLOSES THE LOOP — the real question the manager has, not a
   *  process/volume number like the other 3 stats — and earns more visual
   *  weight. Reaproveita semantic-success (estado de UI genérico, mesmo
   *  raciocínio da fatia 9a para "campanha encerrada") em vez de
   *  TRIAGE_COLORS: "voltou a estudar" é um sinal de resultado de campanha,
   *  não a triagem de um aluno específico. */
  emphasis?: boolean
}) {
  return (
    <div
      className={`rounded-xl p-3 ${
        emphasis ? "bg-semantic-success/10 ring-1 ring-semantic-success/25" : "bg-bg-elevated"
      }`}
    >
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd
        className={`font-bold ${emphasis ? "text-2xl text-semantic-success" : "text-lg text-text-primary"}`}
      >
        {value}
      </dd>
      {hint && <p className="text-[11px] text-text-muted">{hint}</p>}
    </div>
  )
}
