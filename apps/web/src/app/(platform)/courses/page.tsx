import { PageHeader } from "@/components/layout/page-header"
import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { resolveCoursesListView } from "@/lib/course-management-guard"
import { hasRole } from "@/lib/role-helpers"
import type { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace-context"
import { canAuthorCourses, resolvePlatformShell } from "@/lib/workspace-resolver"
import type { Role } from "@eximia/shared"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { CoursesPageClient } from "./_components/courses-page-client"
import { type TrailSummary, TrailsSectionClient } from "./_components/trails-section-client"

export default async function CoursesPage() {
  const { user, profile, supabase, roles } = await getAuthProfile()
  if (!user || !profile) return redirect("/login")

  // BUG-2 (side effect): course-authoring actions ("Criar Curso", "Criar
  // Blueprint", "Importar com IA") belong to the Estúdio, not to the standard
  // world. Bind them to workspace + real instructor hat — NOT the singular role,
  // which leaked the buttons into the student "Minha Trilha" context.
  //
  // fix-instructor-student-context (BUG 1, Minha Trilha): the workspace-first
  // rule below (resolveCoursesListView) subsumes the context rule
  // (contextForcesStudentView) on this page — the `personal` context only exists
  // in the STANDARD shell, which always renders the enrollment listing; the
  // authoring listing is Estúdio-only.
  const activeWorkspace = await getActiveWorkspace()
  const canAuthor = canAuthorCourses(activeWorkspace, roles as Role[])

  // "View as student" preview — the instructor-only "Ver como Aluno" toggle.
  // Gate on the real instructor hat (union), never the singular role, mirroring
  // the (platform) layout (isPreviewingAsStudent).
  const viewAsStudent = (await cookies()).get("x-view-as-student")?.value === "true"
  const isPreviewingAsStudent = viewAsStudent && hasRole({ roles }, "instructor")

  // BUG (fix-instructor-student-context): which listing does /courses render?
  // The ACTIVE WORKSPACE decides first, mirroring the shell (resolvePlatformShell)
  // and the authoring buttons (canAuthorCourses above). A multi-chapéu user
  // (instructor + enrolled student) who SWITCHED to the standard world ("Minha
  // Trilha") must see his ENROLLMENTS, not the empty AUTHORING table his instructor
  // hat used to force. Authoring renders only in the Estúdio shell. The union of
  // hats (E1/E7) still discriminates authoring WITHIN the Estúdio.
  const activeShell = resolvePlatformShell(activeWorkspace, roles as Role[])
  const isManager =
    resolveCoursesListView(roles, isPreviewingAsStudent, activeShell) === "authoring"

  // Resolve tenant — admin/super_admin with null tenant uses cookie
  const activeTenantId = await resolveTenantId(profile.tenant_id)

  // Use service client for cross-tenant admin
  let db = supabase
  if (!profile.tenant_id) {
    const { createServiceClient } = await import("@/lib/supabase/service")
    db = createServiceClient()
  }

  // Fetch tenant enrollment mode
  const { data: tenant } = await db
    .from("tenants")
    .select("settings")
    .eq("id", activeTenantId)
    .maybeSingle()
  const tenantSettings = (tenant?.settings as Record<string, unknown>) ?? {}
  const enrollmentMode = (tenantSettings.enrollment_mode as string) ?? "open"

  let courses: Array<{
    id: string
    title: string
    description: string | null
    cover_image_url: string | null
    type: string
    status: string
    created_at: string
    chapter_count: number
    enrolled_count: number
  }> = []

  if (isManager) {
    let query = db
      .from("courses")
      .select("id, title, description, cover_image_url, type, status, created_at")
      .order("created_at", { ascending: false })

    // Admin/super_admin with null tenant: filter by active tenant explicitly
    if (!profile.tenant_id && activeTenantId) {
      query = query.eq("tenant_id", activeTenantId)
    }

    // Managers see courses from their areas; instructors see all tenant courses; admins see all
    if (profile.role === "instructor") {
      // Instructors see all courses in their tenant (RLS handles tenant isolation)
    } else if (profile.role === "manager") {
      const { data: userAreas } = await db
        .from("user_areas")
        .select("area_id")
        .eq("user_id", user.id)

      const areaIds = (userAreas ?? []).map((ua) => ua.area_id)
      if (areaIds.length > 0) {
        query = query.in("area_id", areaIds)
      } else {
        query = query.eq("created_by", user.id)
      }
    }

    const { data } = await query

    courses = (data ?? []).map((c) => ({ ...c, chapter_count: 0, enrolled_count: 0 }))

    if (courses.length > 0) {
      const courseIds = courses.map((c) => c.id)
      const { data: chapters } = await db
        .from("chapters")
        .select("course_id")
        .in("course_id", courseIds)

      const countMap: Record<string, number> = {}
      for (const ch of chapters ?? []) {
        countMap[ch.course_id] = (countMap[ch.course_id] ?? 0) + 1
      }
      courses = courses.map((c) => ({ ...c, chapter_count: countMap[c.id] ?? 0 }))
    }
  } else if (enrollmentMode === "assigned") {
    // Assigned mode: only show courses the student is already enrolled in
    const { data: enrolledCourses } = await db
      .from("enrollments")
      .select("course_id")
      .eq("student_id", user.id)
      .in("status", ["active", "completed"])

    const enrolledIds = (enrolledCourses ?? []).map((e) => e.course_id)

    if (enrolledIds.length > 0) {
      const { data } = await db
        .from("courses")
        .select("id, title, description, cover_image_url, type, status, created_at")
        .eq("status", "published")
        .in("id", enrolledIds)
        .order("created_at", { ascending: false })

      courses = (data ?? []).map((c) => ({ ...c, chapter_count: 0, enrolled_count: 0 }))
    }

    if (courses.length > 0) {
      const courseIds = courses.map((c) => c.id)
      const { data: chapters } = await db
        .from("chapters")
        .select("course_id")
        .in("course_id", courseIds)
        .eq("status", "published")

      const countMap: Record<string, number> = {}
      for (const ch of chapters ?? []) {
        countMap[ch.course_id] = (countMap[ch.course_id] ?? 0) + 1
      }
      courses = courses.map((c) => ({ ...c, chapter_count: countMap[c.id] ?? 0 }))
    }
  } else {
    // Open mode: show all published courses
    const { data } = await db
      .from("courses")
      .select("id, title, description, cover_image_url, type, status, created_at")
      .eq("status", "published")
      .order("created_at", { ascending: false })

    courses = (data ?? []).map((c) => ({ ...c, chapter_count: 0, enrolled_count: 0 }))

    if (courses.length > 0) {
      const courseIds = courses.map((c) => c.id)
      const { data: chapters } = await db
        .from("chapters")
        .select("course_id")
        .in("course_id", courseIds)
        .eq("status", "published")

      const countMap: Record<string, number> = {}
      for (const ch of chapters ?? []) {
        countMap[ch.course_id] = (countMap[ch.course_id] ?? 0) + 1
      }
      courses = courses.map((c) => ({ ...c, chapter_count: countMap[c.id] ?? 0 }))
    }
  }

  const enrollments: Record<string, "active" | "completed"> = {}
  if (!isManager) {
    const { data: enrollmentData } = await db
      .from("enrollments")
      .select("course_id, status")
      .eq("student_id", user.id)

    for (const e of enrollmentData ?? []) {
      if (e.status === "active" || e.status === "completed") {
        enrollments[e.course_id] = e.status
      }
    }
  }

  // Fetch enrolled counts for social proof
  if (courses.length > 0) {
    const courseIds = courses.map((c) => c.id)
    const { data: enrollCounts } = await db
      .from("enrollments")
      .select("course_id")
      .in("course_id", courseIds)
      .in("status", ["active", "completed"])

    const enrollCountMap: Record<string, number> = {}
    for (const e of enrollCounts ?? []) {
      enrollCountMap[e.course_id] = (enrollCountMap[e.course_id] ?? 0) + 1
    }
    courses = courses.map((c) => ({ ...c, enrolled_count: enrollCountMap[c.id] ?? 0 }))
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* RODADA 12 — esta tela tinha um herói MÃO A MAO que duplicava byte a
          byte a variante "hero com imagem" do `PageHeader` (mesmo #1a1a1a,
          mesmo gradiente, mesma tipografia) e, por ser cópia, ficou de fora da
          correção da rodada 11: o eyebrow saía com o laranja do mundo Padrão
          chumbado na classe, medido em pixel #ff8645 no Estúdio (2º item da
          barra, "Meus Cursos") E na Administração ("Cursos e Trilhas"). O
          mundo anunciava azul ou teal na barra e voltava ao laranja no
          PRIMEIRO elemento do conteúdo.
          A correção é ESTRUTURAL, não de classe: a tela passa a usar o
          componente, que já resolve `--world-accent-on-dark` por superfície.
          Trocar só a classe deixaria a cópia viva para reprovar de novo na
          próxima mudança do cabeçalho. */}
      <PageHeader
        section="Educacao"
        title={isManager ? "Meus Cursos" : "Cursos e Trilhas"}
        description={
          isManager
            ? "Gerencie seus cursos e conteudo educacional."
            : enrollmentMode === "assigned"
              ? "Suas trilhas e os cursos atribuidos a voce."
              : "Acompanhe suas trilhas e explore os cursos disponiveis."
        }
        backgroundImage="https://images.unsplash.com/photo-1513258496099-48168024aec0?w=1200&q=80"
      />

      {/* Trails layers for students — Minhas Trilhas + Trilhas Disponíveis
          (unificação Cursos e Trilhas, decisão Hugo 2026-07-15) */}
      {!isManager && <TrailsSection supabase={db} userId={user.id} />}

      {!isManager && (
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">
          Cursos
        </h2>
      )}

      <CoursesPageClient
        isManager={isManager}
        canAuthor={canAuthor}
        courses={courses}
        enrollments={enrollments}
        enrollmentMode={enrollmentMode}
        isViewingAsStudent={isPreviewingAsStudent}
      />
    </div>
  )
}

