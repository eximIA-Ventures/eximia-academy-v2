import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getDbClient } from "@/lib/auth"
import { getTrailDetail } from "../actions"
import { TrailDetailClient } from "./trail-detail-client"

export default async function TrailDetailPage({ params }: { params: Promise<{ trailId: string }> }) {
  const { trailId } = await params
  const supabase = await getDbClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return redirect("/login")

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile) return redirect("/dashboard")

  const { data: trail, error } = await getTrailDetail(trailId)
  if (error || !trail) return redirect("/trails")

  return (
    <div className="space-y-6">
      <TrailDetailClient trail={trail} userRole={profile.role} />
    </div>
  )
}
