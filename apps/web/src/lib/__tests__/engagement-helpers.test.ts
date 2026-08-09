import { describe, expect, it, vi } from "vitest"

/**
 * Iteração 3 (2026-07-03) — engagement buckets read SIGNALS via the SECURITY
 * DEFINER RPC `auth_team_engagement_signals`, not via client-side queries over
 * the RLS-protected signal tables.
 *
 * ROOT CAUSE these tests lock in: the student UNIVERSE (resolved by the scope
 * RPCs) includes students tied to the manager only by `reports_to`. Under the
 * authenticated client, the signal-table RLS does NOT grant a manager reach to
 * those students (only via manager_groups / auth_team_reachable_student_ids),
 * so their sessions came back empty → everyone bucketed "inativos". The RPC
 * reads signals with elevated privilege (re-gated), so a reports_to-only /
 * multi-hat student (e.g. Caio, active today) is classified correctly.
 */

import { getSubteamEngagementSummaries, getTeamEngagementBuckets } from "../engagement-helpers"

const TENANT = "tenant-1"
const MANAGER = "11111111-1111-1111-1111-111111111111"
const CAIO = "16e3e6ed-f6da-40c1-a4e0-f7dad5ced201"

// Mock the scope primitives so getTeamEngagementBuckets resolves a known
// universe without touching the DB. Each returns the ids we hand it.
const mockGetDirectTeamStudentIds = vi.fn()
const mockGetManagedTeamStudentIds = vi.fn()
const mockGetSubtreeStudentIdsAtNode = vi.fn()

vi.mock("../area-context", () => ({
  getDirectTeamStudentIds: (...a: unknown[]) => mockGetDirectTeamStudentIds(...a),
  getManagedTeamStudentIds: (...a: unknown[]) => mockGetManagedTeamStudentIds(...a),
  getSubtreeStudentIdsAtNode: (...a: unknown[]) => mockGetSubtreeStudentIdsAtNode(...a),
}))

type SignalRow = {
  student_id: string
  total_sessions: number | string
  completed_sessions: number | string
  last_activity_at: string | null
  reflections_count: number | string
  behind_schedule: boolean
}

type UserRow = { id: string; full_name: string | null; email: string | null }

/**
 * Builds a db stub exposing `.from("users")...` (names) and
 * `.rpc("auth_team_engagement_signals", { _student_ids })` (signals). Records
 * the rpc calls so tests can assert the RPC is the signal source and no
 * client-side sessions/slide_reflections/enrollments query is issued.
 */
function makeDb(users: UserRow[], signals: SignalRow[]) {
  const rpcCalls: Array<{ fn: string; args?: Record<string, unknown> }> = []
  const fromTables: string[] = []

  type Builder = Promise<{ data: unknown[] }> & {
    select: () => Builder
    eq: (c: string, v: unknown) => Builder
    in: (c: string, v: unknown[]) => Builder
  }

  const from = vi.fn((table: string): Builder => {
    fromTables.push(table)
    const data = table === "users" ? users : []
    const builder: Builder = Object.assign(Promise.resolve({ data }), {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      in: vi.fn(() => builder),
    })
    return builder
  })

  const rpc = vi.fn((fn: string, args?: Record<string, unknown>) => {
    rpcCalls.push({ fn, args })
    if (fn === "auth_team_engagement_signals")
      return Promise.resolve({ data: signals, error: null })
    return Promise.resolve({ data: null, error: null })
  })

  // biome-ignore lint/suspicious/noExplicitAny: minimal stub matching the loose client
  return { db: { from, rpc } as any, rpcCalls, fromTables }
}

const daysAgoIso = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()