async function TrailsSection({
  supabase,
  userId,
}: { supabase: Awaited<ReturnType<typeof createClient>>; userId: string }) {
  const { data: trails } = await supabase
    .from("learning_trails")
    .select("id, title, description, estimated_hours, status, is_mandatory")
    .eq("status", "active")
    .order("title", { ascending: true })

  if (!trails || trails.length === 0) return null

  // Get course counts per trail
  const trailIds = trails.map((t) => t.id)
  const { data: trailCourses } = await supabase
    .from("trail_courses")
    .select("trail_id")
    .in("trail_id", trailIds)

  const countMap: Record<string, number> = {}
  for (const tc of trailCourses ?? []) {
    countMap[tc.trail_id] = (countMap[tc.trail_id] ?? 0) + 1
  }

  // The viewer's trail enrollments → is_enrolled + progress per trail (keyed by
  // userId, not role, so any learner view gets the same layers).
  const { data: trailEnrollments } = await supabase
    .from("enrollments")
    .select("trail_id, status")
    .eq("student_id", userId)
    .not("trail_id", "is", null)
    .in("trail_id", trailIds)

  const progressMap: Record<string, { total: number; completed: number }> = {}
  for (const e of trailEnrollments ?? []) {
    if (!e.trail_id) continue
    const curr = progressMap[e.trail_id] ?? { total: 0, completed: 0 }
    curr.total++
    if (e.status === "completed") curr.completed++
    progressMap[e.trail_id] = curr
  }

  const summaries: TrailSummary[] = trails.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    estimated_hours: t.estimated_hours,
    is_mandatory: t.is_mandatory,
    course_count: countMap[t.id] ?? 0,
    is_enrolled: t.id in progressMap,
    progress: progressMap[t.id] ?? null,
  }))

  return <TrailsSectionClient trails={summaries} />
}
