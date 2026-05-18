import { PageHeader } from "@/components/layout/page-header"
import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { getLeaderTeam, getLeaderTeamProgress } from "@/lib/leader/team"
import { redirect } from "next/navigation"
import { LeaderDashboardClient } from "./_components/leader-dashboard-client"

export default async function LeaderPage() {
  const { user, profile } = await getAuthProfile()

  if (!user || !profile) return redirect("/login")
  if (profile.role !== "leader") return redirect("/dashboard")

  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) return redirect("/dashboard")

  // Resolve team via shared areas
  const { areas, members } = await getLeaderTeam(user.id, tenantId)

  // Fetch team progress data
  const teamMemberIds = members.map((m) => m.id)
  const { enrollments, sessions, reflections, courses } =
    await getLeaderTeamProgress(teamMemberIds, tenantId)

  // Process team member stats
  const now = Date.now()
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000

  const teamData = members.map((member) => {
    const memberEnrollments = enrollments.filter(
      (e) => e.student_id === member.id,
    )
    const memberSessions = sessions.filter(
      (s) => s.student_id === member.id,
    )
    const memberReflections = reflections.filter(
      (r) => r.student_id === member.id,
    )

    const completedEnrollments = memberEnrollments.filter(
      (e) => e.status === "completed",
    ).length
    const totalEnrollments = memberEnrollments.length
    const completionPct =
      totalEnrollments > 0
        ? Math.round((completedEnrollments / totalEnrollments) * 100)
        : 0

    const recentSessions = memberSessions.filter(
      (s) => new Date(s.created_at).getTime() > sevenDaysAgo,
    )
    const isActive = recentSessions.length > 0
    const neverStarted = memberSessions.length === 0

    let lastActiveDate: string | null = null
    if (memberSessions.length > 0) {
      const latest = Math.max(
        ...memberSessions.map((s) => new Date(s.created_at).getTime()),
      )
      lastActiveDate = new Date(latest).toISOString()
    }

    // Determine status color
    let status: "active" | "inactive" | "never" = "never"
    if (neverStarted) {
      status = "never"
    } else if (isActive) {
      status = "active"
    } else {
      status = "inactive"
    }

    const courseNames = memberEnrollments.map(
      (e) => (e.courses as any)?.title ?? "",
    ).filter(Boolean)

    return {
      id: member.id,
      fullName: member.fullName,
      email: member.email,
      avatarUrl: member.avatarUrl,
      coursesEnrolled: courseNames,
      totalEnrollments,
      completedEnrollments,
      completionPct,
      totalSessions: memberSessions.length,
      lastActiveDate,
      status,
      reflectionsCount: memberReflections.length,
    }
  })

  // Summary stats
  const totalMembers = members.length
  const activeLearners = teamData.filter((m) => m.status === "active").length
  const totalEnrollments = enrollments.length
  const completedEnrollments = enrollments.filter(
    (e) => e.status === "completed",
  ).length
  const overallCompletionRate =
    totalEnrollments > 0
      ? Math.round((completedEnrollments / totalEnrollments) * 100)
      : 0

  const totalSessionsCount = sessions.length
  const avgSessionsPerMember =
    totalMembers > 0
      ? Math.round((totalSessionsCount / totalMembers) * 10) / 10
      : 0

  // Recent reflections (for the pending reflections panel)
  const recentReflections = reflections.slice(0, 20).map((r) => {
    const member = members.find((m) => m.id === r.student_id)
    const chapter = (r as any).chapter_slides?.chapters
    return {
      id: r.id,
      studentId: r.student_id,
      studentName: member?.fullName ?? "",
      chapterTitle: chapter?.title ?? "",
      response: (r.response ?? "").slice(0, 200),
      fullResponse: r.response ?? "",
      createdAt: r.created_at,
    }
  })

  // Recent completions
  const recentCompletions = enrollments
    .filter((e) => e.status === "completed" && e.updated_at)
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
    .slice(0, 10)
    .map((e) => {
      const member = members.find((m) => m.id === e.student_id)
      return {
        studentName: member?.fullName ?? "",
        courseTitle: (e.courses as any)?.title ?? "",
        completedAt: e.updated_at,
      }
    })

  return (
    <div className="space-y-8">
      <PageHeader
        section="Lider Educador"
        title="Minha Equipe"
        description="Acompanhe a jornada de aprendizado da sua equipe. Celebre progressos, inspire pelo exemplo."
        accent="teal"
        backgroundImage="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&q=80"
      />

      <LeaderDashboardClient
        leaderName={profile.full_name}
        areas={areas}
        summary={{
          totalMembers,
          activeLearners,
          completionRate: overallCompletionRate,
          avgSessionsPerMember,
        }}
        teamData={teamData}
        recentReflections={recentReflections}
        recentCompletions={recentCompletions}
        tenantId={tenantId}
      />
    </div>
  )
}
