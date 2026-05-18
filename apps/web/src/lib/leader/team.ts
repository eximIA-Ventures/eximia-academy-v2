import { createServiceClient } from "@/lib/supabase/service"

/**
 * Resolves the team members for a leader based on shared areas.
 * A leader sees all users assigned to the same area(s) they belong to.
 */
export async function getLeaderTeam(leaderId: string, tenantId: string) {
  const db = createServiceClient()

  // 1. Find the leader's area(s)
  const { data: leaderAreas } = await db
    .from("user_areas")
    .select("area_id, areas(id, name, slug)")
    .eq("user_id", leaderId)

  if (!leaderAreas || leaderAreas.length === 0) {
    return { areas: [], members: [] }
  }

  const areaIds = leaderAreas.map((ua) => ua.area_id)
  const areas = leaderAreas.map((ua) => {
    const area = ua.areas as unknown as { id: string; name: string; slug: string }
    return { id: area.id, name: area.name, slug: area.slug }
  })

  // 2. Find all users in those areas (excluding the leader themselves)
  const { data: teamUserAreas } = await db
    .from("user_areas")
    .select("user_id, area_id")
    .in("area_id", areaIds)

  const teamUserIds = [
    ...new Set(
      (teamUserAreas ?? [])
        .map((ua) => ua.user_id)
        .filter((id) => id !== leaderId),
    ),
  ]

  if (teamUserIds.length === 0) {
    return { areas, members: [] }
  }

  // 3. Fetch full user info for team members
  const { data: members } = await db
    .from("users")
    .select("id, full_name, email, avatar_url, role, status, created_at")
    .eq("tenant_id", tenantId)
    .in("id", teamUserIds)
    .eq("status", "active")
    .order("full_name")

  return {
    areas,
    members: (members ?? []).map((m) => ({
      id: m.id,
      fullName: m.full_name ?? "",
      email: m.email ?? "",
      avatarUrl: m.avatar_url,
      role: m.role,
      createdAt: m.created_at,
    })),
  }
}

/**
 * Fetches team progress data for the leader dashboard.
 * Returns enriched member data with enrollment + session stats.
 */
export async function getLeaderTeamProgress(
  teamMemberIds: string[],
  tenantId: string,
) {
  if (teamMemberIds.length === 0) {
    return {
      enrollments: [],
      sessions: [],
      reflections: [],
      courses: [],
    }
  }

  const db = createServiceClient()

  const [
    { data: enrollments },
    { data: sessions },
    { data: reflections },
    { data: courses },
  ] = await Promise.all([
    db
      .from("enrollments")
      .select("id, student_id, course_id, status, created_at, updated_at, courses(title)")
      .eq("tenant_id", tenantId)
      .in("student_id", teamMemberIds),
    db
      .from("sessions")
      .select("id, student_id, chapter_id, status, created_at, turn_number, analytics")
      .eq("tenant_id", tenantId)
      .in("student_id", teamMemberIds),
    db
      .from("slide_reflections")
      .select("id, student_id, slide_id, response, created_at, chapter_slides(chapter_id, chapters(title))")
      .eq("tenant_id", tenantId)
      .in("student_id", teamMemberIds)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("courses")
      .select("id, title")
      .eq("tenant_id", tenantId)
      .neq("status", "archived")
      .order("title"),
  ])

  return {
    enrollments: enrollments ?? [],
    sessions: sessions ?? [],
    reflections: reflections ?? [],
    courses: courses ?? [],
  }
}
