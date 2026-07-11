// ---------------------------------------------------------------------------
// Engagement Engine — Campaigns (E14/E15/E16)
// ---------------------------------------------------------------------------
// A campaign is the HEADER + lifecycle of a manager dispatch batch (E13 §2.3).
// The individual messages live in `notifications` (linked by campaign_id), re-
// scoped exactly as today; this module owns ONLY the header row and the loop-
// closing reads/state transitions:
//
//   • createCampaign()   — insert one `campaigns` row (service client), stamped
//     tenant_id + created_by. The BEFORE INSERT trigger derives window_end from
//     return_window_days (default 7 — D2). Returns the created row (E15 AC6).
//   • campaignResult()    — SELECT * FROM campaign_result(:id): recipients / read
//     / returned / rate, aggregated over the campaign's notifications using the
//     EXACT efficacy criterion (returned_at over origin=nudge/channel=inapp/
//     sent_at set). The SQL function re-asserts the caller's authority internally
//     (fail-closed), but we ALSO gate at the app layer (see E16 route). (E16 AC1/AC2)
//   • autoCloseExpiredCampaigns() — the cron step that flips open→closed for every
//     campaign whose window_end has passed (closed_reason='auto'). Additive to the
//     efficacy cron; NEVER touches the returned_at carimbo. (E16 AC5)
//   • closeCampaignManually() — the manager "encerrar agora" button: open→closed
//     with closed_reason='manual', closed_by. Idempotent + re-scoped by the route
//     (E16 AC6).
//
// SECURITY: writes use the service client (RLS-bypassing), so the .eq("tenant_id")
// / .eq("id") filters + the caller-side authorisation done by the route are the
// trava. tenantId/created_by/managerId are server-trusted inputs. This module does
// NOT authorise — the /api/engagement/campaign route(s) do that before calling.
// ---------------------------------------------------------------------------

import { createServiceClient } from "@/lib/supabase/service"
import type {
  CampaignCloseReason,
  CampaignResultRow,
  CampaignRow,
  CampaignSegment,
} from "@/types/notifications"
import type { SupabaseClient } from "@supabase/supabase-js"

// Loose service-client shape (matches createServiceClient) so we can query the
// campaigns table (not in the generated Database type) without fighting generics.
// biome-ignore lint/suspicious/noExplicitAny: matches createServiceClient's loose typing
type ServiceClient = SupabaseClient<any, "public", any>

/** D2 default measurement window (mirrors campaigns.return_window_days default). */
export const DEFAULT_RETURN_WINDOW_DAYS = 7

export interface CreateCampaignParams {
  tenantId: string
  createdBy: string // owning manager (server-trusted; the authenticated caller)
  segment: CampaignSegment
  focusNode?: string | null
  name?: string | null
  returnWindowDays?: number // default 7 (D2)
}

/**
 * Inserts one `campaigns` header row and returns it. The DB trigger derives
 * window_end (created_at + return_window_days) — we do NOT compute it here so the
 * DB stays the single source of truth for the deadline. Throws on insert failure
 * so the caller can abort the dispatch (E15 AC6: header before messages).
 */
export async function createCampaign(
  params: CreateCampaignParams,
  dbOverride?: ServiceClient,
): Promise<CampaignRow> {
  const { tenantId, createdBy, segment, focusNode, name, returnWindowDays } = params
  const db = dbOverride ?? (createServiceClient() as ServiceClient)

  const insert: Record<string, unknown> = {
    tenant_id: tenantId,
    created_by: createdBy,
    segment,
    focus_node: focusNode ?? null,
    name: name ?? null,
  }
  // Only set the window when explicitly overridden; otherwise let the column
  // default (7) + trigger derive window_end, keeping the DB authoritative.
  if (typeof returnWindowDays === "number") insert.return_window_days = returnWindowDays

  const { data, error } = await db.from("campaigns").insert(insert).select("*").single()
  if (error || !data) {
    throw new Error(`Failed to create campaign: ${error?.message ?? "no row returned"}`)
  }
  return data as CampaignRow
}

