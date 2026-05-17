"use server"

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

export async function toggleViewAsStudent() {
  const cookieStore = await cookies()
  const current = cookieStore.get("x-view-as-student")?.value === "true"

  if (current) {
    cookieStore.delete("x-view-as-student")
  } else {
    cookieStore.set("x-view-as-student", "true", {
      path: "/",
      httpOnly: false,
      maxAge: 60 * 60 * 4,
      sameSite: "lax",
    })
  }

  revalidatePath("/", "layout")
  return { viewAsStudent: !current }
}

export interface InstructorDashboardData {
  courses: {
    id: string
    title: string
    status: string
    enrollmentCount: number
  }[]
  students: {
    totalStudents: number
    activeThisWeek: number
    avgProgress: number
  }
  analytics: {
    sessionsThisWeek: number
    completionRate: number
    avgScore: number
  }
}

export interface RecentReflection {
  slideOrder: number
  chapterTitle: string
  response: string
  createdAt: string
}

export interface RecentSession {
  sessionId: string
  chapterTitle: string
  interactionType: string
  chapterOrder?: number
  status: string
  turns: number
  createdAt: string
  studentMessages: string[]
}

export interface StudentDetail {
  id: string
  full_name: string
  email: string
  role: string
  lastSessionDate: string | null
  totalSessions: number
  completedSessions: number
  /** Sessions where the student actually wrote messages */
  sessionsWithMessages: number
  /** Total messages the student wrote across all sessions */
  totalMessages: number
  coursesEnrolled: number
  coursesCompleted: number
  reflectionsCount: number
  recentReflections: RecentReflection[]
  recentSessions: RecentSession[]
}

export interface TenantReflection {
  studentName: string
  chapterTitle: string
  slideOrder: number
  response: string
  hasAiResponse: boolean
  createdAt: string
}

