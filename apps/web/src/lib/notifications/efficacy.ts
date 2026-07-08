// ---------------------------------------------------------------------------
// Engagement Engine — Efficacy (BACKEND-3)
// ---------------------------------------------------------------------------
// "Did the nudge work?" The Engagement Engine measures efficacy per recipient:
// a nudge `notifications` row is considered to have WORKED when the student had
// a learning session AFTER the nudge was sent. That signal is stored in
// notifications.returned_at.
//
// This module owns:
//   • markReturnedForSentNudges() — the job that scans nudge notifications with
//     returned_at IS NULL and sent_at set, and stamps returned_at when a
//     sessions row exists for the recipient with created_at > sent_at.
//   • nudgeEfficacyByType() — a metrics helper returning the return-rate per
//     nudge type (origin=nudge), for dashboards.
//
// SECURITY (lição da sessão):
//   • Runs ONLY as the service role. Per the migration RLS contract, ONLY
//     service_role (and super_admin) may set returned_at, so this MUST use the
//     service client. The cron route gates entry with CRON_SECRET (fail-closed),
//     exactly like the existing webhook-retry cron.
//   • All work is partitioned per (recipient_id), and every read/update is
//     keyed by ids that come from the DB itself — nothing is taken from a client.
//     There is no tenant input: the job is global by design (it processes every
//     tenant's pending nudges) but each update only ever touches the matching
//     notification row by its primary key.
//
// PERF: the candidate scan uses idx_notifications_efficacy (partial index on
// sent_at WHERE returned_at IS NULL AND sent_at IS NOT NULL), then sessions are
// fetched once per recipient batch. Bounded by MAX_CANDIDATES per run so a cron
// tick stays cheap and idempotent (re-running only picks up the still-pending).
// ---------------------------------------------------------------------------

import { createServiceClient } from "@/lib/supabase/service"
import type { SupabaseClient } from "@supabase/supabase-js"

// Loose service-client shape (matches createServiceClient).
// biome-ignore lint/suspicious/noExplicitAny: matches createServiceClient's loose typing
type ServiceClient = SupabaseClient<any, "public", any>

/** Max nudge notifications evaluated per run (FinOps guardrail; idempotent). */
const MAX_CANDIDATES = 5000
/** PostgREST per-request row cap. */
const PAGE_SIZE = 1000
/**
 * Upper bound on sessions drained per recipient when checking for a return.
 * High enough to never drop a qualifying (later) session in practice;
 * fetchAllRows additionally stops after 100 pages, so this is a safety cap.
 */
const MAX_SESSIONS_PER_RECIPIENT = 100_000

/** Result of one efficacy run. */
export interface EfficacyRunResult {
  /** Nudge notifications scanned (returned_at IS NULL, sent_at set). */
  scanned: number
  /** Rows newly stamped with returned_at (the student returned after the nudge). */
  marked: number
}

interface CandidateRow {
  id: string
  recipient_id: string
  sent_at: string
}

async function fetchAllRows<T>(
  // biome-ignore lint/suspicious/noExplicitAny: PostgREST builder is loosely typed
  buildPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  maxRows: number,
): Promise<T[]> {
  const all: T[] = []
  let from = 0
  for (let page = 0; page < 100; page++) {
    const to = Math.min(from + PAGE_SIZE - 1, maxRows - 1)
    if (to < from) break
    const { data, error } = await buildPage(from, to)
    if (error || !data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE_SIZE || all.length >= maxRows) break
    from += PAGE_SIZE
  }
  return all.slice(0, maxRows)
}

/**
 * Scans pending nudge notifications and marks returned_at for any whose
 * recipient had a learning session AFTER the nudge's sent_at.
 *
 * Candidate set: notifications WHERE origin = 'nudge' AND returned_at IS NULL
 * AND sent_at IS NOT NULL (sent_at "há >0" — strictly in the past, which any
 * stored sent_at is). For each candidate, returned_at is set to now() when at
 * least one sessions row exists for recipient_id with created_at > sent_at.
 *
 * Idempotent: already-stamped rows are excluded by the returned_at IS NULL
 * predicate, so re-running only processes the still-pending remainder.
 *
 * MUST run as the service role (only service_role/super_admin may set
 * returned_at per the RLS contract).
 *
 * @param dbOverride Optional service client (tests); defaults to createServiceClient().
 */
