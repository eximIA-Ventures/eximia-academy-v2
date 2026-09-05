import { getAuthProfile } from "@/lib/auth"
import type { SessionAnalyticsJsonb } from "@/types/analytics"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { StudentFullProfile } from "./_components/student-full-profile"

// Os selects abaixo usam colunas citadas (`"order"`) e relações aninhadas
// (`chapters(...)`, `courses(...)`, `areas(...)`) que o gerador de tipos do
// Supabase não expande corretamente a partir da string crua do `.select()`.
// Estes tipos locais narrowam o formato real devolvido pelo banco, sem `any`.
type CoursesEmbed = { title: string | null } | { title: string | null }[] | null
type ChaptersRow = {
  id: string
  title: string | null
  order: number | null
  interaction_type: string | null
  course_id: string | null
  courses: CoursesEmbed
}
type ChaptersEmbed = ChaptersRow | ChaptersRow[] | null
type ChapterSlideRow = {
  order: number | null
  chapter_id: string | null
  chapters:
    | { title: string | null; order: number | null }
    | { title: string | null; order: number | null }[]
    | null
}
type ChapterSlideEmbed = ChapterSlideRow | ChapterSlideRow[] | null
type AreaNameEmbed = { name: string | null } | { name: string | null }[] | null

function embedFirst<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

type MessageRow = {
  id: string
  session_id: string
  role: string
  content: string | null
  created_at: string
}

type AssessmentRow = {
  id: string
  assessment_type: string
  results: unknown
  created_at: string
}

