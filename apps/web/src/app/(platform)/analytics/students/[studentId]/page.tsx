import { getAuthProfile } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { StudentFullProfile } from "./_components/student-full-profile"

export default async function StudentAnalyticsPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params
  const { user, profile } = await getAuthProfile()

  if (!user || !profile) return redirect("/login")
  if (!["manager", "admin", "instructor", "super_admin"].includes(profile.role)) return redirect("/dashboard")

  let tenantId = profile.tenant_id
  if (!tenantId) {
    const { resolveTenantId } = await import("@/lib/auth")
    tenantId = await resolveTenantId(null)
  }
  if (!tenantId) return redirect("/dashboard")

  const { createServiceClient } = await import("@/lib/supabase/service")
  const db = createServiceClient()

  // Fetch ALL student data in parallel
  const [
    { data: student },
    { data: sessions },
    { data: reflections },
    { data: enrollments },
    { data: messages },
    { data: userAreas },
    { data: assessments },
    { data: gamification },
  ] = await Promise.all([
    db.from("users").select("id, full_name, email, avatar_url, role, created_at, profile").eq("id", studentId).eq("tenant_id", tenantId).single(),
    db.from("sessions").select("id, analytics, created_at, status, turn_number, chapter_id, chapters(id, title, \"order\", interaction_type, course_id, courses(title))").eq("student_id", studentId).eq("tenant_id", tenantId).order("created_at", { ascending: false }),
    db.from("slide_reflections").select("id, slide_id, response, ai_response, created_at, chapter_slides(\"order\", chapter_id, chapters(title, \"order\"))").eq("student_id", studentId).eq("tenant_id", tenantId).order("created_at", { ascending: false }),
    db.from("enrollments").select("id, course_id, status, created_at, completed_at, area_id, courses(title)").eq("student_id", studentId).eq("tenant_id", tenantId),
    db.from("messages").select("id, session_id, role, content, created_at").eq("role", "user").in("session_id", (await db.from("sessions").select("id").eq("student_id", studentId).eq("tenant_id", tenantId)).data?.map((s) => s.id) ?? []).order("created_at", { ascending: true }).limit(500),
    db.from("user_areas").select("area_id, areas(name)").eq("user_id", studentId),
    db.from("assessment_history").select("id, assessment_type, results, created_at").eq("user_id", studentId).order("created_at", { ascending: false }).limit(20),
    db.from("user_gamification").select("*").eq("user_id", studentId).single(),
  ])

  if (!student) return redirect("/analytics")

  // Process sessions into structured data
  const allSessions = sessions ?? []
  const allReflections = reflections ?? []
  const allMessages = messages ?? []
  const allEnrollments = enrollments ?? []

  // Group sessions by chapter
  const sessionsByChapter = new Map<string, Array<typeof allSessions[0]>>()
  for (const s of allSessions) {
    const title = (s.chapters as any)?.title ?? "—"
    const list = sessionsByChapter.get(title) ?? []
    list.push(s)
    sessionsByChapter.set(title, list)
  }

  // Group reflections by chapter
  const reflectionsByChapter = new Map<string, Array<{ slideOrder: number; response: string; aiResponse: string | null; createdAt: string }>>()
  for (const r of allReflections) {
    const slide = r.chapter_slides as any
    const chapterTitle = slide?.chapters?.title ?? "—"
    const list = reflectionsByChapter.get(chapterTitle) ?? []
    list.push({
      slideOrder: slide?.order ?? 0,
      response: r.response ?? "",
      aiResponse: r.ai_response,
      createdAt: r.created_at,
    })
    reflectionsByChapter.set(chapterTitle, list)
  }

  // Sessions by week (last 8 weeks)
  const now = Date.now()
  const sessionsByWeek: Array<{ week: string; count: number }> = []
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(now - (i + 1) * 7 * 86400000)
    const weekEnd = new Date(now - i * 7 * 86400000)
    const count = allSessions.filter((s) => {
      const t = new Date(s.created_at).getTime()
      return t >= weekStart.getTime() && t < weekEnd.getTime()
    }).length
    sessionsByWeek.push({ week: `${weekStart.getDate()}/${weekStart.getMonth() + 1}`, count })
  }

  // Messages per session
  const messagesBySession = new Map<string, string[]>()
  for (const m of allMessages) {
    const list = messagesBySession.get(m.session_id) ?? []
    list.push((m.content ?? "").slice(0, 300))
    messagesBySession.set(m.session_id, list)
  }

  // Compute stats
  const completedSessions = allSessions.filter((s) => s.status === "completed").length
  const totalWords = allReflections.reduce((sum, r) => sum + (r.response ?? "").split(/\s+/).length, 0)
  const avgWordsPerReflection = allReflections.length > 0 ? Math.round(totalWords / allReflections.length) : 0
  const uniqueChapters = new Set(allSessions.map((s) => s.chapter_id)).size
  const areaName = (userAreas?.[0]?.areas as any)?.name ?? null
  const memberSince = new Date(student.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })

  let lastActivityDate: string | null = null
  let daysSinceLastActivity: number | null = null
  if (allSessions.length > 0) {
    const latest = Math.max(...allSessions.map((s) => new Date(s.created_at).getTime()))
    lastActivityDate = new Date(latest).toLocaleDateString("pt-BR")
    daysSinceLastActivity = Math.floor((now - latest) / 86400000)
  }

  // Depth progression
  const depthProgression = allSessions
    .filter((s) => s.analytics && (s.analytics as any).depth_reached)
    .map((s) => ({
      date: new Date(s.created_at).toLocaleDateString("pt-BR"),
      depth: (s.analytics as any).depth_reached as number,
      chapter: (s.chapters as any)?.title ?? "—",
    }))
    .reverse()

  // Build props
  const profileData = {
    id: student.id,
    fullName: student.full_name ?? "—",
    email: student.email ?? "",
    avatarUrl: student.avatar_url,
    areaName,
    memberSince,
    lastActivityDate,
    daysSinceLastActivity,

    // Stats
    totalSessions: allSessions.length,
    completedSessions,
    totalReflections: allReflections.length,
    avgWordsPerReflection,
    uniqueChapters,
    totalMessages: allMessages.length,

    // Enrollments
    enrollments: allEnrollments.map((e) => ({
      courseTitle: (e.courses as any)?.title ?? "—",
      status: e.status,
      enrolledAt: e.created_at,
      completedAt: e.completed_at,
    })),

    // Activity trend
    sessionsByWeek,

    // Sessions grouped by chapter
    chapterSessions: [...sessionsByChapter.entries()].map(([title, sessions]) => ({
      chapterTitle: title,
      chapterOrder: (sessions[0]?.chapters as any)?.order ?? 0,
      interactionType: (sessions[0]?.chapters as any)?.interaction_type ?? "socratic_dialogue",
      sessions: sessions.map((s) => ({
        id: s.id,
        status: s.status,
        turns: s.turn_number ?? 0,
        createdAt: s.created_at,
        messages: messagesBySession.get(s.id) ?? [],
        depth: (s.analytics as any)?.depth_reached ?? null,
      })),
    })).sort((a, b) => a.chapterOrder - b.chapterOrder),

    // Reflections grouped by chapter
    chapterReflections: [...reflectionsByChapter.entries()].map(([title, refs]) => ({
      chapterTitle: title,
      reflections: refs.sort((a, b) => a.slideOrder - b.slideOrder),
    })),

    // Depth progression
    depthProgression,

    // Gamification
    gamification: gamification ? {
      xp: gamification.xp,
      level: gamification.level,
      currentStreak: gamification.current_streak,
      maxStreak: gamification.max_streak,
    } : null,

    // Assessments
    assessments: (assessments ?? []).map((a) => ({
      type: a.assessment_type,
      results: a.results,
      createdAt: a.created_at,
    })),
  }

  return (
    <div className="space-y-6">
      <Link href="/analytics" className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-cerrado-600 transition-colors">
        <ArrowLeft size={14} /> Voltar para Analytics
      </Link>
      <StudentFullProfile data={profileData} />
    </div>
  )
}