/**
 * Loop-closing aggregation for a campaign (E16 AC1/AC2): "N of M recipients
 * returned". Delegates to the `campaign_result(uuid)` SQL function, which uses
 * the EXACT efficacy criterion (returned_at over origin=nudge/channel=inapp/
 * sent_at set) — no new behaviour query. Returns null when the campaign is unknown
 * or the caller may not see it (the function fails-closed to zero rows; we map
 * that to null so the route can 404).
 *
 * The route MUST have already resolved the caller's scope; this function reads via
 * the service client but the SQL function itself re-asserts authority when called
 * with an authenticated client. In our product path the route does the app-layer
 * scope check before calling (see E16 route), so we call with the service client
 * and pass the caller identity through the route's own gate.
 */
export async function campaignResult(
  campaignId: string,
  dbOverride?: ServiceClient,
): Promise<CampaignResultRow | null> {
  const db = dbOverride ?? (createServiceClient() as ServiceClient)
  const { data, error } = await db.rpc("campaign_result", { p_campaign_id: campaignId })
  if (error) {
    throw new Error(`Failed to read campaign result: ${error.message}`)
  }
  const rows = (data ?? []) as CampaignResultRow[]
  return rows.length > 0 ? rows[0] : null
}

/**
 * Reads a single campaign header (service client). Used by the route to check the
 * caller's ownership/tenant BEFORE returning a result or closing it (the app-layer
 * scope gate that complements the DB RLS). Returns null when not found.
 */
export async function getCampaignById(
  campaignId: string,
  dbOverride?: ServiceClient,
): Promise<CampaignRow | null> {
  const db = dbOverride ?? (createServiceClient() as ServiceClient)
  const { data, error } = await db.from("campaigns").select("*").eq("id", campaignId).single()
  if (error || !data) return null
  return data as CampaignRow
}

export interface AutoCloseResult {
  closed: number
}

/**
 * Cron step (E16 AC5): flips every OPEN campaign whose window_end has passed to
 * closed (closed_reason='auto'). Idempotent — the .eq("status","open") predicate
 * means a second run touches nothing already closed. NEVER touches returned_at
 * (that carimbo stays in efficacy.ts, unchanged). Global by design (all tenants),
 * like the efficacy cron; each UPDATE is keyed by the row's own predicate.
 */
export async function autoCloseExpiredCampaigns(
  dbOverride?: ServiceClient,
  now: Date = new Date(),
): Promise<AutoCloseResult> {
  const db = dbOverride ?? (createServiceClient() as ServiceClient)
  const nowIso = now.toISOString()
  const { data, error } = await db
    .from("campaigns")
    .update({ status: "closed", closed_at: nowIso, closed_reason: "auto" as CampaignCloseReason })
    .eq("status", "open")
    .lt("window_end", nowIso)
    .select("id")
  if (error) {
    throw new Error(`Failed to auto-close campaigns: ${error.message}`)
  }
  return { closed: Array.isArray(data) ? data.length : 0 }
}

/**
 * Manual close (E16 AC6): the manager "encerrar campanha agora" button. Sets
 * open→closed with closed_reason='manual' + closed_by. Idempotent (re-asserts
 * status='open' in the predicate so closing an already-closed campaign is a no-op
 * that returns the current row). Tenant + ownership are re-asserted here as
 * belt-and-braces even though the route already gated the caller.
 *
 * Returns the resulting row (already-closed → the existing row), or null when the
 * campaign is not found within the tenant.
 */
export async function closeCampaignManually(
  params: { campaignId: string; tenantId: string; managerId: string },
  dbOverride?: ServiceClient,
): Promise<CampaignRow | null> {
  const { campaignId, tenantId, managerId } = params
  const db = dbOverride ?? (createServiceClient() as ServiceClient)
  const nowIso = new Date().toISOString()

  const { data: updated } = await db
    .from("campaigns")
    .update({
      status: "closed",
      closed_at: nowIso,
      closed_reason: "manual" as CampaignCloseReason,
      closed_by: managerId,
    })
    .eq("id", campaignId)
    .eq("tenant_id", tenantId)
    .eq("status", "open")
    .select("*")
    .single()

  if (updated) return updated as CampaignRow

  // No open row transitioned — either already closed (idempotent no-op) or not
  // ours. Return the current row if it exists in the tenant, else null.
  return getCampaignById(campaignId, db)
}
