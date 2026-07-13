"use client"

// ---------------------------------------------------------------------------
// Engagement Engine — header notification bell (badge + quick-peek dropdown)
// ---------------------------------------------------------------------------
// • Polls /api/notifications/inbox for the unread count every 90 s.
// • On open it fetches the latest 10 notifications (full=1) to show in the
//   dropdown.  Marking all-read wipes the badge and revalidates via server
//   action.
// • Clicking "Ver todas" navigates to /notificacoes (the full inbox page).
// • NÃO toca em admin nem no next-best-action.
// ---------------------------------------------------------------------------

import {
  markActedAction,
  markAllReadAction,
  markReadAction,
} from "@/lib/notifications/inbox-actions"
import type { Notification } from "@/types/notifications"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@eximia/ui"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Bell, CheckCheck, ExternalLink, Inbox } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { startTransition, useCallback, useEffect, useRef, useState } from "react"

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

function statusDot(status: Notification["status"]): string {
  if (status === "queued" || status === "sent") return "bg-cerrado-500"
  return "bg-transparent"
}

function originLabel(origin: Notification["origin"]): string {
  if (origin === "nudge") return "Nudge"
  if (origin === "system") return "Sistema"
  return "Mensagem"
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NotificationBellProps {
  /** Initial unread count fetched server-side so the badge is visible on SSR/hydration. */
  initialUnreadCount?: number
}

const POLL_INTERVAL_MS = 90_000 // 90 s

export function NotificationBell({ initialUnreadCount = 0 }: NotificationBellProps) {
  const [unread, setUnread] = useState(initialUnreadCount)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ---------------------------------------------------------------------------
  // Poll unread count
  // ---------------------------------------------------------------------------

  const refreshCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/inbox", { cache: "no-store" })
      if (!res.ok) return
      const json = (await res.json()) as { unreadCount: number }
      setUnread(json.unreadCount)
    } catch {
      // network error — silently skip
    }
  }, [])

  useEffect(() => {
    pollRef.current = setInterval(refreshCount, POLL_INTERVAL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [refreshCount])

  // ---------------------------------------------------------------------------
  // Fetch notifications on open
  // ---------------------------------------------------------------------------

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/notifications/inbox?full=1", { cache: "no-store" })
      if (!res.ok) return
      const json = (await res.json()) as {
        unreadCount: number
        notifications: Notification[]
      }
      setUnread(json.unreadCount)
      setNotifications((json.notifications ?? []).slice(0, 10))
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      void fetchNotifications()
    }
  }, [open, fetchNotifications])

  // ---------------------------------------------------------------------------
  // Mark read on item click
  // ---------------------------------------------------------------------------

  const handleItemClick = useCallback(async (n: Notification) => {
    // Mesma condição de "não lido" usada em handleMarkAllRead.
    const isUnread = n.status === "queued" || n.status === "sent"
    // If the item has a CTA, mark acted; otherwise mark read.
    const action = n.ctaUrl ? markActedAction : markReadAction
    startTransition(() => {
      void action(n.id).then((result) => {
        // Só aplica o optimistic update se a server action confirmou (ok).
        // Com ok:false (RLS, rede, etc.) o estado local fica intocado e o
        // próximo poll/refresh reconcilia com o servidor.
        if (!result.ok) return
        setNotifications((prev) =>
          prev.map((p) =>
            p.id === n.id
              ? { ...p, status: n.ctaUrl ? "acted" : "read", readAt: new Date().toISOString() }
              : p,
          ),
        )
        // Recount locally — só decrementa se o item estava de fato não lido,
        // evitando dessincronizar o badge abaixo do valor real.
        if (isUnread) setUnread((c) => Math.max(0, c - 1))
      })
    })
  }, [])

  // ---------------------------------------------------------------------------
  // Mark all read
  // ---------------------------------------------------------------------------

  const handleMarkAllRead = useCallback(async () => {
    startTransition(() => {
      void markAllReadAction().then(() => {
        setUnread(0)
        setNotifications((prev) =>
          prev.map((n) =>
            n.status === "queued" || n.status === "sent"
              ? { ...n, status: "read", readAt: new Date().toISOString() }
              : n,
          ),
        )
      })
    })
  }, [])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const badgeCount = Math.min(unread, 99)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className="relative">
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-xl text-text-secondary transition-all hover:bg-bg-hover hover:text-text-primary"
          aria-label={unread > 0 ? `${unread} notificações não lidas` : "Notificações"}
        >
          <Bell size={18} />
          {badgeCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-cerrado-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-bg-app"
              aria-hidden="true"
            >
              {badgeCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="right-0 left-auto w-[340px] max-h-[480px] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-semibold text-text-primary">Notificações</p>
          {unread > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-[11px] font-medium text-cerrado-600 hover:text-cerrado-700 transition-colors"
              title="Marcar todas como lidas"
            >
              <CheckCheck size={13} />
              Marcar todas
            </button>
          )}
        </div>

        <DropdownMenuSeparator className="m-0" />

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-2 p-3">
              {["s1", "s2", "s3"].map((sk) => (
                <div key={sk} className="flex gap-3 rounded-lg p-2.5 animate-pulse">
                  <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-bg-elevated" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-3/4 rounded bg-bg-elevated" />
                    <div className="h-2.5 w-full rounded bg-bg-elevated" />
                    <div className="h-2 w-1/3 rounded bg-bg-elevated" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <Inbox size={28} className="mb-3 text-text-muted/40" />
              <p className="text-sm font-medium text-text-secondary">Tudo em dia</p>
              <p className="mt-0.5 text-[11px] text-text-muted">Nenhuma notificação no momento</p>
            </div>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {notifications.map((n) => {
                const isUnread = n.status === "queued" || n.status === "sent"
                return (
                  <li key={n.id}>
                    {/* biome-ignore lint/a11y/useKeyWithClickEvents: mouse + keyboard handled below */}
                    <div
                      className={`flex gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-bg-elevated/60 ${
                        isUnread ? "bg-cerrado-600/3" : ""
                      }`}
                      onClick={() => {
                        void handleItemClick(n)
                        if (n.ctaUrl) {
                          // Clicar em qualquer parte da linha realiza a ação:
                          // marca acted (handleItemClick) E navega para o CTA.
                          // Antes só o Link "Abrir" navegava, deixando o item
                          // marcado como "acted" sem a ação ter sido tomada.
                          //
                          // Navegação é INDEPENDENTE do sucesso do markActed: ir
                          // para o destino é a intenção primária do usuário e não
                          // deve ser bloqueada por uma escrita de side-effect que
                          // pode falhar (rede/RLS). Se o markActed falhar, o
                          // optimistic update é descartado (ver handleItemClick) e
                          // o próximo poll reconcilia o badge — mas a navegação
                          // ocorre normalmente.
                          setOpen(false)
                          router.push(n.ctaUrl)
                        }
                      }}
                    >
                      {/* Unread dot */}
                      <div className="mt-[5px] flex h-2 w-2 shrink-0 items-start justify-center">
                        <span
                          className={`h-2 w-2 rounded-full transition-colors ${statusDot(n.status)}`}
                          aria-hidden="true"
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-xs leading-snug ${
                              isUnread
                                ? "font-semibold text-text-primary"
                                : "font-medium text-text-secondary"
                            }`}
                          >
                            {n.title}
                          </p>
                          <span className="shrink-0 text-[10px] text-text-muted whitespace-nowrap">
                            {relativeTime(n.createdAt)}
                          </span>
                        </div>

                        {n.body && (
                          <p className="mt-0.5 text-[11px] leading-relaxed text-text-muted line-clamp-2">
                            {n.body}
                          </p>
                        )}

                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="rounded-md bg-bg-surface px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-text-muted">
                            {originLabel(n.origin)}
                          </span>
                          {n.ctaUrl && (
                            <Link
                              href={n.ctaUrl}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-0.5 text-[10px] font-medium text-cerrado-600 hover:text-cerrado-700 transition-colors"
                            >
                              Abrir <ExternalLink size={10} />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Footer — link to full inbox */}
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator className="m-0" />
            <div className="px-4 py-2.5">
              <Link
                href="/notificacoes"
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-bg-surface py-2 text-xs font-medium text-cerrado-600 transition-colors hover:bg-bg-elevated hover:text-cerrado-700"
              >
                <Inbox size={13} />
                Ver todas as notificações
              </Link>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
