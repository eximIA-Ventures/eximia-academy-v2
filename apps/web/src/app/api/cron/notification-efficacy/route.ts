// ---------------------------------------------------------------------------
// POST /api/cron/notification-efficacy — Engagement Engine efficacy job
// ---------------------------------------------------------------------------
// Marks notifications.returned_at on nudge rows whose recipient had a learning
// session AFTER the nudge was sent ("did the nudge work?"). Runs as the service
// role inside markReturnedForSentNudges() (only service_role/super_admin may set
// returned_at per the migration RLS contract).
//
// SECURITY: fail-closed on CRON_SECRET, identical to /api/cron/webhook-retry.
// If CRON_SECRET is unset OR the Authorization header does not match, the route
// returns 401 and does NO work. The job itself takes no client input.
// ---------------------------------------------------------------------------

import { autoCloseExpiredCampaigns } from "@/lib/notifications/campaigns"
import { markReturnedForSentNudges } from "@/lib/notifications/efficacy"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  // Verify cron secret to prevent unauthorized access (fail-closed).
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Step 1 (UNCHANGED): stamp returned_at on nudge rows whose recipient returned.
  const result = await markReturnedForSentNudges()

  // Step 2 (E16 AC5, ADDITIVE): auto-close campaigns whose measurement window has
  // passed (open → closed, closed_reason='auto'). This is a SEPARATE step that does
  // NOT touch the returned_at carimbo above — it only flips the campaign header's
  // lifecycle. Idempotent (only touches status='open' with window_end < now).
  const campaignClose = await autoCloseExpiredCampaigns()

  return NextResponse.json({ ...result, campaignsClosed: campaignClose.closed })
}