export async function markReturnedForSentNudges(
  dbOverride?: ServiceClient,
): Promise<EfficacyRunResult> {
  const db = dbOverride ?? (createServiceClient() as ServiceClient)
  const nowIso = new Date().toISOString()

  // 1. Pull pending nudge candidates (oldest sent first), bounded.
  const candidates = await fetchAllRows<CandidateRow>(
    (from, to) =>
      db
        .from("notifications")
        .select("id, recipient_id, sent_at")
        .eq("origin", "nudge")
        .eq("channel", "inapp")
        .is("returned_at", null)
        .not("sent_at", "is", null)
        .order("sent_at", { ascending: true })
        .range(from, to),
    MAX_CANDIDATES,
  )

  if (candidates.length === 0) return { scanned: 0, marked: 0 }

  // 2. For each recipient, find their EARLIEST session timestamp on/after the
  //    earliest pending sent_at — one query per recipient keeps it simple and
  //    correct (a recipient may have several pending nudges at different times).
  //    We fetch each recipient's sessions once (>= the recipient's earliest
  //    pending sent_at) and compare in memory.
  const byRecipient = new Map<string, CandidateRow[]>()
  for (const c of candidates) {
    const list = byRecipient.get(c.recipient_id) ?? []
    list.push(c)
    byRecipient.set(c.recipient_id, list)
  }

  const idsToMark: string[] = []

  for (const [recipientId, rows] of byRecipient) {
    // Earliest pending nudge for this recipient — only sessions after this can
    // ever satisfy any of their pending nudges, so scope the read to it.
    const earliestSentMs = Math.min(...rows.map((r) => new Date(r.sent_at).getTime()))
    const earliestSentIso = new Date(earliestSentMs).toISOString()

    // Drain ALL sessions strictly after the recipient's earliest pending nudge.
    // A previous cap of PAGE_SIZE (1000), combined with the ascending order,
    // could drop the qualifying (later) session for a recipient with >1000
    // sessions after earliestSentIso — silently losing a returned_at stamp.
    // The read is already tightly scoped (student_id + created_at > earliestSentIso),
    // so we paginate fully. MAX_SESSIONS_PER_RECIPIENT bounds the worst case
    // (fetchAllRows also stops after 100 pages = 100k rows).
    const sessions = await fetchAllRows<{ created_at: string }>(
      (from, to) =>
        db
          .from("sessions")
          .select("created_at")
          .eq("student_id", recipientId)
          .gt("created_at", earliestSentIso)
          .order("created_at", { ascending: true })
          .range(from, to),
      MAX_SESSIONS_PER_RECIPIENT,
    )
    if (sessions.length === 0) continue

    const sessionTimes = sessions.map((s) => new Date(s.created_at).getTime())
    for (const row of rows) {
      const sentMs = new Date(row.sent_at).getTime()
      // The student "returned" if ANY session happened strictly after this nudge.
      if (sessionTimes.some((t) => t > sentMs)) idsToMark.push(row.id)
    }
  }

  if (idsToMark.length === 0) return { scanned: candidates.length, marked: 0 }

  // 3. Stamp returned_at in batches (keyed by primary key; re-asserts the
  //    returned_at IS NULL predicate to stay idempotent under concurrency).
  let marked = 0
  for (let i = 0; i < idsToMark.length; i += PAGE_SIZE) {
    const batch = idsToMark.slice(i, i + PAGE_SIZE)
    const { data, error } = await db
      .from("notifications")
      .update({ returned_at: nowIso })
      .in("id", batch)
      .is("returned_at", null)
      .select("id")
    if (!error && Array.isArray(data)) marked += data.length
  }

  return { scanned: candidates.length, marked }
}

// ---------------------------------------------------------------------------
// Metrics — return rate per nudge type (for the efficacy dashboard).
// ---------------------------------------------------------------------------

/** Efficacy figures for one nudge template type. */
export interface NudgeEfficacyByType {
  /** notification_templates.key the nudge used (null when none). */
  templateKey: string | null
  /** Nudge notifications sent (sent_at IS NOT NULL) for this key. */
  sent: number
  /** Of those, how many have returned_at set (student returned after the nudge). */
  returned: number
  /** returned ÷ sent as 0–100 (0 when sent === 0). */
  returnRatePct: number
}

