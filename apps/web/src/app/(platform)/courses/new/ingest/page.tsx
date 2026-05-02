import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { tenantRedirect } from "@/lib/tenant-nav"
import { redirect } from "next/navigation"
import { IngestionWizard } from "./_components/ingestion-wizard"

export default async function IngestPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return tenantRedirect("/login")

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()

  if (!profile || !["manager", "admin", "instructor"].includes(profile.role)) {
    return tenantRedirect("/courses")
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <nav className="mb-6 text-sm text-text-muted">
        <Link href="/courses" className="hover:text-text-secondary">
          Cursos
        </Link>
        <span className="mx-2">/</span>
        <Link href="/courses/new" className="hover:text-text-secondary">
          Novo Curso
        </Link>
        <span className="mx-2">/</span>
        <span className="text-text-primary">Importar com IA</span>
      </nav>
      <IngestionWizard />
    </div>
  )
}
