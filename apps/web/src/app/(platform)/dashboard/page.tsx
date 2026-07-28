import { getAuthProfile } from "@/lib/auth"
import { resolveContext } from "@/lib/context-resolver"
import { hasRole } from "@/lib/role-helpers"
import { getActiveWorkspace } from "@/lib/workspace-context"
import { resolvePlatformShell } from "@/lib/workspace-resolver"
import type { Role } from "@eximia/shared"
import { redirect } from "next/navigation"
import { AdminDashboardSlot } from "./_components/admin-dashboard-slot"
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
  // Eixo de MUNDO (rodada 9). `/dashboard` é a home do mundo PADRÃO, e o mundo
  // de aprendizagem não contém administração: para o `super_admin` isto passa a
  // resolver a tela de ALUNO em vez do painel global de todas as empresas (que
  // mudou para o 4º mundo, `/super-admin`). Usamos `resolvePlatformShell` — o
  // MESMO resolvedor do `(platform)/layout.tsx` — para a tela nunca discordar da
  // casca em volta dela, e porque ele é fail-closed por chapéu real.
  const activeWorkspace = await getActiveWorkspace()
  const platformShell = resolvePlatformShell(activeWorkspace, roles as Role[])
  const kind = resolveDashboardKind(capabilityProfile, activeContext, platformShell)
  // Quando a tela de aluno vem da regra do mundo Padrão (e não do contexto), os
  // desvios de staff abaixo não se aplicam: um `super_admin + instructor` seria
  // rebatido para `/instructor` e nunca veria o Padrão que ele escolheu.
  const isStandardWorldSuperAdmin =
    platformShell === "standard" && hasRole(capabilityProfile, "super_admin")

  // Dedicated routes by capability (preserve the instructor/leader branches the
  // MAPA omitted). Regra: staff que TAMBÉM é aluno (hasEnrollment) e escolheu
  // "Minha Trilha" (personal) vê a trilha; staff PURO (sem enrollment) vai sempre
  // à página dedicada, mesmo quando o contexto resolveu para 'personal' por falta
  // de outra opção (corrige a regressão do instrutor puro caindo na trilha).
  const isStaffWithoutTrail = !hasEnrollment
  if (
    kind === "student" &&
    !isStandardWorldSuperAdmin &&
    hasRole(capabilityProfile, "instructor") &&
    (activeContext.type !== "personal" || isStaffWithoutTrail)
  ) {
    return redirect("/instructor")
  }
  if (
    kind === "student" &&
    !isStandardWorldSuperAdmin &&
    hasRole(capabilityProfile, "leader") &&
    (activeContext.type !== "personal" || isStaffWithoutTrail)
  ) {
    return redirect("/leader")
  }

  switch (kind) {
    case "student":
      return (
        <StudentDashboardPage
          supabase={supabase}
          userId={user.id}
          fullName={profile.full_name}
          tenantId={profile.tenant_id}
        />
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

    case "admin":
      // A resolução de tenant + render do painel vive num slot ÚNICO, também
      // consumido pela home do mundo admin (`/admin`, W2). Zero duplicação.
      return (
        <AdminDashboardSlot
          supabase={supabase}
          role={profile.role}
          tenantId={profile.tenant_id}
          fullName={profile.full_name}
        />
      )

    default: {
      // Exhaustiveness guard — every DashboardKind is handled above.
      const _exhaustive: never = kind
      console.error(`Unhandled dashboard kind: ${_exhaustive as string}`)
      return redirect("/login")
    }
  }
}
