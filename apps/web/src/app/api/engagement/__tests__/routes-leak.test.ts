import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// E3 AC9 — non-leakage tests for the 5 /api/engagement/* routes.
// Each test drives a payload/context that tries to reach a student OUTSIDE the
// caller's scope and asserts the route returns 400/403/empty — never a dispatch
// to, or data about, a foreign student.
// ---------------------------------------------------------------------------

const mockGetAuthProfile = vi.fn()
const mockResolveTenantId = vi.fn()
const mockResolveEngagementScope = vi.fn()
const mockResolveAudienceScoped = vi.fn()
const mockDispatchTeamNudge = vi.fn()
const mockGenerateNudgeSuggestions = vi.fn()
const mockServiceFrom = vi.fn()

vi.mock("@/lib/auth", () => ({
  getAuthProfile: () => mockGetAuthProfile(),
  resolveTenantId: (t: string | null) => mockResolveTenantId(t),
}))
vi.mock("@/lib/notifications/engagement-scope", () => ({
  resolveEngagementScope: (...a: unknown[]) => mockResolveEngagementScope(...a),
}))
vi.mock("@/lib/notifications/audiences", () => ({
  resolveAudienceScoped: (...a: unknown[]) => mockResolveAudienceScoped(...a),
}))
vi.mock("@/lib/notifications/engine", () => ({
  dispatchTeamNudge: (...a: unknown[]) => mockDispatchTeamNudge(...a),
  generateNudgeSuggestions: (...a: unknown[]) => mockGenerateNudgeSuggestions(...a),
}))
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: (t: string) => mockServiceFrom(t) }),
}))

import { POST as actionPOST } from "../action/route"
import { POST as campaignPOST } from "../campaign/route"
import { GET as historyGET } from "../history/route"
import { GET as overviewGET } from "../overview/route"

const TENANT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const MANAGER = "11111111-1111-1111-1111-111111111111"
const IN_SCOPE = "22222222-2222-2222-2222-222222222222"
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
  return new Request("http://localhost/api/engagement/x", {
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
})

