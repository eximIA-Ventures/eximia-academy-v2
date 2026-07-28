import { logAdminAction } from "@/lib/audit"
import { getAuthProfile } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

async function getDb(profile: { tenant_id: string | null }) {
  if (!profile.tenant_id) return createServiceClient()
  return createClient()
}

function requestIp(request: Request): string | undefined {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined
  )
}

export async function POST(request: Request, { params }: { params: Promise<{ areaId: string }> }) {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile || !["admin", "super_admin", "instructor"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { areaId } = await params
  const { course_id } = await request.json()
  if (!course_id) return NextResponse.json({ error: "course_id required" }, { status: 400 })

  const db = await getDb(profile)
  const { error } = await db.from("courses").update({ area_id: areaId }).eq("id", course_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction({
    actorId: user.id,
    tenantId: profile.tenant_id,
    action: "area.course_added",
    targetType: "area",
    targetId: areaId,
    details: { course_id, ip: requestIp(request) },
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ areaId: string }> },
) {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile || !["admin", "super_admin", "instructor"].includes(profile.role)) {
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

  await logAdminAction({
    actorId: user.id,
    tenantId: profile.tenant_id,
    action: "area.course_removed",
    targetType: "area",
    targetId: areaId,
    details: { course_id, ip: requestIp(request) },
  })

  return NextResponse.json({ ok: true })
}
