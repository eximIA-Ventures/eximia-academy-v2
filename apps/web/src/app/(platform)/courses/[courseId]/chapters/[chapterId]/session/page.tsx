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

  // Find active or most recent completed session for this student + chapter
  const { data: session } = await supabase
    .from("sessions")
    .select(
      "id, status, interactions_remaining, created_at, completed_at, question:questions(id, text)",
    )
    .eq("student_id", user.id)
    .eq("chapter_id", chapterId)
    .in("status", ["active", "completed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!session) {
    return redirect(`/courses/${courseId}/chapters/${chapterId}`)
  }

  // Load existing messages for the session
  const { data: existingMessages } = await supabase
    .from("messages")
    .select("id, role, content, turn_number, created_at")
    .eq("session_id", session.id)
    .order("turn_number", { ascending: true })
    .order("created_at", { ascending: true })

  // Get chapter title for header
  const { data: chapter } = await supabase
    .from("chapters")
    .select("title")
    .eq("id", chapterId)
    .maybeSingle()

  // Get tenant max interactions for counter
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle()

  let maxInteractions = 6
  if (profile?.tenant_id) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("settings")
      .eq("id", profile.tenant_id)
      .maybeSingle()
    maxInteractions =
      ((tenant?.settings as Record<string, unknown>)?.max_interactions_per_session as number) ?? 6
  }

  const question = (session.question as unknown as { id: string; text: string } | null) ?? { id: "fallback", text: "Vamos conversar sobre o que você aprendeu neste capítulo. O que mais chamou sua atenção?" }

  // Find next chapter with active questions (AC5 - Story 3.5)
  const { data: currentChapter } = await supabase
    .from("chapters")
    .select("order, course_id")
    .eq("id", chapterId)
    .maybeSingle()

  let nextChapterId: string | null = null
  if (currentChapter) {
    const { data: nextChap } = await supabase
      .from("chapters")
      .select("id, questions!inner(id)")
      .eq("course_id", currentChapter.course_id)
      .eq("status", "published")
      .eq("questions.status", "active")
      .gt("order", currentChapter.order)
      .order("order", { ascending: true })
      .limit(1)
      .maybeSingle()
    nextChapterId = nextChap?.id ?? null
  }

  // Build initial messages from DB messages, or just the question if no messages yet
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
      chapterTitle={chapter?.title ?? ""}
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
