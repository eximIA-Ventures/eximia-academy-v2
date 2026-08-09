import { describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// E14/E15/E16 — the campaigns write/read helpers, DB mocked at the service leaf.
//   • createCampaign inserts a header and returns it (E15 AC6).
//   • campaignResult delegates to the campaign_result() SQL function (E16 AC2).
//   • autoCloseExpiredCampaigns only touches OPEN campaigns with window_end < now
//     (E16 AC5/AC8d), idempotent, and NEVER a returned_at write.
//   • closeCampaignManually re-asserts tenant + status=open (E16 AC6).
// ---------------------------------------------------------------------------

import {
  autoCloseExpiredCampaigns,
  campaignResult,
  closeCampaignManually,
  createCampaign,
} from "../campaigns"

const TENANT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const MANAGER = "11111111-1111-1111-1111-111111111111"
const CAMPAIGN = "cccccccc-cccc-cccc-cccc-cccccccccccc"

// A minimal chainable service-client stub. Records the update/insert payload +
// the predicate columns so we can assert the auto-close / manual-close filters.
function makeDb(opts: {
  insertReturn?: unknown
  rpcReturn?: unknown
  updateReturn?: unknown
  selectReturn?: unknown
  capture?: { update?: Record<string, unknown>; eqCols?: string[]; ltCols?: string[] }
}) {
  const capture = opts.capture ?? {}
  capture.eqCols = capture.eqCols ?? []
  capture.ltCols = capture.ltCols ?? []
  return {
    // biome-ignore lint/suspicious/noExplicitAny: chainable stub
    from: (_t: string): any => {
      const builder: Record<string, unknown> = {}
      builder.insert = () => ({
        select: () => ({
          single: () => Promise.resolve({ data: opts.insertReturn ?? null, error: null }),
        }),
      })
      builder.select = () => builder
      builder.update = (u: Record<string, unknown>) => {
        capture.update = u
        return builder
      }
      builder.eq = (col: string) => {
        capture.eqCols?.push(col)
        return builder
      }
      builder.lt = (col: string) => {
        capture.ltCols?.push(col)
        return builder
      }
      builder.single = () => Promise.resolve({ data: opts.selectReturn ?? null, error: null })
      // Terminal for update().eq().lt().select() → resolves the update return.
      // biome-ignore lint/suspicious/noThenProperty: intentional thenable
      builder.then = (onF: (v: { data: unknown; error: null }) => unknown) =>
        Promise.resolve({ data: opts.updateReturn ?? [], error: null }).then(onF)
      return builder
    },
    rpc: () => Promise.resolve({ data: opts.rpcReturn ?? [], error: null }),
  }
}

describe("createCampaign (E15 AC6)", () => {
  it("inserts a header and returns the row", async () => {
    const row = { id: CAMPAIGN, tenant_id: TENANT, created_by: MANAGER, status: "open" }
    // biome-ignore lint/suspicious/noExplicitAny: test stub
    const db = makeDb({ insertReturn: row }) as any
    const out = await createCampaign(
      { tenantId: TENANT, createdBy: MANAGER, segment: "atencao" },
      db,
    )
    expect(out).toEqual(row)
  })

  it("throws when the insert returns no row", async () => {
    // biome-ignore lint/suspicious/noExplicitAny: test stub
    const db = makeDb({ insertReturn: null }) as any
    await expect(
      createCampaign({ tenantId: TENANT, createdBy: MANAGER, segment: "atencao" }, db),
    ).rejects.toThrow(/Failed to create campaign/)
  })
})

describe("campaignResult (E16 AC2)", () => {
  it("returns the first row of the campaign_result() function", async () => {
    const rpcRow = {
      campaign_id: CAMPAIGN,
      status: "open",
      window_end: "2026-07-15T12:00:00Z",
      recipients: 10,
      read_count: 4,
      returned_count: 6,
      return_rate: 0.6,
    }
    // biome-ignore lint/suspicious/noExplicitAny: test stub
    const db = makeDb({ rpcReturn: [rpcRow] }) as any
    const out = await campaignResult(CAMPAIGN, db)
    expect(out).toEqual(rpcRow)
  })

  it("returns null when the function yields no rows (unknown/foreign campaign)", async () => {
    // biome-ignore lint/suspicious/noExplicitAny: test stub
    const db = makeDb({ rpcReturn: [] }) as any
    expect(await campaignResult(CAMPAIGN, db)).toBeNull()
  })
})

describe("autoCloseExpiredCampaigns (E16 AC5/AC8d)", () => {
  it("filters status=open AND window_end < now, and reports the count closed", async () => {
    const capture: { update?: Record<string, unknown>; eqCols: string[]; ltCols: string[] } = {
      eqCols: [],
      ltCols: [],
    }
    // biome-ignore lint/suspicious/noExplicitAny: test stub
    const db = makeDb({ updateReturn: [{ id: CAMPAIGN }, { id: "d2" }], capture }) as any
    const out = await autoCloseExpiredCampaigns(db, new Date("2026-07-20T00:00:00Z"))
    expect(out.closed).toBe(2)
    // The transition sets closed_reason='auto' and only touches open+expired rows.
    expect(capture.update).toMatchObject({ status: "closed", closed_reason: "auto" })
    expect(capture.eqCols).toContain("status")
    expect(capture.ltCols).toContain("window_end")
  })
})

describe("closeCampaignManually (E16 AC6)", () => {
  it("re-asserts id + tenant + status=open and stamps closed_reason='manual'", async () => {
    const capture: { update?: Record<string, unknown>; eqCols: string[]; ltCols: string[] } = {
      eqCols: [],
      ltCols: [],
    }
    const closedRow = {
      id: CAMPAIGN,
      status: "closed",
      closed_reason: "manual",
      closed_by: MANAGER,
    }
    // biome-ignore lint/suspicious/noExplicitAny: test stub
    const db = makeDb({ selectReturn: closedRow, capture }) as any
    const out = await closeCampaignManually(
      { campaignId: CAMPAIGN, tenantId: TENANT, managerId: MANAGER },
      db,
    )
    expect(out).toEqual(closedRow)
    expect(capture.update).toMatchObject({
      status: "closed",
      closed_reason: "manual",
      closed_by: MANAGER,
    })
    // The predicate re-asserts id, tenant_id AND status (idempotent/scoped).
    expect(capture.eqCols).toEqual(expect.arrayContaining(["id", "tenant_id", "status"]))
  })
})