export default async function StudentAnalyticsPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params
  const { user, profile } = await getAuthProfile()

  if (!user || !profile) return redirect("/login")
  if (!["leader", "manager", "admin", "instructor", "super_admin"].includes(profile.role))
    return redirect("/dashboard")

  // LGPD gate (fix-manager-privacy-gates, Correção 1 + ratificação do Hugo,
  // 2026-07-13): raw student content (chat messages, slide-reflection text) is
  // visible ONLY when the PRIMARY role (`profile.role`) is instructor, admin or
  // super_admin. A manager or leader is DENIED the verbatim even if they also
  // carry an instructor hat in the role union; the primary role decides,
  // closing the multi-hat loophole (achado do @po). Leader/manager keep the
  // page: aggregate stats and per-module insight only, never the verbatim text.
  const canSeeRawContent =
    profile.role === "instructor" || profile.role === "admin" || profile.role === "super_admin"

  let tenantId = profile.tenant_id
  if (!tenantId) {
    const { resolveTenantId } = await import("@/lib/auth")
    tenantId = await resolveTenantId(null)
  }
  if (!tenantId) return redirect("/dashboard")

  const { createServiceClient } = await import("@/lib/supabase/service")
  const db = createServiceClient()

  // Fetch student + sessions first
  const [{ data: student }, { data: sessions }] = await Promise.all([
    db
      .from("users")
      // Sem `avatar_url`: a coluna não existe no banco (2026-07-28). Pedi-la fazia
      // esta leitura devolver `42703` com `data: null` — e como o `error` era
      // descartado, a página inteira do aluno lia isso como "aluno não existe".
      .select("id, full_name, report_name, email, role, created_at, profile")
      .eq("id", studentId)
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    db
      .from("sessions")
      .select(
        'id, analytics, created_at, status, turn_number, chapter_id, chapters(id, title, "order", interaction_type, course_id, courses(title))',
      )
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
  ])

  if (!student) return redirect("/analytics")

  const sessionIds = (sessions ?? []).map((s) => s.id)

  // Fetch remaining data in parallel
  const [
    { data: reflections },
    { data: enrollments },
    { data: messages },
    { data: userAreas },
    { data: gamification },
  ] = await Promise.all([
    db
      .from("slide_reflections")
      .select(
        'id, slide_id, response, ai_response, created_at, chapter_slides("order", chapter_id, chapters(title, "order"))',
      )
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    // INCIDENT FIX (2026-07-01): hide archived courses + soft-deleted
    // enrollments from the student detail course list shown to managers.
    db
      .from("enrollments")
      .select(
        "id, course_id, status, created_at, completed_at, area_id, courses!inner(title, status)",
      )
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .neq("courses.status", "archived"),
    sessionIds.length > 0
      ? db
          .from("messages")
          .select("id, session_id, role, content, created_at")
          .eq("role", "user")
          .in("session_id", sessionIds)
          .order("created_at", { ascending: true })
          .limit(500)
      : Promise.resolve({ data: [] as MessageRow[] }),
    db.from("user_areas").select("area_id, areas(name)").eq("user_id", studentId),
    db.from("user_gamification").select("*").eq("user_id", studentId).maybeSingle(),
  ])

  // Assessments — table might not exist, catch gracefully
  let assessments: AssessmentRow[] = []
  try {
    const { data } = await db
      .from("assessment_history")
      .select("id, assessment_type, results, created_at")
      .eq("user_id", studentId)
      .order("created_at", { ascending: false })
      .limit(20)
    assessments = data ?? []
  } catch {
    /* table may not exist */
  }

  // Process sessions into structured data
  const allSessions = sessions ?? []
  const allReflections = reflections ?? []
  const allMessages = messages ?? []
  const allEnrollments = enrollments ?? []

  // Group sessions by chapter
  const sessionsByChapter = new Map<string, Array<(typeof allSessions)[0]>>()
  for (const s of allSessions) {
    const title = embedFirst(s.chapters as ChaptersEmbed)?.title ?? "—"
    const list = sessionsByChapter.get(title) ?? []
    list.push(s)
    sessionsByChapter.set(title, list)
  }

  // Group reflections by chapter
  const reflectionsByChapter = new Map<
    string,
    Array<{ slideOrder: number; response: string; aiResponse: string | null; createdAt: string }>
  >()
  for (const r of allReflections) {
    const slide = embedFirst(r.chapter_slides as ChapterSlideEmbed)
    const chapterTitle = embedFirst(slide?.chapters ?? null)?.title ?? "—"
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
  // Count reflections: use slide_reflections if available, else count session messages as reflections
  const effectiveReflectionCount =
    allReflections.length > 0 ? allReflections.length : allMessages.length
  const totalWords =
    allReflections.length > 0
      ? allReflections.reduce((sum, r) => sum + (r.response ?? "").split(/\s+/).length, 0)
      : allMessages.reduce((sum, m) => sum + (m.content ?? "").split(/\s+/).length, 0)
  const avgWordsPerReflection =
    effectiveReflectionCount > 0 ? Math.round(totalWords / effectiveReflectionCount) : 0
  const uniqueChapters = new Set(allSessions.map((s) => s.chapter_id)).size
  const areaName = embedFirst(userAreas?.[0]?.areas as AreaNameEmbed)?.name ?? null
  const memberSince = new Date(student.created_at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })

  let lastActivityDate: string | null = null
  let daysSinceLastActivity: number | null = null
  if (allSessions.length > 0) {
    const latest = Math.max(...allSessions.map((s) => new Date(s.created_at).getTime()))
    lastActivityDate = new Date(latest).toLocaleDateString("pt-BR")
    daysSinceLastActivity = Math.floor((now - latest) / 86400000)
  }

  // Depth progression
  const depthProgression = allSessions
    .filter((s) => s.analytics && (s.analytics as SessionAnalyticsJsonb).depth_reached)
    .map((s) => ({
      date: new Date(s.created_at).toLocaleDateString("pt-BR"),
      depth: (s.analytics as SessionAnalyticsJsonb).depth_reached as number,
      chapter: embedFirst(s.chapters as ChaptersEmbed)?.title ?? "—",
    }))
    .reverse()

  // Per-module (chapter) performance insight (fix-manager-privacy-gates,
  // Correção 1) — the manager/leader replacement for raw content: only
  // ALREADY-AGGREGATED indicators (progress, session counts, reflection
  // counts, last access), never response/message text.
  const moduleInsights = [...sessionsByChapter.entries()]
    .map(([title, chSessions]) => {
      const completed = chSessions.filter((s) => s.status === "completed").length
      const chapterOrder = embedFirst(chSessions[0]?.chapters as ChaptersEmbed)?.order ?? 0
      const lastAccessMs = Math.max(...chSessions.map((s) => new Date(s.created_at).getTime()))
      const depths = chSessions
        .map((s) => (s.analytics as SessionAnalyticsJsonb | null)?.depth_reached)
        .filter((d): d is number => typeof d === "number")
      const avgDepth =
        depths.length > 0
          ? Math.round((depths.reduce((a, b) => a + b, 0) / depths.length) * 10) / 10
          : null
      const reflectionCount = allReflections.filter(
        (r) =>
          (embedFirst(embedFirst(r.chapter_slides as ChapterSlideEmbed)?.chapters ?? null)?.title ??
            "—") === title,
      ).length
      return {
        chapterTitle: title,
        chapterOrder,
        totalSessions: chSessions.length,
        completedSessions: completed,
        reflectionCount,
        avgDepth,
        lastAccessAt: new Date(lastAccessMs).toLocaleDateString("pt-BR"),
      }
    })
    .sort((a, b) => a.chapterOrder - b.chapterOrder)

  // Build props
  const profileData = {
    id: student.id,
    fullName: student.report_name ?? student.full_name ?? "—",
    email: student.email ?? "",
    // Não há fonte de avatar em produção; o componente cai na inicial do nome.
    avatarUrl: null,
    areaName,
    memberSince,
    lastActivityDate,
    daysSinceLastActivity,

    // Stats
    totalSessions: allSessions.length,
    completedSessions,
    totalReflections: effectiveReflectionCount,
    avgWordsPerReflection,
    uniqueChapters,
    totalMessages: allMessages.length,

    // Enrollments
    enrollments: allEnrollments.map((e) => ({
      courseTitle: embedFirst(e.courses as CoursesEmbed)?.title ?? "—",
      status: e.status,
      enrolledAt: e.created_at,
      completedAt: e.completed_at,
    })),

    // Activity trend
    sessionsByWeek,

    // Sessions grouped by chapter. Raw message text (LGPD, Correção 1) is
    // instructor/admin/super_admin only — omitted for leader/manager.
    chapterSessions: [...sessionsByChapter.entries()]
      .map(([title, sessions]) => ({
        chapterTitle: title,
        chapterOrder: embedFirst(sessions[0]?.chapters as ChaptersEmbed)?.order ?? 0,
        interactionType:
          embedFirst(sessions[0]?.chapters as ChaptersEmbed)?.interaction_type ??
          "socratic_dialogue",
        sessions: sessions.map((s) => ({
          id: s.id,
          status: s.status,
          turns: s.turn_number ?? 0,
          createdAt: s.created_at,
          messages: canSeeRawContent ? (messagesBySession.get(s.id) ?? []) : [],
          depth: (s.analytics as SessionAnalyticsJsonb | null)?.depth_reached ?? null,
        })),
      }))
      .sort((a, b) => a.chapterOrder - b.chapterOrder),

    // Reflections grouped by chapter — fallback to session messages when no
    // slide reflections exist. Raw response/aiResponse text (LGPD, Correção 1)
    // is instructor/admin/super_admin only; leader/manager get an empty list
    // and rely on `moduleInsights` (aggregate counts) instead.
    chapterReflections: !canSeeRawContent
      ? []
      : (() => {
          // If we have slide reflections, use them
          if (reflectionsByChapter.size > 0) {
            return [...reflectionsByChapter.entries()].map(([title, refs]) => ({
              chapterTitle: title,
              reflections: refs.sort((a, b) => a.slideOrder - b.slideOrder),
            }))
          }
          // Fallback: build reflections from session messages (Socratic dialogue responses)
          const messageReflections = new Map<
            string,
            Array<{
              slideOrder: number
              response: string
              aiResponse: string | null
              createdAt: string
            }>
          >()
          for (const s of allSessions) {
            const chapterTitle = embedFirst(s.chapters as ChaptersEmbed)?.title ?? "\u2014"
            const sessionMsgs = allMessages.filter((m) => m.session_id === s.id)
            for (let i = 0; i < sessionMsgs.length; i++) {
              const list = messageReflections.get(chapterTitle) ?? []
              list.push({
                slideOrder: i + 1,
                response: (sessionMsgs[i].content ?? "").slice(0, 500),
                aiResponse: null,
                createdAt: sessionMsgs[i].created_at,
              })
              messageReflections.set(chapterTitle, list)
            }
          }
          return [...messageReflections.entries()].map(([title, refs]) => ({
            chapterTitle: title,
            reflections: refs.sort((a, b) => a.slideOrder - b.slideOrder),
          }))
        })(),

    // Depth progression
    depthProgression,

    // LGPD gate flag + per-module insight (fix-manager-privacy-gates,
    // Correção 1) — drives StudentFullProfile's rendering branch.
    canSeeRawContent,
    moduleInsights,

    // Gamification
    gamification: gamification
      ? {
          xp: gamification.xp,
          level: gamification.level,
          currentStreak: gamification.current_streak,
          maxStreak: gamification.max_streak,
        }
      : null,

    // Assessments — SH-F.7: `results` é JSON opaco por assessment_type e PODE
    // conter texto livre do aluno. Mesmo gate fail-closed de messages/reflections
    // (herda a política LGPD por papel primário cravada pelo Hugo): quando
    // !canSeeRawContent, `results` sai `null`, fechando o 2º canal de exposição.
    assessments: (assessments ?? []).map((a) => ({
      type: a.assessment_type,
      results: canSeeRawContent ? a.results : null,
      createdAt: a.created_at,
    })),
  }

  return (
    <div className="space-y-6">
      <Link
        href="/analytics"
        className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-cerrado-600 transition-colors"
      >
        <ArrowLeft size={14} /> Voltar para Analytics
      </Link>
      <StudentFullProfile data={profileData} />
    </div>
  )
}
