import { createServiceClient } from "@/lib/supabase/service"

type InstructorPermissionKey =
  | "can_create_courses"
  | "can_create_quizzes"
  | "can_manage_trails"
  | "can_view_analytics"
  | "can_manage_enrollments"

interface InstructorPermissions {
  can_create_courses: boolean
  can_create_quizzes: boolean
  can_manage_trails: boolean
  can_view_analytics: boolean
  can_manage_enrollments: boolean
  assigned_area_ids: string[]
}

// Simple in-memory cache (5 min TTL)
const cache = new Map<string, { data: InstructorPermissions; expiry: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function getInstructorPermissions(
  userId: string,
  tenantId: string,
): Promise<InstructorPermissions | null> {
  const cacheKey = `ip:${userId}:${tenantId}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expiry > Date.now()) {
    return cached.data
  }

  const supabase = createServiceClient()
  const { data } = await supabase
    .from("instructor_permissions")
    .select(
      "can_create_courses, can_create_quizzes, can_manage_trails, can_view_analytics, can_manage_enrollments, assigned_area_ids",
    )
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .single()

  if (!data) return null

  const permissions: InstructorPermissions = {
    can_create_courses: data.can_create_courses,
    can_create_quizzes: data.can_create_quizzes,
    can_manage_trails: data.can_manage_trails,
    can_view_analytics: data.can_view_analytics,
    can_manage_enrollments: data.can_manage_enrollments,
    assigned_area_ids: data.assigned_area_ids ?? [],
  }

  cache.set(cacheKey, { data: permissions, expiry: Date.now() + CACHE_TTL })
  return permissions
}

/**
 * Check if an instructor has a specific permission.
 * Returns true for non-instructor roles (admin/manager always have access).
 */
export async function checkInstructorPermission(
  userId: string,
  tenantId: string,
  permission: InstructorPermissionKey,
): Promise<boolean> {
  const permissions = await getInstructorPermissions(userId, tenantId)
  if (!permissions) return false
  return permissions[permission]
}

/**
 * Get the assigned area IDs for an instructor.
 * Returns empty array if no permissions found.
 */
export async function getInstructorAreaIds(userId: string, tenantId: string): Promise<string[]> {
  const permissions = await getInstructorPermissions(userId, tenantId)
  return permissions?.assigned_area_ids ?? []
}
