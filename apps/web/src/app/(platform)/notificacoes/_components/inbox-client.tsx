"use client"

// ---------------------------------------------------------------------------
// Engagement Engine — full inbox client component
// ---------------------------------------------------------------------------
// Receives the initial inbox snapshot from the page server component and
// manages client-side mark-read / mark-acted interactions.
//
// SECURITY: all mutations go through inbox server actions (which enforce auth +
// RLS). No tenant_id or recipient_id is ever taken from the client.
// ---------------------------------------------------------------------------

import type { InboxResult } from "@/lib/notifications/inbox"
import {
  markActedAction,
  markAllReadAction,
  markReadAction,
} from "@/lib/notifications/inbox-actions"
import type { Notification } from "@/types/notifications"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Bell, CheckCheck, ExternalLink, Inbox, MailOpen, Megaphone, Zap } from "lucide-react"
import Link from "next/link"
import { startTransition, useCallback, useMemo, useState } from "react"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return ""
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ptBR })
  } catch {
    return ""
  }
}

function originIcon(origin: Notification["origin"]) {
  if (origin === "nudge") return <Zap size={13} className="text-cerrado-500" />
  if (origin === "system") return <Bell size={13} className="text-text-muted" />
  return <Megaphone size={13} className="text-blue-500" />
}

function originLabel(origin: Notification["origin"]): string {
  if (origin === "nudge") return "Nudge"
  if (origin === "system") return "Sistema"
  return "Mensagem"
}

type InboxFilter = "all" | "unread" | "read"

