import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// E16 AC8 — loop-closing read + encerramento, scoped.
//   (a) the aggregation (campaign_result) returns the counts the SQL function
//       produces; the route maps them (recipients/read/returned/notReturned).
//   (b) the result read is SCOPED: a campaign of another owner/tenant → 404.
//   (c) manual close is SCOPED: a foreign campaign_id → 404, never closes it.
//   (d) auto-close only touches OPEN campaigns with window_end < now (idempotent).
// The DB (campaign_result RPC, campaigns table) is mocked at the service-client
// leaf; the route's own scope gate runs for real.
// ---------------------------------------------------------------------------

const mockGetAuthProfile = vi.fn()
const mockResolveTenantId = vi.fn()
const mockGetCampaignById = vi.fn()
const mockCampaignResult = vi.fn()
const mockCloseCampaignManually = vi.fn()

vi.mock("@/lib/auth", () => ({
  getAuthProfile: () => mockGetAuthProfile(),
  resolveTenantId: (t: string | null) => mockResolveTenantId(t),
}))
vi.mock("@/lib/notifications/campaigns", () => ({
  getCampaignById: (...a: unknown[]) => mockGetCampaignById(...a),
  campaignResult: (...a: unknown[]) => mockCampaignResult(...a),
  closeCampaignManually: (...a: unknown[]) => mockCloseCampaignManually(...a),
}))

import { PATCH as closePATCH, GET as resultGET } from "../campaign/[id]/route"

const TENANT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const OTHER_TENANT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const RINALDO = "11111111-1111-1111-1111-111111111111"
const OTHER_MANAGER = "22222222-2222-2222-2222-222222222222"
const CAMPAIGN = "cccccccc-cccc-cccc-cccc-cccccccccccc"

function asManager(id = RINALDO, tenant = TENANT) {
  mockGetAuthProfile.mockResolvedValue({
    user: { id },
    profile: { tenant_id: tenant, full_name: "Rinaldo" },
    roles: ["manager"],
    supabase: {},
  })
  mockResolveTenantId.mockResolvedValue(tenant)
}

function ctx() {
  return { params: Promise.resolve({ id: CAMPAIGN }) }
}

function ownedByRinaldo(overrides: Record<string, unknown> = {}) {
  return {
    id: CAMPAIGN,
    tenant_id: TENANT,
    created_by: RINALDO,
    segment: "atencao",
    return_window_days: 7,
    window_end: "2026-07-15T12:00:00Z",
    status: "open",
    closed_at: null,
    closed_by: null,
    closed_reason: null,
    created_at: "2026-07-08T12:00:00Z",
    updated_at: "2026-07-08T12:00:00Z",
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("E16 AC1/AC2 — result aggregation (a)", () => {
  it("maps recipients/read/returned + derives notReturned from the SQL result", async () => {
    asManager()
    mockGetCampaignById.mockResolvedValue(ownedByRinaldo())
    mockCampaignResult.mockResolvedValue({
      campaign_id: CAMPAIGN,
      status: "open",
      window_end: "2026-07-15T12:00:00Z",
      recipients: 12,
      read_count: 5,
      returned_count: 7,
      return_rate: 0.5833,
    })
    const res = await resultGET(new Request("http://localhost/x"), ctx())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.result.recipients).toBe(12) // M — the base, always explicit
    expect(json.result.returnedCount).toBe(7) // N
    expect(json.result.notReturned).toBe(5)
    expect(json.result.returnRate).toBe(0.5833)
  })

  it("state='closed' once the window has passed even before the cron flips status", async () => {
    asManager()
    mockGetCampaignById.mockResolvedValue(
      ownedByRinaldo({ status: "open", window_end: "2000-01-01T00:00:00Z" }),
    )
    mockCampaignResult.mockResolvedValue({
      campaign_id: CAMPAIGN,
      status: "open",
      window_end: "2000-01-01T00:00:00Z",
      recipients: 3,
      read_count: 1,
      returned_count: 2,
      return_rate: 0.6667,
    })
    const res = await resultGET(new Request("http://localhost/x"), ctx())
    const json = await res.json()
    expect(json.state).toBe("closed")
  })
})

describe("E16 AC1 — result read is scoped (b)", () => {
  it("404 for a campaign owned by another manager (never leaks counts)", async () => {
    asManager(RINALDO)
    mockGetCampaignById.mockResolvedValue(ownedByRinaldo({ created_by: OTHER_MANAGER }))
    const res = await resultGET(new Request("http://localhost/x"), ctx())
    expect(res.status).toBe(404)
    // The aggregation is never even computed for a foreign campaign.
    expect(mockCampaignResult).not.toHaveBeenCalled()
  })

  it("404 for a campaign of another tenant", async () => {
    asManager(RINALDO, TENANT)
    mockGetCampaignById.mockResolvedValue(ownedByRinaldo({ tenant_id: OTHER_TENANT }))
    const res = await resultGET(new Request("http://localhost/x"), ctx())
    expect(res.status).toBe(404)
  })

  it("404 when the campaign does not exist", async () => {
    asManager()
    mockGetCampaignById.mockResolvedValue(null)
    const res = await resultGET(new Request("http://localhost/x"), ctx())
    expect(res.status).toBe(404)
  })
})

describe("E16 AC6 — manual close is scoped (c)", () => {
  it("404 for a foreign campaign (never closes it)", async () => {
    asManager(RINALDO)
    mockGetCampaignById.mockResolvedValue(ownedByRinaldo({ created_by: OTHER_MANAGER }))
    const res = await closePATCH(
      new Request("http://localhost/x", {
        method: "PATCH",
        body: JSON.stringify({ status: "closed" }),
      }),
      ctx(),
    )
    expect(res.status).toBe(404)
    expect(mockCloseCampaignManually).not.toHaveBeenCalled()
  })

  it("closes an owned campaign (200) and echoes the closed state", async () => {
    asManager(RINALDO)
    mockGetCampaignById.mockResolvedValue(ownedByRinaldo())
    mockCloseCampaignManually.mockResolvedValue(
      ownedByRinaldo({
        status: "closed",
        closed_at: "2026-07-10T12:00:00Z",
        closed_reason: "manual",
        closed_by: RINALDO,
      }),
    )
    const res = await closePATCH(
      new Request("http://localhost/x", {
        method: "PATCH",
        body: JSON.stringify({ status: "closed" }),
      }),
      ctx(),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.campaign.status).toBe("closed")
    expect(json.campaign.closedReason).toBe("manual")
    expect(mockCloseCampaignManually).toHaveBeenCalledWith({
      campaignId: CAMPAIGN,
      tenantId: TENANT,
      managerId: RINALDO,
    })
  })

  it("400 for a body that is not { status: 'closed' }", async () => {
    asManager()
    const res = await closePATCH(
      new Request("http://localhost/x", {
        method: "PATCH",
        body: JSON.stringify({ status: "open" }),
      }),
      ctx(),
    )
    expect(res.status).toBe(400)
  })
})
