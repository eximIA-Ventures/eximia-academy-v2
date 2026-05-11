import { getAuthProfile } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/service"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

async function getDb(profile: { tenant_id: string | null }) {
  if (!profile.tenant_id) return createServiceClient()
  return createClient()
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ areaId: string }> },
) {
  const { profile } = await getAuthProfile()
  if (!profile || !["admin", "super_admin", "instructor"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { areaId } = await params
  const { course_id } = await request.json()
  if (!course_id) return NextResponse.json({ error: "course_id required" }, { status: 400 })

  const db = await getDb(profile)
  const { error } = await db
    .from("courses")
    .update({ area_id: areaId })
    .eq("id", course_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ areaId: string }> },
) {
  const { profile } = await getAuthProfile()
  if (!profile || !["admin", "super_admin", "instructor"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { areaId } = await params
  const { course_id } = await request.json()
  if (!course_id) return NextResponse.json({ error: "course_id required" }, { status: 400 })

  const db = await getDb(profile)
  const { error } = await db
    .from("courses")
    .update({ area_id: null })
    .eq("id", course_id)
    .eq("area_id", areaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
