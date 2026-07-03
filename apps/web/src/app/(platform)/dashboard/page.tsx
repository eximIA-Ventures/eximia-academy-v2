import { getAuthProfile } from "@/lib/auth"
import { resolveContext } from "@/lib/context-resolver"
import { hasRole } from "@/lib/role-helpers"
import { redirect } from "next/navigation"
import { AdminDashboardPage } from "./_components/admin-dashboard-page"
import { ManagerDashboardPage } from "./_components/manager-dashboard-page"
import { ManagerTeamDashboardPage } from "./_components/manager-team-dashboard-page"
import { resolveDashboardKind } from "./_components/resolve-dashboard-kind"
import { StudentDashboardPage } from "./_components/student-dashboard-page"
import { SuperAdminDashboardPage } from "./_components/super-admin-dashboard-page"

// =============================================================================
// Dashboard router (E8, chokepoint 1) — by ACTIVE CONTEXT + capability, never
// by `profile.role`. The active context decides WHICH dashboard to render among
// the ones the person's hats allow; it never grants access (RLS is the trava).
// A forged context falls back to the student trail (resolveDashboardKind) and,
// even if a shell rendered, RLS returns zero rows (AC9/AC10).
// =============================================================================
export default async function DashboardPage({
  searchParams,
}: {
  // E9 drill-down: `?focus=<uuid>` selects the subtree node a manager is focused
  // on. Read here (SSR), gated downstream against auth_subtree_user_ids() — a
  // forged value never widens reach (it falls back to the manager's own root).
  searchParams?: Promise<{ focus?: string }>
}) {
  const {
    user,
    profile,
    roles,
    hasEnrollment,
    error: profileError,
    supabase,
  } = await getAuthProfile()
  const focusUserId = (await searchParams)?.focus ?? null

  if (!user) return redirect("/login")

  if (profileError) {
    console.error("Failed to fetch user profile:", profileError.message)
    throw new Error("Failed to load user profile")
  }

  if (!profile) return redirect("/login")

  // Active context (E7): reads + validates x-active-context vs user_roles; safe
  // default by precedence when absent. `roles[]` is the UNION of hats (E1).
  const { active: activeContext } = await resolveContext()
  const capabilityProfile = { roles }
  const kind = resolveDashboardKind(capabilityProfile, activeContext)

  // Dedicated routes by capability (preserve the instructor/leader branches the
  // MAPA omitted). Regra: staff que TAMBÉM é aluno (hasEnrollment) e escolheu
  // "Minha Trilha" (personal) vê a trilha; staff PURO (sem enrollment) vai sempre
  // à página dedicada, mesmo quando o contexto resolveu para 'personal' por falta
  // de outra opção (corrige a regressão do instrutor puro caindo na trilha).
  const isStaffWithoutTrail = !hasEnrollment
  if (
    kind === "student" &&
    hasRole(capabilityProfile, "instructor") &&
    (activeContext.type !== "personal" || isStaffWithoutTrail)
  ) {
    return redirect("/instructor")
  }
  if (
    kind === "student" &&
    hasRole(capabilityProfile, "leader") &&
    (activeContext.type !== "personal" || isStaffWithoutTrail)
  ) {
    return redirect("/leader")
  }

  switch (kind) {
    case "student":
      return (
        <StudentDashboardPage supabase={supabase} userId={user.id} fullName={profile.full_name} />
      )

    case "manager-team":
      return (
        <ManagerTeamDashboardPage
          supabase={supabase}
          tenantId={profile.tenant_id}
          managerId={user.id}
          fullName={profile.full_name}
          focusUserId={focusUserId}
        />
      )

    case "manager":
      // Organization-context manager view (NOT "Meu Time") — always the whole
      // reachable subtree, unaffected by the Diretos/Hierarquia switch (that
      // switch is scoped to the `team` context only, per product spec).
      // Pinning "hierarchy" here avoids silently inheriting a stray
      // `x-team-view` cookie value set from a previous "Meu Time" session.
      return (
        <ManagerDashboardPage
          supabase={supabase}
          tenantId={profile.tenant_id}
          managerId={user.id}
          fullName={profile.full_name}
          teamViewMode="hierarchy"
        />
      )

    case "super-admin":
      return <SuperAdminDashboardPage fullName={profile.full_name} />

    case "admin": {
      // Admin global (null tenant) needs service client to bypass RLS.
      // (Preserved integrally from the previous admin branch.)
      let dbClient = supabase
      let resolvedTenantId = profile.tenant_id
      if (!profile.tenant_id) {
        const { createServiceClient } = await import("@/lib/supabase/service")
        dbClient = createServiceClient()
        const { resolveTenantId } = await import("@/lib/auth")
        resolvedTenantId = await resolveTenantId(null)
      }
      return (
        <AdminDashboardPage
          supabase={dbClient}
          role={profile.role}
          tenantId={resolvedTenantId}
          fullName={profile.full_name}
        />
      )
    }

    default: {
      // Exhaustiveness guard — every DashboardKind is handled above.
      const _exhaustive: never = kind
      console.error(`Unhandled dashboard kind: ${_exhaustive as string}`)
      return redirect("/login")
    }
  }
}
