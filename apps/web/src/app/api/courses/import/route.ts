import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

interface ImportChapter {
  title: string
  content?: string | null
  learning_objective?: string | null
  order: number
  status?: string
  interaction_type?: string | null
  bloom_target?: string | null
  video_url?: string | null
  audio_url?: string | null
  content_blocks?: unknown | null
  slide_audio_url?: string | null
  questions?: Array<{
    text: string
    skill?: string | null
    intention?: string | null
    expected_depth?: string | null
    question_type?: string
    correct_answer?: string | null
    explanation?: string | null
    options?: unknown | null
    status?: string
  }>
  slides?: Array<{
    order: number
    image_url?: string | null
    text_content?: string | null
    text_status?: string
    audio_start_ms?: number | null
    audio_end_ms?: number | null
    metadata?: unknown | null
  }>
}

interface ImportPayload {
  version: string
  platform?: string
  course: {
    title: string
    description?: string | null
    type?: string
    cover_image_url?: string | null
    settings?: unknown
  }
  chapters?: ImportChapter[]
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile || !["manager", "admin", "instructor"].includes(profile.role)) {
    return NextResponse.json({ error: "Permissão negada" }, { status: 403 })
  }

  let payload: ImportPayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  if (!payload.course?.title) {
    return NextResponse.json({ error: "Curso sem título" }, { status: 400 })
  }

  // Create course
  const { data: newCourse, error: courseError } = await supabase
    .from("courses")
    .insert({
      title: payload.course.title,
      description: payload.course.description ?? null,
      type: payload.course.type ?? "regular",
      cover_image_url: payload.course.cover_image_url ?? null,
      settings: payload.course.settings ?? {},
      status: "draft",
      created_by: user.id,
      tenant_id: profile.tenant_id,
    })
    .select("id")
    .single()

  if (courseError || !newCourse) {
    return NextResponse.json(
      { error: `Erro ao criar curso: ${courseError?.message ?? "desconhecido"}` },
      { status: 500 },
    )
  }

  const courseId = newCourse.id
  let chaptersCreated = 0
  let questionsCreated = 0
  let slidesCreated = 0

  // Create chapters
  for (const ch of payload.chapters ?? []) {
    const { data: newChapter, error: chError } = await supabase
      .from("chapters")
      .insert({
        course_id: courseId,
        tenant_id: profile.tenant_id,
        title: ch.title,
        content: ch.content ?? null,
        learning_objective: ch.learning_objective ?? null,
        order: ch.order,
        status: ch.status ?? "draft",
        interaction_type: ch.interaction_type ?? null,
        bloom_target: ch.bloom_target ?? null,
        video_url: ch.video_url ?? null,
        audio_url: ch.audio_url ?? null,
        content_blocks: ch.content_blocks ?? null,
        slide_audio_url: ch.slide_audio_url ?? null,
      })
      .select("id")
      .single()

    if (chError || !newChapter) continue
    chaptersCreated++

    // Create questions for this chapter
    if (ch.questions && ch.questions.length > 0) {
      const questionRows = ch.questions.map((q) => ({
        chapter_id: newChapter.id,
        tenant_id: profile.tenant_id,
        text: q.text,
        skill: q.skill ?? null,
        intention: q.intention ?? null,
        expected_depth: q.expected_depth ?? null,
        question_type: q.question_type ?? "open_ended",
        correct_answer: q.correct_answer ?? null,
        explanation: q.explanation ?? null,
        options: q.options ?? null,
        status: q.status ?? "draft",
      }))

      const { data: insertedQuestions } = await supabase.from("questions").insert(questionRows).select("id")
      questionsCreated += insertedQuestions?.length ?? 0
    }

    // Create slides for this chapter
    if (ch.slides && ch.slides.length > 0) {
      const slideRows = ch.slides.map((s) => ({
        chapter_id: newChapter.id,
        tenant_id: profile.tenant_id,
        order: s.order,
        image_url: s.image_url ?? null,
        text_content: s.text_content ?? null,
        text_status: s.text_status ?? "pending",
        audio_start_ms: s.audio_start_ms ?? null,
        audio_end_ms: s.audio_end_ms ?? null,
        metadata: s.metadata ?? null,
      }))

      const { data: insertedSlides } = await supabase.from("chapter_slides").insert(slideRows).select("id")
      slidesCreated += insertedSlides?.length ?? 0
    }
  }

  return NextResponse.json({
    success: true,
    courseId,
    stats: {
      chapters: chaptersCreated,
      questions: questionsCreated,
      slides: slidesCreated,
    },
  })
}
