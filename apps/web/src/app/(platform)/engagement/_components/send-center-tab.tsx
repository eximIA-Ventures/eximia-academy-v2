"use client"

// ---------------------------------------------------------------------------
// Central de Envios — INLINE tab (replaces the individual-action overlay).
// ---------------------------------------------------------------------------
// Decisão de produto (Hugo, 2026-07-09, definitiva): o overlay morre. A ação
// individual passa a ser composta e enviada NESTA aba da própria página, servindo
// DOIS fluxos:
//
//   (a) AUTOMÁTICO — os botões da tabela navegam para
//       `/engagement?student={id}&action={remind|activate|recognize}`; a shell
//       seleciona esta aba e a Central abre pré-preenchida (aluno + preview).
//   (b) MANUAL — o gestor abre a Central direto (sem params); a Central JÁ CARREGA
//       a lista completa e rolável dos alunos do recorte atual (GET
//       /api/engagement/students sem `ids`), e a barra de busca FILTRA essa lista
//       por nome (mesmo endpoint com `?q=`).
//
// E12 Rodada 6 (Hugo ao vivo, 2026-07-09/10) — REFORMA do composer:
//   • item 2: a seção "Tipo de mensagem" (4 categorias de TOM Lembrete/Acionamento/
//     Reconhecimento/Mensagem livre) SAIU. O gestor não escolhe um tom — ele escolhe
//     entre DOIS caminhos: escrever a mensagem do zero, ou usar um template pronto
//     (dropdown ÚNICO com TODOS os templates ativos, não filtrado por tipo). O
//     `nudgeType` que a lógica de negócio precisa continua derivado server-side do
//     status real do aluno (o detalhe carrega `detail.nudgeType`), nunca mais pedido
//     ao gestor.
//   • item 3: os textos sugeridos NÃO começam mais com "Percebi/Notei que" (a origem
//     Plataforma já prefixa "A exímIA Academy percebeu o seguinte:" — evita a
//     duplicação "percebeu ... Percebi que").
//   • item 4: o CANAL (In-app/Email) passou a ser um seletor REAL, ligado ao payload
//     (antes hardcoded em in-app). Reusa o canal do MessagePreviewPanel + propaga
//     `channel` a POST /api/engagement/action (que já aceita o parâmetro).
//   • item 5: envio em massa LEVE — o gestor seleciona ALGUNS alunos no picker
//     (seleção múltipla) e manda a MESMA mensagem para todos de uma vez. Reusa o
//     MESMO motor de dispatch (dispatchTeamNudge via POST /action com studentIds[]),
//     re-escopado + cap 200 server-side. NÃO é Campanha (objeto observável); é envio
//     pontual, registrado no Histórico como um envio individual.
//   • item 6: polish visual do composer (espaçamento/hierarquia com os tokens da casa).
//
// Endpoints (todos já escopados server-side, nunca confiando no client):
//   • GET /api/engagement/students?ids=&action=  → detail + AC10 nudgeType
//   • GET /api/engagement/students[?q=]          → picker (lista o recorte; q filtra)
//   • GET /api/engagement/history?student=        → comms recentes (composer 1-aluno)
//   • GET /api/engagement/templates               → catálogo de templates (item 2)
//   • POST /api/engagement/action                 → dispatch 1..N (server re-scopes)
// ---------------------------------------------------------------------------

