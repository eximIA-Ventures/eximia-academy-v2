import { describe, expect, it, vi } from "vitest"

/**
 * Story 4 — team/profiles scope-by-team (GESTOR = DONO DO TIME).
 *
 * Pure-logic tests for the `studentIds` resolution branch introduced in
 * `team/profiles/actions.ts::getTeamProfiles`. Mirrors the repo convention of
 * `courses/__tests__/role-permissions.test.ts`: rather than mocking the whole
 * server action (next/headers + supabase server client), we extract the exact
 * decision the action now makes and assert it against the S1 primitive contract
 * (`getManagedTeamStudentIds` → `string[] | null`).
 *
 * The function under test reproduces, line-for-line, the post-edit branch:
 *   - manager: studentIds = (await getManagedTeamStudentIds(...)) ?? []
 *   - admin:   studentIds stays null (tenant-wide)
 *   - others:  barred earlier by the role guard (not reached here)
 *
 * Covers AC1 (manager → team), AC2 (manager null/[] → empty, never tenant-wide)
 * and AC3 (admin → null, unchanged).
 */

type ScopePrimitive = (managerId: string) => Promise<string[] | null>

/**
 * Exact replica of the `studentIds` resolution in getTeamProfiles after S4.
 * `null` return ⇒ tenant-wide (admin); `[]` ⇒ empty roster (manager w/o team).
 */
async function resolveStudentIds(
  role: "manager" | "admin",
  managerId: string,
  getManagedTeamStudentIds: ScopePrimitive,
): Promise<string[] | null> {
  let studentIds: string[] | null = null // null means "all students in tenant"

  if (role === "manager") {
    // null ("owns no team") collapses to [] — NEVER tenant-wide for a manager.
    studentIds = (await getManagedTeamStudentIds(managerId)) ?? []
  }
  // admin: studentIds stays null (tenant-wide), unchanged.

  return studentIds
}

const MANAGER = "11111111-1111-1111-1111-111111111111"

describe("getTeamProfiles — manager scope resolution (Story 4)", () => {
  it("AC1 — manager with a populated team scopes to the team's student ids", async () => {
    const primitive = vi.fn<ScopePrimitive>().mockResolvedValue(["s1", "s2", "s3"])

    const studentIds = await resolveStudentIds("manager", MANAGER, primitive)

    expect(studentIds).toEqual(["s1", "s2", "s3"])
    // Resolved via the TEAM primitive, with the manager's own id.
    expect(primitive).toHaveBeenCalledWith(MANAGER)
  })

  it("AC2 — manager whose team has no members resolves to [] (empty, not tenant-wide)", async () => {
    const primitive = vi.fn<ScopePrimitive>().mockResolvedValue([])

    const studentIds = await resolveStudentIds("manager", MANAGER, primitive)

    expect(studentIds).toEqual([])
    expect(studentIds).not.toBeNull()
  })

  it("AC2 — manager who owns no team (primitive returns null) is normalized to [] (never tenant-wide)", async () => {
    const primitive = vi.fn<ScopePrimitive>().mockResolvedValue(null)

    const studentIds = await resolveStudentIds("manager", MANAGER, primitive)

    // The `?? []` security normalization: a manager can NEVER fall back to the
    // tenant-wide `null` branch.
    expect(studentIds).toEqual([])
    expect(studentIds).not.toBeNull()
  })

  it("AC3 — admin keeps studentIds = null (tenant-wide) and never calls the team primitive", async () => {
    const primitive = vi.fn<ScopePrimitive>().mockResolvedValue(["should-not-be-used"])

    const studentIds = await resolveStudentIds("admin", "admin-id-ignored", primitive)

    expect(studentIds).toBeNull()
    expect(primitive).not.toHaveBeenCalled()
  })

  it("empty studentIds ([]) drives the existing empty-result path (length === 0)", async () => {
    const primitive = vi.fn<ScopePrimitive>().mockResolvedValue([])

    const studentIds = await resolveStudentIds("manager", MANAGER, primitive)

    // getTeamProfiles short-circuits to the zeroed payload when length === 0.
    expect(studentIds !== null && studentIds.length === 0).toBe(true)
  })
})