// ---------------------------------------------------------------------------
// action — 403 when target is outside scope; dispatches when in scope.
// ---------------------------------------------------------------------------
describe("POST /api/engagement/action — non-leakage", () => {
  it("403 when studentId is outside the caller scope (never dispatches)", async () => {
    asManager()
    mockResolveEngagementScope.mockResolvedValue([IN_SCOPE]) // OUT_OF_SCOPE not here
    const res = await actionPOST(req({ studentId: OUT_OF_SCOPE, nudgeType: "inactive" }))
    expect(res.status).toBe(403)
    expect(mockDispatchTeamNudge).not.toHaveBeenCalled()
  })

  it("dispatches for an in-scope student, senderName is the authenticated caller", async () => {
    asManager()
    mockResolveEngagementScope.mockResolvedValue([IN_SCOPE])
    mockDispatchTeamNudge.mockResolvedValue({
      inAppCreated: 1,
      emailsSent: 0,
      emailsFailed: 0,
      recipientsSkipped: 0,
      total: 1,
    })
    const res = await actionPOST(
      req({ studentId: IN_SCOPE, nudgeType: "inactive", senderIdentity: "manager" }),
    )
    expect(res.status).toBe(200)
    expect(mockDispatchTeamNudge).toHaveBeenCalledTimes(1)
    const call = mockDispatchTeamNudge.mock.calls[0][0]
    expect(call.studentIds).toEqual([IN_SCOPE])
    expect(call.senderIdentity).toBe("manager")
    expect(call.senderName).toBe("Rinaldo") // server-trusted, not from payload
  })

  it("403 for a non-staff caller", async () => {
    mockGetAuthProfile.mockResolvedValue({
      user: { id: MANAGER },
      profile: { tenant_id: TENANT },
      roles: ["student"],
      supabase: {},
    })
    mockResolveTenantId.mockResolvedValue(TENANT)
    const res = await actionPOST(req({ studentId: IN_SCOPE, nudgeType: "inactive" }))
    expect(res.status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// campaign — confirm drops out-of-scope ids; preview uses resolveAudienceScoped.
// ---------------------------------------------------------------------------
describe("POST /api/engagement/campaign — non-leakage", () => {
  it("confirm re-scopes and drops out-of-scope ids from the reviewed list", async () => {
    asManager()
    mockResolveEngagementScope.mockResolvedValue([IN_SCOPE])
    mockDispatchTeamNudge.mockResolvedValue({
      inAppCreated: 1,
      emailsSent: 0,
      emailsFailed: 0,
      recipientsSkipped: 0,
      total: 1,
    })
    const res = await campaignPOST(
      req({ mode: "confirm", nudgeType: "inactive", studentIds: [IN_SCOPE, OUT_OF_SCOPE] }),
    )
    expect(res.status).toBe(200)
    const call = mockDispatchTeamNudge.mock.calls[0][0]
    expect(call.studentIds).toEqual([IN_SCOPE]) // OUT_OF_SCOPE dropped
    const json = await res.json()
    expect(json.recipientsSkipped).toBeGreaterThanOrEqual(1)
  })

  it("confirm returns 400 when NO reviewed id survives the scope", async () => {
    asManager()
    mockResolveEngagementScope.mockResolvedValue([IN_SCOPE])
    const res = await campaignPOST(
      req({ mode: "confirm", nudgeType: "inactive", studentIds: [OUT_OF_SCOPE] }),
    )
    expect(res.status).toBe(400)
    expect(mockDispatchTeamNudge).not.toHaveBeenCalled()
  })

  it("preview resolves recipients via the SCOPED audience resolver (no dispatch)", async () => {
    asManager()
    mockResolveAudienceScoped.mockResolvedValue([IN_SCOPE])
    const res = await campaignPOST(
      req({ mode: "preview", nudgeType: "never_accessed", criteria: { risk: "never_accessed" } }),
    )
    expect(res.status).toBe(200)
    expect(mockResolveAudienceScoped).toHaveBeenCalledTimes(1)
    expect(mockDispatchTeamNudge).not.toHaveBeenCalled()
    const json = await res.json()
    expect(json.mode).toBe("preview")
    expect(json.recipients.map((r: { id: string }) => r.id)).toEqual([IN_SCOPE])
  })
})

// ---------------------------------------------------------------------------
// history — a student filter outside scope returns empty (never leaks rows).
// ---------------------------------------------------------------------------
describe("GET /api/engagement/history — non-leakage", () => {
  it("returns empty when the student filter is outside the caller scope", async () => {
    asManager()
    mockResolveEngagementScope.mockResolvedValue([IN_SCOPE])
    const res = await historyGET(
      new Request(`http://localhost/api/engagement/history?student=${OUT_OF_SCOPE}`),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.notifications).toEqual([])
  })

  it("fail-closed: empty scope yields empty history", async () => {
    asManager()
    mockResolveEngagementScope.mockResolvedValue([])
    const res = await historyGET(new Request("http://localhost/api/engagement/history"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.notifications).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// overview — fail-closed empty scope yields zeroed cards / no suggestions.
// ---------------------------------------------------------------------------
describe("GET /api/engagement/overview — non-leakage", () => {
  it("empty scope yields zero cards and no leaked students", async () => {
    asManager()
    mockResolveEngagementScope.mockResolvedValue([])
    mockGenerateNudgeSuggestions.mockResolvedValue({ created: [], skipped: [] })
    // service reads resolve to empty via the beforeEach default stub (Promise.all
    // of users/sessions/notifications); overview filters by inScope([]) → nothing.
    mockServiceFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    })
    const res = await overviewGET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.cards.alunosEmAtencao).toBe(0)
    expect(json.cards.semAcessoRecente).toBe(0)
    expect(json.scope.tenantWide).toBe(false)
    expect(json.scope.studentCount).toBe(0)
  })
})
