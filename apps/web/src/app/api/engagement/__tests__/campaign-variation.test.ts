import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// E15 AC9 — variation-by-recipient + campaign, WITHOUT weakening the E7 trava.
// Proves:
//   (a) a studentId outside the caller scope in the `recipients` array is DROPPED
//       in confirm (never dispatched, its variation never re-enters);
//   (b) the cap of 200 rejects an over-sized `recipients` list;
//   (c) the per-aluno nudgeType derived in the segment PREVIEW matches
//       computeStudentAction (never_accessed for totalSessions===0, inactive for
//       an atrasado student) — the REAL function, not a re-implementation;
//   (d) confirm creates a campaign header and stamps campaignId into the dispatch.
// The security trava (resolveEngagementScope re-scope) is exercised for real at the
// route boundary; only the DB-hitting leaves are mocked (same style as routes-leak).
// ---------------------------------------------------------------------------

const mockGetAuthProfile = vi.fn()
const mockResolveTenantId = vi.fn()
const mockResolveEngagementScope = vi.fn()
const mockComputeEngagementTriage = vi.fn()
const mockDispatchTeamNudge = vi.fn()
const mockCreateCampaign = vi.fn()
const mockServiceFrom = vi.fn()

vi.mock("@/lib/auth", () => ({
  getAuthProfile: () => mockGetAuthProfile(),
  resolveTenantId: (t: string | null) => mockResolveTenantId(t),
}))
vi.mock("@/lib/notifications/engagement-scope", () => ({
  resolveEngagementScope: (...a: unknown[]) => mockResolveEngagementScope(...a),
  readFocusParam: (request: Request) => {
    const raw = new URL(request.url).searchParams.get("focus")
    return raw && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)
      ? raw
      : null
  },
}))
vi.mock("@/lib/notifications/engagement-triage", () => ({
  computeEngagementTriage: (...a: unknown[]) => mockComputeEngagementTriage(...a),
}))
vi.mock("@/lib/notifications/engine", async () => {
  const actual = await vi.importActual<typeof import("@/lib/notifications/engine")>(
    "@/lib/notifications/engine",
  )
  return {
    ...actual,
    dispatchTeamNudge: (...a: unknown[]) => mockDispatchTeamNudge(...a),
  }
})
vi.mock("@/lib/notifications/campaigns", () => ({
  createCampaign: (...a: unknown[]) => mockCreateCampaign(...a),
}))
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: (t: string) => mockServiceFrom(t) }),
}))

import { computeStudentAction } from "@/lib/student-triage"
import { POST as campaignPOST } from "../campaign/route"

const TENANT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const MANAGER = "11111111-1111-1111-1111-111111111111"
const IN_SCOPE = "22222222-2222-2222-2222-222222222222"
const IN_SCOPE_2 = "33333333-3333-3333-3333-333333333333"
const OUT_OF_SCOPE = "99999999-9999-9999-9999-999999999999"

function asManager() {
  mockGetAuthProfile.mockResolvedValue({
    user: { id: MANAGER },
    profile: { tenant_id: TENANT, full_name: "Rinaldo" },
    roles: ["manager"],
    supabase: {},
  })
  mockResolveTenantId.mockResolvedValue(TENANT)
}

function req(body: unknown): Request {
  return new Request("http://localhost/api/engagement/campaign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockServiceFrom.mockReturnValue({
    select: () => ({
      eq: () => ({ in: () => Promise.resolve({ data: [], error: null }) }),
    }),
  })
  mockCreateCampaign.mockResolvedValue({
    id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    tenant_id: TENANT,
    created_by: MANAGER,
    segment: "atencao",
    window_end: "2026-07-15T12:00:00Z",
    status: "open",
  })
  mockDispatchTeamNudge.mockResolvedValue({
    inAppCreated: 1,
    emailsSent: 0,
    emailsFailed: 0,
    emailRowsFailed: 0,
    recipientsSkipped: 0,
    total: 1,
  })
})

