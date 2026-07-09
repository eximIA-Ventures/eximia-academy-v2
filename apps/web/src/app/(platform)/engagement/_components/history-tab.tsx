"use client"

// ---------------------------------------------------------------------------
// E8 — Aba Histórico.
// ---------------------------------------------------------------------------
// Scoped table of sent communications. Source: GET /api/engagement/history,
// which the server ALREADY scopes to recipient_id ∈ allowedStudentIds (E3) —
// this component adds NO parallel unscoped path (E8 Dev Notes), it only renders
// what the scoped route returns and forwards the route-supported filters as
// query params. The non-leakage guarantee lives in the route (AC3/AC8).
//
// 8 columns (report Seção 13): Destinatário, Motivo, Mensagem/template, Origem,
// Canal, Status, Data, Resultado. Filters: Aluno (busca), Tipo, Origem, Canal,
// Status, Período.
//
// KNOWN GAPS in the E3 history route (registered in the Dev Agent Record; not
// fixable here without editing an out-of-boundary route):
//   • the row carries `recipient_id` but no recipient name → "Destinatário"
//     shows the returned name when present, else a short id reference.
//   • the route SELECT omits `returned_at`/`acted_at` → "Resultado" derives from
//     what IS present (read_at/status); "Acessou depois da mensagem" only shows
//     if `returned_at` ever arrives in the payload.
// ---------------------------------------------------------------------------

import type { NotificationStatus } from "@/types/notifications"
import { Badge, DataTable, EmptyState, Select } from "@eximia/ui"
import { Inbox } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { nudgeTypeLabel } from "./nudge-labels"
import type { HistoryTabProps } from "./types"

// --- Row shape returned by GET /api/engagement/history (E3) -----------------
// Extra optional fields (recipientName/returnedAt/actedAt) are read defensively:
// if the route is extended to return them, the UI upgrades with no change here.

interface HistoryRow {
  id: string
  recipient_id: string
  recipient_name?: string | null
  template_id: string | null
  channel: "inapp" | "email"
  origin: "nudge" | "manual" | "system"
  title: string
  body: string | null
  status: NotificationStatus
  sender_identity: "manager" | "platform"
  sender_name: string | null
  context: { nudge_type?: string; [k: string]: unknown } | null
  created_at: string
  sent_at: string | null
  read_at: string | null
  returned_at?: string | null
  acted_at?: string | null
}

type StatusFilter = "" | NotificationStatus
type OriginFilter = "" | "nudge" | "manual" | "system"
// Channel filter (E12 item 2): the route DEFAULTS to in-app so the Histórico
// total matches the "Mensagens enviadas" summary card (which counts in-app only).
// "all" is the explicit opt-in to every channel; the UI mirrors this so the
// selected label never contradicts what the table shows.
type ChannelFilter = "inapp" | "email" | "all"

// Map the 4 real DB statuses to human labels (report Seção 13). "Falhou"/
// "Dispensado" are NOT statuses of `notifications` (documented in the story) —
// we derive UI labels only from the real values.
function statusLabel(row: HistoryRow): { label: string; variant: "default" | "success" | "info" } {
  switch (row.status) {
    case "queued":
      return { label: "Aguardando", variant: "default" }
    case "sent":
      // sent + read_at set is effectively "Lido"; sent alone is "Não lido".
      return row.read_at
        ? { label: "Lido", variant: "success" }
        : { label: "Não lido", variant: "info" }
    case "read":
      return { label: "Lido", variant: "success" }
    case "acted":
      return { label: "Lido", variant: "success" }
    default:
      return { label: row.status, variant: "default" }
  }
}

// Resultado (AC5): "Acessou depois da mensagem" when returned_at is present;
// otherwise "Sem resposta" once enough time has passed since sent_at.
const RESULT_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000 // 3d, conservative "no response" window
function resultLabel(row: HistoryRow): string {
  if (row.returned_at) return "Acessou depois da mensagem"
  const sentMs = row.sent_at ? new Date(row.sent_at).getTime() : null
  if (sentMs != null && Date.now() - sentMs > RESULT_THRESHOLD_MS) return "Sem resposta"
  return "—"
}

