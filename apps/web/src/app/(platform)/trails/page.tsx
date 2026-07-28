import { FeatureTracker } from "@/components/analytics/feature-tracker"
import { PageHeader } from "@/components/layout/page-header"
import { getDbClient } from "@/lib/auth"
import { contextForcesStudentView, resolveContext } from "@/lib/context-resolver"
import { createClient } from "@/lib/supabase/server"
import { ArrowLeft } from "lucide-react"
import { cookies } from "next/headers"
import Link from "next/link"
import { redirect } from "next/navigation"
import { listTrails } from "./actions"
import { TrailsListClient } from "./trails-list-client"

export default async function TrailsPage() {
  const supabase = await getDbClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return redirect("/login")

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()

  if (!profile) return redirect("/dashboard")

  // Regra da casa (E7/E8, espelha courses/page.tsx e o chapter page): a visão se
  // decide pelo CONTEXTO RESOLVIDO, não pelo role cru — contexto `personal` ativo
  // (com alternativa disponível) = experiência de ALUNO para qualquer chapéu.
  // O toggle "Ver como Aluno" (cookie) também força a visão de aluno.
  const viewAsStudent = (await cookies()).get("x-view-as-student")?.value === "true"
  const contextStudent = contextForcesStudentView(await resolveContext())
  const effectiveRole = contextStudent || viewAsStudent ? "student" : profile.role
  const isStudentView = effectiveRole === "student"

  const { data: trails } = await listTrails(isStudentView ? "student" : "management")

  return (
    <div className="space-y-6">
      <FeatureTracker feature="trails" />
      {isStudentView && (
        <Link
          href="/courses"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={14} />
          Voltar
        </Link>
      )}
      <PageHeader
        section="Trilhas"
        title="Trilhas de Aprendizagem"
        description={
          isStudentView
            ? "Sua jornada de desenvolvimento, curso a curso"
            : "Gerencie trilhas de aprendizagem vinculadas a cargos"
        }
        backgroundImage="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&q=80"
      />
      <TrailsListClient trails={trails ?? []} userRole={effectiveRole} />
    </div>
  )
}
