import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { SocraticChat } from "./_components/socratic-chat"

interface SessionPageProps {
  params: Promise<{ courseId: string; chapterId: string }>
}

export default async function SessionPage({ params }: SessionPageProps) {
  const { courseId, chapterId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return redirect("/login")

  // Find active or most recent completed session
  const { data: sessions } = await supabase
    .from("sessions")
    .select(
      "id, status, interactions_remaining, created_at, completed_at, question:questions(id, text)",
    )
    .eq("student_id", user.id)
    .eq("chapter_id", chapterId)
    .in("status", ["active", "completed"])
    .order("created_at", { ascending: false })
    .limit(1)

  const session = sessions?.[0] ?? null

  if (!session) {
    return redirect(`/courses/${courseId}/chapters/${chapterId}`)
  }

  // Load existing messages
  const { data: existingMessages } = await supabase
    .from("messages")
    .select("id, role, content, turn_number, created_at")
    .eq("session_id", session.id)
    .order("turn_number", { ascending: true })
    .order("created_at", { ascending: true })

  // Chapter title
  const { data: chapters } = await supabase
    .from("chapters")
    .select("title")
    .eq("id", chapterId)
    .limit(1)
  const chapterTitle = chapters?.[0]?.title ?? ""

  // Tenant max interactions
  const { data: profiles } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .limit(1)
  const tenantId = profiles?.[0]?.tenant_id ?? null

  let maxInteractions = 6
  if (tenantId) {
    const { data: tenants } = await supabase
      .from("tenants")
      .select("settings")
      .eq("id", tenantId)
      .limit(1)
    const settings = tenants?.[0]?.settings as Record<string, unknown> | null
    maxInteractions = (settings?.max_interactions_per_session as number) ?? 6
  }

  // Question — extract from session join or use fallback
  const rawQuestion = session.question as unknown
  let question = { id: "fallback", text: "Vamos conversar sobre o que você aprendeu neste capítulo. O que mais chamou sua atenção?" }
  if (rawQuestion && typeof rawQuestion === "object" && "text" in rawQuestion) {
    question = rawQuestion as { id: string; text: string }
  }

  // Next chapter with active questions
  const { data: currentChapters } = await supabase
    .from("chapters")
    .select("order, course_id")
    .eq("id", chapterId)
    .limit(1)
  const currentChapter = currentChapters?.[0] ?? null

  let nextChapterId: string | null = null
  if (currentChapter) {
    const { data: nextChaps } = await supabase
      .from("chapters")
      .select("id, questions!inner(id)")
      .eq("course_id", currentChapter.course_id)
      .eq("status", "published")
      .eq("questions.status", "active")
      .gt("order", currentChapter.order)
      .order("order", { ascending: true })
      .limit(1)
    nextChapterId = nextChaps?.[0]?.id ?? null
  }

  // Build initial messages
  const initialMessages =
    existingMessages && existingMessages.length > 0
      ? existingMessages.map((m) => ({
          id: m.id,
          role: m.role === "user" ? ("user" as const) : ("assistant" as const),
          content: m.content,
        }))
      : [{ id: "q0", role: "assistant" as const, content: question.text }]

  return (
    <SocraticChat
      sessionId={session.id}
      courseId={courseId}
      chapterId={chapterId}
      chapterTitle={chapterTitle}
      initialQuestion={question.text}
      initialMessages={initialMessages}
      maxInteractions={maxInteractions}
      currentInteractionsRemaining={session.interactions_remaining}
      sessionStatus={session.status as "active" | "completed"}
      sessionCreatedAt={session.created_at}
      sessionCompletedAt={session.completed_at}
      nextChapterId={nextChapterId}
    />
  )
}
