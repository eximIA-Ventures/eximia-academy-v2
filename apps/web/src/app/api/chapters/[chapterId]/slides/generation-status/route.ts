import { requireCourseManager } from "@/lib/course-management-guard"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chapterId: string }> },
) {
  const { chapterId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Guard de papel que faltava. O RLS de `chapter_slides` é escopado só por
  // TENANT (`chapter_slides_select`, migration 20260314000000): não olha matrícula
  // nem papel. Sem este guard, qualquer membro do tenant lê o progresso de autoria
  // de um capítulo em rascunho. O único consumidor desta rota é o `slide-manager`,
  // dentro de uma página já protegida por `requireCourseManager` — então esta é a
  // mesma régua do chamador, e não fecha porta em ninguém legítimo.
  const roleCheck = await requireCourseManager(supabase, user.id)
  if (!roleCheck.ok) {
    if (roleCheck.motivo === "indisponivel") {
      return NextResponse.json(
        { error: "profile_check_unavailable" },
        { status: 503, headers: { "Retry-After": "5" } },
      )
    }
    return NextResponse.json({ error: roleCheck.error }, { status: 403 })
  }

  // Get counts by status
  const { data: slides } = await supabase
    .from("chapter_slides")
    .select("id, text_status")
    .eq("chapter_id", chapterId)

  if (!slides) return NextResponse.json({ error: "No slides found" }, { status: 404 })

  const total = slides.length
  const pending = slides.filter((s) => s.text_status === "pending").length
  const generating = slides.filter((s) => s.text_status === "generating").length
  const review = slides.filter((s) => s.text_status === "review").length
  const approved = slides.filter((s) => s.text_status === "approved").length

  const isComplete = generating === 0 && pending === 0
  const progress = total > 0 ? Math.round(((review + approved) / total) * 100) : 0

  return NextResponse.json({
    total,
    pending,
    generating,
    review,
    approved,
    isComplete,
    progress,
  })
}