// "Tipo de ação" / "Motivo": derive from context.nudge_type when present,
// else fall back to the notification origin. Never shows a raw enum unlabelled.
function motivoLabel(row: HistoryRow): string {
  if (row.context?.nudge_type) return nudgeTypeLabel(row.context.nudge_type)
  if (row.origin === "nudge") return "Ação de engajamento"
  if (row.origin === "manual") return "Mensagem manual"
  return "Sistema"
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function HistoryTab({ context, focusedStudentId }: HistoryTabProps) {
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Server-side filters (route-supported query params).
  const [origin, setOrigin] = useState<OriginFilter>("")
  // Default to in-app so the initial Histórico total agrees with the "Mensagens
  // enviadas" card (E12 item 2). The user can widen to "all" or narrow to email.
  const [channel, setChannel] = useState<ChannelFilter>("inapp")
  const [status, setStatus] = useState<StatusFilter>("")
  const [from, setFrom] = useState<string>("")
  const [to, setTo] = useState<string>("")

  // Client-side free-text search (over recipient ref + title/message).
  const [search, setSearch] = useState<string>("")

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams()
      if (focusedStudentId) params.set("student", focusedStudentId)
      if (origin) params.set("origin", origin)
      if (channel) params.set("channel", channel)
      if (status) params.set("status", status)
      if (from) params.set("from", new Date(from).toISOString())
      if (to) params.set("to", new Date(`${to}T23:59:59`).toISOString())
      const res = await fetch(`/api/engagement/history?${params.toString()}`)
      if (!res.ok) throw new Error("history failed")
      const data = (await res.json()) as { notifications: HistoryRow[] }
      setRows(data.notifications ?? [])
    } catch {
      setError(true)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [focusedStudentId, origin, channel, status, from, to])

  useEffect(() => {
    void fetchHistory()
  }, [fetchHistory])

  // Client-side "Aluno" free-text search over the recipient reference + message.
  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const who = (r.recipient_name ?? r.recipient_id).toLowerCase()
      return who.includes(q) || r.title.toLowerCase().includes(q)
    })
  }, [rows, search])

  const columns = useMemo(
    () => [
      {
        key: "recipient",
        header: "Destinatário",
        render: (r: HistoryRow) => (
          <span className="text-text-primary">
            {r.recipient_name ?? `Aluno ${r.recipient_id.slice(0, 8)}`}
          </span>
        ),
      },
      {
        key: "motivo",
        header: "Motivo",
        render: (r: HistoryRow) => <span className="text-text-secondary">{motivoLabel(r)}</span>,
      },
      {
        key: "message",
        header: "Mensagem",
        render: (r: HistoryRow) => (
          <span className="block max-w-[16rem] truncate text-text-secondary" title={r.title}>
            {r.title}
          </span>
        ),
      },
      {
        key: "origin",
        header: "Origem",
        render: (r: HistoryRow) => (
          <span className="text-text-secondary">
            {r.sender_identity === "manager"
              ? `Gestor${r.sender_name ? ` (${r.sender_name})` : ""}`
              : "Plataforma"}
          </span>
        ),
      },
      {
        key: "channel",
        header: "Canal",
        render: (r: HistoryRow) => (
          <span className="text-text-secondary">{r.channel === "inapp" ? "In-app" : "Email"}</span>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (r: HistoryRow) => {
          const s = statusLabel(r)
          return (
            <Badge variant={s.variant} badgeSize="sm">
              {s.label}
            </Badge>
          )
        },
      },
      {
        key: "date",
        header: "Data",
        render: (r: HistoryRow) => (
          <span className="whitespace-nowrap text-text-muted">{fmtDate(r.created_at)}</span>
        ),
      },
      {
        key: "result",
        header: "Resultado",
        render: (r: HistoryRow) => <span className="text-text-secondary">{resultLabel(r)}</span>,
      },
    ],
    [],
  )

  // Efficacy base (AC5): always with explicit base (enviadas N, retornaram M) —
  // never a naked %. Only rows with a sent_at count as "enviadas".
  const efficacy = useMemo(() => {
    const enviadas = rows.filter((r) => r.sent_at != null).length
    const retornaram = rows.filter((r) => r.returned_at != null).length
    return { enviadas, retornaram }
  }, [rows])

  const filterSlot = (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        selectSize="sm"
        aria-label="Origem"
        value={origin}
        onChange={(e) => setOrigin(e.target.value as OriginFilter)}
      >
        <option value="">Todas as origens</option>
        <option value="nudge">Engajamento</option>
        <option value="manual">Manual</option>
        <option value="system">Sistema</option>
      </Select>
      <Select
        selectSize="sm"
        aria-label="Canal"
        value={channel}
        onChange={(e) => setChannel(e.target.value as ChannelFilter)}
      >
        <option value="inapp">In-app</option>
        <option value="email">Email</option>
        <option value="all">Todos os canais</option>
      </Select>
      <Select
        selectSize="sm"
        aria-label="Status"
        value={status}
        onChange={(e) => setStatus(e.target.value as StatusFilter)}
      >
        <option value="">Todos os status</option>
        <option value="queued">Aguardando</option>
        <option value="sent">Não lido</option>
        <option value="read">Lido</option>
        <option value="acted">Lido (com ação)</option>
      </Select>
      <input
        type="date"
        aria-label="Data inicial"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className="h-9 rounded-xl bg-bg-card px-3 text-xs text-text-primary shadow-card"
      />
      <input
        type="date"
        aria-label="Data final"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className="h-9 rounded-xl bg-bg-card px-3 text-xs text-text-primary shadow-card"
      />
    </div>
  )

  // Empty state (Seção 15) — only when there is genuinely nothing (no filters
  // hiding rows), so the copy matches "nada enviado para este recorte ainda".
  const noData = !loading && !error && rows.length === 0

  if (noData) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Histórico do recorte atual{context.recorteLabel ? `: ${context.recorteLabel}` : ""}.
        </p>
        <EmptyState
          className="rounded-2xl bg-bg-card shadow-card"
          icon={<Inbox size={28} />}
          title="Nenhuma comunicação enviada para este recorte ainda."
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          Histórico do recorte atual{context.recorteLabel ? `: ${context.recorteLabel}` : ""}.
        </p>
        {/* Efficacy always carries its base (kill list Seção 16: nunca % solto). */}
        {efficacy.enviadas > 0 && (
          <Badge variant="info" badgeSize="sm">
            {efficacy.retornaram} de {efficacy.enviadas} enviadas retornaram
          </Badge>
        )}
      </div>

      {error ? (
        <EmptyState
          className="rounded-2xl bg-bg-card shadow-card"
          icon={<Inbox size={28} />}
          title="Não foi possível carregar o histórico"
          description="Tente novamente em instantes."
          actionLabel="Recarregar"
          onAction={() => void fetchHistory()}
        />
      ) : (
        <div className="rounded-2xl bg-bg-card p-5 shadow-card">
          <DataTable<HistoryRow>
            columns={columns}
            data={visibleRows}
            rowKey={(r) => r.id}
            loading={loading}
            searchPlaceholder="Buscar por aluno…"
            searchValue={search}
            onSearchChange={setSearch}
            filterSlot={filterSlot}
            emptyMessage="Nenhuma comunicação corresponde aos filtros."
          />
        </div>
      )}
    </div>
  )
}
