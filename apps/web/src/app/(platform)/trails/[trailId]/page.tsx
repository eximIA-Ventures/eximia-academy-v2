import { tenantRedirect } from "@/lib/tenant-nav"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getTrailDetail } from "../actions"
import { TrailDetailClient } from "./trail-detail-client"

export default async function TrailDetailPage({ params }: { params: Promise<{ trailId: string }> }) {
  const { trailId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return tenantRedirect("/login")

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile) return tenantRedirect("/dashboard")

  const { data: trail, error } = await getTrailDetail(trailId)
  if (error || !trail) return tenantRedirect("/trails")

  return (
    <div className="space-y-6">
      <TrailDetailClient trail={trail} userRole={profile.role} />
    </div>
  )
}