interface MetricRow {
  template_id: string | null
  sent_at: string | null
  returned_at: string | null
}

/**
 * Computes the return rate per nudge template key for a tenant. Joins
 * origin='nudge' notifications to their template key (via template_id) so the
 * dashboard can show "inactive_14d: 42% returned". Tenant-scoped.
 *
 * Caller MUST be auth'd + role-gated (admin/manager) before calling — this
 * helper does not authorize; it only aggregates. Uses the service client so it
 * can read across all recipients' rows within the tenant.
 *
 * E3 (Engagement Center v2) — SCOPE: when `allowedStudentIds` is a non-null
 * array, only notifications whose `recipient_id` is IN that set are aggregated,
 * so a manager's efficacy figures NEVER count sends to students outside their
 * reach. `null`/`undefined` preserves the tenant-wide behaviour (admin). An empty
 * array yields zero metrics (fail-closed). The recipient filter is applied as an
 * extra `.in("recipient_id", chunk)` predicate; large scopes are chunked to stay
 * under the PostgREST URL cap, then merged.
 *
 * @param tenantId  Tenant to scope to (caller-resolved, server-trusted).
 * @param dbOverride Optional service client (tests).
 * @param allowedStudentIds Optional caller-scope filter (E3).
 */
export async function nudgeEfficacyByType(
  tenantId: string,
  dbOverride?: ServiceClient,
  allowedStudentIds?: string[] | null,
): Promise<NudgeEfficacyByType[]> {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!tenantId || !UUID_RE.test(tenantId)) return []
  const db = dbOverride ?? (createServiceClient() as ServiceClient)

  // Caller-scope (E3): a non-null scope restricts recipients; [] = fail-closed.
  if (allowedStudentIds != null && allowedStudentIds.length === 0) return []
  // Chunk the recipient filter so a large scope never blows the URL length cap.
  const RECIPIENT_CHUNK = 200
  const scopeChunks: (string[] | null)[] =
    allowedStudentIds == null
      ? [null] // tenant-wide, single pass
      : Array.from({ length: Math.ceil(allowedStudentIds.length / RECIPIENT_CHUNK) }, (_, i) =>
          allowedStudentIds.slice(i * RECIPIENT_CHUNK, (i + 1) * RECIPIENT_CHUNK),
        )

  const rows: MetricRow[] = []
  for (const chunk of scopeChunks) {
    const chunkRows = await fetchAllRows<MetricRow>((from, to) => {
      let q = db
        .from("notifications")
        .select("template_id, sent_at, returned_at")
        .eq("tenant_id", tenantId)
        .eq("origin", "nudge")
        .eq("channel", "inapp")
        .not("sent_at", "is", null)
      if (chunk != null) q = q.in("recipient_id", chunk)
      return q.range(from, to)
    }, 50_000)
    rows.push(...chunkRows)
  }
  if (rows.length === 0) return []

  // Map template_id → key (one lookup; templates are tenant-scoped).
  const templateIds = [...new Set(rows.map((r) => r.template_id).filter((t): t is string => !!t))]
  const keyById = new Map<string, string>()
  if (templateIds.length > 0) {
    const templates = await fetchAllRows<{ id: string; key: string }>(
      (from, to) =>
        db
          .from("notification_templates")
          .select("id, key")
          .eq("tenant_id", tenantId)
          .in("id", templateIds)
          .range(from, to),
      templateIds.length,
    )
    for (const t of templates) keyById.set(t.id, t.key)
  }

  // Aggregate by template key (null key bucketed under "" → reported as null).
  const agg = new Map<string, { sent: number; returned: number }>()
  for (const r of rows) {
    const key = r.template_id ? (keyById.get(r.template_id) ?? "") : ""
    const entry = agg.get(key) ?? { sent: 0, returned: 0 }
    entry.sent += 1
    if (r.returned_at) entry.returned += 1
    agg.set(key, entry)
  }

  return [...agg.entries()]
    .map(([key, { sent, returned }]) => ({
      templateKey: key === "" ? null : key,
      sent,
      returned,
      returnRatePct: sent > 0 ? Math.round((returned / sent) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.sent - a.sent)
}
