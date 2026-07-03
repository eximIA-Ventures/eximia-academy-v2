import { describe, expect, it } from "vitest"
import { isCourseManagerRole, requireCourseManager } from "../course-management-guard"

/**
 * fix-manager-privacy-gates (2026-07-03), Correção 2 — course management
 * (Enriquecer com IA, Interações, Editar, Exportar, Adicionar Capítulo,
 * create/edit/publish/archive/delete) is instructor/admin/super_admin ONLY.
 * A manager-only hat (no instructor/admin) is DENIED, even when the legacy
 * singular `users.role` column still reads "manager" — the gate reads the
 * UNION of hats from `user_roles` (multi-chapéu, E1/E7), never the singular
 * column. Mirrors the prod bug this migration fixes: Rinaldo's singular
 * `users.role` is "manager" even though his real hats are
 * instructor+manager — a singular-role check would have locked him out.
 */

type UserRow = {
  role: string | null
  tenant_id: string | null
  user_roles: { role: string }[]
}

function buildSupabaseStub(row: UserRow | null) {
  return {
    from(table: string) {
      if (table !== "users") throw new Error(`unexpected table ${table}`)
      return {
        select() {
          return {
            eq() {
              return {
                async single() {
                  return { data: row, error: row ? null : { message: "not found" } }
                },
              }
            },
          }
        },
      }
    },
    // biome-ignore lint/suspicious/noExplicitAny: test stub matches the narrow slice actually used
  } as any
}

describe("requireCourseManager", () => {
  it("denies a manager-only hat (singular role also 'manager') — the leak this fixes", async () => {
    const supabase = buildSupabaseStub({
      role: "manager",
      tenant_id: "tenant-1",
      user_roles: [{ role: "manager" }],
    })
    const result = await requireCourseManager(supabase, "caio")
    expect(result.ok).toBe(false)
    expect(result.error).toBe("Permissão negada")
  })

  it("allows instructor hat even when singular role is still 'manager' (Rinaldo's real prod shape)", async () => {
    const supabase = buildSupabaseStub({
      role: "manager",
      tenant_id: "tenant-1",
      user_roles: [{ role: "instructor" }, { role: "manager" }],
    })
    const result = await requireCourseManager(supabase, "rinaldo")
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("expected ok result")
    expect(result.ctx.hats).toEqual(["instructor", "manager"])
    expect(result.ctx.tenantId).toBe("tenant-1")
  })

  it("allows admin hat", async () => {
    const supabase = buildSupabaseStub({
      role: "admin",
      tenant_id: "tenant-1",
      user_roles: [{ role: "admin" }],
    })
    const result = await requireCourseManager(supabase, "admin-user")
    expect(result.ok).toBe(true)
  })

  it("allows super_admin hat", async () => {
    const supabase = buildSupabaseStub({
      role: "super_admin",
      tenant_id: null,
      user_roles: [{ role: "super_admin" }],
    })
    const result = await requireCourseManager(supabase, "sa-user")
    expect(result.ok).toBe(true)
  })

  it("denies student hat", async () => {
    const supabase = buildSupabaseStub({
      role: "student",
      tenant_id: "tenant-1",
      user_roles: [{ role: "student" }],
    })
    const result = await requireCourseManager(supabase, "student-user")
    expect(result.ok).toBe(false)
    expect(result.error).toBe("Permissão negada")
  })

  it("denies leader hat", async () => {
    const supabase = buildSupabaseStub({
      role: "leader",
      tenant_id: "tenant-1",
      user_roles: [{ role: "leader" }],
    })
    const result = await requireCourseManager(supabase, "leader-user")
    expect(result.ok).toBe(false)
    expect(result.error).toBe("Permissão negada")
  })

  it("falls back to the singular role when user_roles is empty (pre-backfill defensive path)", async () => {
    const supabase = buildSupabaseStub({
      role: "instructor",
      tenant_id: "tenant-1",
      user_roles: [],
    })
    const result = await requireCourseManager(supabase, "legacy-user")
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("expected ok result")
    expect(result.ctx.hats).toEqual(["instructor"])
  })

  it("returns an error when the profile is not found", async () => {
    const supabase = buildSupabaseStub(null)
    const result = await requireCourseManager(supabase, "ghost-user")
    expect(result.ok).toBe(false)
    expect(result.error).toBe("Perfil não encontrado")
  })
})

describe("isCourseManagerRole", () => {
  it("is true for instructor, admin, super_admin", () => {
    expect(isCourseManagerRole(["instructor"])).toBe(true)
    expect(isCourseManagerRole(["admin"])).toBe(true)
    expect(isCourseManagerRole(["super_admin"])).toBe(true)
  })

  it("is false for a manager-only union", () => {
    expect(isCourseManagerRole(["manager"])).toBe(false)
    expect(isCourseManagerRole(["student", "manager", "leader"])).toBe(false)
  })

  it("is true when manager is present alongside instructor/admin (union, not subtraction)", () => {
    expect(isCourseManagerRole(["manager", "instructor"])).toBe(true)
    expect(isCourseManagerRole(["manager", "admin"])).toBe(true)
  })
})
