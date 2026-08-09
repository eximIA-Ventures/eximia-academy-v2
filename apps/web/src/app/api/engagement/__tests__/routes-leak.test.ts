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
const mockCreateCampaign = vi.fn()
const mockServiceFrom = vi.fn()

vi.mock("@/lib/auth", () => ({
  getAuthProfile: () => mockGetAuthProfile(),
  resolveTenantId: (t: string | null) => mockResolveTenantId(t),
}))
vi.mock("@/lib/notifications/engagement-scope", () => ({
  resolveEngagementScope: (...a: unknown[]) => mockResolveEngagementScope(...a),
  // Rodada 3: routes now read `?focus=` via this helper. Faithful pure copy — a
  // valid UUID passes through, anything else → null (matches the real impl). The
  // leak tests don't pass a focus, so this resolves to null and is inert here.
  readFocusParam: (request: Request) => {
    const raw = new URL(request.url).searchParams.get("focus")
    return raw && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)
      ? raw
      : null
  },
}))
vi.mock("@/lib/notifications/audiences", () => ({
  resolveAudienceScoped: (...a: unknown[]) => mockResolveAudienceScoped(...a),
}))
vi.mock("@/lib/notifications/engine", async () => {
  // Keep the real NUDGE_TYPE_TEMPLATE_KEY / render helpers the route imports, but
  // stub the two DB-hitting exports so the leak tests stay behaviour-level.
  const actual = await vi.importActual<typeof import("@/lib/notifications/engine")>(
    "@/lib/notifications/engine",
  )
  return {
    ...actual,
    dispatchTeamNudge: (...a: unknown[]) => mockDispatchTeamNudge(...a),
    generateNudgeSuggestions: (...a: unknown[]) => mockGenerateNudgeSuggestions(...a),
  }
})
vi.mock("@/lib/notifications/campaigns", () => ({
  createCampaign: (...a: unknown[]) => mockCreateCampaign(...a),
}))
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: (t: string) => mockServiceFrom(t) }),
}))

