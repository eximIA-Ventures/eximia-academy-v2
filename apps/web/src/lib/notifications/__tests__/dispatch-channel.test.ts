import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// Rodada 4 (E12, bug de confiança 2026-07-09) — dispatchTeamNudge channel gate
// ---------------------------------------------------------------------------
// The Campanhas wizard lets the manager choose "In-app" or "Email". Before this
// round the choice ONLY filtered the visible templates; the send ALWAYS emailed
// whenever the template supported it (all 5 seed templates do). These tests pin
// the fix: the CHOSEN channel now really governs the email mirror.
//
//   • channel omitted / "email" → email mirror rides (template supports it +
//     student has an address). Legacy behaviour, preserved byte-for-byte.
//   • channel = "inapp"         → email mirror SUPPRESSED; in-app still created.
//
// Resend is stubbed via the global fetch; a call to it is the observable proof
// an email went out. buildNotificationEmail is mocked (it reaches for tenant
// config we do not exercise here).
// ---------------------------------------------------------------------------

vi.mock("@/lib/email-template", () => ({
  buildNotificationEmail: () => "<html>email</html>",
}))

// A chainable service-client stub. Reads route by table; inserts are captured so
// we can assert which channels were written. Mirrors the loose shape the engine
// uses (from().select().eq()...).
type Row = Record<string, unknown>
let capturedNotifications: Row[] = []

function installDb(opts: {
  studentHatIds: string[]
  students: Row[]
  template: Row
}) {
  capturedNotifications = []
  return {
    from(table: string) {
      // Chainable thenable: every filter returns itself; awaiting resolves data.
      const state = { table, isInsert: false, payload: null as Row | null }
      // biome-ignore lint/suspicious/noExplicitAny: minimal chainable stub
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        neq: () => builder,
        order: () => builder,
        limit: () => builder,
        insert: (payload: Row) => {
          state.isInsert = true
          state.payload = payload
          if (table === "notifications") capturedNotifications.push(payload)
          return builder
        },
        single: () => Promise.resolve({ data: opts.template, error: null }),
        // biome-ignore lint/suspicious/noThenProperty: intentional thenable query stub (same pattern as engine.test.ts)
        then: (onFulfilled: (v: { data: unknown; error: null }) => unknown) => {
          if (state.isInsert) return Promise.resolve({ data: null, error: null }).then(onFulfilled)
          if (table === "user_roles") {
            return Promise.resolve({
              data: opts.studentHatIds.map((id) => ({ user_id: id })),
              error: null,
            }).then(onFulfilled)
          }
          if (table === "users") {
            return Promise.resolve({ data: opts.students, error: null }).then(onFulfilled)
          }
          return Promise.resolve({ data: [], error: null }).then(onFulfilled)
        },
      }
      return builder
    },
  }
}

const mockCreateServiceClient = vi.fn()
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => mockCreateServiceClient(),
}))

import { dispatchTeamNudge } from "../engine"

const TENANT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const MANAGER = "11111111-1111-1111-1111-111111111111"
const STUDENT = "22222222-2222-2222-2222-222222222222"

// An email-enabled template (like every seed template).
const EMAIL_TEMPLATE: Row = {
  id: "tmpl-1",
  key: "inactive_14d",
  name: "Retomada",
  title: "Retome seus estudos",
  body_inapp: "Volte para a plataforma.",
  email_subject: "Retome",
  email_html: "<p>Retome</p>",
  channel_email: true,
  is_active: true,
  variables: [] as string[],
}

describe("dispatchTeamNudge — channel gate (Rodada 4)", () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockCreateServiceClient.mockReturnValue(
      installDb({
        studentHatIds: [STUDENT],
        students: [{ id: STUDENT, full_name: "Marcela", email: "marcela@x.com" }],
        template: EMAIL_TEMPLATE,
      }),
    )
    fetchSpy = vi.fn().mockResolvedValue({ ok: true, text: async () => "" })
    vi.stubGlobal("fetch", fetchSpy)
    vi.stubEnv("RESEND_API_KEY", "re_test_key")
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("channel='inapp' → SUPPRESSES the email mirror (no Resend call, no email row)", async () => {
    const result = await dispatchTeamNudge({
      tenantId: TENANT,
      studentIds: [STUDENT],
      nudgeType: "inactive",
      originManagerId: MANAGER,
      channel: "inapp",
    })

    // In-app is still delivered.
    expect(result.inAppCreated).toBe(1)
    // No email went out — the fix.
    expect(result.emailsSent).toBe(0)
    expect(result.emailsFailed).toBe(0)
    expect(fetchSpy).not.toHaveBeenCalled()
    // Only the in-app notification row was written; no email mirror row.
    expect(capturedNotifications).toHaveLength(1)
    expect(capturedNotifications[0].channel).toBe("inapp")
  })

  it("channel='email' → email mirror rides (Resend called, email row written)", async () => {
    const result = await dispatchTeamNudge({
      tenantId: TENANT,
      studentIds: [STUDENT],
      nudgeType: "inactive",
      originManagerId: MANAGER,
      channel: "email",
    })

    expect(result.inAppCreated).toBe(1)
    expect(result.emailsSent).toBe(1)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    // Both the in-app row AND the email mirror row were written.
    expect(capturedNotifications).toHaveLength(2)
    expect(capturedNotifications.map((r) => r.channel).sort()).toEqual(["email", "inapp"])
  })

  it("channel OMITTED → defaults to email behaviour (legacy call-sites unchanged)", async () => {
    // api/analytics/manager/nudge and api/engagement/action call WITHOUT channel;
    // they must keep emailing exactly as before.
    const result = await dispatchTeamNudge({
      tenantId: TENANT,
      studentIds: [STUDENT],
      nudgeType: "inactive",
      originManagerId: MANAGER,
    })

    expect(result.inAppCreated).toBe(1)
    expect(result.emailsSent).toBe(1)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  // E12 Rodada 7 item 2 — independent channels. The manager can send by e-mail
  // WITHOUT the in-app inbox row: the new "email_only" state skips the in-app
  // notification and sends only the email mirror.
  it("channel='email_only' → e-mail rides, in-app inbox row is SKIPPED", async () => {
    const result = await dispatchTeamNudge({
      tenantId: TENANT,
      studentIds: [STUDENT],
      nudgeType: "inactive",
      originManagerId: MANAGER,
      channel: "email_only",
    })

    // No in-app inbox row was written.
    expect(result.inAppCreated).toBe(0)
    // The email still went out.
    expect(result.emailsSent).toBe(1)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    // Exactly one row written, and it is the EMAIL mirror (no in-app row).
    expect(capturedNotifications).toHaveLength(1)
    expect(capturedNotifications[0].channel).toBe("email")
  })
})