const FILTER_LABELS: Record<InboxFilter, string> = {
  all: "Todas",
  unread: "Não lidas",
  read: "Lidas",
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface InboxClientProps {
  initialData: InboxResult
}

export function InboxClient({ initialData }: InboxClientProps) {
  const [notifications, setNotifications] = useState<Notification[]>(initialData.notifications)
  const [unread, setUnread] = useState(initialData.unreadCount)
  const [filter, setFilter] = useState<InboxFilter>("all")
  const [pending, setPending] = useState<Set<string>>(new Set())

  // ---------------------------------------------------------------------------
  // Derived list
  // ---------------------------------------------------------------------------

  const visible = useMemo(() => {
    if (filter === "unread")
      return notifications.filter((n) => n.status === "queued" || n.status === "sent")
    if (filter === "read")
      return notifications.filter((n) => n.status === "read" || n.status === "acted")
    return notifications
  }, [notifications, filter])

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const handleMarkRead = useCallback((n: Notification) => {
    if (n.status === "read" || n.status === "acted") return
    setPending((s) => new Set(s).add(n.id))
    startTransition(() => {
      void markReadAction(n.id).then((res) => {
        setPending((s) => {
          const next = new Set(s)
          next.delete(n.id)
          return next
        })
        if (res.ok) {
          setNotifications((prev) =>
            prev.map((p) =>
              p.id === n.id ? { ...p, status: "read", readAt: new Date().toISOString() } : p,
            ),
          )
          setUnread((c) => Math.max(0, c - 1))
        }
      })
    })
  }, [])

  const handleMarkActed = useCallback((n: Notification) => {
    setPending((s) => new Set(s).add(n.id))
    startTransition(() => {
      void markActedAction(n.id).then((res) => {
        setPending((s) => {
          const next = new Set(s)
          next.delete(n.id)
          return next
        })
        if (res.ok) {
          setNotifications((prev) =>
            prev.map((p) =>
              p.id === n.id
                ? {
                    ...p,
                    status: "acted",
                    readAt: p.readAt ?? new Date().toISOString(),
                    actedAt: new Date().toISOString(),
                  }
                : p,
            ),
          )
          // only decrement if was unread
          if (n.status === "queued" || n.status === "sent") {
            setUnread((c) => Math.max(0, c - 1))
          }
        }
      })
    })
  }, [])

  const handleMarkAllRead = useCallback(() => {
    startTransition(() => {
      void markAllReadAction().then((res) => {
        if (res.ok) {
          setNotifications((prev) =>
            prev.map((n) =>
              n.status === "queued" || n.status === "sent"
                ? { ...n, status: "read", readAt: new Date().toISOString() }
                : n,
            ),
          )
          setUnread(0)
        }
      })
    })
  }, [])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Notificações</h1>
          {unread > 0 ? (
            <p className="mt-0.5 text-sm text-text-muted">
              {unread} {unread === 1 ? "não lida" : "não lidas"}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-text-muted">Tudo em dia</p>
          )}
        </div>

        {unread > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 rounded-xl bg-cerrado-600/10 px-3 py-1.5 text-xs font-semibold text-cerrado-600 transition-colors hover:bg-cerrado-600/15"
          >
            <CheckCheck size={14} />
            Marcar todas como lidas
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-xl bg-bg-elevated p-1">
        {(["all", "unread", "read"] as InboxFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${
              filter === f
                ? "bg-bg-card shadow-card text-text-primary"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-bg-card shadow-card py-16 px-6 text-center">
          {filter === "unread" ? (
            <>
              <MailOpen size={40} className="mb-4 text-text-muted/30" />
              <p className="text-base font-semibold text-text-secondary">Tudo lido</p>
              <p className="mt-1 text-sm text-text-muted">
                Nenhuma notificação não lida no momento.
              </p>
            </>
          ) : (
            <>
              <Inbox size={40} className="mb-4 text-text-muted/30" />
              <p className="text-base font-semibold text-text-secondary">Nada aqui ainda</p>
              <p className="mt-1 text-sm text-text-muted">Você não tem notificações ainda.</p>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-bg-card shadow-card overflow-hidden divide-y divide-border-subtle">
          {visible.map((n) => {
            const isUnread = n.status === "queued" || n.status === "sent"
            const isActed = n.status === "acted"
            const isPending = pending.has(n.id)

            return (
              <div
                key={n.id}
                className={`flex gap-4 px-5 py-4 transition-colors ${
                  isUnread ? "bg-cerrado-600/[0.03]" : ""
                } ${isPending ? "opacity-60" : ""}`}
              >
                {/* Origin icon + unread dot */}
                <div className="mt-0.5 flex shrink-0 flex-col items-center gap-1.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-bg-surface">
                    {originIcon(n.origin)}
                  </div>
                  {isUnread && (
                    <span className="h-1.5 w-1.5 rounded-full bg-cerrado-500" aria-hidden="true" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`text-sm leading-snug ${
                        isUnread
                          ? "font-semibold text-text-primary"
                          : "font-medium text-text-secondary"
                      } ${isActed ? "line-through opacity-60" : ""}`}
                    >
                      {n.title}
                    </p>
                    <span className="shrink-0 text-[11px] text-text-muted whitespace-nowrap">
                      {relativeTime(n.createdAt)}
                    </span>
                  </div>

                  {n.body && <p className="text-xs leading-relaxed text-text-muted">{n.body}</p>}

                  {/* Actions row */}
                  <div className="flex items-center gap-3 pt-0.5">
                    <span className="flex items-center gap-1 rounded-md bg-bg-surface px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                      {originIcon(n.origin)}
                      {originLabel(n.origin)}
                    </span>

                    {n.ctaUrl && !isActed && (
                      <Link
                        href={n.ctaUrl}
                        onClick={() => handleMarkActed(n)}
                        className="flex items-center gap-1 text-xs font-medium text-cerrado-600 hover:text-cerrado-700 transition-colors"
                      >
                        Abrir <ExternalLink size={11} />
                      </Link>
                    )}

                    {isUnread && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleMarkRead(n)}
                        className="ml-auto flex items-center gap-1 text-[11px] font-medium text-text-muted hover:text-text-secondary transition-colors disabled:pointer-events-none"
                      >
                        <MailOpen size={12} />
                        Marcar lida
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