import { POST as actionPOST } from "../action/route"
import { POST as campaignPOST } from "../campaign/route"
import { GET as historyGET } from "../history/route"
import { GET as overviewGET } from "../overview/route"
import { PATCH as templatePATCH } from "../templates/[id]/route"
import { GET as templatesGET } from "../templates/route"

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
  // A campaign confirm creates the header before dispatch (E15 AC6). Default it to
  // a valid row so the existing E7 confirm tests reach dispatch; the header itself
  // is not what these leak tests assert (they assert the re-scope of recipients).
  mockCreateCampaign.mockResolvedValue({
    id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    tenant_id: TENANT,
    created_by: MANAGER,
    segment: "atencao",
    window_end: "2026-07-15T12:00:00Z",
    status: "open",
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
// E12 Rodada 6 — action route: light bulk send (item 5) + channel (item 4).
// ---------------------------------------------------------------------------
// item 5: the Central de Envios can send the SAME message to a FEW manually-chosen
// students in one call via `studentIds[]`. This REUSES the same dispatch engine as
// a single send (no campaign header), and the SAME re-scope trava must drop any
// out-of-scope id from the bulk set — never leak. item 4: the chosen `channel` is
// propagated to the engine so an explicit "In-app" truly suppresses the email.
describe("POST /api/engagement/action — bulk (item 5) + channel (item 4)", () => {
  const IN_SCOPE_2 = "33333333-3333-3333-3333-333333333333"

  it("bulk studentIds[] dispatch to the SURVIVING in-scope set (drops out-of-scope, no leak)", async () => {
    asManager()
    // Only IN_SCOPE + IN_SCOPE_2 are reachable; OUT_OF_SCOPE is submitted but must
    // be dropped before any dispatch.
    mockResolveEngagementScope.mockResolvedValue([IN_SCOPE, IN_SCOPE_2])
    mockDispatchTeamNudge.mockResolvedValue({
      inAppCreated: 2,
      emailsSent: 0,
      emailsFailed: 0,
      recipientsSkipped: 0,
      total: 2,
    })
    const res = await actionPOST(
      req({
        studentIds: [IN_SCOPE, IN_SCOPE_2, OUT_OF_SCOPE],
        nudgeType: "custom",
        message: "Mesma mensagem para todos.",
      }),
    )
    expect(res.status).toBe(200)
    expect(mockDispatchTeamNudge).toHaveBeenCalledTimes(1)
    const call = mockDispatchTeamNudge.mock.calls[0][0]
    // The OUT_OF_SCOPE id never reached the engine.
    expect(call.studentIds.sort()).toEqual([IN_SCOPE, IN_SCOPE_2].sort())
    expect(call.studentIds).not.toContain(OUT_OF_SCOPE)
  })

  it("403 when the WHOLE bulk set is out of scope (never dispatches)", async () => {
    asManager()
    mockResolveEngagementScope.mockResolvedValue([IN_SCOPE]) // neither submitted id
    const res = await actionPOST(
      req({ studentIds: [OUT_OF_SCOPE, IN_SCOPE_2], nudgeType: "custom", message: "x" }),
    )
    expect(res.status).toBe(403)
    expect(mockDispatchTeamNudge).not.toHaveBeenCalled()
  })

  it("propagates the chosen channel to the engine (item 4)", async () => {
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
      req({ studentId: IN_SCOPE, nudgeType: "inactive", channel: "inapp" }),
    )
    expect(res.status).toBe(200)
    expect(mockDispatchTeamNudge.mock.calls[0][0].channel).toBe("inapp")
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

  it("400 on an unknown `type` filter (never handed raw to the DB)", async () => {
    asManager()
    mockResolveEngagementScope.mockResolvedValue([IN_SCOPE])
    const res = await historyGET(
      new Request("http://localhost/api/engagement/history?type=not_a_real_type"),
    )
    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// history — contract fields (E3 patch): recipient_name, returned_at, acted_at,
// and the enrichment MUST NOT leak a name for a student outside scope.
// ---------------------------------------------------------------------------
describe("GET /api/engagement/history — contract fields + enrichment scope", () => {
  // A configurable notifications-read + users-lookup stub. `notifRows` is what the
  // scoped notifications read returns; `usersRows` is what the `users` lookup
  // returns. The users stub records which ids were requested so we can assert the
  // enrichment only ever queries in-scope recipient ids.
  function stubHistoryReads(opts: {
    notifRows: Record<string, unknown>[]
    usersRows: Array<{ id: string; full_name: string | null; email: string | null }>
    onUsersIn?: (ids: string[]) => void
  }) {
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === "notifications") {
        // The route builds: select().eq().in().[eq()...].order().limit() → thenable.
        const builder: Record<string, unknown> = {}
        for (const m of ["select", "eq", "in", "gte", "lte", "order"]) {
          builder[m] = () => builder
        }
        builder.limit = () => Promise.resolve({ data: opts.notifRows, error: null })
        return builder
      }
      if (table === "users") {
        return {
          select: () => ({
            eq: () => ({
              in: (_col: string, ids: string[]) => {
                opts.onUsersIn?.(ids)
                return Promise.resolve({ data: opts.usersRows, error: null })
              },
            }),
          }),
        }
      }
      return {
        select: () => ({ eq: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }),
      }
    })
  }

  it("attaches recipient_name/email + returned_at/acted_at from the scoped rows", async () => {
    asManager()
    mockResolveEngagementScope.mockResolvedValue([IN_SCOPE])
    stubHistoryReads({
      notifRows: [
        {
          id: "n1",
          recipient_id: IN_SCOPE,
          created_at: "2026-07-08T10:00:00Z",
          returned_at: "2026-07-08T12:00:00Z",
          acted_at: null,
        },
      ],
      usersRows: [{ id: IN_SCOPE, full_name: "Aluno Um", email: "um@x.co" }],
    })
    const res = await historyGET(new Request("http://localhost/api/engagement/history"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.notifications).toHaveLength(1)
    const row = json.notifications[0]
    expect(row.recipient_name).toBe("Aluno Um")
    expect(row.recipient_email).toBe("um@x.co")
    expect(row.returned_at).toBe("2026-07-08T12:00:00Z")
    expect(row.acted_at).toBeNull()
  })

  it("enrichment NEVER queries a recipient id outside the scoped rows", async () => {
    asManager()
    mockResolveEngagementScope.mockResolvedValue([IN_SCOPE])
    let queriedIds: string[] = []
    // The notifications read is already scope-bound, so it can only ever return
    // IN_SCOPE rows. Even if a foreign user row were returned by `users`, the
    // enrichment must only ask for ids that appeared in the (scoped) notif rows.
    stubHistoryReads({
      notifRows: [{ id: "n1", recipient_id: IN_SCOPE, created_at: "2026-07-08T10:00:00Z" }],
      usersRows: [
        { id: IN_SCOPE, full_name: "Aluno Um", email: "um@x.co" },
        // A poisoned extra row the DB should never have returned — proves that even
        // if `users` over-returns, the map is keyed by the recipient_id present in
        // the scoped rows, so the foreign name never reaches a scoped notification.
        { id: OUT_OF_SCOPE, full_name: "Aluno Fora", email: "fora@x.co" },
      ],
      onUsersIn: (ids) => {
        queriedIds = ids
      },
    })
    const res = await historyGET(new Request("http://localhost/api/engagement/history"))
    expect(res.status).toBe(200)
    const json = await res.json()
    // The lookup was bounded to the in-scope recipient id only.
    expect(queriedIds).toEqual([IN_SCOPE])
    // No returned notification carries the out-of-scope student's name.
    for (const row of json.notifications) {
      expect(row.recipient_id).not.toBe(OUT_OF_SCOPE)
      expect(row.recipient_name).not.toBe("Aluno Fora")
    }
  })
})

// ---------------------------------------------------------------------------
// overview — fail-closed empty scope yields zeroed cards / no suggestions.
// ---------------------------------------------------------------------------
describe("GET /api/engagement/overview — non-leakage", () => {
  it("empty scope yields zero canonical cards and no leaked students", async () => {
    asManager()
    mockResolveEngagementScope.mockResolvedValue([])
    mockGenerateNudgeSuggestions.mockResolvedValue({ created: [], skipped: [] })
    // E12 Rodada 5: with an empty scope, computeEngagementTriage returns EARLY
    // (fail-closed) without touching the DB, and the only service read left is the
    // `notifications` count (select().eq().eq()). The default stub covers it.
    mockServiceFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    })
    const res = await overviewGET(new Request("http://localhost/api/engagement/overview"))
    expect(res.status).toBe(200)
    const json = await res.json()
    // Canonical triage cards (item 1): all zero for an empty recorte.
    expect(json.cards.analisados).toBe(0)
    expect(json.cards.noRitmo).toBe(0)
    expect(json.cards.semAcesso).toBe(0)
    expect(json.cards.atencao).toBe(0)
    expect(json.cards.mensagensEnviadas).toBe(0)
    expect(json.scope.tenantWide).toBe(false)
    expect(json.scope.studentCount).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// templates — contract fields (E3 patch): GET returns ALL templates (active +
// inactive) with is_active + updated_at; PATCH accepts the is_active toggle and
// still refuses to touch the immutable `key`.
// ---------------------------------------------------------------------------
describe("GET /api/engagement/templates — all templates + fields", () => {
  it("returns active AND inactive templates with isActive + updatedAt", async () => {
    asManager()
    // No is_active filter is applied by the route → the stub returns both.
    mockServiceFrom.mockImplementation((table: string) => {
      if (table !== "notification_templates") throw new Error(`unexpected table ${table}`)
      const rows = [
        {
          id: "t1",
          key: "nudge_inactive",
          name: "Retomada",
          intent: "retomada",
          tone: "gentil",
          is_active: true,
          updated_at: "2026-07-08T09:00:00Z",
        },
        {
          id: "t2",
          key: "nudge_old",
          name: "Antigo",
          intent: "manual",
          tone: null,
          is_active: false,
          updated_at: "2026-07-01T09:00:00Z",
        },
      ]
      const builder: Record<string, unknown> = {}
      builder.select = () => builder
      builder.eq = () => builder
      // Two chained .order() calls; the last resolves the query.
      let orderCount = 0
      builder.order = () => {
        orderCount += 1
        return orderCount >= 2 ? Promise.resolve({ data: rows, error: null }) : builder
      }
      return builder
    })
    const res = await templatesGET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.templates).toHaveLength(2)
    // The inactive template survives (no is_active filter dropped it).
    const inactive = json.templates.find((t: { id: string }) => t.id === "t2")
    expect(inactive.isActive).toBe(false)
    expect(inactive.updatedAt).toBe("2026-07-01T09:00:00Z")
    const active = json.templates.find((t: { id: string }) => t.id === "t1")
    expect(active.isActive).toBe(true)
    expect(active.updatedAt).toBe("2026-07-08T09:00:00Z")
  })
})

describe("PATCH /api/engagement/templates/[id] — is_active toggle, key immutable", () => {
  const VALID_ID = "33333333-3333-3333-3333-333333333333"

  function patchReq(body: unknown): Request {
    return new Request(`http://localhost/api/engagement/templates/${VALID_ID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  }

  it("accepts is_active in the update and never accepts key", async () => {
    asManager()
    let capturedUpdate: Record<string, unknown> = {}
    mockServiceFrom.mockImplementation((table: string) => {
      if (table !== "notification_templates") throw new Error(`unexpected table ${table}`)
      return {
        update: (u: Record<string, unknown>) => {
          capturedUpdate = u
          return {
            eq: () => ({
              eq: () => ({
                select: () => ({
                  single: () =>
                    Promise.resolve({
                      data: {
                        id: VALID_ID,
                        key: "nudge_inactive",
                        name: "Retomada",
                        intent: "retomada",
                        tone: "gentil",
                        is_active: false,
                        updated_at: "2026-07-08T13:00:00Z",
                      },
                      error: null,
                    }),
                }),
              }),
            }),
          }
        },
      }
    })
    const res = await templatePATCH(
      patchReq({ is_active: false, key: "hacked_key", name: "Retomada" }),
      { params: Promise.resolve({ id: VALID_ID }) },
    )
    expect(res.status).toBe(200)
    // is_active reached the update; key was dropped (immutable).
    expect(capturedUpdate.is_active).toBe(false)
    expect(capturedUpdate.name).toBe("Retomada")
    expect(capturedUpdate).not.toHaveProperty("key")
    const json = await res.json()
    expect(json.template.is_active).toBe(false)
    expect(json.template.updated_at).toBe("2026-07-08T13:00:00Z")
  })

  it("400 when only key is provided (no editable field survives)", async () => {
    asManager()
    mockServiceFrom.mockImplementation(() => {
      throw new Error("should not reach DB when no editable field")
    })
    const res = await templatePATCH(patchReq({ key: "hacked_key" }), {
      params: Promise.resolve({ id: VALID_ID }),
    })
    expect(res.status).toBe(400)
  })
})
