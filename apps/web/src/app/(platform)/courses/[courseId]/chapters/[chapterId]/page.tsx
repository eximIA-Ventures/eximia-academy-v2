import { createClient } from "@/lib/supabase/server"
import { getDbClient } from "@/lib/auth"
import { extractHeadings } from "@/lib/utils/extract-headings"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
} from "@eximia/ui"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import type { ChapterSlide, LearningMode } from "@eximia/shared"
import { ChapterContentWrapper } from "./_components/chapter-content-wrapper"
import { ChapterNavigation } from "./_components/chapter-navigation"
import { ChapterTocSheet } from "./_components/chapter-toc-sheet"
import { PresentationViewer } from "./present/_components/presentation-viewer"

interface ChapterPageProps {
  params: Promise<{ courseId: string; chapterId: string }>
}

export default async function ChapterPage({ params }: ChapterPageProps) {
  const { courseId, chapterId } = await params
  const supabase = await getDbClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return redirect("/login")

  // Check user role — instructors/managers/admins bypass enrollment check
  const { data: roleCheck } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  // Check "view as student" mode for instructors
  const viewAsStudent = (await (await import("next/headers")).cookies()).get("x-view-as-student")?.value === "true"
  const isContentRole = !viewAsStudent && (roleCheck?.role === "instructor" || roleCheck?.role === "manager" || roleCheck?.role === "admin" || roleCheck?.role === "super_admin")

  if (!isContentRole && !viewAsStudent) {
    // Students must be enrolled — active or completed (allow review without restart)
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("id, status")
      .eq("student_id", user.id)
      .eq("course_id", courseId)
      .in("status", ["active", "completed"])
      .maybeSingle()

    if (!enrollment) return redirect("/courses")

    // Consciousness gate: redirect if pre-phase not completed
    if (enrollment.status === "active") {
      const { data: consciousnessCheck } = await supabase
        .from("consciousness_responses")
        .select("id")
        .eq("enrollment_id", enrollment.id)
        .eq("phase", "pre")
        .maybeSingle()

      if (!consciousnessCheck) {
        return redirect(`/consciousness/${courseId}`)
      }
    }
  }

  // Fetch chapter + course (Epic 12: include video_url, audio_url; Slide Integration: slide_audio_url)
  const { data: chapter } = await supabase
    .from("chapters")
    .select('id, title, content, content_blocks, "order", course_id, status, video_url, audio_url, slide_audio_url, interaction_type, interaction_config')
    .eq("id", chapterId)
    .maybeSingle()

  if (!chapter) notFound()

  const { data: course } = await supabase
    .from("courses")
    .select("id, title")
    .eq("id", courseId)
    .maybeSingle()

  if (!course) notFound()

  // Check for active questions (AC9)
  const { count: activeQuestionCount } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("chapter_id", chapterId)
    .eq("status", "active")

  // Check for existing session (AC6, AC7)
  const { data: activeSession } = await supabase
    .from("sessions")
    .select("id, status")
    .eq("student_id", user.id)
    .eq("chapter_id", chapterId)
    .eq("status", "active")
    .maybeSingle()

  const { data: lastCompletedSession } = await supabase
    .from("sessions")
    .select("id, status")
    .eq("student_id", user.id)
    .eq("chapter_id", chapterId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  // Fetch adjacent chapters for navigation (Task 7)
  const { data: chapters } = await supabase
    .from("chapters")
    .select('id, title, "order"')
    .eq("course_id", courseId)
    .eq("status", "published")
    .order("order", { ascending: true })

  const currentIndex = chapters?.findIndex((c) => c.id === chapterId) ?? -1
  const prevChapter =
    currentIndex > 0
      ? ((chapters?.[currentIndex - 1] as { id: string; title: string } | undefined) ?? null)
      : null
  const nextChapter =
    currentIndex >= 0 && currentIndex < (chapters?.length ?? 0) - 1
      ? ((chapters?.[currentIndex + 1] as { id: string; title: string } | undefined) ?? null)
      : null

  // Fetch user's learning mode preference (Epic 12)
  const { data: userProfile } = await supabase
    .from("users")
    .select("learning_mode")
    .eq("id", user.id)
    .maybeSingle()

  const learningMode = (userProfile?.learning_mode as LearningMode) ?? "read"

  // Fetch slides for this chapter (Slide Integration)
  // Super admin has no tenant_id → RLS blocks chapter_slides. Use service client.
  const slidesClient = roleCheck?.role === "super_admin"
    ? (await import("@/lib/supabase/service")).createServiceClient()
    : supabase
  const { data: slidesData } = await slidesClient
    .from("chapter_slides")
    .select("id, chapter_id, tenant_id, order, image_url, image_storage_path, text_content, text_status, audio_start_ms, audio_end_ms, metadata, created_at, updated_at")
    .eq("chapter_id", chapterId)
    .order("order", { ascending: true })

  const slides = (slidesData ?? []) as ChapterSlide[]
  const hasSlides = slides.length > 0

  // Fetch quiz questions if interaction_type is quiz
  const interactionType = (chapter.interaction_type as string | null) ?? null
  let quizQuestions: Array<{
    id: string; text: string; question_type: "multiple_choice" | "true_false" | "open_ended"
    options: string[] | null; correct_answer: string | null; explanation: string | null; skill: string | null
  }> = []

  if (interactionType === "quiz") {
    const { data: qData } = await supabase
      .from("questions")
      .select("id, text, question_type, options, correct_answer, explanation, skill")
      .eq("chapter_id", chapterId)
      .eq("status", "active")
      .in("question_type", ["multiple_choice", "true_false", "open_ended"])

    quizQuestions = (qData ?? []).map((q) => {
      let opts: string[] | null = null
      if (q.options) {
        opts = typeof q.options === "string" ? JSON.parse(q.options) : Array.isArray(q.options) ? q.options : null
      }
      return { ...q, options: opts }
    }) as typeof quizQuestions
  }

  const hasActiveQuestions = (activeQuestionCount ?? 0) > 0
  const sections = extractHeadings(chapter.content ?? "")

  // When chapter has slides, render immersive presentation view directly
  if (hasSlides) {
    // Fetch tenant_id for reflections — fallback to slide's tenant for super_admin
    let tenantId: string | undefined
    const { data: userFull } = await supabase.from("users").select("tenant_id").eq("id", user.id).maybeSingle()
    tenantId = userFull?.tenant_id ?? undefined
    if (!tenantId && slides.length > 0) {
      tenantId = (slides[0] as any).tenant_id ?? undefined
    }

    // Fetch saved reflections for this user across all slides in this chapter
    let savedReflections: Array<{ slide_id: string; response: string; ai_response: string | null }> = []
    if (tenantId) {
      const slideIds = slides.map((s) => s.id)
      const { data: refData } = await supabase
        .from("slide_reflections")
        .select("slide_id, response, ai_response")
        .eq("student_id", user.id)
        .in("slide_id", slideIds)

      savedReflections = (refData ?? []) as typeof savedReflections
    }

    const tSlug = "default"

    return (
      <PresentationViewer
        courseTitle={course.title}
        chapterTitle={chapter.title}
        slides={slides.map((s) => ({
          id: s.id,
          order: s.order,
          image_url: s.image_url,
          text_content: s.text_content,
          audio_start_ms: s.audio_start_ms,
          audio_end_ms: s.audio_end_ms,
        }))}
        audioUrl={(chapter.slide_audio_url as string | null) ?? (chapter.audio_url as string | null) ?? null}
        podcastUrl={(chapter.slide_audio_url as string | null) ?? null}
        narrationUrl={(chapter.audio_url as string | null) ?? null}
        chapterId={chapterId}
        hasContent={!!(chapter.content && (chapter.content as string).trim().length > 50)}
        videoUrl={(chapter.video_url as string | null) ?? null}
        backUrl={`/courses/${courseId}`}
        interaction={hasActiveQuestions ? {
          type: "socratic",
          courseId,
          chapterId,
          hasActiveQuestions,
          activeQuestionCount: activeQuestionCount ?? 0,
          activeSession,
          lastCompletedSession,
        } : undefined}
        isCompleted={!!lastCompletedSession}
        tenantId={tenantId}
        reflections={savedReflections}
        aiReflectionEnabled
        userRole={roleCheck?.role}
        viewAsStudent={viewAsStudent}
        courseId={courseId}
        nextChapter={nextChapter}
      />
    )
  }

  const tSlug2 = "default"

  return (
    <div className="mx-auto max-w-4xl px-3 py-4 sm:px-4 sm:py-6">
      {/* Breadcrumb + Back button */}
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <Breadcrumb>
          <BreadcrumbList className="text-xs sm:text-sm">
            <BreadcrumbItem>
              <BreadcrumbLink href={ "/courses"}>Cursos</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="max-w-[100px] sm:max-w-[200px]">
              <BreadcrumbLink href={ `/courses/${courseId}`} className="truncate block">{course.title}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="max-w-[100px] sm:max-w-none">
              <BreadcrumbPage className="truncate">{chapter.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex items-center gap-2 shrink-0 self-start">
          {isContentRole && (
            <Link href={ `/courses/${courseId}/chapters/${chapterId}/present`}>
              <Button size="sm" className="min-h-[44px] sm:min-h-0">
                Apresentar
              </Button>
            </Link>
          )}
          <Link href={ `/courses/${courseId}`}>
            <Button variant="outline" size="sm" className="min-h-[44px] sm:min-h-0">
              <ArrowLeft size={16} className="mr-1.5" /> Voltar ao Curso
            </Button>
          </Link>
        </div>
      </div>

      {/* Chapter header (AC2) */}
      <h1 className="mb-2 text-lg font-bold text-text-primary sm:text-2xl md:text-3xl break-words pr-12 sm:pr-0">{chapter.title}</h1>
      <p className="mb-6 text-sm text-text-secondary sm:mb-8">{course.title}</p>

      {/* Chapter content with mode selector + session button */}
      <ChapterContentWrapper
        content={chapter.content ?? ""}
        contentBlocks={(chapter.content_blocks as Record<string, unknown>[] | null) ?? null}
        videoUrl={(chapter.video_url as string | null) ?? null}
        audioUrl={(chapter.audio_url as string | null) ?? null}
        podcastUrl={(chapter.slide_audio_url as string | null) ?? null}
        narrationUrl={(chapter.audio_url as string | null) ?? null}
        userPreference={learningMode}
        slides={slides}
        hasSlides={hasSlides}
        slideAudioUrl={(chapter.slide_audio_url as string | null) ?? null}
        interactionType={interactionType}
        quizQuestions={quizQuestions}
        scenarioData={interactionType === "scenario" ? ((chapter.interaction_config as Record<string, unknown>) ?? null) : null}
        assignmentData={interactionType === "assignment" ? ((chapter.interaction_config as Record<string, unknown>) ?? null) : null}
        courseId={courseId}
        chapterId={chapterId}
        hasActiveQuestions={hasActiveQuestions}
        activeQuestionCount={activeQuestionCount ?? 0}
        activeSession={activeSession}
        lastCompletedSession={lastCompletedSession}
        tocChapters={(chapters ?? []).map((c) => ({
          id: c.id as string,
          title: c.title as string,
          order: c.order as number,
        }))}
        tocCourseTitle={course.title}
        tocSections={sections}
      />

      {/* Chapter navigation (Task 7) */}
      <ChapterNavigation courseId={courseId} prevChapter={prevChapter} nextChapter={nextChapter} />

      {/* TOC — rendered inside ChapterContentWrapper when slides, standalone otherwise */}
      {!hasSlides && (
        <ChapterTocSheet
          courseId={courseId}
          courseTitle={course.title}
          chapters={(chapters ?? []).map((c) => ({
            id: c.id as string,
            title: c.title as string,
            order: c.order as number,
          }))}
          currentChapterId={chapterId}
          currentSections={sections}
        />
      )}
    </div>
  )
}
