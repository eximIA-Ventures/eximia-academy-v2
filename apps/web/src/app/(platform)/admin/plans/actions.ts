"use server"

import { countFeatureUsage, invalidateFeatureCache } from "@/lib/feature-gate"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { updatePlanFeatureSchema } from "@eximia/shared"
import { revalidatePath } from "next/cache"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlanFeatureRow {
  id: string
  plan: string
  feature_key: string
  is_enabled: boolean
  quota: number | null
  created_at: string
  updated_at: string
}

export interface PlanFeaturesGrouped {
  essencial: PlanFeatureRow[]
  standard: PlanFeatureRow[]
  premium: PlanFeatureRow[]
}

export interface FeatureAdoption {
  feature_key: string
  total_tenants: number
  tenants_using: number
  adoption_rate: number
}

export interface TenantQuotaUsage {
  tenant_id: string
  tenant_name: string
  plan: string
  feature_key: string
  quota: number
  used: number
  utilization_pct: number
}

export interface TenantFeatureUsage {
  tenant_id: string
  tenant_name: string
  plan: string
  courses_count: number
  quizzes_count: number
  trails_count: number
  webhooks_count: number
}

export interface FeatureUsageStats {
  adoption: FeatureAdoption[]
  quotaAlerts: TenantQuotaUsage[]
  tenantUsage: TenantFeatureUsage[]
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function requireAdmin(): Promise<
  | { error: string; role?: never; tenantId?: never; user?: never }
  | {
      error?: never
      role: "admin" | "super_admin"
      tenantId: string
      user: { id: string }
    }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado" }

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile?.role || !["admin", "super_admin"].includes(profile.role)) {
    return { error: "Acesso negado" }
  }

  return { role: profile.role as "admin" | "super_admin", tenantId: profile.tenant_id, user }
}

// ---------------------------------------------------------------------------
// listPlanFeatures — returns all 21 rows grouped by plan (super_admin only)
// ---------------------------------------------------------------------------

export async function listPlanFeatures(): Promise<
  { data: PlanFeaturesGrouped; error?: never } | { data?: never; error: string }
> {
  const auth = await requireAdmin()
  if (auth.error) return { error: auth.error }

  if (auth.role !== "super_admin") {
    return { error: "Apenas super_admin pode listar todas as features" }
  }

  const service = createServiceClient()

  const { data, error } = await service
    .from("plan_features")
    .select("id, plan, feature_key, is_enabled, quota, created_at, updated_at")
    .order("feature_key", { ascending: true })

  if (error) {
    console.error("[listPlanFeatures]", error)
    return { error: "Erro ao carregar configurações de plano" }
  }

  const grouped: PlanFeaturesGrouped = {
    essencial: [],
    standard: [],
    premium: [],
  }

  for (const row of data ?? []) {
    const plan = row.plan as keyof PlanFeaturesGrouped
    if (grouped[plan]) {
      grouped[plan].push(row)
    }
  }

  return { data: grouped }
}

// ---------------------------------------------------------------------------
// updatePlanFeature — super_admin only
// ---------------------------------------------------------------------------

