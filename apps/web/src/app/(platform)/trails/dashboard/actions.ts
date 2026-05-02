"use server"

import { createClient } from "@/lib/supabase/server"

// ---- Types ----

export interface TrailStat {
  trailId: string
  trailTitle: string
  status: string
  targetRoleName: string | null
  studentCount: number
  completedCount: number
  avgCompletionPct: number
}

export interface RoleCoverage {
  roleId: string
  roleName: string
  seniorityLevel: string
  hasTrail: boolean
  trailCount: number
}

export interface StudentProgress {
  userId: string
  fullName: string
  roleName: string | null
  trailId: string
  trailTitle: string
  progressPct: number
  status: "active" | "completed" | "dropped"
}

export interface TrailDashboardData {
  trailStats: TrailStat[]
  roleCoverage: RoleCoverage[]
  studentProgress: StudentProgress[]
  trails: Array<{ id: string; title: string }>
  roles: Array<{ id: string; name: string }>
}

// ---- Server Action ----

export async function getTrailDashboardData(): Promise<
  { data: TrailDashboardData } | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile) return { error: "Perfil não encontrado" }
  if (!["manager", "admin", "super_admin"].includes(profile.role)) {
    return { error: "Permissão negada" }
  }

  const tenantId = profile.tenant_id

  // ---- 1. Fetch all trails for this tenant ----
  const { data: trails } = await supabase
    .from("learning_trails")
    .select("id, title, status, target_job_role_id")
    .order("title", { ascending: true })

  const allTrails = trails ?? []
  const trailIds = allTrails.map((t) => t.id)

  // ---- 2. Fetch all job roles ----
  const { data: jobRoles } = await supabase
    .from("job_roles")
    .select("id, name, seniority_level")
    .order("name", { ascending: true })

  const allRoles = jobRoles ?? []

  // ---- 3. Get target role names ----
  const roleIds = [
    ...new Set(allTrails.filter((t) => t.target_job_role_id).map((t) => t.target_job_role_id!)),
  ]
  const roleNameMap = new Map(allRoles.map((r) => [r.id, r.name]))

  // ---- 4. Get enrollments for all trails ----
  const { data: enrollments } = trailIds.length
    ? await supabase
        .from("enrollments")
        .select("student_id, trail_id, status, course_id")
        .in("trail_id", trailIds)
        .in("status", ["active", "completed"])
    : { data: [] }

  const allEnrollments = enrollments ?? []

  // ---- 5. Get trail_courses to compute per-trail total course count ----
  const { data: trailCourses } = trailIds.length
    ? await supabase.from("trail_courses").select("trail_id, course_id").in("trail_id", trailIds)
    : { data: [] }

  const trailCourseCountMap = new Map<string, number>()
  for (const tc of trailCourses ?? []) {
    trailCourseCountMap.set(tc.trail_id, (trailCourseCountMap.get(tc.trail_id) ?? 0) + 1)
  }

  // ---- 6. Compute trail stats ----
  // Group enrollments by trail_id + student_id
  const trailStudentMap = new Map<string, Map<string, { total: number; completed: number }>>()
  for (const e of allEnrollments) {
    if (!e.trail_id) continue
    if (!trailStudentMap.has(e.trail_id)) {
      trailStudentMap.set(e.trail_id, new Map())
    }
    const studentMap = trailStudentMap.get(e.trail_id)!
    if (!studentMap.has(e.student_id)) {
      studentMap.set(e.student_id, { total: 0, completed: 0 })
    }
    const entry = studentMap.get(e.student_id)!
    entry.total++
    if (e.status === "completed") entry.completed++
  }

  const trailStats: TrailStat[] = allTrails.map((trail) => {
    const studentMap = trailStudentMap.get(trail.id)
    const studentCount = studentMap?.size ?? 0
    const totalCoursesInTrail = trailCourseCountMap.get(trail.id) ?? 1

    // Count students who completed ALL courses in the trail
    let completedCount = 0
    let totalProgressPct = 0

    if (studentMap) {
      for (const [, progress] of studentMap) {
        const pct =
          totalCoursesInTrail > 0
            ? Math.round((progress.completed / totalCoursesInTrail) * 100)
            : 0
        totalProgressPct += Math.min(pct, 100)
        if (progress.completed >= totalCoursesInTrail && totalCoursesInTrail > 0) {
          completedCount++
        }
      }
    }

    const avgCompletionPct = studentCount > 0 ? Math.round(totalProgressPct / studentCount) : 0

    return {
      trailId: trail.id,
      trailTitle: trail.title,
      status: trail.status,
      targetRoleName: trail.target_job_role_id
        ? roleNameMap.get(trail.target_job_role_id) ?? null
        : null,
      studentCount,
      completedCount,
      avgCompletionPct,
    }
  })

  // ---- 7. Compute role coverage ----
  const trailsPerRole = new Map<string, number>()
  for (const trail of allTrails) {
    if (trail.target_job_role_id) {
      trailsPerRole.set(
        trail.target_job_role_id,
        (trailsPerRole.get(trail.target_job_role_id) ?? 0) + 1,
      )
    }
  }

  const roleCoverage: RoleCoverage[] = allRoles.map((role) => {
    const trailCount = trailsPerRole.get(role.id) ?? 0
    return {
      roleId: role.id,
      roleName: role.name,
      seniorityLevel: role.seniority_level,
      hasTrail: trailCount > 0,
      trailCount,
    }
  })

  // ---- 8. Student progress table ----
  // Get all students enrolled in trails
  const studentIds = [...new Set(allEnrollments.map((e) => e.student_id))]
  const { data: students } = studentIds.length
    ? await supabase
        .from("users")
        .select("id, full_name, job_role_id")
        .in("id", studentIds)
    : { data: [] }

  const studentMap = new Map(
    (students ?? []).map((s) => [s.id, { fullName: s.full_name, jobRoleId: s.job_role_id }]),
  )

  // Aggregate per student per trail
  const studentTrailKey = (studentId: string, trailId: string) => `${studentId}::${trailId}`
  const studentTrailProgress = new Map<
    string,
    { studentId: string; trailId: string; total: number; completed: number; hasActive: boolean }
  >()

  for (const e of allEnrollments) {
    if (!e.trail_id) continue
    const key = studentTrailKey(e.student_id, e.trail_id)
    if (!studentTrailProgress.has(key)) {
      studentTrailProgress.set(key, {
        studentId: e.student_id,
        trailId: e.trail_id,
        total: 0,
        completed: 0,
        hasActive: false,
      })
    }
    const entry = studentTrailProgress.get(key)!
    entry.total++
    if (e.status === "completed") {
      entry.completed++
    } else if (e.status === "active") {
      entry.hasActive = true
    }
  }

  const trailTitleMap = new Map(allTrails.map((t) => [t.id, t.title]))

  const studentProgress: StudentProgress[] = []
  for (const [, entry] of studentTrailProgress) {
    const student = studentMap.get(entry.studentId)
    if (!student) continue

    const totalCoursesInTrail = trailCourseCountMap.get(entry.trailId) ?? 1
    const progressPct =
      totalCoursesInTrail > 0
        ? Math.min(Math.round((entry.completed / totalCoursesInTrail) * 100), 100)
        : 0

    let status: "active" | "completed" | "dropped" = "active"
    if (entry.completed >= totalCoursesInTrail && totalCoursesInTrail > 0) {
      status = "completed"
    } else if (!entry.hasActive && entry.completed < totalCoursesInTrail) {
      // All enrollments are either completed or dropped, but not enough completed
      status = entry.total > 0 ? "active" : "dropped"
    }

    studentProgress.push({
      userId: entry.studentId,
      fullName: student.fullName,
      roleName: student.jobRoleId ? roleNameMap.get(student.jobRoleId) ?? null : null,
      trailId: entry.trailId,
      trailTitle: trailTitleMap.get(entry.trailId) ?? "Trilha desconhecida",
      progressPct,
      status,
    })
  }

  // Sort by trail title, then student name
  studentProgress.sort((a, b) => {
    const trailCmp = a.trailTitle.localeCompare(b.trailTitle)
    if (trailCmp !== 0) return trailCmp
    return a.fullName.localeCompare(b.fullName)
  })

  return {
    data: {
      trailStats,
      roleCoverage,
      studentProgress,
      trails: allTrails.map((t) => ({ id: t.id, title: t.title })),
      roles: allRoles.map((r) => ({ id: r.id, name: r.name })),
    },
  }
}