export async function getStudentDetails(tenantId: string, areaId?: string | null): Promise<StudentDetail[]> {
  const serviceClient = createServiceClient()

  // 1. Get students — filter by area if provided
  let studentQuery = serviceClient
    .from("users")
    .select("id, full_name, email, role")
    .eq("tenant_id", tenantId)
    .eq("role", "student")
    .order("full_name")

  // Area-scoped filtering via user_areas
  let areaStudentIds: string[] | null = null
  if (areaId) {
    const { data: areaUsers } = await serviceClient
      .from("user_areas")
      .select("user_id")
      .eq("area_id", areaId)
    areaStudentIds = (areaUsers ?? []).map((r) => r.user_id)
    if (areaStudentIds.length === 0) return []
    studentQuery = studentQuery.in("id", areaStudentIds)
  }

  const { data: students } = await studentQuery

  if (!students || students.length === 0) return []

  const studentIds = students.map((s) => s.id)

  // 2. Batch fetch all related data in parallel
  const [
    { data: sessions },
    { data: enrollments },
    { data: reflections },
    { data: detailedReflections },
    { data: detailedSessions },
  ] = await Promise.all([
    serviceClient
      .from("sessions")
      .select("id, student_id, status, created_at")
      .eq("tenant_id", tenantId)
      .in("student_id", studentIds),
    serviceClient
      .from("enrollments")
      .select("id, student_id, status, course_id")
      .eq("tenant_id", tenantId)
      .in("student_id", studentIds),
    serviceClient
      .from("slide_reflections")
      .select("id, student_id")
      .eq("tenant_id", tenantId)
      .in("student_id", studentIds),
    // Fetch reflections with slide/chapter details for recent reflections
    serviceClient
      .from("slide_reflections")
      .select("student_id, slide_id, response, created_at, chapter_slides(order, chapter_id, chapters(title))")
      .eq("tenant_id", tenantId)
      .in("student_id", studentIds)
      .order("created_at", { ascending: false })
      .limit(500),
    // Fetch sessions with chapter details for recent sessions (include order for module sorting)
    serviceClient
      .from("sessions")
      .select("id, student_id, status, turn_number, created_at, chapters(title, interaction_type, \"order\")")
      .eq("tenant_id", tenantId)
      .in("student_id", studentIds)
      .order("created_at", { ascending: false })
      .limit(500),
  ])

  // Fetch student messages for all recent sessions
  const recentSessionIds = (detailedSessions ?? []).slice(0, 200).map((s: any) => s.id)

  const messagesBySession = new Map<string, string[]>()
  if (recentSessionIds.length > 0) {
    const { data: msgs } = await serviceClient
      .from("messages")
      .select("session_id, role, content")
      .in("session_id", recentSessionIds)
      .eq("role", "user")
      .order("created_at", { ascending: true })

    for (const m of msgs ?? []) {
      const list = messagesBySession.get(m.session_id) ?? []
      list.push((m.content ?? "").slice(0, 200))
      messagesBySession.set(m.session_id, list)
    }
  }

  // 3. Build lookup maps
  const sessionsByStudent = new Map<string, Array<{ status: string; created_at: string }>>()
  for (const s of sessions ?? []) {
    const list = sessionsByStudent.get(s.student_id) ?? []
    list.push({ status: s.status, created_at: s.created_at })
    sessionsByStudent.set(s.student_id, list)
  }

  const enrollmentsByStudent = new Map<string, Array<{ status: string }>>()
  for (const e of enrollments ?? []) {
    const list = enrollmentsByStudent.get(e.student_id) ?? []
    list.push({ status: e.status })
    enrollmentsByStudent.set(e.student_id, list)
  }

  const reflectionsByStudent = new Map<string, number>()
  for (const r of reflections ?? []) {
    reflectionsByStudent.set(r.student_id, (reflectionsByStudent.get(r.student_id) ?? 0) + 1)
  }

  // Build recent reflections lookup (top 5 per student)
  const recentReflectionsByStudent = new Map<string, RecentReflection[]>()
  for (const r of detailedReflections ?? []) {
    const list = recentReflectionsByStudent.get(r.student_id) ?? []
    if (list.length >= 5) continue
    const slide = r.chapter_slides as unknown as { order: number; chapter_id: string; chapters: { title: string } | null } | null
    list.push({
      slideOrder: slide?.order ?? 0,
      chapterTitle: slide?.chapters?.title ?? "—",
      response: (r.response ?? "").slice(0, 500),
      createdAt: r.created_at,
    })
    recentReflectionsByStudent.set(r.student_id, list)
  }

  // Build recent sessions lookup (top 5 per student)
  const recentSessionsByStudent = new Map<string, RecentSession[]>()
  for (const s of detailedSessions ?? []) {
    const list = recentSessionsByStudent.get(s.student_id) ?? []
    if (list.length >= 5) continue
    const chapter = s.chapters as unknown as { title: string; interaction_type: string | null; order?: number } | null
    list.push({
      sessionId: s.id,
      chapterTitle: chapter?.title ?? "—",
      interactionType: chapter?.interaction_type ?? "socratic_dialogue",
      chapterOrder: chapter?.order ?? 999,
      status: s.status,
      turns: (s as any).turn_number ?? 0,
      createdAt: s.created_at,
      studentMessages: messagesBySession.get(s.id) ?? [],
    })
    recentSessionsByStudent.set(s.student_id, list)
  }

  // Build messages-per-student lookup
  const messagesPerStudent = new Map<string, { sessionsWithMsgs: number; totalMsgs: number }>()
  for (const s of sessions ?? []) {
    const msgs = messagesBySession.get(s.id)
    if (msgs && msgs.length > 0) {
      const curr = messagesPerStudent.get(s.student_id) ?? { sessionsWithMsgs: 0, totalMsgs: 0 }
      curr.sessionsWithMsgs++
      curr.totalMsgs += msgs.length
      messagesPerStudent.set(s.student_id, curr)
    }
  }

  // 4. Aggregate per student
  return students.map((student) => {
    const studentSessions = sessionsByStudent.get(student.id) ?? []
    const studentEnrollments = enrollmentsByStudent.get(student.id) ?? []
    const msgStats = messagesPerStudent.get(student.id) ?? { sessionsWithMsgs: 0, totalMsgs: 0 }

    // Find most recent session date
    let lastSessionDate: string | null = null
    if (studentSessions.length > 0) {
      const sorted = studentSessions
        .map((s) => s.created_at)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      lastSessionDate = sorted[0] ?? null
    }

    return {
      id: student.id,
      full_name: student.full_name ?? "",
      email: student.email ?? "",
      role: student.role,
      lastSessionDate,
      totalSessions: studentSessions.length,
      completedSessions: studentSessions.filter((s) => s.status === "completed").length,
      sessionsWithMessages: msgStats.sessionsWithMsgs,
      totalMessages: msgStats.totalMsgs,
      coursesEnrolled: studentEnrollments.length,
      coursesCompleted: studentEnrollments.filter((e) => e.status === "completed").length,
      reflectionsCount: reflectionsByStudent.get(student.id) ?? 0,
      recentReflections: recentReflectionsByStudent.get(student.id) ?? [],
      recentSessions: recentSessionsByStudent.get(student.id) ?? [],
    }
  })
}