import type { TemplateIntent } from "@/types/notifications"
import {
  Badge,
  Button,
  Command,
  CommandEmpty,
  CommandItem,
  CommandList,
  Input,
  Select,
  Skeleton,
  useToast,
} from "@eximia/ui"
import { CheckCircle2, Search, Send, UserSearch, Users, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { withFocus } from "./engagement-fetch"
import {
  MessagePreviewPanel,
  type MessagePreviewValue,
  buildSuggestedMessage,
} from "./message-preview-panel"
import type {
  EngagementDeepLinkAction,
  EngagementStudentDetail,
  EngagementStudentOption,
  SendCenterTabProps,
} from "./types"

// --- Template shape consumed from GET /api/engagement/templates (E9 source). ---
// Same endpoint the Templates tab + the Campaigns wizard use — ONE catalogue. Now
// carries channelEmail so the template list respects the chosen channel (item 4).
interface SendCenterTemplate {
  id: string
  key: string
  name: string
  intent: TemplateIntent | null
  bodyInapp: string | null
  channelInapp: boolean
  channelEmail: boolean
}

// --- Comms-history row (single-student composer). Mirrors GET /history. -------
interface CommsHistoryRow {
  id: string
  title: string
  status: string
  created_at: string
  sent_at: string | null
  sender_identity: string
  channel: string
}

// --- Suggested base body per nudgeType (item 3: NO "Percebi/Notei que" prefix). --
// The body the preview PRE-FILLS when a template is not chosen; the manager edits
// freely. The origin greeting is added by MessagePreviewPanel.buildSuggestedMessage
// — this is only the body. Rewritten to open DIRECTLY on the observation, since the
// platform origin already prefixes "A exímIA Academy percebeu o seguinte:" (which
// made "percebeu ... Percebi que" read redundantly). Also reads naturally under the
// manager origin ("Aqui é {nome}. Você ainda não acessou...").
const SUGGESTED_BODY: Record<string, string> = {
  never_accessed:
    "Você ainda não acessou a plataforma. Quando puder, dê o primeiro passo e comece sua trilha na exímIA Academy.",
  inactive:
    "Faz um tempo que você não acessa a plataforma. Que tal retomar de onde parou? Estou por aqui se precisar.",
  behind_teaching_plan:
    "Sua trilha está um pouco abaixo do ritmo esperado para o Plano de Ensino. Quando puder, acesse a plataforma e avance no próximo módulo.",
  no_reflection:
    "Você concluiu sessões recentes, mas ainda não registrou suas reflexões. Consolidar o aprendizado faz toda a diferença.",
  top_performer:
    "Seu engajamento tem sido excelente. Continue assim, o progresso está muito consistente.",
}
// "Escrever do zero" starts with an empty body — the manager writes it all.
const BLANK_BODY = ""

const STATUS_LABEL: Record<string, { label: string; variant: "error" | "warning" | "success" }> = {
  atencao: { label: "Em atenção", variant: "error" },
  sem_acesso: { label: "Sem acesso recente", variant: "warning" },
  no_ritmo: { label: "No ritmo", variant: "success" },
}

const MOTIVO_BY_NUDGE: Record<string, string> = {
  never_accessed: "Convite enviado, mas nenhuma atividade registrada.",
  inactive: "Sem acesso recente à plataforma.",
  behind_teaching_plan: "Progresso abaixo do esperado para o Plano de Ensino.",
  no_reflection: "Sessões concluídas sem reflexão registrada.",
  top_performer: "Aluno em dia, engajamento em destaque no recorte atual.",
}

// item 2: the two composing paths (no tom category anymore).
type MessageMode = "scratch" | "template"

// The deep-link `?action=` verb → the students-route `action` query value. The tom
// category is gone; we still fetch the detail with a real action so the route
// derives a valid nudgeType (recognize forces top_performer; others derive from
// ritmo). A manual open (no deep-link) fetches as "activate" — the honest,
// risk-aware default that yields the right suggested body.
function studentsActionParam(action: EngagementDeepLinkAction | null): string {
  return action ?? "activate"
}

function firstNameOf(fullName: string | null): string {
  if (!fullName) return "aluno"
  const t = fullName.trim()
  return t ? t.split(/\s+/)[0] : "aluno"
}

function lastAccessLabel(days: number | null): string {
  if (days === null) return "Nunca acessou"
  if (days === 0) return "Hoje"
  if (days === 1) return "Ontem"
  return `${days} dias atrás`
}

export function SendCenterTab({
  initialStudentId,
  initialAction,
  senderOptions,
  context,
  canAct,
  onSent,
  focus,
  restrictToStudentIds,
}: SendCenterTabProps) {
  const { toast } = useToast()

  // The SELECTED recipients (item 5: multi-select). A Map preserves display names
  // for the chips without a re-fetch. One selected = the full composer with the
  // student card; two+ = the bulk composer (same message to all, no per-student
  // detail card). Seeded from the deep-link (single student) when present.
  const [selected, setSelected] = useState<Map<string, string | null>>(() =>
    initialStudentId ? new Map([[initialStudentId, null]]) : new Map(),
  )
  const selectedIds = [...selected.keys()]
  const singleId = selectedIds.length === 1 ? selectedIds[0] : null
  const isBulk = selectedIds.length > 1

  // The deep-link action verb (only meaningful for a single deep-linked student).
  const [deepAction, setDeepAction] = useState<EngagementDeepLinkAction | null>(initialAction)

  // Message-composing mode (item 2): write from scratch, or use a ready template.
  const [messageMode, setMessageMode] = useState<MessageMode>("scratch")

  // Loaded student detail (single-student composer only) + comms history + preview.
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<EngagementStudentDetail | null>(null)
  const [history, setHistory] = useState<CommsHistoryRow[] | null>(null)
  const [preview, setPreview] = useState<MessagePreviewValue | null>(null)
  const [sending, setSending] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // item 2 — the tenant template catalogue (all active templates, lazily loaded).
  const [templates, setTemplates] = useState<SendCenterTemplate[] | null>(null)
  // The template the manager picked (null = none yet; only relevant in "template"
  // mode). Reset whenever the recipient set or the message mode changes.
  const [pickedTemplateKey, setPickedTemplateKey] = useState<string | null>(null)

  // Manual picker state.
  const [pickerQuery, setPickerQuery] = useState("")
  const [pickerResults, setPickerResults] = useState<EngagementStudentOption[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pickerError, setPickerError] = useState<string | null>(null)

  // Whether the composer is active (at least one student selected).
  const hasSelection = selectedIds.length > 0

  // React to a NEW deep-link (shell re-seeds these props when the URL changes).
  useEffect(() => {
    if (initialStudentId) {
      setSelected(new Map([[initialStudentId, null]]))
      setDeepAction(initialAction)
    }
    // A cleared deep-link (initialStudentId null) leaves the current selection
    // intact — the manual flow keeps its picks; only an incoming deep-link reseeds.
  }, [initialStudentId, initialAction])

  // --- Load the SINGLE selected student's detail + seed the preview. ---------
  // Only runs in single-recipient mode; bulk mode has no per-student detail card.
  const loadStudent = useCallback(async () => {
    if (!singleId) {
      setDetail(null)
      setHistory(null)
      setPreview(null)
      setLoadError(null)
      return
    }
    setLoading(true)
    setLoadError(null)
    setDetail(null)
    setHistory(null)
    setPreview(null)
    try {
      const res = await fetch(
        withFocus(
          `/api/engagement/students?ids=${encodeURIComponent(singleId)}&action=${studentsActionParam(deepAction)}`,
          focus,
        ),
      )
      if (!res.ok) {
        const body = await res.text().catch(() => "")
        console.error(`[send-center] student detail load failed: HTTP ${res.status}`, body)
        setLoadError("Não foi possível carregar os dados do aluno.")
        return
      }
      const data = (await res.json()) as { students: EngagementStudentDetail[] }
      const found = data.students[0]
      if (!found) {
        setLoadError("Este aluno não pertence ao seu recorte atual.")
        return
      }
      setDetail(found)

      // Seed the editable preview. Default mode = "scratch" (blank body); the
      // suggested body only fills when the manager is on a deep-linked risk action
      // (helpful) OR later when a template is chosen. Item 3: when we DO pre-fill a
      // body, it no longer begins with "Percebi/Notei que".
      const first = firstNameOf(found.fullName)
      const identity = senderOptions.defaultIdentity
      // A deep-linked open pre-fills the suggested body (the automated flow's help);
      // a fresh manual open starts blank (item 2 default = write from scratch).
      const seedBody = deepAction
        ? (SUGGESTED_BODY[found.nudgeType] ?? SUGGESTED_BODY.inactive)
        : BLANK_BODY
      setPreview({
        identity,
        message: buildSuggestedMessage(identity, first, senderOptions.managerName, seedBody),
        // item 2: independent channels — default to in-app on, e-mail off.
        channelInapp: true,
        channelEmail: false,
      })

      // Recent comms history (last 3), scoped by the same route (E8) — always fetched
      // for a single-student composer (useful context regardless of tom).
      const hRes = await fetch(
        withFocus(`/api/engagement/history?student=${encodeURIComponent(singleId)}`, focus),
      )
      if (hRes.ok) {
        const hData = (await hRes.json()) as { notifications: CommsHistoryRow[] }
        setHistory((hData.notifications ?? []).slice(0, 3))
      } else {
        setHistory([])
      }
    } catch (err) {
      console.error("[send-center] student detail load errored:", err)
      setLoadError("Erro ao carregar os dados do aluno.")
    } finally {
      setLoading(false)
    }
  }, [singleId, deepAction, senderOptions.defaultIdentity, senderOptions.managerName, focus])

  useEffect(() => {
    void loadStudent()
  }, [loadStudent])

  // For bulk mode, there is no per-student detail: seed a plain blank preview once
  // the selection becomes multi. The same message goes to everyone.
  useEffect(() => {
    if (!isBulk) return
    setDetail(null)
    setHistory(null)
    setLoadError(null)
    setLoading(false)
    const identity = senderOptions.defaultIdentity
    // A generic greeting placeholder ({first} → "aluno" per recipient at render);
    // the bulk send passes a single free-form message applied to all.
    setPreview((prev) =>
      prev
        ? prev
        : {
            identity,
            message: buildSuggestedMessage(identity, "", senderOptions.managerName, BLANK_BODY),
            channelInapp: true,
            channelEmail: false,
          },
    )
  }, [isBulk, senderOptions.defaultIdentity, senderOptions.managerName])

  // --- Templates (item 2): load the tenant catalogue once, when composing. ---
  useEffect(() => {
    if (!hasSelection || templates !== null) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/engagement/templates")
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as { templates: SendCenterTemplate[] }
        if (!cancelled) setTemplates(data.templates ?? [])
      } catch (err) {
        console.error("[send-center] template catalogue load failed:", err)
        if (!cancelled) setTemplates([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [hasSelection, templates])

  // Reset the picked template when the recipient set or the message mode changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only on these keys
  useEffect(() => {
    setPickedTemplateKey(null)
  }, [messageMode, selectedIds.length])

  const wantsInapp = preview?.channelInapp ?? true
  const wantsEmail = preview?.channelEmail ?? false

  // item 2 + item 4: templates that support ANY of the SELECTED channels (in-app
  // and/or e-mail — the manager may pick both). No tom filter — the dropdown lists
  // the whole catalogue that can carry at least one chosen channel. When neither is
  // selected yet, fall back to the in-app-capable set (the default composing base).
  const availableTemplates = (templates ?? []).filter((t) => {
    if (!wantsInapp && !wantsEmail) return t.channelInapp
    return (wantsInapp && t.channelInapp) || (wantsEmail && t.channelEmail)
  })

  // A channel switch may drop the currently-picked template from the list (e.g. an
  // in-app-only template when the manager unticks in-app and keeps only e-mail).
  // Clear the stale pick so we never submit a templateKey no selected channel carries.
  useEffect(() => {
    if (pickedTemplateKey && !availableTemplates.some((t) => t.key === pickedTemplateKey)) {
      setPickedTemplateKey(null)
    }
  }, [pickedTemplateKey, availableTemplates])

  // Apply a chosen template's body as the editable starting point (single mode).
  const applyTemplate = useCallback(
    (key: string | null) => {
      setPickedTemplateKey(key)
      if (!preview) return
      const first = detail ? firstNameOf(detail.fullName) : ""
      const identity = preview.identity
      const tpl = key ? (templates ?? []).find((t) => t.key === key) : null
      const body =
        tpl?.bodyInapp ??
        (detail ? (SUGGESTED_BODY[detail.nudgeType] ?? SUGGESTED_BODY.inactive) : BLANK_BODY)
      setPreview({
        identity,
        message: buildSuggestedMessage(identity, first, senderOptions.managerName, body),
        // Preserve the manager's channel selection when swapping the body.
        channelInapp: preview.channelInapp,
        channelEmail: preview.channelEmail,
      })
    },
    [detail, preview, templates, senderOptions.managerName],
  )

  // --- Manual picker: full recorte roster on open + debounced filter. --------
  // Loads the WHOLE recorte on open; typing FILTERS via the same scoped route.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    // The picker is always visible (multi-select): it stays open so the manager can
    // add more students even after selecting one. So it loads regardless of
    // selection — the selection is tracked separately (chips).
    const q = pickerQuery.trim()
    if (searchTimer.current) clearTimeout(searchTimer.current)
    setPickerLoading(true)
    setPickerError(null)
    const delay = q.length === 0 ? 0 : 250
    searchTimer.current = setTimeout(async () => {
      try {
        // Cards Mestre-Detalhe (fatia 5/6, doc 03 §4 decisão 3): when the
        // picker is narrowed to a card's cohort, add `studentIds` alongside
        // `q` — both filters coexist (the route INTERSECTS studentIds with
        // the recorte, then `q` filters by name within that).
        const params = new URLSearchParams()
        if (q.length > 0) params.set("q", q)
        if (restrictToStudentIds && restrictToStudentIds.length > 0) {
          params.set("studentIds", restrictToStudentIds.join(","))
        }
        const qs = params.toString()
        const url = qs.length > 0 ? `/api/engagement/students?${qs}` : "/api/engagement/students"
        const res = await fetch(withFocus(url, focus))
        if (res.ok) {
          const data = (await res.json()) as { students: EngagementStudentOption[] }
          setPickerResults(data.students ?? [])
          setPickerError(null)
        } else {
          const body = await res.text().catch(() => "")
          console.error(`[send-center] student picker load failed: HTTP ${res.status}`, body)
          setPickerResults([])
          setPickerError(
            res.status === 403
              ? "Você não tem permissão para listar alunos neste recorte."
              : "Não foi possível carregar os alunos. Tente novamente.",
          )
        }
      } catch (err) {
        console.error("[send-center] student picker load errored:", err)
        setPickerResults([])
        setPickerError("Erro de conexão ao carregar alunos. Verifique sua rede.")
      } finally {
        setPickerLoading(false)
      }
    }, delay)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [pickerQuery, focus, restrictToStudentIds])

  // item 5: toggle a student in/out of the selection (multi-select). A deep-linked
  // student is just the first entry; toggling never touches the deep-link action.
  function toggleStudent(option: EngagementStudentOption) {
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(option.id)) next.delete(option.id)
      else next.set(option.id, option.fullName)
      return next
    })
    // Selecting a NEW student while a deep-link action is set would confuse the
    // single-student seed; clear the deep action once the manager curates the set
    // manually (the send still derives nudgeType from the detail per recipient).
    setDeepAction(null)
  }

  function removeSelected(id: string) {
    setSelected((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }

  function resetComposer() {
    setSelected(new Map())
    setDeepAction(null)
    setDetail(null)
    setHistory(null)
    setPreview(null)
    setLoadError(null)
    setPickedTemplateKey(null)
    setMessageMode("scratch")
    setPickerQuery("")
  }

  // item 2: derive the engine's channel model from the two independent flags.
  //   in-app only        → "inapp"      (email mirror suppressed)
  //   in-app + e-mail     → "email"      (in-app row + email mirror — legacy "both")
  //   e-mail only         → "email_only" (skip the in-app inbox row)
  // Neither selected → null (send blocked, guarded below and in the disabled state).
  function engineChannel(): "inapp" | "email" | "email_only" | null {
    if (!preview) return null
    const { channelInapp, channelEmail } = preview
    if (channelInapp && channelEmail) return "email"
    if (channelInapp) return "inapp"
    if (channelEmail) return "email_only"
    return null
  }
  const noChannelSelected = !preview?.channelInapp && !preview?.channelEmail

  async function handleSend() {
    if (!preview || preview.message.trim().length === 0 || selectedIds.length === 0) return
    const ch = engineChannel()
    if (!ch) {
      toast({
        variant: "error",
        title: "Selecione um canal",
        description: "Marque notificação no app, e-mail, ou ambos, para enviar.",
      })
      return
    }
    setSending(true)
    try {
      // nudgeType: single mode uses the server-derived detail.nudgeType; bulk mode
      // has no single detail, so it uses `custom` (a free-form send to all — the
      // engine accepts it and the `message` override IS the body). templateKey: when
      // a template was chosen, record ITS key (traceability); else null (custom).
      const nudgeType = !isBulk && detail ? detail.nudgeType : "custom"
      const templateKey =
        messageMode === "template" && pickedTemplateKey
          ? pickedTemplateKey
          : !isBulk && detail
            ? detail.templateKey
            : null

      const payload: Record<string, unknown> = {
        nudgeType,
        templateKey,
        message: preview.message,
        senderIdentity: preview.identity,
        channel: ch,
      }
      // Single vs bulk: the route accepts either `studentId` or `studentIds[]`.
      if (isBulk) payload.studentIds = selectedIds
      else payload.studentId = selectedIds[0]

      const res = await fetch("/api/engagement/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        toast({
          variant: "error",
          title: "Não foi possível enviar",
          description: err?.error ?? "Tente novamente em instantes.",
        })
        return
      }
      const data = (await res.json().catch(() => null)) as { total?: number } | null
      const sentCount = data?.total ?? selectedIds.length
      toast({
        variant: "success",
        title: "Mensagem enviada",
        description: isBulk
          ? `${sentCount} aluno${sentCount === 1 ? "" : "s"} receberá${sentCount === 1 ? "" : "o"} a comunicação.`
          : `${detail?.fullName ?? "O aluno"} receberá a comunicação.`,
      })
      resetComposer()
      onSent?.()
    } catch {
      toast({ variant: "error", title: "Erro de rede", description: "Verifique sua conexão." })
    } finally {
      setSending(false)
    }
  }

  const statusMeta = detail ? STATUS_LABEL[detail.status] : null
  const scopeCopy = context.tenantWide
    ? "Todos os alunos. Marque um ou vários para enviar a mesma mensagem."
    : "Alunos do seu recorte atual. Marque um ou vários para enviar a mesma mensagem."

  const composerTitle = isBulk
    ? `Enviar para ${selectedIds.length} alunos`
    : detail?.fullName
      ? `Enviar para ${detail.fullName}`
      : "Enviar mensagem"

  // The suggested body the preview panel offers when the origin is switched
  // (single = the student's nudgeType body; bulk/scratch = blank).
  const panelSuggestedBody =
    messageMode === "template" && pickedTemplateKey
      ? ((templates ?? []).find((t) => t.key === pickedTemplateKey)?.bodyInapp ?? BLANK_BODY)
      : !isBulk && detail && deepAction
        ? (SUGGESTED_BODY[detail.nudgeType] ?? SUGGESTED_BODY.inactive)
        : BLANK_BODY

  return (
    <div className="space-y-6">
      {/* --- Picker: sempre visível, seleção MÚLTIPLA (item 5) --- */}
      <section className="rounded-2xl bg-bg-card p-5 shadow-card">
        <div className="flex items-center gap-2">
          <UserSearch size={18} className="text-text-muted" aria-hidden="true" />
          <h2 className="text-base font-semibold text-text-primary">Escolha o aluno</h2>
        </div>
        <p className="mt-1 text-sm text-text-secondary">{scopeCopy}</p>

        {/* Selected chips (item 5) — the curated recipient set. */}
        {selectedIds.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedIds.map((id) => {
              const name = selected.get(id) ?? detail?.fullName ?? "Aluno"
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-cerrado-600/10 py-1 pl-3 pr-1.5 text-xs font-medium text-cerrado-700 ring-1 ring-cerrado-600/25"
                >
                  {name}
                  <button
                    type="button"
                    onClick={() => removeSelected(id)}
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full text-cerrado-700/70 hover:bg-cerrado-600/20 hover:text-cerrado-700"
                    aria-label={`Remover ${name}`}
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </span>
              )
            })}
          </div>
        )}

        <div className="mt-4 space-y-3">
          <Input
            type="text"
            placeholder="Filtrar aluno por nome..."
            value={pickerQuery}
            onChange={(e) => setPickerQuery(e.target.value)}
            leadingIcon={<Search size={16} aria-hidden="true" />}
            aria-label="Filtrar aluno por nome"
          />
          {pickerError && (
            <div
              className="rounded-lg bg-semantic-error/10 px-3 py-2 text-xs text-text-secondary ring-1 ring-semantic-error/30"
              role="alert"
            >
              {pickerError}
            </div>
          )}
          <Command filter={() => true} className="shadow-none ring-1 ring-border-subtle">
            <CommandList className="max-h-72">
              {pickerLoading && (
                <div className="space-y-2 p-2">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              )}
              {!pickerLoading && !pickerError && pickerResults.length === 0 && (
                <CommandEmpty>
                  {pickerQuery.trim().length > 0
                    ? "Nenhum aluno corresponde ao filtro no recorte atual."
                    : "Nenhum aluno no seu recorte atual."}
                </CommandEmpty>
              )}
              {!pickerLoading &&
                pickerResults.map((s) => {
                  const checked = selected.has(s.id)
                  return (
                    <CommandItem
                      key={s.id}
                      value={s.fullName ?? s.id}
                      onSelect={() => toggleStudent(s)}
                      className={checked ? "bg-cerrado-600/5" : undefined}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          checked
                            ? "border-cerrado-600 bg-cerrado-600 text-white"
                            : "border-border-subtle"
                        }`}
                        aria-hidden="true"
                      >
                        {checked && <CheckCircle2 size={12} />}
                      </span>
                      <span className="truncate font-medium text-text-primary">
                        {s.fullName ?? "Aluno"}
                      </span>
                    </CommandItem>
                  )
                })}
            </CommandList>
          </Command>
          {selectedIds.length > 1 && (
            <p className="flex items-center gap-1.5 text-xs text-text-muted">
              <Users size={13} aria-hidden="true" />
              {selectedIds.length} alunos selecionados receberão a mesma mensagem.
            </p>
          )}
        </div>
      </section>

      {/* --- Composer: aparece quando há pelo menos um aluno selecionado --- */}
      {hasSelection && (
        <section className="rounded-2xl bg-bg-card p-6 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-text-primary">{composerTitle}</h2>
              {!isBulk && detail && (
                <p className="mt-0.5 text-sm text-text-secondary">
                  {MOTIVO_BY_NUDGE[detail.nudgeType] ?? "Ação de engajamento."}
                </p>
              )}
              {isBulk && (
                <p className="mt-0.5 text-sm text-text-secondary">
                  A mesma mensagem será enviada para todos os alunos selecionados.
                </p>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={resetComposer} disabled={sending}>
              Limpar
            </Button>
          </div>

          {loading && !isBulk && (
            <div className="mt-5 space-y-4">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}

          {!loading && loadError && !isBulk && (
            <div className="mt-5 rounded-xl bg-semantic-error/10 p-4 text-sm text-text-secondary ring-1 ring-semantic-error/30">
              {loadError}
            </div>
          )}

          {/* The composer body shows when: bulk mode (no detail needed), OR single
              mode with the detail loaded. */}
          {((isBulk && preview) || (!isBulk && detail && preview)) && (
            <div className="mt-6 space-y-6">
              {/* --- Métricas do aluno (single mode only) --- */}
              {!isBulk && detail && (
                <dl className="grid grid-cols-2 gap-4 rounded-xl bg-bg-surface p-4 text-sm">
                  {statusMeta && (
                    <div className="col-span-2">
                      <dt className="text-xs text-text-muted">Status atual</dt>
                      <dd className="mt-1">
                        <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs text-text-muted">Último acesso</dt>
                    <dd className="mt-0.5 font-medium text-text-primary">
                      {lastAccessLabel(detail.daysSinceLastActivity)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-muted">Progresso</dt>
                    <dd className="mt-0.5 font-medium text-text-primary">{detail.progressPct}%</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-text-muted">Engajamento</dt>
                    <dd className="mt-0.5 font-medium text-text-primary">
                      {detail.completedSessions}/{detail.totalSessions} sessões ·{" "}
                      {detail.reflectionsCount} reflexões
                    </dd>
                  </div>
                </dl>
              )}

              {/* --- Histórico recente de comunicações (single mode only) --- */}
              {!isBulk && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-text-primary">
                    Histórico recente de comunicações
                  </p>
                  {history === null ? (
                    <Skeleton className="h-12 w-full" />
                  ) : history.length === 0 ? (
                    <p className="text-xs text-text-muted">
                      Nenhuma comunicação enviada para este aluno ainda.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {history.map((h) => (
                        <li
                          key={h.id}
                          className="rounded-lg bg-bg-surface px-3 py-2 text-xs text-text-secondary"
                        >
                          <span className="font-medium text-text-primary">{h.title}</span>
                          <span className="text-text-muted">
                            {" · "}
                            {new Date(h.created_at).toLocaleDateString("pt-BR")}
                            {" · "}
                            {h.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* --- Como compor (item 2): escrever do zero OU usar template --- */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-text-primary">
                  Como quer compor a mensagem?
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMessageMode("scratch")
                      applyTemplate(null)
                    }}
                    aria-pressed={messageMode === "scratch"}
                    className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
                      messageMode === "scratch"
                        ? "border-cerrado-600 bg-cerrado-600/10 ring-1 ring-cerrado-600/30"
                        : "border-border-subtle bg-bg-surface hover:border-cerrado-600/40"
                    }`}
                  >
                    <span className="text-sm font-semibold text-text-primary">
                      Escrever do zero
                    </span>
                    <span className="text-xs text-text-muted">
                      Digite a mensagem diretamente abaixo.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMessageMode("template")}
                    aria-pressed={messageMode === "template"}
                    className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
                      messageMode === "template"
                        ? "border-cerrado-600 bg-cerrado-600/10 ring-1 ring-cerrado-600/30"
                        : "border-border-subtle bg-bg-surface hover:border-cerrado-600/40"
                    }`}
                  >
                    <span className="text-sm font-semibold text-text-primary">
                      Usar um template
                    </span>
                    <span className="text-xs text-text-muted">
                      Comece de um modelo pronto e ajuste.
                    </span>
                  </button>
                </div>

                {/* Template dropdown — ALL active templates for the chosen channel
                    (item 2: no tom filter). Only shown in "template" mode. */}
                {messageMode === "template" && (
                  <div className="space-y-1.5 pt-1">
                    <label
                      htmlFor="send-template"
                      className="text-xs font-medium text-text-secondary"
                    >
                      Template
                    </label>
                    {templates === null ? (
                      <Skeleton className="h-10 w-full rounded-xl" />
                    ) : availableTemplates.length === 0 ? (
                      <p className="text-xs text-text-muted">
                        Nenhum template ativo para o canal escolhido. Escreva a mensagem do zero ou
                        troque o canal.
                      </p>
                    ) : (
                      <Select
                        id="send-template"
                        value={pickedTemplateKey ?? ""}
                        onChange={(e) => applyTemplate(e.target.value || null)}
                      >
                        <option value="">Escolha um template...</option>
                        {availableTemplates.map((t) => (
                          <option key={t.id} value={t.key}>
                            {t.name}
                          </option>
                        ))}
                      </Select>
                    )}
                  </div>
                )}
              </div>

              {/* --- Origem + preview editável + canal (item 4: canal real) --- */}
              <MessagePreviewPanel
                recipientFirstName={detail ? firstNameOf(detail.fullName) : "aluno"}
                suggestedBody={panelSuggestedBody}
                senderOptions={senderOptions}
                // item 4: offer BOTH channels so the panel renders the In-app/Email
                // radio group; the chosen `preview.channel` drives the payload.
                channelInapp={true}
                channelEmail={true}
                value={preview}
                onChange={setPreview}
                disabled={sending}
              />

              {/* --- Cancelar + Enviar --- */}
              <div className="flex items-center justify-end gap-2 border-t border-border-subtle pt-5">
                {!canAct && (
                  <p className="mr-auto text-xs text-text-muted">
                    Você não tem permissão para enviar comunicações.
                  </p>
                )}
                <Button variant="ghost" onClick={resetComposer} disabled={sending}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={
                    !canAct ||
                    sending ||
                    preview.message.trim().length === 0 ||
                    // item 2: block sending when no channel is selected.
                    noChannelSelected
                  }
                >
                  {sending ? (
                    "Enviando..."
                  ) : (
                    <>
                      <Send size={15} /> {isBulk ? `Enviar para ${selectedIds.length}` : "Enviar"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* --- Rodapé informativo (recorte + reforço da decisão inline) --- */}
      {!hasSelection && (
        <div className="flex items-center gap-2 rounded-2xl bg-bg-surface p-4 text-xs text-text-muted">
          <CheckCircle2 size={14} className="shrink-0 text-cerrado-600" aria-hidden="true" />
          <span>
            As mensagens são enviadas apenas para alunos do seu recorte. O envio é registrado no
            Histórico.
          </span>
        </div>
      )}
    </div>
  )
}
