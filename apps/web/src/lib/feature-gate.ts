import { createServiceClient } from "@/lib/supabase/service"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlanName = "essencial" | "standard" | "premium"

export interface FeatureCheckResult {
  allowed: boolean
  featureKey: string
  quota: number | null
  used: number
  currentPlan: PlanName
  requiredPlan: PlanName | null
}

interface CacheEntry {
  plan: PlanName
  features: Map<string, { isEnabled: boolean; quota: number | null }>
  expiry: number
}

// ---------------------------------------------------------------------------
// Plan display names
// ---------------------------------------------------------------------------

export const PLAN_DISPLAY_NAMES: Record<PlanName, string> = {
  essencial: "Essencial",
  standard: "Standard",
  premium: "Premium",
}

// ---------------------------------------------------------------------------
// Plan hierarchy (lowest to highest)
// ---------------------------------------------------------------------------

const PLAN_HIERARCHY: PlanName[] = ["essencial", "standard", "premium"]

// ---------------------------------------------------------------------------
// In-memory cache (TTL 5 min) — shared across requests in the same process
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 5 * 60 * 1000
const tenantCache = new Map<string, CacheEntry>()

function getCacheEntry(tenantId: string): CacheEntry | null {
  const entry = tenantCache.get(tenantId)
  if (!entry) return null
  if (Date.now() > entry.expiry) {
    tenantCache.delete(tenantId)
    return null
  }
  return entry
}

/** Manually invalidate cache for a tenant (e.g. after plan change). */
export function invalidateFeatureCache(tenantId: string): void {
  tenantCache.delete(tenantId)
}

// ---------------------------------------------------------------------------
// Feature usage counting (uses service client to bypass RLS)
// ---------------------------------------------------------------------------

const USAGE_COUNT_QUERIES: Record<string, string> = {
  courses: "courses",
  trails: "learning_trails",
  webhooks: "webhooks",
  quizzes: "quiz_sessions",
}

export async function countFeatureUsage(tenantId: string, featureKey: string): Promise<number> {
  const table = USAGE_COUNT_QUERIES[featureKey]
  if (!table) return 0

  const serviceClient = createServiceClient()
  const { count } = await serviceClient
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)

  return count ?? 0
}

// ---------------------------------------------------------------------------
// Determine required plan (lowest plan where feature is enabled)
// ---------------------------------------------------------------------------

async function getRequiredPlan(featureKey: string): Promise<PlanName | null> {
  const serviceClient = createServiceClient()
  const { data } = await serviceClient
    .from("plan_features")
    .select("plan")
    .eq("feature_key", featureKey)
    .eq("is_enabled", true)
    .order("plan")

  if (!data || data.length === 0) return null

  for (const plan of PLAN_HIERARCHY) {
    if (data.some((row) => row.plan === plan)) return plan
  }

  return null
}

// ---------------------------------------------------------------------------
// Core: checkFeature
// ---------------------------------------------------------------------------

export async function checkFeature(tenantId: string, featureKey: string): Promise<FeatureCheckResult> {
  const serviceClient = createServiceClient()

  // 1. Try cache first
  let cached = getCacheEntry(tenantId)

  if (!cached) {
    // 2. Fetch tenant plan
    const { data: tenant } = await serviceClient
      .from("tenants")
      .select("plan")
      .eq("id", tenantId)
      .single()

    const plan = (tenant?.plan as PlanName) ?? "essencial"

    // 3. Fetch all features for this plan
    const { data: features } = await serviceClient
      .from("plan_features")
      .select("feature_key, is_enabled, quota")
      .eq("plan", plan)

    const featureMap = new Map<string, { isEnabled: boolean; quota: number | null }>()
    for (const f of features ?? []) {
      featureMap.set(f.feature_key, {
        isEnabled: f.is_enabled,
        quota: f.quota,
      })
    }

    cached = { plan, features: featureMap, expiry: Date.now() + CACHE_TTL_MS }
    tenantCache.set(tenantId, cached)
  }

  // 4. Lookup this specific feature
  const featureConfig = cached.features.get(featureKey)
  const currentPlan = cached.plan

  if (!featureConfig || !featureConfig.isEnabled) {
    const requiredPlan = await getRequiredPlan(featureKey)
    return {
      allowed: false,
      featureKey,
      quota: featureConfig?.quota ?? null,
      used: 0,
      currentPlan,
      requiredPlan,
    }
  }

  // 5. If quota-based, check usage
  if (featureConfig.quota !== null) {
    const used = await countFeatureUsage(tenantId, featureKey)
    if (used >= featureConfig.quota) {
      const requiredPlan = await findUpgradePlanForQuota(featureKey, featureConfig.quota)
      return {
        allowed: false,
        featureKey,
        quota: featureConfig.quota,
        used,
        currentPlan,
        requiredPlan,
      }
    }

    return {
      allowed: true,
      featureKey,
      quota: featureConfig.quota,
      used,
      currentPlan,
      requiredPlan: null,
    }
  }

  // 6. Feature enabled, no quota
  return {
    allowed: true,
    featureKey,
    quota: null,
    used: 0,
    currentPlan,
    requiredPlan: null,
  }
}

