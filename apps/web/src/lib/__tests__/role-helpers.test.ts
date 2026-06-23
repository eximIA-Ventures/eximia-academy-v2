import { describe, expect, it } from "vitest"
import { hasAnyRole, hasRole } from "../role-helpers"

/**
 * hasRole / hasAnyRole — pure hat checks over the UNION of hats (E1, E7 §4.10).
 *
 * Contract under test: they read `profile.roles[]` (the union from `user_roles`),
 * never the singular `profile.role`. No I/O, so a plain object is the only fixture.
 */

const student = { roles: ["student"] }
const managerStudent = { roles: ["student", "manager"] }
const superAdmin = { roles: ["student", "admin", "super_admin"] }
const empty = { roles: [] as string[] }

describe("hasRole", () => {
  it("returns true when the hat is present in the union", () => {
    expect(hasRole(managerStudent, "manager")).toBe(true)
    expect(hasRole(student, "student")).toBe(true)
    expect(hasRole(superAdmin, "super_admin")).toBe(true)
  })

  it("returns false when the hat is absent", () => {
    expect(hasRole(student, "manager")).toBe(false)
    expect(hasRole(managerStudent, "admin")).toBe(false)
    expect(hasRole(superAdmin, "leader")).toBe(false)
  })

  it("returns false for any role on an empty union", () => {
    expect(hasRole(empty, "student")).toBe(false)
    expect(hasRole(empty, "super_admin")).toBe(false)
  })

  it("does not partial-match role names", () => {
    // "admin" must not be satisfied by "super_admin" string membership.
    expect(hasRole({ roles: ["super_admin"] }, "admin")).toBe(false)
  })
})

describe("hasAnyRole", () => {
  it("returns true when at least one of the queried hats is present", () => {
    expect(hasAnyRole(superAdmin, ["admin", "super_admin", "manager"])).toBe(true)
    expect(hasAnyRole(managerStudent, ["admin", "manager"])).toBe(true)
    // first match short-circuits but result is the same regardless of order
    expect(hasAnyRole(managerStudent, ["manager", "admin"])).toBe(true)
  })

  it("returns false when none of the queried hats are present", () => {
    expect(hasAnyRole(student, ["admin", "super_admin", "manager"])).toBe(false)
    expect(hasAnyRole(managerStudent, ["admin", "super_admin"])).toBe(false)
  })

  it("returns false for an empty query list (no hat asked for)", () => {
    expect(hasAnyRole(superAdmin, [])).toBe(false)
  })

  it("returns false for any query against an empty union", () => {
    expect(hasAnyRole(empty, ["student", "manager", "admin"])).toBe(false)
  })
})
