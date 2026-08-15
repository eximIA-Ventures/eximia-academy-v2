import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

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
// FeatureCheckUnavailableError — a leitura falhou, o plano é DESCONHECIDO
// ---------------------------------------------------------------------------

/**
 * Levantado quando não foi possível DESCOBRIR o plano — não quando o plano não
 * cobre a feature. São coisas diferentes e não podem terminar no mesmo desfecho:
 * "não sei" e "você não tem direito" são respostas distintas, e um gate que as
 * confunde ensina o cliente a desconfiar da mensagem certa quando ela finalmente
 * for verdadeira.
 *
 * Distinta de `FeatureNotAvailableError`, que é a recusa legítima por plano.
 */
export class FeatureCheckUnavailableError extends Error {
  public readonly feature: string
  public readonly cause: unknown

  constructor(feature: string, cause: unknown) {
    super(`Nao foi possivel verificar a feature "${feature}": leitura de plano indisponivel.`)
    this.name = "FeatureCheckUnavailableError"
    this.feature = feature
    this.cause = cause
  }
}

// ---------------------------------------------------------------------------
// Carga do plano do tenant (fonte única, usada por checkFeature e getAllFeatures)
// ---------------------------------------------------------------------------

/**
 * Popula a entrada de cache de um tenant, distinguindo os dois `null` possíveis:
 *
 * - **linha ausente** (`data: null`, `error: null`) → `essencial`. É ausência de
 *   direito, e o plano mais restritivo é a resposta certa.
 * - **erro de leitura** (`error != null`) → levanta. É ausência de RESPOSTA. Cair
 *   em `essencial` aqui produziria um 403 dizendo "seu plano não permite" para um
 *   cliente que paga por plano que permite.
 *
 * `maybeSingle` em vez de `single` é o que torna a distinção estrutural: `single`
 * devolve ERRO (`PGRST116`) quando não há linha, o que obrigaria a farejar código
 * de erro para separar os dois casos. Com `maybeSingle`, ausência é `data: null`
 * sem erro, e todo `error` que sobra é falha de verdade.
 *
 * A gravação no cache é a ÚLTIMA instrução de propósito: qualquer falha acima sai
 * por exceção antes de escrever. Um mapa de features vazio gravado por causa de um
 * soluço ficaria 5 minutos no cache, e o defeito transitório viraria incidente.
 */
async function loadTenantFeatures(tenantId: string, featureKey: string): Promise<CacheEntry> {
  const serviceClient = createServiceClient()

  const { data: tenant, error: tenantError } = await serviceClient
    .from("tenants")
    .select("plan")
    .eq("id", tenantId)
    .maybeSingle()

  if (tenantError) throw new FeatureCheckUnavailableError(featureKey, tenantError)

  const plan = (tenant?.plan as PlanName) ?? "essencial"

  const { data: features, error: featuresError } = await serviceClient
    .from("plan_features")
    .select("feature_key, is_enabled, quota")
    .eq("plan", plan)

  if (featuresError) throw new FeatureCheckUnavailableError(featureKey, featuresError)

  const featureMap = new Map<string, { isEnabled: boolean; quota: number | null }>()
  for (const f of features ?? []) {
    featureMap.set(f.feature_key, {
      isEnabled: f.is_enabled,
      quota: f.quota,
    })
  }

  const entry: CacheEntry = { plan, features: featureMap, expiry: Date.now() + CACHE_TTL_MS }
  tenantCache.set(tenantId, entry)
  return entry
}

// ---------------------------------------------------------------------------
// Core: checkFeature
// ---------------------------------------------------------------------------

export async function checkFeature(tenantId: string, featureKey: string): Promise<FeatureCheckResult> {
  // 1. Try cache first
  const cached = getCacheEntry(tenantId) ?? (await loadTenantFeatures(tenantId, featureKey))

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
// requireFeature — for API routes (returns a 403 response on blocked)
// ---------------------------------------------------------------------------

/** Corpo do 403, exatamente como a AC5 da story 28.2 declara. */
export interface FeatureNotAvailableBody {
  error: "feature_not_available"
  feature: string
  current_plan: PlanName
  required_plan: PlanName | null
}

/** Corpo do 503. Deliberadamente SEM `current_plan`: o plano é o que se ignora. */
export interface FeatureCheckUnavailableBody {
  error: "feature_check_unavailable"
  feature: string
}

/**
 * Guard de rota. Devolve a resposta 403 pronta quando o plano do tenant não
 * cobre a feature (desligada OU com quota estourada), e `null` quando pode
 * seguir — o chamador faz `if (blocked) return blocked`.
 *
 * Irmã de `requireFeatureAction`: mesma decisão (`checkFeature`, uma única
 * fonte), formas de recusa diferentes porque os consumidores são diferentes.
 * Server action propaga exceção; rota HTTP precisa de status e corpo.
 *
 * Recebe o `tenantId` já resolvido, e não o `NextRequest`: as rotas deste repo
 * resolvem sessão e `profile.tenant_id` antes de qualquer guard (ver
 * `api/course-designer/generate/route.ts`), então pedir o request obrigaria a
 * uma segunda resolução de auth para chegar ao mesmo id.
 *
 * Dois desfechos de recusa, nunca confundidos: **403** quando o plano é conhecido
 * e não cobre a feature, **503** quando o plano não pôde ser lido. O 503 é
 * retentável e o 403 não; entregar um pelo outro faz o cliente tratar uma falha
 * de infraestrutura como decisão comercial (ou o contrário).
 */
export async function requireFeature(
  tenantId: string,
  featureKey: string,
): Promise<NextResponse | null> {
  let result: FeatureCheckResult
  try {
    result = await checkFeature(tenantId, featureKey)
  } catch (err) {
    if (!(err instanceof FeatureCheckUnavailableError)) throw err

    console.error(`[feature-gate] leitura de plano indisponivel para "${featureKey}":`, err.cause)

    const body: FeatureCheckUnavailableBody = {
      error: "feature_check_unavailable",
      feature: featureKey,
    }
    // `Retry-After` porque isto é transitório por definição — o 403 irmão não tem
    // header nenhum, e essa assimetria é o sinal de que os casos são diferentes.
    return NextResponse.json(body, { status: 503, headers: { "Retry-After": "5" } })
  }

  if (result.allowed) return null

  const body: FeatureNotAvailableBody = {
    error: "feature_not_available",
    feature: featureKey,
    current_plan: result.currentPlan,
    required_plan: result.requiredPlan,
  }

  return NextResponse.json(body, { status: 403 })
}

// ---------------------------------------------------------------------------
// getAllFeatures — returns check result for every feature of a tenant's plan
// ---------------------------------------------------------------------------

export async function getAllFeatures(tenantId: string): Promise<(FeatureCheckResult & { featureKey: string })[]> {
  // Mesma carga de `checkFeature`, e não uma segunda cópia dela: a duplicata que
  // existia aqui carregava o MESMO defeito de tratar erro de leitura como plano
  // `essencial`, e ia divergir na primeira correção aplicada só de um lado.
  const cached = getCacheEntry(tenantId) ?? (await loadTenantFeatures(tenantId, "*"))

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
