import { getAuthProfile } from "@/lib/auth"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { CourseDetailClient } from "./_components/course-detail-client"

interface CourseDetailPageProps {
  params: Promise<{ courseId: string }>
}

export default async function CourseDetailPage({ params }: CourseDetailPageProps) {
  const { courseId } = await params
  const { user, profile, supabase } = await getAuthProfile()
  if (!user || !profile) return redirect("/login")

  // "View as student" mode — override role for all UI decisions
  const viewAsStudent = (await cookies()).get("x-view-as-student")?.value === "true"
  const effectiveRole =
    viewAsStudent &&
    (profile.role === "instructor" || profile.role === "admin" || profile.role === "super_admin")
      ? "student"
      : profile.role

  // Use service client for cross-tenant admin
  let db = supabase
  if (!profile.tenant_id) {
    const { createServiceClient } = await import("@/lib/supabase/service")
    db = createServiceClient()
  }

  const { data: course } = await db.from("courses").select("*").eq("id", courseId).single()

  if (!course) notFound()

  const { data: chapters } = await db
    .from("chapters")
    .select('id, title, status, "order", content')
    .eq("course_id", courseId)
    .order("order", { ascending: true })

  // Fetch active job and pending questions count for badge (managers only)
  let activeJobStatus: string | null = null
  let pendingQuestionsCount = 0
  const pendingPerChapter: Record<string, number> = {}

  if (effectiveRole === "manager" || effectiveRole === "admin" || effectiveRole === "instructor") {
    const { data: activeJob } = await db
      .from("question_generation_jobs")
      .select("status")
      .eq("course_id", courseId)
      .in("status", ["pending", "processing"])
      .limit(1)
      .maybeSingle()

    activeJobStatus = activeJob?.status ?? null

    const chapterIds = (chapters ?? []).map((c) => c.id)
    if (chapterIds.length > 0) {
      const { count } = await db
        .from("questions")
        .select("id", { count: "exact", head: true })
        .in("chapter_id", chapterIds)
        .eq("status", "pending")

      pendingQuestionsCount = count ?? 0

      // Get pending question counts per chapter
      const { data: pendingByChapter } = await db
        .from("questions")
        .select("chapter_id")
        .in("chapter_id", chapterIds)
        .eq("status", "pending")

      if (pendingByChapter) {
        for (const q of pendingByChapter) {
          pendingPerChapter[q.chapter_id] = (pendingPerChapter[q.chapter_id] ?? 0) + 1
        }
      }
    }
  }

  // Fetch enrollment progress + completed chapters for students
  let progressPercentage = 0
  let enrollmentStatus: string | undefined
  let enrolledAt: string | null = null
  let enrollmentId: string | null = null
  let certificateCode: string | null = null
  const completedChapterIds: string[] = []
  const chapterSessionCounts: Record<string, number> = {}

  // Determine if we should fetch personal enrollment data
  const isRealStudent =
    effectiveRole !== "manager" && effectiveRole !== "admin" && effectiveRole !== "instructor"
  const isViewingAsStudent =
    viewAsStudent &&
    (profile.role === "instructor" || profile.role === "admin" || profile.role === "super_admin")

  if (isRealStudent && !isViewingAsStudent) {
    // Real student — fetch personal enrollment and apply gates
    const { data: enrollment } = await db
      .from("enrollments")
      .select("id, progress, status, created_at")
      .eq("student_id", user.id)
      .eq("course_id", courseId)
      .maybeSingle()

    enrollmentStatus = enrollment?.status ?? undefined
    enrolledAt = enrollment?.created_at ?? null
    enrollmentId = enrollment?.id ?? null

    // Consciousness gate: redirect to full-screen consciousness wizard (outside platform layout)
    if (enrollment && enrollment.status === "active") {
      const { data: consciousnessCheck } = await db
        .from("consciousness_responses")
        .select("id")
        .eq("enrollment_id", enrollment.id)
        .eq("phase", "pre")
        .maybeSingle()

      if (!consciousnessCheck) {
        return redirect(`/consciousness/${courseId}`)
      }
    }

    // Closure gate: redirect to closure page if course completed but post-consciousness not done
    if (enrollment?.status === "completed" && enrollment.id) {
      const { data: closureCheck } = await db
        .from("consciousness_responses")
        .select("id")
        .eq("enrollment_id", enrollment.id)
        .eq("phase", "post")
        .maybeSingle()

      if (!closureCheck) {
        return redirect(`/courses/${courseId}/closure`)
      }

      // Check for certificate
      const { data: cert } = await db
        .from("certificates")
        .select("verification_code")
        .eq("enrollment_id", enrollment.id)
        .maybeSingle()
      certificateCode = cert?.verification_code ?? null
    }
    if (enrollment?.progress && typeof enrollment.progress === "object") {
      const p = enrollment.progress as { percentage?: number }
      progressPercentage = p.percentage ?? 0
    }

    // Find chapters with completed sessions
    const chapterIds = (chapters ?? []).map((c) => c.id)
    if (chapterIds.length > 0) {
      const { data: sessions } = await db
        .from("sessions")
        .select("chapter_id, status")
        .eq("student_id", user.id)
        .in("chapter_id", chapterIds)

      if (sessions) {
        for (const s of sessions) {
          chapterSessionCounts[s.chapter_id] = (chapterSessionCounts[s.chapter_id] ?? 0) + 1
          if (s.status === "completed" && !completedChapterIds.includes(s.chapter_id)) {
            completedChapterIds.push(s.chapter_id)
          }
        }
      }
    }
  } else if (isViewingAsStudent) {
    // Instructor/admin "View as Student" — show aggregate progress, skip gates
    enrollmentStatus = "active"

    const chapterIds = (chapters ?? []).map((c) => c.id)
    const publishedChapters = (chapters ?? []).filter((c) => c.status === "published")
    const totalPublished = publishedChapters.length

    if (chapterIds.length > 0 && totalPublished > 0) {
      // Use service client to see all students' sessions
      const { createServiceClient } = await import("@/lib/supabase/service")
      const svc = profile.tenant_id ? createServiceClient() : db

      const { data: allSessions } = await svc
        .from("sessions")
        .select("chapter_id, status")
        .in("chapter_id", chapterIds)
        .eq("status", "completed")

      if (allSessions) {
        // Count unique chapters that have at least one completed session (any student)
        const chaptersWithCompletions = new Set(allSessions.map((s) => s.chapter_id))
        for (const chId of chaptersWithCompletions) {
          if (!completedChapterIds.includes(chId)) {
            completedChapterIds.push(chId)
          }
        }
        // Aggregate progress: % of published chapters with at least one completion
        progressPercentage = Math.round((chaptersWithCompletions.size / totalPublished) * 100)

        // Session counts per chapter (all students)
        for (const s of allSessions) {
          chapterSessionCounts[s.chapter_id] = (chapterSessionCounts[s.chapter_id] ?? 0) + 1
        }
      }
    }
  }

  return (
    <CourseDetailClient
      course={course}
      chapters={chapters ?? []}
      userRole={effectiveRole}
      activeJobStatus={activeJobStatus}
      pendingQuestionsCount={pendingQuestionsCount}
      pendingPerChapter={pendingPerChapter}
      progressPercentage={progressPercentage}
      completedChapterIds={completedChapterIds}
      chapterSessionCounts={chapterSessionCounts}
      enrollmentStatus={enrollmentStatus}
      enrolledAt={enrolledAt}
      enrollmentId={enrollmentId}
      certificateCode={certificateCode}
    />
  )
}
