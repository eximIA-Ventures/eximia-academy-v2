import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

interface RouteContext {
  params: Promise<{ courseId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { courseId } = await context.params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (!profile || !["manager", "admin", "instructor"].includes(profile.role)) {
    return NextResponse.json({ error: "Permissão negada" }, { status: 403 })
  }

  // Fetch course
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, title, description, type, status, cover_image_url, settings, created_at")
    .eq("id", courseId)
    .single()

  if (courseError || !course) {
    return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 })
  }

  // Fetch chapters
  const { data: chapters } = await supabase
    .from("chapters")
    .select(
      "id, title, content, learning_objective, order, status, interaction_type, bloom_target, video_url, audio_url, content_blocks, slide_audio_url",
    )
    .eq("course_id", courseId)
    .order("order")

  // Fetch questions per chapter
  const chapterIds = (chapters ?? []).map((c) => c.id)
  let questions: Record<string, unknown>[] = []
  if (chapterIds.length > 0) {
    const { data } = await supabase
      .from("questions")
      .select(
        "id, chapter_id, text, skill, intention, expected_depth, question_type, correct_answer, explanation, options, status",
      )
      .in("chapter_id", chapterIds)
      .order("created_at")
    questions = data ?? []
  }

  // Fetch slides per chapter
  let slides: Record<string, unknown>[] = []
  if (chapterIds.length > 0) {
    const { data } = await supabase
      .from("chapter_slides")
      .select("id, chapter_id, order, image_url, text_content, text_status, audio_start_ms, audio_end_ms, metadata")
      .in("chapter_id", chapterIds)
      .order("order")
    slides = data ?? []
  }

  // Fetch quiz sessions
  let quizSessions: Record<string, unknown>[] = []
  const { data: quizData } = await supabase
    .from("quiz_sessions")
    .select(
      "id, chapter_id, title, quiz_type, time_limit_minutes, passing_score, max_attempts, shuffle_questions, show_answers_after, question_ids, is_active",
    )
    .eq("course_id", courseId)
  quizSessions = quizData ?? []

  // Group by chapter
  const questionsByChapter = new Map<string, typeof questions>()
  for (const q of questions) {
    const cid = q.chapter_id as string
    const arr = questionsByChapter.get(cid) ?? []
    arr.push(q)
    questionsByChapter.set(cid, arr)
  }

  const slidesByChapter = new Map<string, typeof slides>()
  for (const s of slides) {
    const cid = s.chapter_id as string
    const arr = slidesByChapter.get(cid) ?? []
    arr.push(s)
    slidesByChapter.set(cid, arr)
  }

  // Build export payload
  const exportData = {
    version: "1.0",
    exported_at: new Date().toISOString(),
    platform: "eximia-academy",
    course: {
      title: course.title,
      description: course.description,
      type: course.type,
      cover_image_url: course.cover_image_url,
      settings: course.settings,
    },
    chapters: (chapters ?? []).map((ch) => ({
      title: ch.title,
      content: ch.content,
      learning_objective: ch.learning_objective,
      order: ch.order,
      status: ch.status,
      interaction_type: ch.interaction_type,
      bloom_target: ch.bloom_target,
      video_url: ch.video_url,
      audio_url: ch.audio_url,
      content_blocks: ch.content_blocks,
      slide_audio_url: ch.slide_audio_url,
      questions: (questionsByChapter.get(ch.id) ?? []).map((q) => ({
        text: q.text,
        skill: q.skill,
        intention: q.intention,
        expected_depth: q.expected_depth,
        question_type: q.question_type,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        options: q.options,
        status: q.status,
      })),
      slides: (slidesByChapter.get(ch.id) ?? []).map((s) => ({
        order: s.order,
        image_url: s.image_url,
        text_content: s.text_content,
        text_status: s.text_status,
        audio_start_ms: s.audio_start_ms,
        audio_end_ms: s.audio_end_ms,
        metadata: s.metadata,
      })),
    })),
    quiz_sessions: quizSessions.map((qs) => ({
      title: qs.title,
      quiz_type: qs.quiz_type,
      time_limit_minutes: qs.time_limit_minutes,
      passing_score: qs.passing_score,
      max_attempts: qs.max_attempts,
      shuffle_questions: qs.shuffle_questions,
      show_answers_after: qs.show_answers_after,
      is_active: qs.is_active,
    })),
  }

  const filename = `${course.title.replace(/[^a-zA-Z0-9À-ÿ\s-]/g, "").replace(/\s+/g, "-").toLowerCase()}.json`

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
