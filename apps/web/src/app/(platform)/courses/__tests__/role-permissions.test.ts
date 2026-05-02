import { describe, it, expect } from "vitest"

/**
 * Pure logic tests for courses role permissions.
 * Validates that the isManager check includes manager and admin.
 * Mirrors the guard logic in actions.ts, page.tsx, and courses-page-client.tsx.
 */

const CONTENT_ROLES = ["manager", "admin", "instructor"]
const NON_CONTENT_ROLES = ["student"]

function isContentRole(role: string): boolean {
  return role === "manager" || role === "admin" || role === "instructor"
}

describe("Courses Role Permissions (Story 9.2)", () => {
  describe("isContentRole (isManager check)", () => {
    for (const role of CONTENT_ROLES) {
      it(`grants access to '${role}' role`, () => {
        expect(isContentRole(role)).toBe(true)
      })
    }

    for (const role of NON_CONTENT_ROLES) {
      it(`denies access to '${role}' role`, () => {
        expect(isContentRole(role)).toBe(false)
      })
    }

    it("denies access to unknown role", () => {
      expect(isContentRole("superadmin")).toBe(false)
    })
  })

  describe("requireContentRole guard (actions.ts)", () => {
    function requireContentRole(role: string | null): { role: string } | { error: string } {
      if (!role) return { error: "Perfil não encontrado" }
      if (role !== "manager" && role !== "admin" && role !== "instructor") {
        return { error: "Permissão negada" }
      }
      return { role }
    }

    it("allows manager to create/edit courses", () => {
      const result = requireContentRole("manager")
      expect("role" in result).toBe(true)
    })

    it("allows admin to create/edit courses", () => {
      const result = requireContentRole("admin")
      expect("role" in result).toBe(true)
    })

    it("blocks student from creating/editing courses", () => {
      const result = requireContentRole("student")
      expect("error" in result).toBe(true)
    })

    it("blocks teacher (deprecated role) from creating/editing courses", () => {
      const result = requireContentRole("teacher")
      expect("error" in result).toBe(true)
    })

    it("allows instructor to create/edit courses", () => {
      const result = requireContentRole("instructor")
      expect("role" in result).toBe(true)
    })

    it("returns error for null profile", () => {
      const result = requireContentRole(null)
      expect("error" in result).toBe(true)
    })
  })

  describe("instructor RBAC constraints (Story 25.2)", () => {
    const INSTRUCTOR_ALLOWED_ROUTES = ["/courses", "/instructor", "/analytics", "/biblioteca"]
    const INSTRUCTOR_BLOCKED_ROUTES = ["/admin/users", "/admin/settings", "/admin/api-keys", "/admin/webhooks"]

    function isInstructorBlocked(pathname: string): boolean {
      const blocked = ["/admin/users", "/admin/settings", "/admin/api-keys", "/admin/webhooks"]
      return blocked.some((p) => pathname.startsWith(p))
    }

    for (const route of INSTRUCTOR_ALLOWED_ROUTES) {
      it(`instructor can access ${route}`, () => {
        expect(isInstructorBlocked(route)).toBe(false)
      })
    }

    for (const route of INSTRUCTOR_BLOCKED_ROUTES) {
      it(`instructor is blocked from ${route}`, () => {
        expect(isInstructorBlocked(route)).toBe(true)
      })
    }

    it("instructor can delete only draft courses (same as manager)", () => {
      function canDeleteCourse(role: string, courseStatus: string): boolean {
        if (role === "admin") return true
        if (role === "manager" || role === "instructor") return courseStatus === "draft"
        return false
      }

      expect(canDeleteCourse("instructor", "draft")).toBe(true)
      expect(canDeleteCourse("instructor", "published")).toBe(false)
      expect(canDeleteCourse("admin", "published")).toBe(true)
      expect(canDeleteCourse("student", "draft")).toBe(false)
    })
  })
})
