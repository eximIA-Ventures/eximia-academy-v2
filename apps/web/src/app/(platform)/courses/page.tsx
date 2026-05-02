import { createClient } from "@/lib/supabase/server"
import { tenantRedirect } from "@/lib/tenant-nav"
import { BookOpen, Clock, Route } from "lucide-react"
import { cookies } from "next/headers"
import Link from "next/link"
import { redirect } from "next/navigation"
import { CoursesPageClient } from "./_components/courses-page-client"

export default async function CoursesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return tenantRedirect("/login")

  const { data: profile } = await supabase.from("users").select("role, tenant_id").eq("id", user.id).single()

  if (!profile) return tenantRedirect("/login")

  // "View as student" mode — override role for all UI decisions
  const viewAsStudent = (await cookies()).get("x-view-as-student")?.value === "true"
  const effectiveRole = viewAsStudent && (profile.role === "instructor" || profile.role === "admin" || profile.role === "super_admin")
    ? "student"
    : profile.role

  const isManager = effectiveRole === "manager" || effectiveRole === "admin" || effectiveRole === "instructor" || effectiveRole === "super_admin"

  // Resolve tenant_id: super_admin uses cookie for active tenant
  let activeTenantId = profile.tenant_id
  if (profile.role === "super_admin" && !activeTenantId) {
    const { cookies: getCookies } = await import("next/headers")
    const cookieStore = await getCookies()
    activeTenantId = cookieStore.get("x-sa-active-tenant")?.value ?? null
  }

  // Fetch tenant enrollment mode
  const { data: tenant } = await supabase
    .from("tenants")
    .select("settings")
    .eq("id", activeTenantId)
    .single()
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
    let query = supabase
      .from("courses")
      .select("id, title, description, cover_image_url, type, status, created_at")
      .order("created_at", { ascending: false })

    // Super admin: must filter by active tenant explicitly (RLS doesn't apply)
    if (profile.role === "super_admin" && activeTenantId) {
      query = query.eq("tenant_id", activeTenantId)
    }

    // Managers see courses from their areas; instructors see all tenant courses; admins see all
    if (profile.role === "instructor") {
      // Instructors see all courses in their tenant (RLS handles tenant isolation)
    } else if (profile.role === "manager") {
      const { data: userAreas } = await supabase
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
      const { data: chapters } = await supabase
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
    const { data: enrolledCourses } = await supabase
      .from("enrollments")
      .select("course_id")
      .eq("student_id", user.id)
      .in("status", ["active", "completed"])

    const enrolledIds = (enrolledCourses ?? []).map((e) => e.course_id)

    if (enrolledIds.length > 0) {
      const { data } = await supabase
        .from("courses")
        .select("id, title, description, cover_image_url, type, status, created_at")
        .eq("status", "published")
        .in("id", enrolledIds)
        .order("created_at", { ascending: false })

      courses = (data ?? []).map((c) => ({ ...c, chapter_count: 0, enrolled_count: 0 }))
    }

    if (courses.length > 0) {
      const courseIds = courses.map((c) => c.id)
      const { data: chapters } = await supabase
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
    const { data } = await supabase
      .from("courses")
      .select("id, title, description, cover_image_url, type, status, created_at")
      .eq("status", "published")
      .order("created_at", { ascending: false })

    courses = (data ?? []).map((c) => ({ ...c, chapter_count: 0, enrolled_count: 0 }))

    if (courses.length > 0) {
      const courseIds = courses.map((c) => c.id)
      const { data: chapters } = await supabase
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
    const { data: enrollmentData } = await supabase
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
    const { data: enrollCounts } = await supabase
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
      {/* Page header */}
      <section className="relative -mx-6 -mt-6 flex min-h-[280px] items-end overflow-hidden bg-bg-app px-6 pb-8 pt-16 sm:px-8 md:px-10">
        <div
          className="absolute inset-y-0 right-0 w-[70%] bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1513258496099-48168024aec0?w=1200&q=80')" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(90deg, rgba(15,15,15,0.97) 0%, rgba(15,15,15,0.85) 35%, rgba(15,15,15,0.3) 65%, transparent 100%)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-bg-app to-transparent" />
        <div className="relative z-10 w-full">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-blue-light">
            Educação
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
            {isManager ? "Meus Cursos" : enrollmentMode === "assigned" ? "Meus Cursos" : "Cursos Disponíveis"}
          </h1>
          <p className="mt-3 text-sm text-text-secondary leading-relaxed max-w-lg md:text-base">
            {isManager
              ? "Gerencie seus cursos e conteúdo educacional."
              : enrollmentMode === "assigned"
                ? "Cursos atribuídos a você."
                : "Explore os cursos disponíveis e inscreva-se."}
          </p>
        </div>
      </section>

      {/* Trails section for students */}
      {!isManager && <TrailsSection supabase={supabase} userId={user!.id} />}

      <CoursesPageClient role={effectiveRole} courses={courses} enrollments={enrollments} enrollmentMode={enrollmentMode} isViewingAsStudent={viewAsStudent} />
    </div>
  )
}

async function TrailsSection({ supabase, userId }: { supabase: Awaited<ReturnType<typeof createClient>>; userId: string }) {
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

  return (
    <div className="space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted flex items-center gap-2">
        <Route size={14} className="text-accent-teal" />
        Trilhas de Aprendizagem
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {trails.map((trail) => (
          <Link
            key={trail.id}
            href={`/trails/${trail.id}`}
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent-teal/8 via-bg-card to-bg-card ring-1 ring-accent-teal/15 transition-all duration-300 hover:-translate-y-0.5 hover:ring-accent-teal/30 hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)]"
          >
            {/* Top accent bar */}
            <div className="h-1 w-full bg-gradient-to-r from-accent-teal via-accent-blue-mid to-accent-teal/20" />

            <div className="p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary group-hover:text-accent-teal transition-colors line-clamp-1">
                  {trail.title}
                </h3>
                {trail.is_mandatory && (
                  <span className="shrink-0 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[8px] font-bold text-amber-500 ring-1 ring-amber-500/25 uppercase">
                    Obrigatória
                  </span>
                )}
              </div>

              {trail.description && (
                <p className="text-[11px] text-text-muted line-clamp-2 leading-relaxed">{trail.description}</p>
              )}

              <div className="flex items-center gap-2 pt-1">
                <span className="inline-flex items-center gap-1 rounded-md bg-accent-teal/10 px-2 py-0.5 text-[10px] font-medium text-accent-teal ring-1 ring-accent-teal/20">
                  <BookOpen size={9} />
                  {countMap[trail.id] ?? 0} cursos
                </span>
                {trail.estimated_hours && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-accent-blue-mid/10 px-2 py-0.5 text-[10px] font-medium text-accent-blue-mid ring-1 ring-accent-blue-mid/20">
                    <Clock size={9} />
                    {trail.estimated_hours}h
                  </span>
                )}
              </div>
            </div>

            <div className="absolute -right-6 -bottom-6 h-20 w-20 rounded-full bg-accent-teal/5 blur-xl" />
          </Link>
        ))}
      </div>
    </div>
  )
}
