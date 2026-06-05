import { createClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

const AREA_COOKIE = "x-active-area"
const COOKIE_MAX_AGE = 60 * 60 * 8 // 8 hours
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getActiveAreaId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(AREA_COOKIE)?.value ?? null
}

export async function setActiveArea(areaId: string) {
  if (!UUID_RE.test(areaId)) return
  const cookieStore = await cookies()
  cookieStore.set(AREA_COOKIE, areaId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  })
}

export async function clearActiveArea() {
  const cookieStore = await cookies()
  cookieStore.delete(AREA_COOKIE)
}

/**
 * Resolves the set of STUDENT ids that belong to a managerial unit (area).
 *
 * This is the reusable scope primitive behind the header Unidade selector: pass
 * the active area id and the function returns the student universe to narrow any
 * dashboard/report to that unit. Mirrors the "unit" scope in
 * `/api/analytics/aggregate` (resolveScopeStudentIds) so the SSR page and the
 * client API describe the SAME population.
 *
 * Contract:
 *   • returns `null`  → no scoping (no area selected / "Todas" → whole tenant)
 *   • returns `[]`    → area selected but it has zero students
 *   • returns [ids]   → the student ids in that unit (role=student only)
 *
 * `db` accepts either the RLS client or the service client, so callers that must
 * bypass RLS (analytics SSR) and callers that don't can share the same helper.
 */
export async function getAreaStudentIds(
  // biome-ignore lint/suspicious/noExplicitAny: loosely-typed RLS/service client, matches lib/supabase/service.ts
  db: SupabaseClient<any, "public", any>,
  tenantId: string,
  areaId: string | null | undefined,
): Promise<string[] | null> {
  if (!areaId || !UUID_RE.test(areaId)) return null
  // Defensive: a missing tenant would silently match nothing — treat as no scope.
  if (!tenantId) return null

  const { data: links } = await db.from("user_areas").select("user_id").eq("area_id", areaId)
  const candidateIds = [...new Set((links ?? []).map((r) => r.user_id as string))]
  if (candidateIds.length === 0) return []

  // user_areas links instructors/admins too — restrict to role=student so the
  // realized universe matches the "students" population the dashboard counts.
  const { data: studentRows } = await db
    .from("users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("role", "student")
    .in("id", candidateIds)
  return [...new Set((studentRows ?? []).map((r) => r.id as string))]
}

export async function getUserAreas(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("user_areas")
    .select("area_id, areas(id, name, slug)")
    .eq("user_id", userId)

  return (data ?? []).map((row) => {
    const area = row.areas as unknown as { id: string; name: string; slug: string }
    return { id: area.id, name: area.name, slug: area.slug }
  })
}