export async function updatePlanFeature(
  plan: string,
  featureKey: string,
  isEnabled: boolean,
  quota: number | null,
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin()
  if ("error" in auth) return { success: false, error: auth.error }

  if (auth.role !== "super_admin") {
    return { success: false, error: "Apenas super_admin pode editar features" }
  }

  const parsed = updatePlanFeatureSchema.safeParse({
    plan,
    feature_key: featureKey,
    is_enabled: isEnabled,
    quota: quota,
  })

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  const service = createServiceClient()

  const { error } = await service
    .from("plan_features")
    .update({
      is_enabled: parsed.data.is_enabled,
      quota: parsed.data.quota ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("plan", parsed.data.plan)
    .eq("feature_key", parsed.data.feature_key)

  if (error) {
    console.error("[updatePlanFeature]", error)
    return { success: false, error: "Erro ao atualizar configuração de plano" }
  }

  // Invalidate cache for all tenants on this plan
  const { data: affectedTenants } = await service
    .from("tenants")
    .select("id")
    .eq("plan", parsed.data.plan)

  for (const tenant of affectedTenants ?? []) {
    invalidateFeatureCache(tenant.id)
  }

  revalidatePath("/admin/plans")
  return { success: true }
}

// ---------------------------------------------------------------------------
// getMyPlanFeatures — returns features for current tenant's plan (admin)
// ---------------------------------------------------------------------------

export async function getMyPlanFeatures(): Promise<
  | {
      data: { plan: string; features: PlanFeatureRow[]; usage: Record<string, number> }
      error?: never
    }
  | { data?: never; error: string }
> {
  const auth = await requireAdmin()
  if (auth.error) return { error: auth.error }

  // Resolve tenant_id: super_admin uses active tenant cookie
  const tenantId =
    auth.role === "super_admin" ? null : auth.tenantId

  if (!tenantId) return { error: "Nenhum tenant ativo selecionado" }

  const service = createServiceClient()

  // Get tenant's plan
  const { data: tenant, error: tenantError } = await service
    .from("tenants")
    .select("plan")
    .eq("id", tenantId)
    .single()

  if (tenantError || !tenant) {
    return { error: "Falha ao carregar dados do tenant" }
  }

  const plan = tenant.plan as string

  // Get plan features for this plan
  const { data: features, error: featuresError } = await service
    .from("plan_features")
    .select("id, plan, feature_key, is_enabled, quota, created_at, updated_at")
    .eq("plan", plan)
    .order("feature_key", { ascending: true })

  if (featuresError) {
    console.error("[getMyPlanFeatures]", featuresError)
    return { error: "Erro ao carregar features do plano" }
  }

  // Count actual usage for quota-limited features
  const quotaFeatureKeys = ["courses", "quizzes", "trails", "webhooks"] as const
  const usage: Record<string, number> = {}

  for (const key of quotaFeatureKeys) {
    try {
      usage[key] = await countFeatureUsage(tenantId, key)
    } catch {
      usage[key] = 0
    }
  }

  return { data: { plan, features: features ?? [], usage } }
}

// ---------------------------------------------------------------------------
// getFeatureUsageStats — Story 28.5: analytics for super_admin
// ---------------------------------------------------------------------------

export async function getFeatureUsageStats(filters?: {
  plan?: string
  feature?: string
}): Promise<{ data: FeatureUsageStats; error?: never } | { data?: never; error: string }> {
  const auth = await requireAdmin()
  if (auth.error) return { error: auth.error }

  if (auth.role !== "super_admin") {
    return { error: "Apenas super_admin pode ver analytics" }
  }

  const service = createServiceClient()

  // 1. Get all tenants
  let tenantsQuery = service.from("tenants").select("id, name, plan")
  if (filters?.plan) {
    tenantsQuery = tenantsQuery.eq("plan", filters.plan)
  }
  const { data: tenants, error: tenantsError } = await tenantsQuery

  if (tenantsError) {
    console.error("[getFeatureUsageStats]", tenantsError)
    return { error: "Erro ao carregar dados de analytics" }
  }

  const allTenants = tenants ?? []
  const totalTenants = allTenants.length

  // 2. Feature adoption rate
  const featureKeys = [
    "courses",
    "course_designer",
    "quizzes",
    "trails",
    "assessments",
    "webhooks",
    "api_access",
  ]
  const featureKeysToCheck = filters?.feature ? [filters.feature] : featureKeys

  const tableMap: Record<string, string> = {
    courses: "courses",
    quizzes: "quiz_sessions",
    trails: "learning_trails",
    webhooks: "webhooks",
  }

  const adoption: FeatureAdoption[] = []

  for (const fk of featureKeysToCheck) {
    const tableName = tableMap[fk]
    if (!tableName) {
      // Features without direct table mapping (course_designer, assessments, api_access)
      adoption.push({
        feature_key: fk,
        total_tenants: totalTenants,
        tenants_using: 0,
        adoption_rate: 0,
      })
      continue
    }

    // Count distinct tenants with at least 1 record
    const tenantIds = allTenants.map((t) => t.id)
    let tenantsUsing = 0

    if (tenantIds.length > 0) {
      const { data: usageRows } = await service
        .from(tableName)
        .select("tenant_id")
        .in("tenant_id", tenantIds)

      const uniqueTenants = new Set((usageRows ?? []).map((r) => r.tenant_id))
      tenantsUsing = uniqueTenants.size
    }

    adoption.push({
      feature_key: fk,
      total_tenants: totalTenants,
      tenants_using: tenantsUsing,
      adoption_rate: totalTenants > 0 ? Math.round((tenantsUsing / totalTenants) * 100) : 0,
    })
  }

  // 3. Quota utilization — tenants with >80% usage
  const quotaAlerts: TenantQuotaUsage[] = []

  // Get all plan features with quotas
  const { data: quotaFeatures } = await service
    .from("plan_features")
    .select("plan, feature_key, quota")
    .not("quota", "is", null)

  for (const pf of quotaFeatures ?? []) {
    if (!pf.quota) continue
    if (filters?.feature && pf.feature_key !== filters.feature) continue

    const featureTenants = allTenants.filter((t) => t.plan === pf.plan)
    const tableName = tableMap[pf.feature_key]
    if (!tableName) continue

    for (const tenant of featureTenants) {
      const { count } = await service
        .from(tableName)
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)

      const used = count ?? 0
      const utilization = Math.round((used / pf.quota) * 100)

      if (utilization >= 80) {
        quotaAlerts.push({
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          plan: pf.plan,
          feature_key: pf.feature_key,
          quota: pf.quota,
          used,
          utilization_pct: utilization,
        })
      }
    }
  }

  // Sort by utilization descending
  quotaAlerts.sort((a, b) => b.utilization_pct - a.utilization_pct)

  // 4. Tenant usage summary table
  const tenantUsage: TenantFeatureUsage[] = []

  for (const tenant of allTenants) {
    const counts: Record<string, number> = {}

    for (const [key, table] of Object.entries(tableMap)) {
      const { count } = await service
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
      counts[key] = count ?? 0
    }

    tenantUsage.push({
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      plan: tenant.plan,
      courses_count: counts.courses ?? 0,
      quizzes_count: counts.quizzes ?? 0,
      trails_count: counts.trails ?? 0,
      webhooks_count: counts.webhooks ?? 0,
    })
  }

  return { data: { adoption, quotaAlerts, tenantUsage } }
}
