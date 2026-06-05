// ---------------------------------------------------------------------------
// Engagement Engine — student in-app inbox (data layer)
// ---------------------------------------------------------------------------
// The `notifications` rows with channel='inapp' ARE the student inbox. This
// module is the *only* place the student reads/updates their own notifications.
//
// SECURITY CONTRACT (mirrors migration 20260604120000_engagement_engine.sql):
//   • Every query is run through the auth-scoped Supabase client, so RLS does the
//     real enforcement (notifications_select / notifications_update_recipient).
//   • We ALSO scope every query in app code to recipient_id = auth.uid() and
//     channel = 'inapp' as defence-in-depth, and to advance ONLY read/acted
//     state (read_at / acted_at + status). Students never write title/body/etc.
//   • No tenant_id or recipient_id is ever taken from the client — the recipient
//     is always the authenticated user (auth.getUser()).
//   • No PII of third parties is returned: rows are filtered to the caller's own.
//
// This file is server-only (it imports the cookie-bound Supabase client). It is
// NOT a "use server" module — the thin server-action wrappers live in
// `inbox-actions.ts`, which re-export these for client components.
// ---------------------------------------------------------------------------

import { createClient } from "@/lib/supabase/server"
import type { Notification, NotificationRow } from "@/types/notifications"

// Columns selected for the inbox. Kept explicit so we never leak unexpected
// columns and so the row->domain mapper stays in sync.
const INBOX_COLUMNS =
  "id, tenant_id, recipient_id, template_id, channel, origin, title, body, cta_url, context, status, created_at, sent_at, read_at, acted_at, returned_at"

const INAPP: NotificationRow["channel"] = "inapp"

/** Unread = not yet opened and not yet acted on (matches idx_notifications_unread). */
const UNREAD_STATUSES: NotificationRow["status"][] = ["queued", "sent"]

export interface ListMyNotificationsOptions {
  /** Max rows to return (default 50, hard cap 100). */
  limit?: number
  /** When true, only rows the student has not yet read/acted on. */
  unreadOnly?: boolean
}

export interface InboxResult {
  notifications: Notification[]
  unreadCount: number
}

// ---------------------------------------------------------------------------
// Row -> domain mapping
// ---------------------------------------------------------------------------

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    recipientId: row.recipient_id,
    templateId: row.template_id,
    channel: row.channel,
    origin: row.origin,
    title: row.title,
    body: row.body,
    ctaUrl: row.cta_url,
    context: row.context ?? {},
    status: row.status,
    createdAt: row.created_at,
    sentAt: row.sent_at,
    readAt: row.read_at,
    actedAt: row.acted_at,
    returnedAt: row.returned_at,
  }
}

/** Resolve the authenticated user id, or null if unauthenticated. */
async function currentUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Lists the authenticated student's in-app notifications, most recent first.
 * Returns an empty list (never throws) when unauthenticated. RLS guarantees
 * only the caller's own rows are visible; we add the recipient/channel filters
 * as belt-and-braces.
 */
export async function listMyNotifications(
  options: ListMyNotificationsOptions = {},
): Promise<Notification[]> {
  const supabase = await createClient()
  const userId = await currentUserId(supabase)
  if (!userId) return []

  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100)

  let query = supabase
    .from("notifications")
    .select(INBOX_COLUMNS)
    .eq("recipient_id", userId)
    .eq("channel", INAPP)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (options.unreadOnly) {
    query = query.in("status", UNREAD_STATUSES)
  }

  const { data, error } = await query
  if (error) {
    console.error("[inbox] listMyNotifications error:", error.message)
    return []
  }

  return (data as NotificationRow[] | null)?.map(toNotification) ?? []
}

/**
 * Count of unread in-app notifications for the authenticated student. Cheap,
 * head-only count — backs the header bell badge. Returns 0 when unauthenticated.
 */
export async function unreadCount(): Promise<number> {
  const supabase = await createClient()
  const userId = await currentUserId(supabase)
  if (!userId) return 0

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .eq("channel", INAPP)
    .in("status", UNREAD_STATUSES)

  if (error) {
    console.error("[inbox] unreadCount error:", error.message)
    return 0
  }
  return count ?? 0
}

/**
 * Convenience for the inbox page: the list plus the live unread count in one
 * call (two round-trips, but a single entry point for the page server component).
 */
export async function getInbox(options: ListMyNotificationsOptions = {}): Promise<InboxResult> {
  const [notifications, count] = await Promise.all([listMyNotifications(options), unreadCount()])
  return { notifications, unreadCount: count }
}

