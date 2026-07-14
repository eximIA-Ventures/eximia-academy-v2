import { describe, it, expect } from "vitest"
import { isCourseManagerRole, resolveCoursesListView } from "@/lib/course-management-guard"

/**
 * Pure logic tests for courses role permissions.
 *
 * fix-manager-privacy-gates (2026-07-03), Correção 2: course management
 * (create/edit/publish/archive/delete, Enriquecer com IA, Interações,
 * Editar, Exportar, Adicionar Capítulo) is instructor/admin/super_admin ONLY.
 * A manager-only hat (no instructor/admin) is DENIED — this test file used to
 * assert the OPPOSITE ("manager grants access"); that assertion was the bug
 * this story fixes, not a spec to preserve.
 *
 * Checked over the UNION of hats (multi-chapéu, E1/E7), never the singular
 * legacy `users.role` column — a manager+instructor keeps everything the
 * instructor gets.
 */

const COURSE_MANAGER_HATS = ["instructor", "admin", "super_admin"]
const NON_COURSE_MANAGER_HATS = ["student", "manager", "leader"]

describe("Courses Role Permissions (fix-manager-privacy-gates, Correção 2)", () => {
  describe("isCourseManagerRole (lib/course-management-guard.ts)", () => {
    for (const hat of COURSE_MANAGER_HATS) {
      it(`grants access when the union includes '${hat}'`, () => {
        expect(isCourseManagerRole([hat])).toBe(true)
      })
    }

    it("denies a manager-only hat (no instructor/admin) — the fix", () => {
      expect(isCourseManagerRole(["manager"])).toBe(false)
    })

    for (const hat of NON_COURSE_MANAGER_HATS) {
      it(`denies a lone '${hat}' hat`, () => {
        expect(isCourseManagerRole([hat])).toBe(false)
      })
    }

    it("denies an empty union", () => {
      expect(isCourseManagerRole([])).toBe(false)
    })

    it("grants access to manager+instructor (union, manager hat does not subtract)", () => {
      expect(isCourseManagerRole(["manager", "instructor"])).toBe(true)
    })

    it("grants access to manager+admin", () => {
      expect(isCourseManagerRole(["student", "manager", "admin"])).toBe(true)
    })

    it("denies manager+student (neither hat is instructor/admin)", () => {
      expect(isCourseManagerRole(["student", "manager"])).toBe(false)
    })
  })

  describe("requireContentRole guard shape (actions.ts) — hats, not singular role", () => {
    function requireContentRole(hats: string[] | null): { hats: string[] } | { error: string } {
      if (!hats) return { error: "Perfil não encontrado" }
      if (!isCourseManagerRole(hats)) {
        return { error: "Permissão negada" }
      }
      return { hats }
    }

    it("blocks a manager-only hat from creating/editing courses (Correção 2)", () => {
      const result = requireContentRole(["manager"])
      expect("error" in result).toBe(true)
    })

    it("allows admin to create/edit courses", () => {
      const result = requireContentRole(["admin"])
      expect("hats" in result).toBe(true)
    })

    it("blocks student from creating/editing courses", () => {
      const result = requireContentRole(["student"])
      expect("error" in result).toBe(true)
    })

    it("allows instructor to create/edit courses", () => {
      const result = requireContentRole(["instructor"])
      expect("hats" in result).toBe(true)
    })

    it("allows manager+instructor (union) to create/edit courses", () => {
      const result = requireContentRole(["manager", "instructor"])
      expect("hats" in result).toBe(true)
    })

    it("returns error for null profile", () => {
      const result = requireContentRole(null)
      expect("error" in result).toBe(true)
    })
  })

  describe("resolveCoursesListView (fix-student-courses-not-listed)", () => {
    // REGRESSION: a manager-only user is enrolled as a student (dashboard shows
    // "1 CURSOS") but /courses rendered the AUTHORING listing (courses they own),
    // which is empty — so the enrolled course was invisible and unreachable.
    it("gives a manager-only hat the STUDENT enrollment listing, not authoring (the bug)", () => {
      expect(resolveCoursesListView(["manager"])).toBe("enrollment")
    })

    it("gives a lone student hat the enrollment listing", () => {
      expect(resolveCoursesListView(["student"])).toBe("enrollment")
    })

    it("gives a manager+student union the enrollment listing (no instructor/admin hat)", () => {
      expect(resolveCoursesListView(["manager", "student"])).toBe("enrollment")
    })

    it("gives a leader-only hat the enrollment listing", () => {
      expect(resolveCoursesListView(["leader"])).toBe("enrollment")
    })

    it("keeps the authoring listing for an instructor (Estúdio unchanged)", () => {
      expect(resolveCoursesListView(["instructor"])).toBe("authoring")
    })

    it("keeps the authoring listing for admin and super_admin", () => {
      expect(resolveCoursesListView(["admin"])).toBe("authoring")
      expect(resolveCoursesListView(["super_admin"])).toBe("authoring")
    })

    it("keeps the authoring listing for a manager+instructor union (manager hat does not subtract)", () => {
      expect(resolveCoursesListView(["manager", "instructor"])).toBe("authoring")
    })

    it("forces the enrollment listing when an instructor is previewing as a student", () => {
      expect(resolveCoursesListView(["instructor"], true)).toBe("enrollment")
    })

    it("gives an empty union the enrollment listing (defensive floor)", () => {
      expect(resolveCoursesListView([])).toBe("enrollment")
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

    it("instructor can delete only draft courses; manager-only can no longer delete at all (Correção 2)", () => {
      function canDeleteCourse(hats: string[], courseStatus: string): boolean {
        if (hats.includes("admin") || hats.includes("super_admin")) return true
        if (hats.includes("instructor")) return courseStatus === "draft"
        return false
      }

      expect(canDeleteCourse(["instructor"], "draft")).toBe(true)
      expect(canDeleteCourse(["instructor"], "published")).toBe(false)
      expect(canDeleteCourse(["admin"], "published")).toBe(true)
      expect(canDeleteCourse(["student"], "draft")).toBe(false)
      expect(canDeleteCourse(["manager"], "draft")).toBe(false)
    })
  })
})
