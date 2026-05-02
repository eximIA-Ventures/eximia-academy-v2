import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/layout/page-header"
import { redirect } from "next/navigation"
import { ModeSelector } from "./_components/mode-selector"

export default async function NewCoursePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return redirect("/login")

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()

  if (!profile || !["manager", "admin", "instructor"].includes(profile.role)) {
    return redirect("/courses")
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        section="Cursos"
        title="Novo Curso"
        description="Escolha como deseja criar seu curso."
      />
      <ModeSelector />
    </div>
  )
}