export async function getInstructorDashboardData(
  userId: string,
  tenantId: string,
  activeAreaId?: string | null,
): Promise<InstructorDashboardData> {
  const supabase = await createClient()
  const serviceClient = createServiceClient()

  // Get instructor's assigned area IDs
  const { data: permData } = await serviceClient
    .from("instructor_permissions")
    .select("assigned_area_ids")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .single()

  // activeAreaId = specific area selected, null = "Todas" (no area filter)
  const areaIds: string[] = activeAreaId ? [activeAreaId] : []

  // 1. Courses — filter by area via course_areas junction table
  let courses: Array<{ id: string; title: string; status: string }> | null = null

  if (activeAreaId) {
    // Get course IDs for this area from junction table
    const { data: courseAreaRows } = await serviceClient
      .from("course_areas")
      .select("course_id")
      .eq("area_id", activeAreaId)
      .eq("tenant_id", tenantId)

    const areaCourseIds = (courseAreaRows ?? []).map((r) => r.course_id)

    if (areaCourseIds.length > 0) {
      const { data } = await serviceClient
        .from("courses")
        .select("id, title, status")
        .eq("tenant_id", tenantId)
        .in("id", areaCourseIds)
        .neq("status", "archived")
        .order("created_at", { ascending: false })
        .limit(20)
      courses = data
    } else {
      // Fallback: also check courses.area_id for backwards compatibility
      const { data } = await serviceClient
        .from("courses")
        .select("id, title, status")
        .eq("tenant_id", tenantId)
        .eq("area_id", activeAreaId)
        .neq("status", "archived")
        .order("created_at", { ascending: false })
        .limit(20)
      courses = data
    }
  } else {
    const { data } = await serviceClient
      .from("courses")
      .select("id, title, status")
      .eq("tenant_id", tenantId)
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(20)
    courses = data
  }

  const coursesWithEnrollments = await Promise.all(
    (courses ?? []).map(async (course) => {
      const { count } = await serviceClient
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .eq("course_id", course.id)

      return {
        id: course.id,
        title: course.title,
        status: course.status,
        enrollmentCount: count ?? 0,
      }
    }),
  )

  // 2. Students in assigned areas (or all if no areas assigned)
  let totalStudents = 0
  let activeThisWeek = 0
  let avgProgress = 0

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  if (areaIds.length > 0) {
    const { data: studentRows } = await serviceClient
      .from("user_areas")
      .select("user_id")
      .in("area_id", areaIds)

    const studentIds = [...new Set((studentRows ?? []).map((r) => r.user_id))]
    totalStudents = studentIds.length

    if (studentIds.length > 0) {
      const { data: activeSessions } = await serviceClient
        .from("sessions")
        .select("student_id")
        .in("student_id", studentIds)
        .gte("created_at", weekAgo)

      activeThisWeek = new Set((activeSessions ?? []).map((s) => s.student_id)).size

      const { count: completedEnrollments } = await serviceClient
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .in("student_id", studentIds)
        .eq("status", "completed")

      const { count: totalEnrollments } = await serviceClient
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .in("student_id", studentIds)
        .in("status", ["active", "completed"])

      avgProgress =
        (totalEnrollments ?? 0) > 0
          ? Math.round(((completedEnrollments ?? 0) / (totalEnrollments ?? 1)) * 100)
          : 0
    }
  } else {
    // No areas assigned — show all tenant students
    const { count: allStudents } = await serviceClient
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("role", "student")

    totalStudents = allStudents ?? 0

    const { data: activeSessions } = await serviceClient
      .from("sessions")
      .select("student_id")
      .eq("tenant_id", tenantId)
      .gte("created_at", weekAgo)

    activeThisWeek = new Set((activeSessions ?? []).map((s) => s.student_id)).size

    const { count: completedEnrollments } = await serviceClient
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "completed")

    const { count: totalEnrollments } = await serviceClient
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("status", ["active", "completed"])

    avgProgress =
      (totalEnrollments ?? 0) > 0
        ? Math.round(((completedEnrollments ?? 0) / (totalEnrollments ?? 1)) * 100)
        : 0
  }

  // 3. Analytics: sessions this week — scoped to area students when filtered
  const courseIds = (courses ?? []).map((c) => c.id)
  let sessionsThisWeek = 0
  let completionRate = 0
  let avgScore = 0

  // Get student IDs for area filtering (reuse from section 2 or fetch fresh)
  let areaStudentIds: string[] | null = null
  if (areaIds.length > 0) {
    const { data: areaRows } = await serviceClient
      .from("user_areas")
      .select("user_id")
      .in("area_id", areaIds)
    areaStudentIds = [...new Set((areaRows ?? []).map((r) => r.user_id))]
  }

  if (courseIds.length > 0) {
    // Get chapter IDs for instructor's courses
    const { data: chapters } = await serviceClient
      .from("chapters")
      .select("id")
      .in("course_id", courseIds)

    const chapterIds = (chapters ?? []).map((ch) => ch.id)

    if (chapterIds.length > 0) {
      // Sessions this week — filter by area students if applicable
      let weekSessionsQuery = serviceClient
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .in("chapter_id", chapterIds)
        .gte("created_at", weekAgo)
      if (areaStudentIds) weekSessionsQuery = weekSessionsQuery.in("student_id", areaStudentIds)
      const { count: weekSessions } = await weekSessionsQuery

      sessionsThisWeek = weekSessions ?? 0

      // Completion rate based on SESSIONS (real progress), not enrollment status
      // A student's completion = their completed sessions / total available chapters
      let allSessionsQuery = serviceClient
        .from("sessions")
        .select("student_id, status")
        .in("chapter_id", chapterIds)
      if (areaStudentIds) allSessionsQuery = allSessionsQuery.in("student_id", areaStudentIds)
      const { data: allSessions } = await allSessionsQuery

      if (allSessions && allSessions.length > 0) {
        const totalChapters = chapterIds.length
        // Group by student: count completed sessions per student
        const studentCompleted = new Map<string, number>()
        for (const s of allSessions) {
          if (s.status === "completed") {
            studentCompleted.set(s.student_id, (studentCompleted.get(s.student_id) ?? 0) + 1)
          }
        }
        // Average completion across students who have at least 1 session
        const uniqueStudents = new Set(allSessions.map((s) => s.student_id))
        let totalPct = 0
        for (const sid of uniqueStudents) {
          const completed = studentCompleted.get(sid) ?? 0
          totalPct += Math.min(100, Math.round((completed / totalChapters) * 100))
        }
        completionRate = uniqueStudents.size > 0 ? Math.round(totalPct / uniqueStudents.size) : 0
      }

      // Average score from analyses — scoped to area students
      let scoreSessionsQuery = serviceClient
        .from("sessions")
        .select("id")
        .in("chapter_id", chapterIds)
        .eq("status", "completed")
        .limit(100)
      if (areaStudentIds) scoreSessionsQuery = scoreSessionsQuery.in("student_id", areaStudentIds)
      const { data: sessionRows } = await scoreSessionsQuery

      const sessionIds = (sessionRows ?? []).map((s) => s.id)
      if (sessionIds.length > 0) {
        const { data: analyses } = await serviceClient
          .from("analyses")
          .select("metrics")
          .in("session_id", sessionIds)

        let totalScore = 0
        let scoreCount = 0
        for (const a of analyses ?? []) {
          const metrics = a.metrics as Record<string, unknown> | null
          const quality = metrics?.quality as Record<string, unknown> | null
          const score = quality?.overall_score as number | undefined
          if (typeof score === "number") {
            totalScore += score
            scoreCount++
          }
        }
        avgScore = scoreCount > 0 ? Math.round((totalScore / scoreCount) * 10) / 10 : 0
      }
    }
  }

  return {
    courses: coursesWithEnrollments,
    students: {
      totalStudents,
      activeThisWeek,
      avgProgress,
    },
    analytics: {
      sessionsThisWeek,
      completionRate,
      avgScore,
    },
  }
}