// ---------------------------------------------------------------------------
// Writes (advance read/acted state only — students never edit content)
// ---------------------------------------------------------------------------

export interface MarkResult {
  ok: boolean
  /** The updated notification when the write succeeded. */
  notification?: Notification
  error?: string
}

/**
 * Marks a single in-app notification as read (sets read_at + advances status to
 * 'read' unless it has already been acted on). The update is scoped to the
 * caller's own row; RLS rejects any attempt against another recipient's row, and
 * we never advance status backwards (an 'acted' row stays 'acted').
 */
export async function markRead(notificationId: string): Promise<MarkResult> {
  const supabase = await createClient()
  const userId = await currentUserId(supabase)
  if (!userId) return { ok: false, error: "unauthenticated" }

  // Fetch first so we (a) confirm ownership in app code and (b) avoid clobbering
  // an already-acted row's status. RLS already restricts visibility to own rows.
  const { data: existing, error: readErr } = await supabase
    .from("notifications")
    .select(INBOX_COLUMNS)
    .eq("id", notificationId)
    .eq("recipient_id", userId)
    .eq("channel", INAPP)
    .maybeSingle()

  if (readErr) {
    console.error("[inbox] markRead lookup error:", readErr.message)
    return { ok: false, error: "lookup_failed" }
  }
  if (!existing) return { ok: false, error: "not_found" }

  const row = existing as NotificationRow

  // Already read or acted — idempotent no-op (still return current state).
  if (row.read_at && (row.status === "read" || row.status === "acted")) {
    return { ok: true, notification: toNotification(row) }
  }

  const nextStatus: NotificationRow["status"] = row.status === "acted" ? "acted" : "read"

  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: row.read_at ?? new Date().toISOString(), status: nextStatus })
    .eq("id", notificationId)
    .eq("recipient_id", userId)
    .eq("channel", INAPP)
    .select(INBOX_COLUMNS)
    .single()

  if (error) {
    console.error("[inbox] markRead update error:", error.message)
    return { ok: false, error: "update_failed" }
  }
  return { ok: true, notification: toNotification(data as NotificationRow) }
}

/**
 * Marks a single in-app notification as acted (CTA clicked): sets acted_at and
 * status='acted', and backfills read_at if the student acted without an explicit
 * open. Ownership-scoped; RLS rejects cross-recipient writes.
 */
export async function markActed(notificationId: string): Promise<MarkResult> {
  const supabase = await createClient()
  const userId = await currentUserId(supabase)
  if (!userId) return { ok: false, error: "unauthenticated" }

  const { data: existing, error: readErr } = await supabase
    .from("notifications")
    .select(INBOX_COLUMNS)
    .eq("id", notificationId)
    .eq("recipient_id", userId)
    .eq("channel", INAPP)
    .maybeSingle()

  if (readErr) {
    console.error("[inbox] markActed lookup error:", readErr.message)
    return { ok: false, error: "lookup_failed" }
  }
  if (!existing) return { ok: false, error: "not_found" }

  const row = existing as NotificationRow
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from("notifications")
    .update({
      acted_at: row.acted_at ?? now,
      read_at: row.read_at ?? now,
      status: "acted",
    })
    .eq("id", notificationId)
    .eq("recipient_id", userId)
    .eq("channel", INAPP)
    .select(INBOX_COLUMNS)
    .single()

  if (error) {
    console.error("[inbox] markActed update error:", error.message)
    return { ok: false, error: "update_failed" }
  }
  return { ok: true, notification: toNotification(data as NotificationRow) }
}

/**
 * Marks every unread in-app notification for the caller as read. Used by the
 * "mark all as read" affordance on the inbox / bell dropdown. Returns the number
 * of rows updated.
 */
export async function markAllRead(): Promise<{ ok: boolean; updated: number; error?: string }> {
  const supabase = await createClient()
  const userId = await currentUserId(supabase)
  if (!userId) return { ok: false, updated: 0, error: "unauthenticated" }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: now, status: "read" })
    .eq("recipient_id", userId)
    .eq("channel", INAPP)
    .in("status", UNREAD_STATUSES)
    .select("id")

  if (error) {
    console.error("[inbox] markAllRead error:", error.message)
    return { ok: false, updated: 0, error: "update_failed" }
  }
  return { ok: true, updated: data?.length ?? 0 }
}
