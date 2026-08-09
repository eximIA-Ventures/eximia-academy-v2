import { ProfilePageClient } from "@/components/profile/profile-page-client"
import { getAuthProfile } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function ProfilePage() {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) return redirect("/login")

  // Fetch extended profile data (profile JSONB + avatar)
  const supabase = await createClient()
  const { data: profileData } = await supabase
    .from("users")
    // Sem `avatar_url` (coluna inexistente, 2026-07-28): com ela, esta leitura
    // falhava inteira e o usuário perdia também o `profile` — o JSONB voltava
    // como `{}` sem nenhum aviso.
    .select("profile")
    .eq("id", user.id)
    .single()

  return (
    <ProfilePageClient
      userId={user.id}
      fullName={profile.full_name}
      email={user.email ?? ""}
      role={profile.role}
      avatarUrl={null}
      onboardingCompleted={profile.onboarding_completed ?? false}
      profile={(profileData?.profile as Record<string, unknown>) || {}}
    />
  )
}
