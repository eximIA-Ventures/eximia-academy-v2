import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// Engagement Engine (E2, Engagement Center v2) — unit tests
// Covers AC8:
//   1. behind_teaching_plan cohort classification (classifyNudgeCohorts)
//   2. renderWithOrigin greeting per sender identity
//   3. 7-day per-manager+type dismissal suppression (generateNudgeSuggestions)
//   4. caller-scope intersection applied to the new cohort
// ---------------------------------------------------------------------------

// The service client is created INSIDE generateNudgeSuggestions; mock the module
// so we can drive every table read/insert deterministically.
const mockFrom = vi.fn()
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: (table: string) => mockFrom(table) }),
}))

import {
  type StudentSignal,
  classifyNudgeCohorts,
  generateNudgeSuggestions,
  renderWithOrigin,
} from "../engine"

const TENANT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const MANAGER_A = "11111111-1111-1111-1111-111111111111"
const MANAGER_B = "22222222-2222-2222-2222-222222222222"

function sig(partial: Partial<StudentSignal> & { id: string }): StudentSignal {
  return {
    fullName: "Aluno",
    email: "a@x.com",
    totalSessions: 0,
    completedSessions: 0,
    reflectionsCount: 0,
    daysSinceLastActivity: null,
    behindSchedule: false,
    ...partial,
  }
}

