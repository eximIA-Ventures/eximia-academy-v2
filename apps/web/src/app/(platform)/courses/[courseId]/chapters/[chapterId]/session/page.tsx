import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
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

  const db = createServiceClient()

  const { data: sessions } = await db
    .from("sessions")
    .select("id, status, interactions_remaining, created_at, completed_at, question:questions(id, text)")
    .eq("student_id", user.id)
    .eq("chapter_id", chapterId)
    .in("status", ["active", "completed"])
    .order("created_at", { ascending: false })
    .limit(1)

  const session = sessions?.[0] ?? null
  if (!session) return redirect(`/courses/${courseId}/chapters/${chapterId}`)

  const { data: existingMessages } = await db
    .from("messages")
    .select("id, role, content, turn_number, created_at")
    .eq("session_id", session.id)
    .order("turn_number", { ascending: true })
    .order("created_at", { ascending: true })

  const { data: chRows } = await db.from("chapters").select("title").eq("id", chapterId).limit(1)
  const chapterTitle = chRows?.[0]?.title ?? ""

  const { data: pRows } = await db.from("users").select("tenant_id").eq("id", user.id).limit(1)
  const tenantId = pRows?.[0]?.tenant_id ?? null

  let maxInteractions = 6
  if (tenantId) {
    const { data: tRows } = await db.from("tenants").select("settings").eq("id", tenantId).limit(1)
    maxInteractions = ((tRows?.[0]?.settings as Record<string, unknown>)?.max_interactions_per_session as number) ?? 6
  }

  const rawQ = session.question as unknown
  const question = (rawQ && typeof rawQ === "object" && "text" in rawQ)
    ? (rawQ as { id: string; text: string })
    : { id: "fallback", text: "Vamos conversar sobre o que você aprendeu neste capítulo. O que mais chamou sua atenção?" }

  const { data: curRows } = await db.from("chapters").select("order, course_id").eq("id", chapterId).limit(1)
  const cur = curRows?.[0] ?? null

  let nextChapterId: string | null = null
  if (cur) {
    const { data: nRows } = await db
      .from("chapters")
      .select("id, questions!inner(id)")
      .eq("course_id", cur.course_id)
      .eq("status", "published")
      .eq("questions.status", "active")
      .gt("order", cur.order)
      .order("order", { ascending: true })
      .limit(1)
    nextChapterId = nRows?.[0]?.id ?? null
  }

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
