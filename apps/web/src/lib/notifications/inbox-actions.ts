"use server"

// ---------------------------------------------------------------------------
// Engagement Engine — student in-app inbox (server actions)
// ---------------------------------------------------------------------------
// Thin "use server" wrappers over `inbox.ts` so client components (the header
// bell, the inbox page) can call them directly. All authorization lives in
// inbox.ts + RLS — these wrappers only add cache revalidation.
//
// The bell badge and inbox list live under /notifications; we revalidate that
// path after any state change so the server-rendered count/list refresh.
// ---------------------------------------------------------------------------

import type { Notification } from "@/types/notifications"
import { revalidatePath } from "next/cache"
import {
  type InboxResult,
  type ListMyNotificationsOptions,
  type MarkResult,
  getInbox,
  listMyNotifications,
  markActed as markActedCore,
  markAllRead as markAllReadCore,
  markRead as markReadCore,
  unreadCount,
} from "./inbox"

// A rota real da caixa de entrada do aluno é /notificacoes (PT). O caminho
// anterior ("/notifications") não existia como page, então o revalidatePath era
// no-op e o estado SSR (badge do sino) podia ficar stale após marcar como lida.
const INBOX_PATH = "/notificacoes"

/** List the caller's in-app notifications (most recent first). */
export async function listMyNotificationsAction(
  options?: ListMyNotificationsOptions,
): Promise<Notification[]> {
  return listMyNotifications(options)
}

/** Live unread count for the header bell badge. */
export async function getUnreadCountAction(): Promise<number> {
  return unreadCount()
}

/** List + unread count in one call (inbox page bootstrap / client refresh). */
export async function getInboxAction(options?: ListMyNotificationsOptions): Promise<InboxResult> {
  return getInbox(options)
}

/** Mark one notification read (sets read_at; advances status). */
export async function markReadAction(notificationId: string): Promise<MarkResult> {
  const result = await markReadCore(notificationId)
  if (result.ok) revalidatePath(INBOX_PATH)
  return result
}

/** Mark one notification acted (CTA clicked: sets acted_at, backfills read_at). */
export async function markActedAction(notificationId: string): Promise<MarkResult> {
  const result = await markActedCore(notificationId)
  if (result.ok) revalidatePath(INBOX_PATH)
  return result
}

/** Mark every unread notification as read. Returns count updated. */
export async function markAllReadAction(): Promise<{
  ok: boolean
  updated: number
  error?: string
}> {
  const result = await markAllReadCore()
  if (result.ok && result.updated > 0) revalidatePath(INBOX_PATH)
  return result
}
