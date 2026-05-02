import { requireAdminOrManager as requireAdmin } from "@/lib/api-auth"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { updateInstructorPermissionsSchema } from "@eximia/shared"
import { NextResponse } from "next/server"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const supabase = await createClient()
  const { user, profile } = await requireAdmin(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { userId } = await params
  const serviceClient = createServiceClient()

  const { data, error } = await serviceClient
    .from("instructor_permissions")
    .select(
      "can_create_courses, can_create_quizzes, can_manage_trails, can_view_analytics, can_manage_enrollments, assigned_area_ids",
    )
    .eq("user_id", userId)
    .eq("tenant_id", profile.tenant_id)
    .single()

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? null })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const supabase = await createClient()
  const { user, profile } = await requireAdmin(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { userId } = await params

  const body = await request.json()
  const parsed = updateInstructorPermissionsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  const { data, error } = await serviceClient
    .from("instructor_permissions")
    .upsert(
      {
        user_id: userId,
        tenant_id: profile.tenant_id,
        ...parsed.data,
      },
      { onConflict: "user_id,tenant_id" },
    )
    .select(
      "can_create_courses, can_create_quizzes, can_manage_trails, can_view_analytics, can_manage_enrollments, assigned_area_ids",
    )
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
