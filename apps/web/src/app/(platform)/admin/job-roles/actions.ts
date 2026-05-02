"use server"

import { createClient } from "@/lib/supabase/server"
import { createJobRoleSchema, updateJobRoleSchema } from "@eximia/shared"
import { revalidatePath } from "next/cache"

async function requireContentRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<{ role: string; tenantId: string; error?: never } | { error: string }> {
  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", userId)
    .single()

  if (!profile) return { error: "Perfil não encontrado" }
  if (!["manager", "admin", "instructor"].includes(profile.role)) {
    return { error: "Permissão negada" }
  }
  return { role: profile.role, tenantId: profile.tenant_id }
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export async function listJobRoles() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado", data: [] }

  const { data, error } = await supabase
    .from("job_roles")
    .select("id, name, slug, description, seniority_level, area_id, created_at")
    .order("name", { ascending: true })

  if (error) return { error: "Erro ao carregar cargos", data: [] }
  return { data: data ?? [] }
}

export async function listJobRolesWithStats() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado", data: [] }

  const { data: roles, error } = await supabase
    .from("job_roles")
    .select("id, name, slug, description, seniority_level, area_id, created_at")
    .order("name", { ascending: true })

  if (error || !roles) return { error: "Erro ao carregar cargos", data: [] }

  // Count active trails per role
  const roleIds = roles.map((r) => r.id)
  const { data: trailCounts } = await supabase
    .from("learning_trails")
    .select("target_job_role_id")
    .in("target_job_role_id", roleIds)
    .eq("status", "active")

  const countMap = new Map<string, number>()
  for (const t of trailCounts ?? []) {
    if (t.target_job_role_id) {
      countMap.set(t.target_job_role_id, (countMap.get(t.target_job_role_id) ?? 0) + 1)
    }
  }

  // Get areas for display
  const areaIds = [...new Set(roles.filter((r) => r.area_id).map((r) => r.area_id!))]
  const { data: areas } = areaIds.length
    ? await supabase.from("areas").select("id, name").in("id", areaIds)
    : { data: [] }

  const areaMap = new Map((areas ?? []).map((a) => [a.id, a.name]))

  const enriched = roles.map((role) => ({
    ...role,
    area_name: role.area_id ? areaMap.get(role.area_id) ?? null : null,
    active_trails_count: countMap.get(role.id) ?? 0,
  }))

  return { data: enriched }
}

export async function createJobRole(raw: unknown) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const roleCheck = await requireContentRole(supabase, user.id)
  if ("error" in roleCheck) return { error: roleCheck.error }

  const result = createJobRoleSchema.safeParse(raw)
  if (!result.success) return { error: result.error.errors[0].message }

  const slug = toSlug(result.data.name)

  const { data, error } = await supabase
    .from("job_roles")
    .insert({
      tenant_id: roleCheck.tenantId,
      name: result.data.name,
      slug,
      description: result.data.description ?? null,
      area_id: result.data.area_id ?? null,
      seniority_level: result.data.seniority_level,
      created_by: user.id,
    })
    .select("id")
    .single()

  if (error) return { error: "Erro ao criar cargo" }

  revalidatePath("/admin/job-roles")
  return { data }
}

export async function updateJobRole(id: string, raw: unknown) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const roleCheck = await requireContentRole(supabase, user.id)
  if ("error" in roleCheck) return { error: roleCheck.error }

  const result = updateJobRoleSchema.safeParse(raw)
  if (!result.success) return { error: result.error.errors[0].message }

  const updateData: Record<string, unknown> = { ...result.data, updated_at: new Date().toISOString() }
  if (result.data.name) {
    updateData.slug = toSlug(result.data.name)
  }

  const { error } = await supabase.from("job_roles").update(updateData).eq("id", id)

  if (error) return { error: "Erro ao atualizar cargo" }

  revalidatePath("/admin/job-roles")
  return { success: true }
}

export async function deleteJobRole(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const roleCheck = await requireContentRole(supabase, user.id)
  if ("error" in roleCheck) return { error: roleCheck.error }

  // Check for active trails
  const { count } = await supabase
    .from("learning_trails")
    .select("id", { count: "exact", head: true })
    .eq("target_job_role_id", id)
    .eq("status", "active")

  if (count && count > 0) {
    return { error: `Nao e possivel excluir: ${count} trilha(s) ativa(s) vinculada(s)` }
  }

  const { error } = await supabase.from("job_roles").delete().eq("id", id)

  if (error) return { error: "Erro ao excluir cargo" }

  revalidatePath("/admin/job-roles")
  return { success: true }
}

export async function listAreas() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: [] }

  const { data } = await supabase
    .from("areas")
    .select("id, name")
    .order("name", { ascending: true })

  return { data: data ?? [] }
}
