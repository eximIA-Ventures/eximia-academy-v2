import { describe, expect, it } from "vitest"
import type { AvailableContext } from "@/lib/context-resolver"
import {
  type DashboardKind,
  type DashboardProfile,
  resolveDashboardKind,
} from "../resolve-dashboard-kind"

/**
 * resolveDashboardKind — the dashboard router decision table (E8 §4.2, AC2/AC3/AC11).
 *
 * CONTEXTO ESTREITA, RLS CONCEDE: the active context only CHOOSES the screen; it
 * NEVER unlocks a dashboard the hats don't grant. These cases assert exactly that:
 *   - "personal" => "student" for ANY hat (absorbs view-as-student)
 *   - management contexts require the matching capability, else fall through to the
 *     precedence default (also capability-gated)
 *   - a FORGED "organization" cookie on a non-admin (the "forja") does NOT become admin
 * Pure function, no I/O — plain fixtures only.
 */

const personal: AvailableContext = { type: "personal", id: null, label: "Minha Trilha" }
const team: AvailableContext = { type: "team", id: null, label: "Meu Time" }
const organization: AvailableContext = { type: "organization", id: null, label: "Minha Organização" }

const profile = (...roles: string[]): DashboardProfile => ({ roles })

describe("resolveDashboardKind — personal context (absorbs view-as-student)", () => {
  it.each<[string, DashboardProfile]>([
    ["pure student", profile("student")],
    ["manager wearing the student trail", profile("student", "manager")],
    ["admin viewing as student", profile("student", "admin")],
    ["super_admin viewing as student", profile("student", "super_admin")],
    ["instructor", profile("student", "instructor")],
    ["leader", profile("student", "leader")],
  ])("personal => 'student' for %s", (_label, p) => {
    expect(resolveDashboardKind(p, personal)).toBe<DashboardKind>("student")
  })
})

describe("resolveDashboardKind — team context", () => {
  it("team + manager hat => 'manager-team'", () => {
    expect(resolveDashboardKind(profile("student", "manager"), team)).toBe("manager-team")
  })

  it("team WITHOUT manager hat => falls through to precedence default, never manager-team", () => {
    // A student forging team context gets the student trail (context grants nothing).
    expect(resolveDashboardKind(profile("student"), team)).toBe("student")
  })

  it("team + admin (no manager hat) => admin by precedence, not manager-team", () => {
    // admin without the manager capability: step 2 (team+manager) misses, step 3
    // precedence resolves to admin.
    expect(resolveDashboardKind(profile("student", "admin"), team)).toBe("admin")
  })

  it("team + super_admin (no manager hat) => super-admin by precedence", () => {
    expect(resolveDashboardKind(profile("student", "super_admin"), team)).toBe("super-admin")
  })
})

describe("resolveDashboardKind — organization context", () => {
  it("organization + super_admin hat => 'super-admin'", () => {
    expect(resolveDashboardKind(profile("student", "super_admin"), organization)).toBe("super-admin")
  })

  it("organization + admin hat => 'admin'", () => {
    expect(resolveDashboardKind(profile("student", "admin"), organization)).toBe("admin")
  })

  it("organization + admin AND super_admin => 'super-admin' wins by precedence", () => {
    expect(
      resolveDashboardKind(profile("student", "admin", "super_admin"), organization),
    ).toBe("super-admin")
  })

  it("organization + manager hat (no admin) => 'manager'", () => {
    expect(resolveDashboardKind(profile("student", "manager"), organization)).toBe("manager")
  })

  // FORJA: the forged org context on a user lacking admin/super_admin/manager.
  it("organization on a PURE STUDENT (forged) => 'student', NEVER admin", () => {
    const kind = resolveDashboardKind(profile("student"), organization)
    expect(kind).toBe("student")
    expect(kind).not.toBe("admin")
    expect(kind).not.toBe("super-admin")
  })

  it("organization on an instructor-only (no org capability, forged) => 'student', NEVER admin", () => {
    // instructor has a dedicated route handled upstream; in this pure resolver they
    // are not org-capable, so a forged org context must not elevate them.
    const kind = resolveDashboardKind(profile("student", "instructor"), organization)
    expect(kind).toBe("student")
    expect(kind).not.toBe("admin")
  })

  it("organization on a leader-only (no org capability, forged) => 'student', NEVER admin", () => {
    const kind = resolveDashboardKind(profile("student", "leader"), organization)
    expect(kind).toBe("student")
    expect(kind).not.toBe("admin")
  })
})

describe("resolveDashboardKind — precedence default (no/insufficient context)", () => {
  // The "no explicit context" branch still mirrors the DB precedence
  // (recompute_primary_role, E1): super_admin > admin > manager > instructor/leader > student.
  it("super_admin defaults to 'super-admin' under a personal-less highest screen", () => {
    // organization context already covered; assert precedence ordering holds when
    // multiple hats are present and the context is organization.
    expect(resolveDashboardKind(profile("manager", "admin", "super_admin"), organization)).toBe(
      "super-admin",
    )
  })

  it("admin (no super_admin) defaults to 'admin'", () => {
    expect(resolveDashboardKind(profile("manager", "admin"), organization)).toBe("admin")
  })

  it("manager under team context defaults to 'manager-team' in the precedence branch", () => {
    // manager hat + team context, but reaching step 3 (no super/admin): the precedence
    // branch routes manager to manager-team specifically when ctx.type === "team".
    // (manager has no admin/super hat here, organization branch's manager path is step 2)
    expect(resolveDashboardKind(profile("manager"), team)).toBe("manager-team")
  })

  it("a pure student with no usable context lands on 'student'", () => {
    expect(resolveDashboardKind(profile("student"), personal)).toBe("student")
  })
})
