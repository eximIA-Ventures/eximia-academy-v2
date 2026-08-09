"use server"

import { resolveTenantId } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { slugify } from "@/lib/utils/slugify"
import { revalidatePath } from "next/cache"

// =============================================================================
// ÁREA / GESTOR — server actions (manager-owned student TEAMS, distinct from
// `areas` = UNIDADE). UI must label these "Grupos de Gestor" / "Times", NEVER
// "Unidades". See migration 20260530130000_area_gestor.sql.
//
// SECURITY MODEL (critical):
//   • Every mutation re-derives the caller's role + tenant from the DB profile
//     (NEVER trusts a tenant_id coming from the client).
//   • tenant_id written to rows is ALWAYS the caller's resolved tenant.
//   • Primary write path is the AUTHENTICATED (RLS-enforced) client. The DB RLS
//     policies (mg_insert / mg_update / mg_delete / mgu_write / mgm_write) are
//     the source of truth: admin → any group in tenant; manager → only groups
//     they own.
//   • The SERVICE client is used ONLY for the cross-tenant super_admin / null-
//     tenant admin case (where RLS would not resolve a tenant). In that branch
//     we replicate the auth + role + tenant guard explicitly in app code.
// =============================================================================

const REVALIDATE_PATH = "/admin/manager-groups"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ManagerGroupUnit {
  id: string
  name: string
  slug: string
}

export interface ManagerGroupRow {
  id: string
  tenant_id: string
  manager_id: string | null
  manager_name: string | null
  name: string
  slug: string
  description: string | null
  is_corporate: boolean
  created_at: string
  updated_at: string
  units: ManagerGroupUnit[]
  member_count: number
}

export interface ManagerOption {
  id: string
  full_name: string
  email: string
  role: string
}

export interface UnitOption {
  id: string
  name: string
  slug: string
}

export interface StudentOption {
  id: string
  full_name: string
  email: string
}

interface AuthContext {
  userId: string
  role: "admin" | "super_admin" | "manager"
  tenantId: string
  // The authenticated, RLS-enforced client. Preferred for all writes.
  authed: Awaited<ReturnType<typeof createClient>>
  // Whether this caller has a null profile tenant (super_admin / cross-tenant
  // admin) and therefore needs the service client to resolve a tenant.
  needsServiceClient: boolean
}

type ActionError = { error: string }

// ---------------------------------------------------------------------------
// Shared auth helper
// ---------------------------------------------------------------------------
// Returns a fully-resolved context or a legible { error }. Roles allowed for
// manager-group operations are admin/super_admin (full) and manager (own only).
// `requireAdmin` narrows further when an operation is admin-only (delete).
// ---------------------------------------------------------------------------
async function getAuthContext(): Promise<AuthContext | ActionError> {
  const authed = await createClient()
  const {
    data: { user },
  } = await authed.auth.getUser()
  if (!user) return { error: "Não autenticado" }

  // Read the profile with the authenticated client (RLS allows self-read).
  const { data: profile } = await authed
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile?.role || !["admin", "super_admin", "manager"].includes(profile.role)) {
    return { error: "Acesso negado" }
  }

  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) return { error: "Nenhum tenant ativo" }

  return {
    userId: user.id,
    role: profile.role as AuthContext["role"],
    tenantId,
    authed,
    needsServiceClient: !profile.tenant_id,
  }
}

// Returns the DB client to use for a mutation. Prefer the RLS-enforced client.
// Only fall back to the service client for the null-tenant (cross-tenant)
// admin/super_admin case, where the app-level guard already validated tenant.
function dbFor(ctx: AuthContext) {
  return ctx.needsServiceClient ? createServiceClient() : ctx.authed
}

// ---------------------------------------------------------------------------
// listManagerGroups — groups visible to the caller
//   admin/super_admin: all groups in tenant; manager: only owned groups.
// ---------------------------------------------------------------------------
export async function listManagerGroups(): Promise<
  { data: ManagerGroupRow[]; error?: never } | { data?: never; error: string }