describe("getTeamEngagementBuckets (Diretos) — RPC signal path", () => {
  it("classifies a reports_to-only / multi-hat active student (Caio) as accessed, NOT inativos", async () => {
    mockGetDirectTeamStudentIds.mockResolvedValueOnce([CAIO, "s-inactive", "s-atrisk"])

    const { db, rpcCalls, fromTables } = makeDb(
      [
        { id: CAIO, full_name: "Caio Pinheiro", email: "caio@x.com" },
        { id: "s-inactive", full_name: "Inactive", email: "i@x.com" },
        { id: "s-atrisk", full_name: "At Risk", email: "a@x.com" },
      ],
      [
        // Caio: active today, plenty of sessions → accessed.
        {
          student_id: CAIO,
          total_sessions: 21,
          completed_sessions: 20,
          last_activity_at: daysAgoIso(0),
          reflections_count: 41,
          behind_schedule: false,
        },
        // Inactive: last activity 47d ago → inativos.
        {
          student_id: "s-inactive",
          total_sessions: 8,
          completed_sessions: 8,
          last_activity_at: daysAgoIso(47),
          reflections_count: 0,
          behind_schedule: false,
        },
        // At risk: 8d ago (5 < d <= 14) → devendo (sem_atividade_recente).
        {
          student_id: "s-atrisk",
          total_sessions: 10,
          completed_sessions: 10,
          last_activity_at: daysAgoIso(8),
          reflections_count: 15,
          behind_schedule: false,
        },
      ],
    )

    const buckets = await getTeamEngagementBuckets(db, TENANT, MANAGER, null, "direct")

    // Caio is accessed (the whole point of the fix).
    expect(buckets.accessed.map((s) => s.id)).toContain(CAIO)
    expect(buckets.inativos.map((s) => s.id)).not.toContain(CAIO)

    // Full classification is correct and sums to the universe.
    expect(buckets.summary.accessedCount).toBe(1)
    expect(buckets.summary.devendoCount).toBe(1)
    expect(buckets.summary.inativosCount).toBe(1)
    expect(buckets.summary.teamTotal).toBe(3)
    expect(buckets.devendo.map((s) => s.id)).toEqual(["s-atrisk"])
    expect(buckets.devendo[0]?.devendoReasons).toEqual(["sem_atividade_recente"])
    expect(buckets.inativos.map((s) => s.id)).toEqual(["s-inactive"])

    // Signals came from the RPC; NO client-side signal-table query was issued.
    expect(rpcCalls).toContainEqual({
      fn: "auth_team_engagement_signals",
      args: { _student_ids: [CAIO, "s-inactive", "s-atrisk"] },
    })
    expect(fromTables).not.toContain("sessions")
    expect(fromTables).not.toContain("slide_reflections")
    expect(fromTables).not.toContain("enrollments")
  })

  it("a universe id with NO signal row (out of RPC reach / no activity) still classifies as inativos, never dropped", async () => {
    mockGetDirectTeamStudentIds.mockResolvedValueOnce([CAIO, "s-nosignal"])

    const { db } = makeDb(
      [
        { id: CAIO, full_name: "Caio", email: "c@x.com" },
        { id: "s-nosignal", full_name: "Ghost", email: "g@x.com" },
      ],
      [
        {
          student_id: CAIO,
          total_sessions: 3,
          completed_sessions: 3,
          last_activity_at: daysAgoIso(1),
          reflections_count: 0,
          behind_schedule: false,
        },
        // no row for s-nosignal
      ],
    )

    const buckets = await getTeamEngagementBuckets(db, TENANT, MANAGER, null, "direct")

    expect(buckets.summary.teamTotal).toBe(2)
    expect(buckets.accessed.map((s) => s.id)).toEqual([CAIO])
    expect(buckets.inativos.map((s) => s.id)).toEqual(["s-nosignal"])
    // The zeroed fallback: no signal → totalSessions 0 → inativos, days null.
    expect(buckets.inativos[0]?.daysSinceLastActivity).toBeNull()
  })

  it("behind-schedule (from the RPC) with recent activity lands in devendo (atras_cronograma)", async () => {
    mockGetDirectTeamStudentIds.mockResolvedValueOnce(["s-behind"])

    const { db } = makeDb(
      [{ id: "s-behind", full_name: "Behind", email: "b@x.com" }],
      [
        {
          student_id: "s-behind",
          total_sessions: 5,
          completed_sessions: 2,
          last_activity_at: daysAgoIso(1), // recent → not at_risk
          reflections_count: 0,
          behind_schedule: true, // but behind pace
        },
      ],
    )

    const buckets = await getTeamEngagementBuckets(db, TENANT, MANAGER, null, "direct")

    expect(buckets.devendo.map((s) => s.id)).toEqual(["s-behind"])
    expect(buckets.devendo[0]?.devendoReasons).toEqual(["atras_cronograma"])
  })

  it("coerces bigint-as-string counts from the RPC (PostgREST serialization)", async () => {
    mockGetDirectTeamStudentIds.mockResolvedValueOnce(["s1"])

    const { db } = makeDb(
      [{ id: "s1", full_name: "S1", email: "s1@x.com" }],
      [
        {
          student_id: "s1",
          total_sessions: "12", // string form
          completed_sessions: "10",
          last_activity_at: daysAgoIso(0),
          reflections_count: "3",
          behind_schedule: false,
        },
      ],
    )

    const buckets = await getTeamEngagementBuckets(db, TENANT, MANAGER, null, "direct")
    // total_sessions "12" must not be treated as 0 → student is accessed, not inativos.
    expect(buckets.accessed.map((s) => s.id)).toEqual(["s1"])
  })

  it("empty universe → empty buckets, no RPC call", async () => {
    mockGetDirectTeamStudentIds.mockResolvedValueOnce([])
    const { db, rpcCalls } = makeDb([], [])

    const buckets = await getTeamEngagementBuckets(db, TENANT, MANAGER, null, "direct")

    expect(buckets.summary.teamTotal).toBe(0)
    expect(rpcCalls).toHaveLength(0)
  })
})

describe("getSubteamEngagementSummaries — RPC signal path", () => {
  it("classifies the union once and re-partitions per node, using the RPC signals", async () => {
    const { db, rpcCalls } = makeDb(
      [
        { id: "a1", full_name: "A1", email: "a1@x.com" },
        { id: "b1", full_name: "B1", email: "b1@x.com" },
      ],
      [
        {
          student_id: "a1",
          total_sessions: 5,
          completed_sessions: 5,
          last_activity_at: daysAgoIso(0),
          reflections_count: 1,
          behind_schedule: false,
        },
        {
          student_id: "b1",
          total_sessions: 0,
          completed_sessions: 0,
          last_activity_at: null,
          reflections_count: 0,
          behind_schedule: false,
        },
      ],
    )

    const result = await getSubteamEngagementSummaries(db, TENANT, [
      { nodeId: "node-a", studentIds: ["a1"] },
      { nodeId: "node-b", studentIds: ["b1"] },
    ])

    expect(result.get("node-a")).toEqual({
      accessedCount: 1,
      devendoCount: 0,
      inativosCount: 0,
      teamTotal: 1,
    })
    expect(result.get("node-b")).toEqual({
      accessedCount: 0,
      devendoCount: 0,
      inativosCount: 1,
      teamTotal: 1,
    })
    // ONE batched RPC over the union, not one per node.
    expect(rpcCalls.filter((c) => c.fn === "auth_team_engagement_signals")).toHaveLength(1)
  })
})
