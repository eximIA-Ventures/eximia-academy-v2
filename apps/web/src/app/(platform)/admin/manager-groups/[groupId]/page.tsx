import { PageHeader } from "@/components/layout/page-header"
import { canOpenAdminRoute, isAdminTierActor, isPlainManager } from "@/lib/admin-route-access"
import { getAuthProfile } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/service"
import { ArrowLeft, Building2, Users } from "lucide-react"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import {
  type ManagerOption,
  type StudentOption,
  type UnitOption,
  listGestorOptions,
  listStudentOptions,
  listUnitOptions,
} from "../actions"
import { GroupDetailClient } from "./_components/group-detail-client"

interface Props {
  params: Promise<{ groupId: string }>
}

export default async function ManagerGroupDetailPage({ params }: Props) {
  const { groupId } = await params
  const { user, profile, roles, supabase } = await getAuthProfile()
  if (!user || !profile) return redirect("/login")
  // Guard por CHAPÉU real (regra dura 3): mesmo eixo do middleware. Conjunto
  // permitido INALTERADO — `manager` segue incluído.
  if (!canOpenAdminRoute("/admin/manager-groups", roles)) {
    return redirect("/dashboard")
  }

  const db = !profile.tenant_id ? createServiceClient() : supabase

  // Load the group — tenant guard done here; RLS + server action also protect mutations.
  const { data: group } = await db
    .from("manager_groups")
    .select(
      "id, tenant_id, manager_id, name, slug, description, is_corporate, created_at, updated_at",
    )
    .eq("id", groupId)
    .single()

  if (!group) return notFound()

  // Ownership guard for managers: they can only see their own groups.
  // "gestor comum" = tem o chapéu manager e NÃO é admin-tier. Espelha a
  // precedência que a coluna singular expressava (admin vence manager).
  if (isPlainManager(roles) && group.manager_id !== user.id) {
    return redirect("/admin/manager-groups")
  }

  // Resolve manager name
  let managerName: string | null = null
  if (group.manager_id) {
    const { data: mgr } = await db
      .from("users")
      .select("full_name")
      .eq("id", group.manager_id)
      .single()
    managerName = mgr?.full_name ?? null
  }

  // Linked units
  const { data: unitLinks } = await db
    .from("manager_group_units")
    .select("unit_id, areas(id, name, slug)")
    .eq("group_id", groupId)

  const linkedUnits: UnitOption[] = (unitLinks ?? []).flatMap((link) => {
    const rel = (link as unknown as { areas: UnitOption | UnitOption[] | null }).areas
    const area = Array.isArray(rel) ? rel[0] : rel
    return area ? [{ id: area.id, name: area.name, slug: area.slug }] : []
  })

  // Members with full user info
  const { data: memberRows } = await db
    .from("manager_group_members")
    .select("student_id")
    .eq("group_id", groupId)

  const memberIds = (memberRows ?? []).map((r) => r.student_id)
  let members: Array<{ id: string; full_name: string; email: string }> = []
  if (memberIds.length > 0) {
    const { data } = await db
      .from("users")
      .select("id, full_name, email")
      .in("id", memberIds)
      .order("full_name")
    members = data ?? []
  }

  const isAdmin = isAdminTierActor(roles)

  // Fetch option lists via server actions (they re-derive auth internally).
  const [studentsResult, gestoresResult, allUnitsResult] = await Promise.all([
    listStudentOptions(),
    listGestorOptions(),
    listUnitOptions(),
  ])

  const availableStudents: StudentOption[] = studentsResult.data ?? []
  const gestores: ManagerOption[] = gestoresResult.data ?? []
  const allUnits: UnitOption[] = allUnitsResult.data ?? []

  const groupRow = {
    ...group,
    manager_name: managerName,
    units: linkedUnits,
    member_count: members.length,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        section="Grupos de Gestor"
        title={group.name}
        description={
          group.description
            ? group.description
            : group.is_corporate
              ? "Grupo corporativo"
              : "Grupo padrão"
        }
        backgroundImage="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80"
      />

      <Link
        href="/admin/manager-groups"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
      >
        <ArrowLeft size={14} />
        Voltar para Grupos de Gestor
      </Link>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl bg-bg-card shadow-card p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-500/15">
              <Users size={20} className="text-blue-500" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
                Membros
              </p>
              <p className="text-2xl font-bold text-text-primary">{members.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-bg-card shadow-card p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cerrado-600/15">
              <Building2 size={20} className="text-cerrado-600" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
                Unidades
              </p>
              <p className="text-2xl font-bold text-text-primary">{linkedUnits.length}</p>
            </div>
          </div>
        </div>
      </div>

      <GroupDetailClient
        group={groupRow}
        members={members}
        availableStudents={availableStudents}
        gestores={gestores}
        allUnits={allUnits}
        isAdmin={isAdmin}
      />
    </div>
  )
}