> {
  const ctx = await getAuthContext()
  if ("error" in ctx) return { error: ctx.error }

  const db = dbFor(ctx)

  let groupsQuery = db
    .from("manager_groups")
    .select(
      "id, tenant_id, manager_id, name, slug, description, is_corporate, created_at, updated_at",
    )
    .eq("tenant_id", ctx.tenantId)
    .order("name", { ascending: true })

  // App-level narrowing for managers (RLS already enforces this, but when the
  // service client is used for cross-tenant admins we still scope correctly,
  // and managers must only ever see their own groups regardless of client).
  if (ctx.role === "manager") {
    groupsQuery = groupsQuery.eq("manager_id", ctx.userId)
  }

  const { data: groups, error } = await groupsQuery
  if (error) {
    console.error("[listManagerGroups]", error)
    return { error: "Erro ao carregar grupos de gestor" }
  }

  const groupIds = (groups ?? []).map((g) => g.id)
  if (groupIds.length === 0) return { data: [] }

  // Resolve manager names, linked units, and member counts in batch.
  const managerIds = Array.from(
    new Set((groups ?? []).map((g) => g.manager_id).filter((v): v is string => !!v)),
  )

  const [{ data: managers }, { data: unitLinks }, { data: members }] = await Promise.all([
    managerIds.length > 0
      ? db.from("users").select("id, full_name").in("id", managerIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string }> }),
    db
      .from("manager_group_units")
      .select("group_id, unit_id, areas(id, name, slug)")
      .in("group_id", groupIds),
    db.from("manager_group_members").select("group_id").in("group_id", groupIds),
  ])

  const managerNameById = new Map(
    (managers ?? []).map((m: { id: string; full_name: string }) => [m.id, m.full_name]),
  )

  const unitsByGroup = new Map<string, ManagerGroupUnit[]>()
  for (const link of unitLinks ?? []) {
    // The FK relation `areas(...)` may be typed as an object or an array
    // depending on the inferred schema; normalize to a single area row.
    const rel = (link as unknown as { areas: ManagerGroupUnit | ManagerGroupUnit[] | null }).areas
    const area = Array.isArray(rel) ? rel[0] : rel
    if (!area) continue
    const arr = unitsByGroup.get(link.group_id) ?? []
    arr.push({ id: area.id, name: area.name, slug: area.slug })
    unitsByGroup.set(link.group_id, arr)
  }

  const memberCountByGroup = new Map<string, number>()
  for (const m of members ?? []) {
    memberCountByGroup.set(m.group_id, (memberCountByGroup.get(m.group_id) ?? 0) + 1)
  }

  const rows: ManagerGroupRow[] = (groups ?? []).map((g) => ({
    ...g,
    manager_name: g.manager_id ? (managerNameById.get(g.manager_id) ?? null) : null,
    units: unitsByGroup.get(g.id) ?? [],
    member_count: memberCountByGroup.get(g.id) ?? 0,
  }))

  return { data: rows }
}

