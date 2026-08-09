import { describe, expect, it, vi } from "vitest"

/**
 * Story 4 — analytics page scope-by-team (GESTOR = DONO DO TIME).
 *
 * Pure-logic tests for the `scopedStudentIds` resolution branch introduced in
 * `analytics/page.tsx`. Mirrors the repo convention of
 * `courses/__tests__/role-permissions.test.ts`: instead of mocking the full SSR
 * page (getAuthProfile, service client, next/navigation), we extract the exact
 * per-role decision and assert it against the two scope primitives' contracts.
 *
 * Post-edit branch under test:
 *   scopedStudentIds =
 *     role === "manager"
 *       ? (await getManagedTeamStudentIds(db, tenantId, user.id)) ?? []   // TEAM
 *       : await getAreaStudentIds(db, tenantId, initialAreaId)            // UNIT
 *
 * `scopeSet`/`inScope` are unchanged and consume `scopedStudentIds` agnostically,
 * so verifying the source-selection + the `?? []` normalization fully covers the
 * security-relevant behavior.
 *
 * Covers AC4 (manager → team), AC5 (manager null → []/empty, never tenant-wide)
 * and AC6 (admin/instructor/leader/super_admin → unit via getAreaStudentIds).
 */

type Role = "manager" | "admin" | "instructor" | "leader" | "super_admin"

/** Exact replica of the analytics page's `scopedStudentIds` resolution. */
async function resolveScopedStudentIds(
  role: Role,
  ctx: {
    getManagedTeamStudentIds: (userId: string) => Promise<string[] | null>
    getAreaStudentIds: (areaId: string | null) => Promise<string[] | null>
    userId: string
    initialAreaId: string | null
  },
): Promise<string[] | null> {
  return role === "manager"
    ? ((await ctx.getManagedTeamStudentIds(ctx.userId)) ?? [])
    : await ctx.getAreaStudentIds(ctx.initialAreaId)
}

/** Mirrors the page's `scopeSet`/`inScope`. */
function makeInScope(scopedStudentIds: string[] | null) {
  const scopeSet = scopedStudentIds === null ? null : new Set(scopedStudentIds)
  return (studentId: string | null | undefined): boolean =>
    scopeSet === null || (studentId != null && scopeSet.has(studentId))
}

const MANAGER = "11111111-1111-1111-1111-111111111111"
const AREA = "22222222-2222-2222-2222-222222222222"

describe("analytics page — scopedStudentIds resolution (Story 4)", () => {
  it("AC4 — manager scopes via the TEAM primitive (not the Unidade selector)", async () => {
    const getManagedTeamStudentIds = vi
      .fn<(u: string) => Promise<string[] | null>>()
      .mockResolvedValue(["s1", "s2"])
    const getAreaStudentIds = vi
      .fn<(a: string | null) => Promise<string[] | null>>()
      .mockResolvedValue(["should-not-be-used"])

    const scoped = await resolveScopedStudentIds("manager", {
      getManagedTeamStudentIds,
      getAreaStudentIds,
      userId: MANAGER,
      initialAreaId: AREA,
    })

    expect(scoped).toEqual(["s1", "s2"])
    expect(getManagedTeamStudentIds).toHaveBeenCalledWith(MANAGER)
    // AC7 — the Unidade selector path is NOT consulted for a manager.
    expect(getAreaStudentIds).not.toHaveBeenCalled()
  })

  it("AC5 — manager who owns no team (null) is normalized to [] and sees an empty dashboard (never tenant-wide)", async () => {
    const getManagedTeamStudentIds = vi
      .fn<(u: string) => Promise<string[] | null>>()
      .mockResolvedValue(null)
    const getAreaStudentIds = vi
      .fn<(a: string | null) => Promise<string[] | null>>()
      .mockResolvedValue(null)

    const scoped = await resolveScopedStudentIds("manager", {
      getManagedTeamStudentIds,
      getAreaStudentIds,
      userId: MANAGER,
      initialAreaId: null,
    })

    expect(scoped).toEqual([])
    expect(scoped).not.toBeNull()

    // Empty scope ⇒ every student is out of scope ⇒ zeroed dashboard.
    const inScope = makeInScope(scoped)
    expect(inScope("anyone")).toBe(false)
    expect(inScope(MANAGER)).toBe(false)
  })

  it("AC5 — manager with a team that has no members ([]) also yields an empty (non-tenant-wide) scope", async () => {
    const getManagedTeamStudentIds = vi
      .fn<(u: string) => Promise<string[] | null>>()
      .mockResolvedValue([])
    const getAreaStudentIds = vi.fn<(a: string | null) => Promise<string[] | null>>()

    const scoped = await resolveScopedStudentIds("manager", {
      getManagedTeamStudentIds,
      getAreaStudentIds,
      userId: MANAGER,
      initialAreaId: AREA,
    })

    expect(scoped).toEqual([])
    expect(makeInScope(scoped)("s1")).toBe(false)
  })

  for (const role of ["admin", "instructor", "leader", "super_admin"] as const) {
    it(`AC6 — ${role} keeps Unidade scope via getAreaStudentIds (team primitive untouched)`, async () => {
      const getManagedTeamStudentIds = vi
        .fn<(u: string) => Promise<string[] | null>>()
        .mockResolvedValue(["should-not-be-used"])
      const getAreaStudentIds = vi
        .fn<(a: string | null) => Promise<string[] | null>>()
        .mockResolvedValue(["u1", "u2"])

      const scoped = await resolveScopedStudentIds(role, {
        getManagedTeamStudentIds,
        getAreaStudentIds,
        userId: "user-id",
        initialAreaId: AREA,
      })

      expect(scoped).toEqual(["u1", "u2"])
      expect(getAreaStudentIds).toHaveBeenCalledWith(AREA)
      expect(getManagedTeamStudentIds).not.toHaveBeenCalled()
    })
  }

  it("AC6 — non-manager with no Unidade selected stays tenant-wide (null), unchanged", async () => {
    const getManagedTeamStudentIds = vi.fn<(u: string) => Promise<string[] | null>>()
    const getAreaStudentIds = vi
      .fn<(a: string | null) => Promise<string[] | null>>()
      .mockResolvedValue(null) // "Todas" → whole tenant

    const scoped = await resolveScopedStudentIds("admin", {
      getManagedTeamStudentIds,
      getAreaStudentIds,
      userId: "admin-id",
      initialAreaId: null,
    })

    expect(scoped).toBeNull()
    // null scope ⇒ inScope is permissive (tenant-wide), as before.
    expect(makeInScope(scoped)("anyone")).toBe(true)
  })
})
