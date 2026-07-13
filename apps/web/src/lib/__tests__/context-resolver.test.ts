import { beforeEach, describe, expect, it, vi } from "vitest"

// context-resolver transitively imports server-only modules (@/lib/auth pulls the
// Supabase server client; context-context pulls next/headers). We only test the PURE
// decision helpers (buildAvailable / defaultContext), so we stub those imports to keep
// the module graph free of I/O. This does not touch the functions under test.
vi.mock("@/lib/auth", () => ({ getAuthProfile: vi.fn() }))
vi.mock("@/lib/context-context", () => ({ getActiveContextCookie: vi.fn() }))

import { getAuthProfile } from "@/lib/auth"
import { getActiveContextCookie } from "@/lib/context-context"
import {
  type AvailableContext,
  buildAvailable,
  defaultContext,
  resolveContext,
} from "../context-resolver"

const types = (cs: AvailableContext[]) => cs.map((c) => c.type)

const mockedAuth = vi.mocked(getAuthProfile)
const mockedCookie = vi.mocked(getActiveContextCookie)

describe("buildAvailable — derives choosable contexts from hats + reach (E7 §4.4/§4.5)", () => {
  it("pure student (enrolled) => only [personal]", () => {
    const out = buildAvailable(["student"], /* hasSubordinates */ false, /* hasEnrollment */ true)
    expect(types(out)).toEqual(["personal"])
    expect(out[0].label).toBe("Minha Trilha")
    expect(out[0].id).toBeNull()
  })

  it("student role with no enrollment still gets [personal] (every user is a student, E1)", () => {
    const out = buildAvailable(["student"], false, false)
    expect(types(out)).toEqual(["personal"])
  })

  it("manager-student WITH subordinates => [personal, team]", () => {
    const out = buildAvailable(["student", "manager"], true, true)
    expect(types(out)).toEqual(["personal", "team"])
  })

  it("manager-student WITHOUT subordinates => team is NOT offered (recent fix: hasSubordinates gate)", () => {
    // Offering "Meu Time" by hat alone would surface an option the server denies in
    // authorizeContextAccess('team'), silently falling back to "Minha Trilha".
    const out = buildAvailable(["student", "manager"], false, true)
    expect(types(out)).toEqual(["personal"])
    expect(types(out)).not.toContain("team")
  })

  it("admin => includes organization (and personal when enrolled)", () => {
    const out = buildAvailable(["student", "admin"], false, true)
    expect(types(out)).toContain("organization")
    expect(types(out)).toContain("personal")
    expect(types(out)).not.toContain("team") // no subordinates here
  })

  it("super_admin => includes organization", () => {
    const out = buildAvailable(["super_admin"], false, false)
    expect(types(out)).toContain("organization")
  })

  it("admin WITH subordinates => [personal, team, organization]", () => {
    const out = buildAvailable(["student", "admin", "manager"], true, true)
    expect(types(out)).toEqual(["personal", "team", "organization"])
  })

  it("no recognizable hat/signal => guarantees a single [personal] option (never empty)", () => {
    const out = buildAvailable([], false, false)
    expect(types(out)).toEqual(["personal"])
    expect(out).toHaveLength(1)
  })

  it("organization is gated by admin/super_admin hat, NOT by manager", () => {
    const out = buildAvailable(["manager"], true, false)
    expect(types(out)).not.toContain("organization")
    expect(types(out)).toContain("team")
  })
})

describe("defaultContext — highest-privilege initial screen (precedence E1)", () => {
  const personal: AvailableContext = { type: "personal", id: null, label: "Minha Trilha" }
  const team: AvailableContext = { type: "team", id: null, label: "Meu Time" }
  const org: AvailableContext = { type: "organization", id: null, label: "Minha Organização" }

  it("prefers organization when present", () => {
    expect(defaultContext([personal, team, org]).type).toBe("organization")
  })

  it("prefers team over personal when no organization", () => {
    expect(defaultContext([personal, team]).type).toBe("team")
  })

  it("falls back to personal when only personal exists", () => {
    expect(defaultContext([personal]).type).toBe("personal")
  })

  it("falls back to the first element when no known type matches", () => {
    const weird = { type: "personal", id: "x", label: "?" } as AvailableContext
    expect(defaultContext([weird])).toBe(weird)
  })
})

// helper to drive resolveContext with a given profile + cookie
function withProfile(opts: {
  roles: string[]
  hasSubordinates: boolean
  hasEnrollment: boolean
}) {
  mockedAuth.mockResolvedValue({
    roles: opts.roles,
    hasSubordinates: opts.hasSubordinates,
    hasEnrollment: opts.hasEnrollment,
    // unused-by-resolveContext fields, present for shape compatibility
    user: { id: "u" },
    profile: {},
    error: null,
    supabase: {},
    // biome-ignore lint/suspicious/noExplicitAny: test double, only the 3 signals matter
  } as any)
}

describe("resolveContext — landing context (E7 §4.4): manager defaults to team", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("manager (Rafael) with NO cookie => lands on TEAM (not the student trail) — the bug fix", () => {
    // Rafael: manager+student, has subordinates (Bia, Caco), enrolled. Fresh login.
    withProfile({ roles: ["student", "manager"], hasSubordinates: true, hasEnrollment: true })
    mockedCookie.mockResolvedValue(null)
    return resolveContext().then((r) => {
      expect(r.active.type).toBe("team")
      // the switch to "Minha Trilha" must still be offered
      expect(types(r.available)).toEqual(["personal", "team"])
    })
  })

  it("manager who EXPLICITLY chose Minha Trilha (personal cookie) => stays personal", () => {
    withProfile({ roles: ["student", "manager"], hasSubordinates: true, hasEnrollment: true })
    mockedCookie.mockResolvedValue({ type: "personal", id: null })
    return resolveContext().then((r) => {
      expect(r.active.type).toBe("personal")
      expect(types(r.available)).toEqual(["personal", "team"])
    })
  })

  it("manager with team cookie => team (drill-down id passes through)", () => {
    withProfile({ roles: ["student", "manager"], hasSubordinates: true, hasEnrollment: true })
    mockedCookie.mockResolvedValue({ type: "team", id: null })
    return resolveContext().then((r) => {
      expect(r.active.type).toBe("team")
    })
  })

  it("pure student with NO cookie => personal (their only available context)", () => {
    withProfile({ roles: ["student"], hasSubordinates: false, hasEnrollment: true })
    mockedCookie.mockResolvedValue(null)
    return resolveContext().then((r) => {
      expect(r.active.type).toBe("personal")
    })
  })

  it("admin (Olivia) with NO cookie => organization (highest privilege)", () => {
    withProfile({
      roles: ["student", "manager", "admin"],
      hasSubordinates: true,
      hasEnrollment: true,
    })
    mockedCookie.mockResolvedValue(null)
    return resolveContext().then((r) => {
      expect(r.active.type).toBe("organization")
      expect(types(r.available)).toEqual(["personal", "team", "organization"])
    })
  })

  it("forged team cookie on a non-manager => safe fallback (no team in available)", () => {
    withProfile({ roles: ["student"], hasSubordinates: false, hasEnrollment: true })
    mockedCookie.mockResolvedValue({ type: "team", id: null })
    return resolveContext().then((r) => {
      expect(r.active.type).toBe("personal") // forge falls back, never grants team
    })
  })
})