// ---------------------------------------------------------------------------
// Slug generation — unique within tenant. Tries the base slug, then -2, -3, …
// ---------------------------------------------------------------------------
async function generateUniqueSlug(
  db: ReturnType<typeof dbFor>,
  tenantId: string,
  name: string,
): Promise<string> {
  const base = slugify(name) || "grupo"
  const { data: existing } = await db
    .from("manager_groups")
    .select("slug")
    .eq("tenant_id", tenantId)
    .like("slug", `${base}%`)

  const taken = new Set((existing ?? []).map((r) => r.slug))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

// ---------------------------------------------------------------------------
// createManagerGroup
//   admin/super_admin: may create any group (any managerId in tenant).
//   manager: may create only a group they own (managerId === self).
// ---------------------------------------------------------------------------
export async function createManagerGroup(input: {
  name: string
  managerId?: string | null
  isCorporate?: boolean
  description?: string | null
  unitIds?: string[]
}): Promise<{ id: string; error?: never } | { id?: never; error: string }> {
  const ctx = await getAuthContext()
  if ("error" in ctx) return { error: ctx.error }

  const name = input.name?.trim()
  if (!name) return { error: "Nome é obrigatório" }

  const isAdmin = ctx.role === "admin" || ctx.role === "super_admin"

  // Resolve the owning gestor and enforce ownership rules.
  let managerId: string | null = input.managerId ?? null
  if (!isAdmin) {
    // A manager can only create groups they own.
    if (managerId && managerId !== ctx.userId) {
      return { error: "Gestor só pode criar grupos que ele mesmo gerencia" }
    }
    managerId = ctx.userId
  }

  const db = dbFor(ctx)

  // Validate the chosen manager belongs to the tenant and has a manager/admin role.
  if (managerId) {
    const { data: mgr } = await db
      .from("users")
      .select("id, role, tenant_id")
      .eq("id", managerId)
      .single()
    if (!mgr || mgr.tenant_id !== ctx.tenantId) {
      return { error: "Gestor inválido para este tenant" }
    }
    if (!["manager", "admin", "super_admin"].includes(mgr.role)) {
      return { error: "O usuário selecionado não é um gestor (manager/admin)" }
    }
  }

  const slug = await generateUniqueSlug(db, ctx.tenantId, name)

  const { data: created, error } = await db
    .from("manager_groups")
    .insert({
      tenant_id: ctx.tenantId, // forced — never from client
      manager_id: managerId,
      name,
      slug,
      description: input.description?.trim() || null,
      is_corporate: input.isCorporate ?? false,
      created_by: ctx.userId,
    })
    .select("id")
    .single()

  if (error || !created) {
    console.error("[createManagerGroup]", error)
    if (error?.code === "23505") return { error: "Já existe um grupo com este slug" }
    return { error: error?.message ?? "Erro ao criar grupo de gestor" }
  }

  // Link the requested UNIDADE(s). Reuse setManagerGroupUnits for tenant
  // validation; ignore "no units" (a group can start unit-less).
  const unitIds = (input.unitIds ?? []).filter(Boolean)
  if (unitIds.length > 0) {
    const linkRes = await setManagerGroupUnits(created.id, unitIds)
    if (linkRes.error) {
      // Roll back the group so we don't leave a half-created record.
      await db.from("manager_groups").delete().eq("id", created.id)
      return { error: linkRes.error }
    }
  }

  revalidatePath(REVALIDATE_PATH)
  return { id: created.id }
}

// ---------------------------------------------------------------------------
// updateManagerGroup — admin (any) or the owning gestor (their own group).
// ---------------------------------------------------------------------------
export async function updateManagerGroup(input: {
  id: string
  name?: string
  managerId?: string | null
  isCorporate?: boolean
  description?: string | null
}): Promise<{ success: true; error?: never } | { success?: never; error: string }> {
  const ctx = await getAuthContext()
  if ("error" in ctx) return { error: ctx.error }

  const db = dbFor(ctx)
  const isAdmin = ctx.role === "admin" || ctx.role === "super_admin"

  // Load + ownership/tenant guard.
  const { data: group } = await db
    .from("manager_groups")
    .select("id, tenant_id, manager_id")
    .eq("id", input.id)
    .single()

  if (!group || group.tenant_id !== ctx.tenantId) return { error: "Grupo não encontrado" }
  if (!isAdmin && group.manager_id !== ctx.userId) return { error: "Sem permissão" }

  const patch: Record<string, unknown> = {}

  if (input.name !== undefined) {
    const name = input.name.trim()
    if (!name) return { error: "Nome não pode ser vazio" }
    patch.name = name
  }
  if (input.description !== undefined) {
    patch.description = input.description?.trim() || null
  }
  if (input.isCorporate !== undefined) {
    patch.is_corporate = input.isCorporate
  }

  // Reassigning the owning gestor is an admin-only action.
  if (input.managerId !== undefined) {
    if (!isAdmin) return { error: "Apenas admin pode reatribuir o gestor do grupo" }
    if (input.managerId) {
      const { data: mgr } = await db
        .from("users")
        .select("id, role, tenant_id")
        .eq("id", input.managerId)
        .single()
      if (!mgr || mgr.tenant_id !== ctx.tenantId) {
        return { error: "Gestor inválido para este tenant" }
      }
      if (!["manager", "admin", "super_admin"].includes(mgr.role)) {
        return { error: "O usuário selecionado não é um gestor (manager/admin)" }
      }
    }
    patch.manager_id = input.managerId
  }

  if (Object.keys(patch).length === 0) return { success: true }

  const { error } = await db.from("manager_groups").update(patch).eq("id", input.id)
  if (error) {
    console.error("[updateManagerGroup]", error)
    return { error: error.message }
  }

  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

// ---------------------------------------------------------------------------
// deleteManagerGroup — admin only (RLS mg_delete). Managers cannot delete.
// ---------------------------------------------------------------------------
export async function deleteManagerGroup(
  id: string,
): Promise<{ success: true; error?: never } | { success?: never; error: string }> {
  const ctx = await getAuthContext()
  if ("error" in ctx) return { error: ctx.error }

  if (ctx.role !== "admin" && ctx.role !== "super_admin") {
    return { error: "Apenas admin pode excluir grupos" }
  }

  const db = dbFor(ctx)

  // Tenant guard before delete.
  const { data: group } = await db
    .from("manager_groups")
    .select("id, tenant_id")
    .eq("id", id)
    .single()
  if (!group || group.tenant_id !== ctx.tenantId) return { error: "Grupo não encontrado" }

  // FK cascades remove manager_group_units / manager_group_members.
  const { error } = await db.from("manager_groups").delete().eq("id", id)
  if (error) {
    console.error("[deleteManagerGroup]", error)
    return { error: error.message }
  }

  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

// ---------------------------------------------------------------------------
// setManagerGroupUnits — replace the set of UNIDADE(s) linked to a group.
//   admin (any) or owning gestor. Validates every unit belongs to the tenant.
// ---------------------------------------------------------------------------
export async function setManagerGroupUnits(
  groupId: string,
  unitIds: string[],
): Promise<{ success: true; error?: never } | { success?: never; error: string }> {
  const ctx = await getAuthContext()
  if ("error" in ctx) return { error: ctx.error }

  const db = dbFor(ctx)
  const isAdmin = ctx.role === "admin" || ctx.role === "super_admin"

  // Group ownership/tenant guard.
  const { data: group } = await db
    .from("manager_groups")
    .select("id, tenant_id, manager_id")
    .eq("id", groupId)
    .single()
  if (!group || group.tenant_id !== ctx.tenantId) return { error: "Grupo não encontrado" }
  if (!isAdmin && group.manager_id !== ctx.userId) return { error: "Sem permissão" }

  const desired = Array.from(new Set(unitIds.filter(Boolean)))

  // Validate every requested UNIDADE belongs to the caller's tenant.
  if (desired.length > 0) {
    const { data: validUnits } = await db
      .from("areas")
      .select("id")
      .eq("tenant_id", ctx.tenantId)
      .in("id", desired)
    const validSet = new Set((validUnits ?? []).map((a) => a.id))
    const invalid = desired.filter((u) => !validSet.has(u))
    if (invalid.length > 0) return { error: "Uma ou mais unidades são inválidas para o tenant" }
  }

  // Replace strategy: delete current links, insert the desired set.
  const { error: delErr } = await db.from("manager_group_units").delete().eq("group_id", groupId)
  if (delErr) {
    console.error("[setManagerGroupUnits:delete]", delErr)
    return { error: delErr.message }
  }

  if (desired.length > 0) {
    const { error: insErr } = await db.from("manager_group_units").insert(
      desired.map((unit_id) => ({
        group_id: groupId,
        unit_id,
        tenant_id: ctx.tenantId, // forced
      })),
    )
    if (insErr) {
      console.error("[setManagerGroupUnits:insert]", insErr)
      return { error: insErr.message }
    }
  }

  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

// ---------------------------------------------------------------------------
// addManagerGroupMembers — add students to a group's team.
//   admin (any) or owning gestor. Validates students are tenant + role student.
//   Idempotent: ignores students already in the group (UNIQUE constraint).
// ---------------------------------------------------------------------------
export async function addManagerGroupMembers(
  groupId: string,
  studentIds: string[],
): Promise<{ success: true; added: number; error?: never } | { success?: never; error: string }> {
  const ctx = await getAuthContext()
  if ("error" in ctx) return { error: ctx.error }

  const db = dbFor(ctx)
  const isAdmin = ctx.role === "admin" || ctx.role === "super_admin"

  const { data: group } = await db
    .from("manager_groups")
    .select("id, tenant_id, manager_id")
    .eq("id", groupId)
    .single()
  if (!group || group.tenant_id !== ctx.tenantId) return { error: "Grupo não encontrado" }
  if (!isAdmin && group.manager_id !== ctx.userId) return { error: "Sem permissão" }

  const requested = Array.from(new Set(studentIds.filter(Boolean)))
  if (requested.length === 0) return { error: "Nenhum aluno informado" }

  // Validate students belong to tenant and hold the student HAT.
  //
  // MULTI-CHAPÉU + SECURITY GUARD (Crivo review, T1 rodada 1, 2026-07-18 —
  // discovered via the self-audit grep, not on the original assigned list, but
  // the SAME class of bug): the legacy singular `users.role` column used to gate
  // this insert would (a) reject a legitimate multi-hat member (e.g. gestor+
  // aluno, like Caio Pinheiro) from ever being added to a team, and (b) is
  // exactly the validation `manager_group_members` relies on to never contain a
  // non-student — asserting via `user_roles` instead makes this the correct
  // enforcement point for the DB-level gap documented in
  // engagement-scope.ts's filterToStudentHat / the auth_direct_student_ids
  // migration. `user_roles` RLS blocks a manager from reading a THIRD PARTY's
  // hat under the authenticated client (self/admin-only) — the SERVICE client is
  // required here, same lesson as everywhere else this pattern appears.
  const svc = createServiceClient()
  const { data: hatRows } = await svc
    .from("user_roles")
    .select("user_id")
    .eq("tenant_id", ctx.tenantId)
    .eq("role", "student")
    .in("user_id", requested)
  const studentHatIds = [...new Set((hatRows ?? []).map((r) => r.user_id as string))]
  // We also pull full_name/email so the consistency guard below can name an
  // offending student in its error message without a second round-trip.
  const { data: validStudents } = studentHatIds.length
    ? await db
        .from("users")
        .select("id, full_name, email")
        .eq("tenant_id", ctx.tenantId)
        .in("id", studentHatIds)
    : { data: [] as Array<{ id: string; full_name: string | null; email: string | null }> }
  const validRows = (validStudents ?? []) as Array<{
    id: string
    full_name: string | null
    email: string | null
  }>
  const validSet = new Set(validRows.map((u) => u.id))
  const invalid = requested.filter((s) => !validSet.has(s))
  if (invalid.length > 0) return { error: "Um ou mais alunos são inválidos para o tenant" }

  // Skip students already in the group to keep the insert idempotent.
  const { data: existing } = await db
    .from("manager_group_members")
    .select("student_id")
    .eq("group_id", groupId)
    .in("student_id", requested)
  const existingSet = new Set((existing ?? []).map((r) => r.student_id))
  const toAdd = requested.filter((s) => !existingSet.has(s))

  if (toAdd.length === 0) {
    return { success: true, added: 0 }
  }

  // -------------------------------------------------------------------------
  // INVARIANTE DE DOMÍNIO (Story 8): "o time é uma subclassificação DENTRO da
  // unidade". Um membro do time DEVE pertencer (via user_areas) a, no mínimo,
  // uma das UNIDADE(s) vinculadas ao grupo (manager_group_units). Esta guarda
  // roda APÓS as validações de tenant/role e a idempotência, e SOMENTE sobre
  // os alunos que de fato serão inseridos (`toAdd`) — não bloqueia re-adições
  // por causa de quem já é membro. Validação em camada de aplicação (decisão
  // do Hugo, 2026-06-06); não há enforcement em RLS para esta invariante.
  // -------------------------------------------------------------------------
  // 1) Unidades alcançadas pelo time. Filtradas por tenant (defesa em
  //    profundidade no branch service-client, que ignora RLS).
  const { data: groupUnits } = await db
    .from("manager_group_units")
    .select("unit_id")
    .eq("tenant_id", ctx.tenantId)
    .eq("group_id", groupId)
  const unitIdSet = new Set((groupUnits ?? []).map((r) => r.unit_id as string))

  // Caso UNIT-LESS: um grupo pode iniciar sem nenhuma unidade vinculada
  // (ver createManagerGroup — "a group can start unit-less"). Sem unidade,
  // não há contra o que validar; a adição é permitida (não é bypass — é a
  // ausência deliberada de critério). Pula a guarda e segue para o insert.
  if (unitIdSet.size > 0) {
    // 2) Unidades às quais cada aluno candidato pertence. `user_areas` NÃO tem
    //    coluna tenant_id; o recorte de tenant já veio de `toAdd` (alunos
    //    validados como do tenant acima) e das unidades do time (filtradas por
    //    ctx.tenantId no passo 1). Por isso NÃO filtramos user_areas por tenant.
    const { data: studentAreas } = await db
      .from("user_areas")
      .select("user_id, area_id")
      .in("user_id", toAdd)
    const areasByStudent = new Map<string, Set<string>>()
    for (const row of studentAreas ?? []) {
      const userId = (row as { user_id: string }).user_id
      const areaId = (row as { area_id: string }).area_id
      const set = areasByStudent.get(userId) ?? new Set<string>()
      set.add(areaId)
      areasByStudent.set(userId, set)
    }

    // 3) Ofensores: candidatos sem interseção entre suas áreas e as unidades do
    //    time. Aluno sem nenhuma área também é ofensor. Interseção NÃO VAZIA —
    //    para grupos corporate (N unidades) basta pertencer a qualquer uma.
    const offenders = toAdd.filter((studentId) => {
      const studentUnits = areasByStudent.get(studentId)
      if (!studentUnits) return true
      for (const u of studentUnits) if (unitIdSet.has(u)) return false
      return true
    })

    // 4) Qualquer ofensor → bloqueia TUDO (sem inserção parcial), nomeando o
    //    primeiro ofensor (full_name, fallback email/id) e indicando os demais.
    if (offenders.length > 0) {
      const nameById = new Map(
        validRows.map((u) => [u.id, u.full_name || u.email || u.id] as const),
      )
      const firstName = nameById.get(offenders[0]) ?? offenders[0]
      const extra = offenders.length - 1
      const suffix = extra > 0 ? ` (e mais ${extra})` : ""
      return {
        error: `Aluno ${firstName} não pertence a unidade deste time${suffix}`,
      }
    }
  }

  const { error } = await db.from("manager_group_members").insert(
    toAdd.map((student_id) => ({
      group_id: groupId,
      student_id,
      tenant_id: ctx.tenantId, // forced
      added_by: ctx.userId,
    })),
  )
  if (error) {
    console.error("[addManagerGroupMembers]", error)
    return { error: error.message }
  }

  revalidatePath(REVALIDATE_PATH)
  return { success: true, added: toAdd.length }
}

// ---------------------------------------------------------------------------
// removeManagerGroupMember — remove a single student from a group's team.
//   admin (any) or owning gestor.
// ---------------------------------------------------------------------------
export async function removeManagerGroupMember(
  groupId: string,
  studentId: string,
): Promise<{ success: true; error?: never } | { success?: never; error: string }> {
  const ctx = await getAuthContext()
  if ("error" in ctx) return { error: ctx.error }

  const db = dbFor(ctx)
  const isAdmin = ctx.role === "admin" || ctx.role === "super_admin"

  const { data: group } = await db
    .from("manager_groups")
    .select("id, tenant_id, manager_id")
    .eq("id", groupId)
    .single()
  if (!group || group.tenant_id !== ctx.tenantId) return { error: "Grupo não encontrado" }
  if (!isAdmin && group.manager_id !== ctx.userId) return { error: "Sem permissão" }

  const { error } = await db
    .from("manager_group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("student_id", studentId)
  if (error) {
    console.error("[removeManagerGroupMember]", error)
    return { error: error.message }
  }

  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

// ---------------------------------------------------------------------------
// Auxiliary data getters for the UI (option lists, all tenant-scoped).
// ---------------------------------------------------------------------------

// Gestores: tenant users with role manager/admin (eligible to own a group).
export async function listGestorOptions(): Promise<
  { data: ManagerOption[]; error?: never } | { data?: never; error: string }
> {
  const ctx = await getAuthContext()
  if ("error" in ctx) return { error: ctx.error }

  const db = dbFor(ctx)
  const { data, error } = await db
    .from("users")
    .select("id, full_name, email, role")
    .eq("tenant_id", ctx.tenantId)
    .in("role", ["manager", "admin"])
    .order("full_name", { ascending: true })

  if (error) {
    console.error("[listGestorOptions]", error)
    return { error: "Erro ao carregar gestores" }
  }
  return { data: data ?? [] }
}

// Unidades: tenant areas (the existing `areas` table) for the multi-select.
export async function listUnitOptions(): Promise<
  { data: UnitOption[]; error?: never } | { data?: never; error: string }
> {
  const ctx = await getAuthContext()
  if ("error" in ctx) return { error: ctx.error }

  const db = dbFor(ctx)
  const { data, error } = await db
    .from("areas")
    .select("id, name, slug")
    .eq("tenant_id", ctx.tenantId)
    .order("name", { ascending: true })

  if (error) {
    console.error("[listUnitOptions]", error)
    return { error: "Erro ao carregar unidades" }
  }
  return { data: data ?? [] }
}

// Alunos: tenant users holding the student HAT (eligible to be added to a team).
//
// MULTI-CHAPÉU (Crivo review, T1 rodada 1, 2026-07-18 — self-audit grep finding,
// same class as addManagerGroupMembers above): the legacy singular `users.role`
// column used to gate this picker would hide a legitimate multi-hat member (e.g.
// gestor+aluno) from the "eligible students" list, making him structurally
// impossible to add to a team through this UI. Asserts via `user_roles`
// (SERVICE client — RLS blocks a manager from reading third-party hats).
export async function listStudentOptions(): Promise<
  { data: StudentOption[]; error?: never } | { data?: never; error: string }
> {
  const ctx = await getAuthContext()
  if ("error" in ctx) return { error: ctx.error }

  const svc = createServiceClient()
  const { data: hatRows, error: hatError } = await svc
    .from("user_roles")
    .select("user_id")
    .eq("tenant_id", ctx.tenantId)
    .eq("role", "student")
  if (hatError) {
    console.error("[listStudentOptions]", hatError)
    return { error: "Erro ao carregar alunos" }
  }
  const studentHatIds = [...new Set((hatRows ?? []).map((r) => r.user_id as string))]
  if (studentHatIds.length === 0) return { data: [] }

  const db = dbFor(ctx)
  const { data, error } = await db
    .from("users")
    .select("id, full_name, email")
    .eq("tenant_id", ctx.tenantId)
    .in("id", studentHatIds)
    .order("full_name", { ascending: true })

  if (error) {
    console.error("[listStudentOptions]", error)
    return { error: "Erro ao carregar alunos" }
  }
  return { data: data ?? [] }
}
