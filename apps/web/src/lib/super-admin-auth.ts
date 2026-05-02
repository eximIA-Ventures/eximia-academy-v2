import { createClient } from "@/lib/supabase/server"

/**
 * Shared super_admin auth check for API routes.
 * Returns user + profile if authenticated and super_admin, null otherwise.
 */
export async function requireSuperAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { user: null, profile: null }

  const { data: profile } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "super_admin") return { user, profile: null }

  return { user, profile }
}