// ---------------------------------------------------------------------------
// 1. behind_teaching_plan cohort classification
// ---------------------------------------------------------------------------
describe("classifyNudgeCohorts — behind_teaching_plan", () => {
  it("flags a student who is behind AND has started (totalSessions > 0)", () => {
    const cohorts = classifyNudgeCohorts([
      sig({ id: "s1", totalSessions: 3, completedSessions: 1, behindSchedule: true }),
    ])
    const behind = cohorts.find((c) => c.type === "behind_teaching_plan")
    expect(behind).toBeDefined()
    expect(behind?.studentIds).toEqual(["s1"])
  })

  it("does NOT flag a behind student who never accessed (belongs to never_accessed)", () => {
    const cohorts = classifyNudgeCohorts([
      sig({ id: "s1", totalSessions: 0, behindSchedule: true }),
    ])
    expect(cohorts.find((c) => c.type === "behind_teaching_plan")).toBeUndefined()
    // never_accessed owns the not-yet-started student.
    expect(cohorts.find((c) => c.type === "never_accessed")?.studentIds).toEqual(["s1"])
  })

  it("does NOT flag an on-pace student", () => {
    const cohorts = classifyNudgeCohorts([
      sig({ id: "s1", totalSessions: 5, behindSchedule: false }),
    ])
    expect(cohorts.find((c) => c.type === "behind_teaching_plan")).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// 2. renderWithOrigin greeting per sender identity
// ---------------------------------------------------------------------------
describe("renderWithOrigin", () => {
  it("signs with the manager name when identity=manager", () => {
    const out = renderWithOrigin("Retome seu curso.", "manager", {
      firstName: "Marcela",
      senderName: "Rinaldo",
    })
    expect(out).toContain("Olá, Marcela. Aqui é Rinaldo.")
    expect(out).toContain("Retome seu curso.")
  })

  it("uses the institutional voice when identity=platform", () => {
    const out = renderWithOrigin("Retome seu curso.", "platform", { firstName: "Marcela" })
    expect(out).toContain("A exímIA Academy percebeu")
    expect(out).not.toContain("Aqui é")
  })

  it("omits the signer clause when manager identity has no name", () => {
    const out = renderWithOrigin("corpo", "manager", { firstName: "Ana", senderName: null })
    expect(out).toContain("Olá, Ana.")
    expect(out).not.toContain("Aqui é")
  })
})

// ---------------------------------------------------------------------------
// Fake service client for generateNudgeSuggestions
// ---------------------------------------------------------------------------
// generateNudgeSuggestions reads (in order, some in parallel):
//   from("users"|"sessions"|"slide_reflections"|"enrollments"|"courses").select().eq()...
//   from("nudge_suggestions").select().eq().gte()            (24h cadence)
//   from("nudge_suggestions").select().eq().eq().eq().gte()  (7d dismissal, when managerId)
//   from("nudge_suggestions").insert().select()              (returns created rows)
// The builder is a chainable thenable: every method returns itself; awaiting it
// resolves to { data, error }. We route the resolved data by table + whether the
// call was a dismissal read (has manager_id eq) vs cadence read.
// ---------------------------------------------------------------------------
interface TableData {
  users?: Row[]
  sessions?: Row[]
  slide_reflections?: Row[]
  enrollments?: Row[]
  courses?: Row[]
  /** rows returned for the 24h cadence read (nudge_suggestions select by tenant + gte). */
  cadence?: Row[]
  /** rows returned for the 7d dismissal read (nudge_suggestions select by manager_id). */
  dismissed?: Row[]
}
type Row = Record<string, unknown>

let capturedInserts: Row[] = []

function installDb(data: TableData) {
  capturedInserts = []
  mockFrom.mockReset()
  mockFrom.mockImplementation((table: string) => {
    const state = { eqCols: [] as string[], isInsert: false, insertPayload: [] as Row[] }

    const resolve = (): { data: Row[] | null; error: null } => {
      if (table !== "nudge_suggestions") {
        return { data: (data[table as keyof TableData] as Row[]) ?? [], error: null }
      }
      if (state.isInsert) return { data: state.insertPayload, error: null }
      // A dismissal read filters by manager_id; the cadence read does not.
      const isDismissal = state.eqCols.includes("manager_id")
      return { data: (isDismissal ? data.dismissed : data.cadence) ?? [], error: null }
    }

    // biome-ignore lint/suspicious/noExplicitAny: minimal chainable stub
    const builder: any = {
      select: () => builder,
      insert: (payload: Row[]) => {
        state.isInsert = true
        state.insertPayload = Array.isArray(payload) ? payload : [payload]
        capturedInserts.push(...state.insertPayload)
        return builder
      },
      eq: (col: string) => {
        state.eqCols.push(col)
        return builder
      },
      gte: () => builder,
      order: () => builder,
      // The builder is an awaitable thenable resolving to { data, error } at the
      // end of the chain (eq calls accumulate, then resolve() reads them).
      // biome-ignore lint/suspicious/noThenProperty: intentional thenable query stub (matches area-context.test.ts intent)
      then: (onFulfilled: (v: { data: Row[] | null; error: null }) => unknown) =>
        Promise.resolve(resolve()).then(onFulfilled),
    }
    return builder
  })
}

// ---------------------------------------------------------------------------
// 3. + 4. generateNudgeSuggestions: 7d dismissal + scope intersection
// ---------------------------------------------------------------------------
describe("generateNudgeSuggestions — dismissal window + scope", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-08T12:00:00.000Z"))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const neverAccessedRoster: TableData = {
    users: [
      { id: "s1", full_name: "Um", email: "s1@x.com" },
      { id: "s2", full_name: "Dois", email: "s2@x.com" },
    ],
    sessions: [],
    slide_reflections: [],
    enrollments: [],
    courses: [],
  }

  it("creates a never_accessed suggestion stamped with manager_id", async () => {
    installDb({ ...neverAccessedRoster, cadence: [], dismissed: [] })
    const res = await generateNudgeSuggestions(TENANT, null, MANAGER_A)
    expect(res.created).toHaveLength(1)
    expect(capturedInserts[0].type).toBe("never_accessed")
    expect(capturedInserts[0].manager_id).toBe(MANAGER_A)
  })

  it("suppresses a type this manager dismissed within 7 days (per-manager filter)", async () => {
    // Manager A dismissed never_accessed 2 days ago → suppressed for A.
    installDb({
      ...neverAccessedRoster,
      cadence: [],
      dismissed: [{ type: "never_accessed" }],
    })
    const res = await generateNudgeSuggestions(TENANT, null, MANAGER_A)
    expect(res.created).toHaveLength(0)
    expect(res.skipped).toContain("never_accessed")
  })

  it("does NOT suppress the same type for a DIFFERENT manager", async () => {
    // Manager B never dismissed → the mock returns empty dismissed rows for B.
    installDb({ ...neverAccessedRoster, cadence: [], dismissed: [] })
    const res = await generateNudgeSuggestions(TENANT, null, MANAGER_B)
    expect(res.created).toHaveLength(1)
    expect(capturedInserts[0].manager_id).toBe(MANAGER_B)
  })

  it("intersects the roster with allowedStudentIds (scope) before classifying", async () => {
    // Only s1 is in scope → the never_accessed cohort must contain only s1.
    installDb({ ...neverAccessedRoster, cadence: [], dismissed: [] })
    const res = await generateNudgeSuggestions(TENANT, ["s1"], MANAGER_A)
    expect(res.created).toHaveLength(1)
    expect(capturedInserts[0].target_student_ids).toEqual(["s1"])
  })

  it("fail-closed: empty scope yields zero cohorts", async () => {
    installDb({ ...neverAccessedRoster, cadence: [], dismissed: [] })
    const res = await generateNudgeSuggestions(TENANT, [], MANAGER_A)
    expect(res.created).toHaveLength(0)
  })

  it("classifies behind_teaching_plan from enrollment pace (behind), stamped by manager", async () => {
    // s1 started (has a session) and is behind: active enrollment, deadline 10 days,
    // created 8 days ago → expectedPct = 80, progress 10 → behind.
    const created8dAgo = new Date("2026-06-30T12:00:00.000Z").toISOString()
    installDb({
      users: [{ id: "s1", full_name: "Um", email: "s1@x.com" }],
      sessions: [{ student_id: "s1", status: "completed", created_at: created8dAgo }],
      slide_reflections: [],
      enrollments: [
        {
          student_id: "s1",
          status: "active",
          created_at: created8dAgo,
          progress: { percentage: 10 },
          course_id: "c1",
        },
      ],
      courses: [{ id: "c1", deadline_days: 10 }],
      cadence: [],
      dismissed: [],
    })
    const res = await generateNudgeSuggestions(TENANT, null, MANAGER_A)
    const behind = capturedInserts.find((r) => r.type === "behind_teaching_plan")
    expect(behind).toBeDefined()
    expect(behind?.target_student_ids).toEqual(["s1"])
    expect(behind?.manager_id).toBe(MANAGER_A)
  })
})