describe("E15 AC4 — confirm re-scope with recipients[] variation (a)", () => {
  it("drops an out-of-scope studentId from the recipients array (never dispatched)", async () => {
    asManager()
    mockResolveEngagementScope.mockResolvedValue([IN_SCOPE, IN_SCOPE_2]) // OUT_OF_SCOPE absent
    const res = await campaignPOST(
      req({
        mode: "confirm",
        segment: "atencao",
        recipients: [
          { studentId: IN_SCOPE, message: "oi in-scope" },
          { studentId: OUT_OF_SCOPE, message: "vazamento" },
        ],
      }),
    )
    expect(res.status).toBe(200)
    // A campaign header was created before dispatch (AC6).
    expect(mockCreateCampaign).toHaveBeenCalledTimes(1)
    const call = mockDispatchTeamNudge.mock.calls[0][0]
    // Only the in-scope id survives, and its variation carries the per-line text.
    expect(call.studentIds).toEqual([IN_SCOPE])
    expect(call.recipients.map((r: { studentId: string }) => r.studentId)).toEqual([IN_SCOPE])
    const inScopeVar = call.recipients.find((r: { studentId: string }) => r.studentId === IN_SCOPE)
    expect(inScopeVar.message).toBe("oi in-scope")
    // The out-of-scope line never reaches the dispatch.
    expect(call.recipients.some((r: { studentId: string }) => r.studentId === OUT_OF_SCOPE)).toBe(
      false,
    )
    // The campaign id is stamped on the dispatch (AC6).
    expect(call.campaignId).toBe("cccccccc-cccc-cccc-cccc-cccccccccccc")
    const json = await res.json()
    expect(json.campaignId).toBe("cccccccc-cccc-cccc-cccc-cccccccccccc")
  })

  it("confirm 400 when NO recipient survives the scope (never dispatches, no campaign)", async () => {
    asManager()
    mockResolveEngagementScope.mockResolvedValue([IN_SCOPE])
    const res = await campaignPOST(
      req({ mode: "confirm", segment: "atencao", recipients: [{ studentId: OUT_OF_SCOPE }] }),
    )
    expect(res.status).toBe(400)
    expect(mockDispatchTeamNudge).not.toHaveBeenCalled()
    // The header is created only AFTER the scope check passes — no orphan header.
    expect(mockCreateCampaign).not.toHaveBeenCalled()
  })
})

describe("E15 AC5 — cap of 200 on the recipients array (b)", () => {
  it("rejects a recipients list over 200 before any dispatch/campaign", async () => {
    asManager()
    const recipients = Array.from({ length: 201 }, (_, i) => ({
      studentId: `44444444-4444-4444-4444-${String(i).padStart(12, "0")}`,
    }))
    const res = await campaignPOST(req({ mode: "confirm", segment: "atencao", recipients }))
    expect(res.status).toBe(400)
    expect(mockDispatchTeamNudge).not.toHaveBeenCalled()
    expect(mockCreateCampaign).not.toHaveBeenCalled()
  })
})

describe("E15 AC2 — segment preview derives per-aluno nudgeType via computeStudentAction (c)", () => {
  it("never_accessed for totalSessions===0, inactive for an atrasado student", async () => {
    asManager()
    mockResolveEngagementScope.mockResolvedValue([IN_SCOPE, IN_SCOPE_2])
    // IN_SCOPE: atencao + 0 sessions → computeStudentAction ⇒ never_accessed.
    // IN_SCOPE_2: atencao + 4 sessions (atrasado) → inactive.
    mockComputeEngagementTriage.mockResolvedValue({
      summary: {},
      triagemByStudent: new Map([
        [IN_SCOPE, "atencao"],
        [IN_SCOPE_2, "atencao"],
      ]),
      sessionCountByStudent: new Map([
        [IN_SCOPE, 0],
        [IN_SCOPE_2, 4],
      ]),
    })
    // The route reads users (names) + templates (bodies). Stub both.
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: () => ({
            eq: () => ({
              in: () =>
                Promise.resolve({
                  data: [
                    { id: IN_SCOPE, full_name: "Venilton", email: "v@x.co" },
                    { id: IN_SCOPE_2, full_name: "Artur", email: "a@x.co" },
                  ],
                  error: null,
                }),
            }),
          }),
        }
      }
      if (table === "notification_templates") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: () =>
                  Promise.resolve({
                    data: [
                      {
                        key: "never_accessed",
                        body_inapp: "Olá {{primeiro_nome}}, comece agora",
                        variables: ["primeiro_nome"],
                      },
                      {
                        key: "inactive_14d",
                        body_inapp: "Olá {{primeiro_nome}}, retome",
                        variables: ["primeiro_nome"],
                      },
                    ],
                    error: null,
                  }),
              }),
            }),
          }),
        }
      }
      return {
        select: () => ({ eq: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }),
      }
    })

    const res = await campaignPOST(req({ mode: "preview", segment: "atencao" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.segment).toBe("atencao")
    const byId = new Map(
      json.recipients.map((r: { id: string; nudgeType: string; renderedText: string }) => [
        r.id,
        r,
      ]),
    )
    // The derivation matches the REAL computeStudentAction (single source of truth).
    expect((byId.get(IN_SCOPE) as { nudgeType: string }).nudgeType).toBe(
      (computeStudentAction("atencao", 0) as { nudgeType: string }).nudgeType,
    )
    expect((byId.get(IN_SCOPE) as { nudgeType: string }).nudgeType).toBe("never_accessed")
    expect((byId.get(IN_SCOPE_2) as { nudgeType: string }).nudgeType).toBe("inactive")
    // Text was pre-rendered with the recipient's first name.
    expect((byId.get(IN_SCOPE) as { renderedText: string }).renderedText).toContain("Venilton")
    expect((byId.get(IN_SCOPE_2) as { renderedText: string }).renderedText).toContain("Artur")
  })

  it("rejects an unknown segment (400)", async () => {
    asManager()
    const res = await campaignPOST(req({ mode: "preview", segment: "not_a_segment" }))
    expect(res.status).toBe(400)
  })
})
