import { PAPEIS_COURSE_DESIGNER, requireRole } from "@/lib/api-role-guard"
import { createClient } from "@/lib/supabase/server"
import { listFrameworks } from "@eximia/course-designer"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { recusa } = await requireRole(supabase, user.id, PAPEIS_COURSE_DESIGNER)
  if (recusa) return recusa

  const frameworks = listFrameworks()
  return NextResponse.json({ frameworks })
}
