import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"
import { z } from "zod"

const postSchema = z.object({
  reflectionId: z.string().uuid(),
  comment: z.string().min(1).max(2000),
})

export async function POST(request: Request) {
  const { user, profile } = await getAuthProfile()

  if (!user || !profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (profile.role !== "leader") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 })
  }

  const body = await request.json()
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors }, { status: 400 })
  }

  const { reflectionId, comment } = parsed.data

  // Verify the reflection belongs to a team member in the leader's area
  const db = createServiceClient()

  const { data: leaderAreas } = await db
    .from("user_areas")
    .select("area_id")
    .eq("user_id", user.id)

  if (!leaderAreas || leaderAreas.length === 0) {
    return NextResponse.json({ error: "No area assigned" }, { status: 403 })
  }

  const areaIds = leaderAreas.map((ua) => ua.area_id)

  // Get the reflection's student_id
  const { data: reflection } = await db
    .from("slide_reflections")
    .select("student_id")
    .eq("id", reflectionId)
    .eq("tenant_id", tenantId)
    .single()

  if (!reflection) {
    return NextResponse.json({ error: "Reflection not found" }, { status: 404 })
  }

  // Verify student is in leader's area
  const { data: studentArea } = await db
    .from("user_areas")
    .select("area_id")
    .eq("user_id", reflection.student_id)
    .in("area_id", areaIds)
    .limit(1)

  if (!studentArea || studentArea.length === 0) {
    return NextResponse.json(
      { error: "Student not in your area" },
      { status: 403 },
    )
  }

  // Insert or update the comment
  const { data, error } = await db
    .from("leader_comments")
    .upsert(
      {
        leader_id: user.id,
        reflection_id: reflectionId,
        tenant_id: tenantId,
        comment,
      },
      { onConflict: "leader_id,reflection_id" },
    )
    .select("id")
    .single()

  if (error) {
    console.error("[leader-comments] Insert error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