// ---------------------------------------------------------------------------
// Find upgrade plan when quota is exceeded
// ---------------------------------------------------------------------------

async function findUpgradePlanForQuota(
  featureKey: string,
  currentQuota: number,
): Promise<PlanName | null> {
  const serviceClient = createServiceClient()
  const { data } = await serviceClient
    .from("plan_features")
    .select("plan, quota")
    .eq("feature_key", featureKey)
    .eq("is_enabled", true)

  if (!data) return null

  for (const plan of PLAN_HIERARCHY) {
    const row = data.find((r) => r.plan === plan)
    if (row && (row.quota === null || row.quota > currentQuota)) {
      return plan as PlanName
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// FeatureNotAvailableError — thrown by requireFeatureAction
// ---------------------------------------------------------------------------

export class FeatureNotAvailableError extends Error {
  public readonly feature: string
  public readonly currentPlan: PlanName
  public readonly requiredPlan: PlanName | null

  constructor(feature: string, currentPlan: PlanName, requiredPlan: PlanName | null) {
    const planLabel = requiredPlan ? PLAN_DISPLAY_NAMES[requiredPlan] : "um plano superior"
    super(`Feature "${feature}" nao disponivel no plano ${PLAN_DISPLAY_NAMES[currentPlan]}. Requer ${planLabel}.`)
    this.name = "FeatureNotAvailableError"
    this.feature = feature
    this.currentPlan = currentPlan
    this.requiredPlan = requiredPlan
  }
}

// ---------------------------------------------------------------------------
// requireFeatureAction — for server actions (throws on blocked)
// ---------------------------------------------------------------------------

export async function requireFeatureAction(tenantId: string, featureKey: string): Promise<void> {
  const result = await checkFeature(tenantId, featureKey)
  if (!result.allowed) {
    throw new FeatureNotAvailableError(featureKey, result.currentPlan, result.requiredPlan)
  }
}

// ---------------------------------------------------------------------------
// getAllFeatures — returns check result for every feature of a tenant's plan
// ---------------------------------------------------------------------------

export async function getAllFeatures(tenantId: string): Promise<(FeatureCheckResult & { featureKey: string })[]> {
  const serviceClient = createServiceClient()

  // Ensure cache is populated
  let cached = getCacheEntry(tenantId)

  if (!cached) {
    const { data: tenant } = await serviceClient
      .from("tenants")
      .select("plan")
      .eq("id", tenantId)
      .single()

    const plan = (tenant?.plan as PlanName) ?? "essencial"

    const { data: features } = await serviceClient
      .from("plan_features")
      .select("feature_key, is_enabled, quota")
      .eq("plan", plan)

    const featureMap = new Map<string, { isEnabled: boolean; quota: number | null }>()
    for (const f of features ?? []) {
      featureMap.set(f.feature_key, {
        isEnabled: f.is_enabled,
        quota: f.quota,
      })
    }

    cached = { plan, features: featureMap, expiry: Date.now() + CACHE_TTL_MS }
    tenantCache.set(tenantId, cached)
  }

  const results: (FeatureCheckResult & { featureKey: string })[] = []

  for (const [featureKey] of cached.features) {
    const result = await checkFeature(tenantId, featureKey)
    results.push({ ...result, featureKey })
  }

  return results
}

// ---------------------------------------------------------------------------
// Server-side helper for SSR pages (used by FeatureGate component)
// ---------------------------------------------------------------------------

export async function getFeatureAccess(
  tenantId: string,
  featureKey: string,
): Promise<FeatureCheckResult> {
  return checkFeature(tenantId, featureKey)
}
