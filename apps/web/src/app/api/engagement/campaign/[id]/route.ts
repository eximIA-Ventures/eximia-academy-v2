// GET  /api/engagement/campaign/:id  → the loop-closing RESULT of a campaign.
// PATCH /api/engagement/campaign/:id  → manual close ({ status: "closed" }).
//
// E16 — fechamento do loop. The campaign, after dispatch, stops being a cega
// "done" screen and becomes an observable object:
//   • OPEN   (status='open', now < window_end): progress — enviadas/lidas/
//     aguardando retorno até window_end.
//   • CLOSED (status='closed' or window passed): result — N de M retornaram.
//
// The "retornaram" count uses EXACTLY the efficacy signal the cron already
// carimba (returned_at over origin=nudge/channel=inapp/sent_at) — NO new tracking
// (E13 §3). It is computed by the campaign_result() SQL function (E14 §5),
// aggregated by campaign_id.
//
// SECURITY (E16 AC1/AC6, inegociável 4): both verbs are SCOPED to the caller. A
// campaign is owned by its creating manager (campaigns.created_by); a manager may
// only read/close their OWN campaigns, an admin any campaign in the tenant, and a
// campaign of another tenant/owner returns 404 (fail-closed, no leak of the
// existence or the counts). This app-layer gate MIRRORS the DB RLS + the
// campaign_result() function's own internal authority check (defence in depth).

import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import {
  campaignResult,
  closeCampaignManually,
  getCampaignById,
} from "@/lib/notifications/campaigns"
import { hasAnyRole } from "@/lib/role-helpers"
import type { CampaignRow } from "@/types/notifications"
import { NextResponse } from "next/server"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Returns whether the caller may see/mutate a campaign header. A campaign is owned
 * by created_by; a manager only reaches their own, an admin/super_admin any in the
 * tenant. Wrong tenant → never authorised (the header must belong to the caller's
 * tenant first). Fail-closed.
 */
function callerMayReach(
  campaign: CampaignRow,
  tenantId: string,
  userId: string,
  roles: string[],
): boolean {
  if (campaign.tenant_id !== tenantId) return false
  const isAdmin = roles.includes("admin") || roles.includes("super_admin")
  if (isAdmin) return true
  if (roles.includes("manager")) return campaign.created_by === userId
  return false
}

// ---------------------------------------------------------------------------
// GET — result (aberta: progresso; encerrada: resultado congelado). AC1/AC2/AC3/AC4.
// ---------------------------------------------------------------------------
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, profile, roles } = await getAuthProfile()
  if (!user || !profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!hasAnyRole({ roles }, ["admin", "manager", "super_admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
  }
  const { id } = await ctx.params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid campaign id" }, { status: 400 })
  }

  // Gate: the header must exist and belong to the caller (fail-closed 404 else —
  // a manager never learns another team's campaign exists, nor its counts).
  const campaign = await getCampaignById(id)
  if (!campaign || !callerMayReach(campaign, tenantId, user.id, roles)) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
  }

  const result = await campaignResult(id)
  const recipients = result?.recipients ?? 0
  const readCount = result?.read_count ?? 0
  const returnedCount = result?.returned_count ?? 0
  // Base N is ALWAYS explicit (never a bare %). return_rate stays 0..1 from the DB.
  const notReturned = Math.max(0, recipients - returnedCount)

  // Encerrada when the header says closed OR the window has passed (E16 AC4). The
  // cron flips status='closed' when window_end passes; before that tick a passed
  // window still reads as "encerrando" — we compute isClosed from BOTH so the UI
  // is never stuck "aberta" past the deadline even if the cron hasn't run yet.
  const windowEnd = campaign.window_end
  const windowPassed = windowEnd != null && new Date(windowEnd).getTime() <= Date.now()
  const isClosed = campaign.status === "closed" || windowPassed

  return NextResponse.json({
    campaign: {
      id: campaign.id,
      segment: campaign.segment,
      status: campaign.status,
      windowStart: campaign.created_at,
      windowEnd: campaign.window_end,
      closedAt: campaign.closed_at,
      closedReason: campaign.closed_reason,
      returnWindowDays: campaign.return_window_days,
    },
    state: isClosed ? "closed" : "open",
    result: {
      recipients, // M — always shown as the base
      readCount,
      returnedCount, // N
      notReturned,
      returnRate: result?.return_rate ?? null, // 0..1 (null when recipients=0)
    },
  })
}

// ---------------------------------------------------------------------------
// PATCH — manual close (E16 AC6). Only { status: "closed" } is accepted. Idempotent
// (closing an already-closed campaign returns 200 with the current row), re-scoped
// (a campaign the caller may not reach → 404, never closes it).
// ---------------------------------------------------------------------------
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, profile, roles } = await getAuthProfile()
  if (!user || !profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!hasAnyRole({ roles }, ["admin", "manager", "super_admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
  }
  const { id } = await ctx.params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid campaign id" }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object" || (body as { status?: unknown }).status !== "closed") {
    return NextResponse.json({ error: 'Only { status: "closed" } is accepted' }, { status: 400 })
  }

  // Gate: fetch + authorise BEFORE mutating (fail-closed 404 for a foreign header).
  const campaign = await getCampaignById(id)
  if (!campaign || !callerMayReach(campaign, tenantId, user.id, roles)) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
  }

  const updated = await closeCampaignManually({ campaignId: id, tenantId, managerId: user.id })
  if (!updated) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
  }
  return NextResponse.json({
    campaign: {
      id: updated.id,
      status: updated.status,
      closedAt: updated.closed_at,
      closedReason: updated.closed_reason,
      closedBy: updated.closed_by,
    },
  })
}