export async function getRecentReflections(tenantId: string, areaId?: string | null): Promise<{
  total: number
  recent: TenantReflection[]
}> {
  const serviceClient = createServiceClient()

  // Area-scoped student filter
  let areaStudentIds: string[] | null = null
  if (areaId) {
    const { data: areaUsers } = await serviceClient
      .from("user_areas")
      .select("user_id")
      .eq("area_id", areaId)
    areaStudentIds = (areaUsers ?? []).map((r) => r.user_id)
    if (areaStudentIds.length === 0) return { total: 0, recent: [] }
  }

  // Get total count
  let countQuery = serviceClient
    .from("slide_reflections")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
  if (areaStudentIds) countQuery = countQuery.in("student_id", areaStudentIds)
  const { count } = await countQuery

  // Fetch reflections (up to 100 for filtering)
  let reflQuery = serviceClient
    .from("slide_reflections")
    .select("student_id, slide_id, response, ai_response, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(100)
  if (areaStudentIds) reflQuery = reflQuery.in("student_id", areaStudentIds)
  const { data: reflections } = await reflQuery

  if (!reflections?.length) {
    return { total: count ?? 0, recent: [] }
  }

  // Resolve student names
  const studentIds = [...new Set(reflections.map((r) => r.student_id))]
  const { data: students } = await serviceClient
    .from("users")
    .select("id, full_name")
    .in("id", studentIds)
  const studentMap = new Map((students ?? []).map((s) => [s.id, s.full_name]))

  // Resolve slide → chapter info (include chapter order for sorting)
  const slideIds = [...new Set(reflections.map((r) => r.slide_id).filter(Boolean))]
  let slideMap = new Map<string, { order: number; chapterTitle: string; chapterOrder: number; chapterId: string }>()

  if (slideIds.length > 0) {
    const { data: slides } = await serviceClient
      .from("chapter_slides")
      .select("id, \"order\", chapter_id")
      .in("id", slideIds)

    if (slides?.length) {
      const chapterIds = [...new Set(slides.map((s) => s.chapter_id))]
      const { data: chapters } = await serviceClient
        .from("chapters")
        .select("id, title, \"order\"")
        .in("id", chapterIds)
      const chapterMap = new Map((chapters ?? []).map((c) => [c.id, { title: c.title, order: (c as any).order ?? 0 }]))

      for (const s of slides) {
        const chapter = chapterMap.get(s.chapter_id)
        slideMap.set(s.id, {
          order: s.order ?? 0,
          chapterTitle: chapter?.title ?? "—",
          chapterOrder: chapter?.order ?? 0,
          chapterId: s.chapter_id,
        })
      }
    }
  }

  const recent: TenantReflection[] = reflections.map((r) => {
    const slide = r.slide_id ? slideMap.get(r.slide_id) : null
    return {
      studentName: studentMap.get(r.student_id) ?? "—",
      chapterTitle: slide?.chapterTitle ?? "—",
      slideOrder: slide?.order ?? 0,
      response: (r.response ?? "").slice(0, 150),
      hasAiResponse: !!r.ai_response,
      createdAt: r.created_at,
    }
  })

  // Sort by chapter order, then slide order (instead of just chronological)
  recent.sort((a, b) => {
    const aSlide = reflections.find((r) => r.slide_id && slideMap.get(r.slide_id)?.chapterTitle === a.chapterTitle)
    const bSlide = reflections.find((r) => r.slide_id && slideMap.get(r.slide_id)?.chapterTitle === b.chapterTitle)
    const aChapterOrder = aSlide?.slide_id ? slideMap.get(aSlide.slide_id)?.chapterOrder ?? 0 : 0
    const bChapterOrder = bSlide?.slide_id ? slideMap.get(bSlide.slide_id)?.chapterOrder ?? 0 : 0
    if (aChapterOrder !== bChapterOrder) return aChapterOrder - bChapterOrder
    return a.slideOrder - b.slideOrder
  })

  return {
    total: count ?? 0,
    recent,
  }
}
