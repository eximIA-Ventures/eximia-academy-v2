import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// Mock data: Essencial plan features (7 features)
// ---------------------------------------------------------------------------
const ESSENCIAL_FEATURES = [
  { plan: "essencial", feature_key: "courses", is_enabled: true, quota: 5 },
  { plan: "essencial", feature_key: "course_designer", is_enabled: false, quota: null },
  { plan: "essencial", feature_key: "quizzes", is_enabled: true, quota: 10 },
  { plan: "essencial", feature_key: "trails", is_enabled: false, quota: null },
  { plan: "essencial", feature_key: "assessments", is_enabled: false, quota: null },
  { plan: "essencial", feature_key: "webhooks", is_enabled: false, quota: null },
  { plan: "essencial", feature_key: "api_access", is_enabled: false, quota: null },
]

const STANDARD_FEATURES = [
  { plan: "standard", feature_key: "courses", is_enabled: true, quota: 50 },
  { plan: "standard", feature_key: "course_designer", is_enabled: true, quota: null },
  { plan: "standard", feature_key: "quizzes", is_enabled: true, quota: null },
  { plan: "standard", feature_key: "trails", is_enabled: true, quota: 10 },
  { plan: "standard", feature_key: "assessments", is_enabled: true, quota: null },
  { plan: "standard", feature_key: "webhooks", is_enabled: true, quota: 5 },
  { plan: "standard", feature_key: "api_access", is_enabled: true, quota: null },
]

const PREMIUM_FEATURES = [
  { plan: "premium", feature_key: "courses", is_enabled: true, quota: null },
  { plan: "premium", feature_key: "course_designer", is_enabled: true, quota: null },
  { plan: "premium", feature_key: "quizzes", is_enabled: true, quota: null },
  { plan: "premium", feature_key: "trails", is_enabled: true, quota: null },
  { plan: "premium", feature_key: "assessments", is_enabled: true, quota: null },
  { plan: "premium", feature_key: "webhooks", is_enabled: true, quota: null },
  { plan: "premium", feature_key: "api_access", is_enabled: true, quota: null },
]

const ALL_FEATURES = [...ESSENCIAL_FEATURES, ...STANDARD_FEATURES, ...PREMIUM_FEATURES]

// ---------------------------------------------------------------------------
// Mock tenant data
// ---------------------------------------------------------------------------
const TENANT_ESSENCIAL = { id: "tenant-ess-001", plan: "essencial" }
const TENANT_STANDARD = { id: "tenant-std-001", plan: "standard" }
const TENANT_PREMIUM = { id: "tenant-prm-001", plan: "premium" }

// ---------------------------------------------------------------------------
// Build mock Supabase client with chained query API
// ---------------------------------------------------------------------------
function createMockQueryBuilder(resolvedData: unknown, resolvedError: unknown = null) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {}

  // Terminal methods that return the final result
  const terminal = () => Promise.resolve({ data: resolvedData, error: resolvedError, count: Array.isArray(resolvedData) ? resolvedData.length : null })
  builder.single = vi.fn(terminal)
  builder.maybeSingle = vi.fn(terminal)

  // Make builder thenable so `await builder` works (Supabase returns PromiseLike)
  builder.then = vi.fn((resolve: (val: unknown) => unknown, reject?: (err: unknown) => unknown) =>
    terminal().then(resolve, reject),
  )

  // Chainable methods that return the builder itself
  for (const method of ["select", "eq", "in", "gte", "lte", "order", "limit"]) {
    builder[method] = vi.fn(() => builder)
  }

  return builder
}

// Track how many times the DB is queried (for cache tests)
let dbQueryCount = 0

function buildMockSupabase() {
  dbQueryCount = 0

  const fromHandler = vi.fn((table: string) => {
    dbQueryCount++

    if (table === "tenants") {
      const qb = createMockQueryBuilder(TENANT_ESSENCIAL)
      // Override for specific tenant IDs via .eq("id", tenantId)
      qb.eq = vi.fn((_col: string, value: string) => {
        if (value === TENANT_ESSENCIAL.id) {
          return createMockQueryBuilder(TENANT_ESSENCIAL)
        }
        if (value === TENANT_STANDARD.id) {
          return createMockQueryBuilder(TENANT_STANDARD)
        }
        if (value === TENANT_PREMIUM.id) {
          return createMockQueryBuilder(TENANT_PREMIUM)
        }
        // Unknown tenant -> null (no plan)
        return createMockQueryBuilder(null)
      })
      qb.select = vi.fn(() => qb)
      return qb
    }

    if (table === "plan_features") {
      // Return all features; the SUT will filter by plan + feature_key via .eq()
      const qb = createMockQueryBuilder(ALL_FEATURES)
      let filteredPlan: string | null = null
      let filteredKey: string | null = null

      const resolveFiltered = () => {
        let results = ALL_FEATURES
        if (filteredPlan) results = results.filter((f) => f.plan === filteredPlan)
        if (filteredKey) results = results.filter((f) => f.feature_key === filteredKey)
        return results
      }

      const updateThenable = () => {
        qb.then = vi.fn((resolve: (val: unknown) => unknown, reject?: (err: unknown) => unknown) => {
          const filtered = resolveFiltered()
          return Promise.resolve({ data: filtered, error: null, count: filtered.length }).then(resolve, reject)
        })
        qb.single = vi.fn(() => {
          const filtered = resolveFiltered()
          if (filtered.length === 1) {
            return Promise.resolve({ data: filtered[0], error: null })
          }
          return Promise.resolve({ data: null, error: { code: "PGRST116", message: "Not found" } })
        })
        qb.maybeSingle = qb.single
      }

      qb.eq = vi.fn((_col: string, value: string) => {
        if (_col === "plan") filteredPlan = value
        if (_col === "feature_key") filteredKey = value
        if (_col === "is_enabled") { /* no-op filter for simplicity */ }
        updateThenable()
        return qb
      })
      qb.order = vi.fn(() => {
        updateThenable()
        return qb
      })
      qb.select = vi.fn(() => {
        // Reset filters for fresh chain
        filteredPlan = null
        filteredKey = null
        updateThenable()
        return qb
      })
      return qb
    }

    // Count queries for quota (courses, webhooks, learning_trails, quiz_sessions)
    if (["courses", "webhooks", "learning_trails", "quiz_sessions"].includes(table)) {
      const countQb = createMockQueryBuilder(null)
      // Override then to return { count: 3 } (the shape from select with count: "exact", head: true)
      const countTerminal = () => Promise.resolve({ data: null, error: null, count: 3 })
      countQb.then = vi.fn((resolve: (val: unknown) => unknown, reject?: (err: unknown) => unknown) =>
        countTerminal().then(resolve, reject),
      )
      countQb.select = vi.fn(() => {
        countQb.then = vi.fn((resolve: (val: unknown) => unknown, reject?: (err: unknown) => unknown) =>
          countTerminal().then(resolve, reject),
        )
        return countQb
      })
      countQb.eq = vi.fn(() => {
        countQb.then = vi.fn((resolve: (val: unknown) => unknown, reject?: (err: unknown) => unknown) =>
          countTerminal().then(resolve, reject),
        )
        return countQb
      })
      return countQb
    }

    return createMockQueryBuilder([])
  })

  return {
    from: fromHandler,
  }
}

let mockSupabase = buildMockSupabase()

// ---------------------------------------------------------------------------
// Mock the Supabase server client
// ---------------------------------------------------------------------------
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

// Also mock the service client (used for quota counting with bypassed RLS)
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => mockSupabase),
}))

// ---------------------------------------------------------------------------
// Import SUT (System Under Test)
// ---------------------------------------------------------------------------
import {
  checkFeature,
  countFeatureUsage,
  requireFeatureAction,
  invalidateFeatureCache,
  getAllFeatures,
  FeatureNotAvailableError,
} from "@/lib/feature-gate"

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------

describe("feature-gate", () => {
  beforeEach(() => {
    mockSupabase = buildMockSupabase()
    dbQueryCount = 0
    invalidateFeatureCache(TENANT_ESSENCIAL.id)
    invalidateFeatureCache(TENANT_STANDARD.id)
    invalidateFeatureCache(TENANT_PREMIUM.id)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // =========================================================================
  // 1. checkFeature tests
  // =========================================================================
  describe("checkFeature", () => {
    it("returns allowed when feature is enabled with no quota", async () => {
      const result = await checkFeature(TENANT_STANDARD.id, "course_designer")

      expect(result.allowed).toBe(true)
      expect(result.featureKey).toBe("course_designer")
      expect(result.currentPlan).toBe("standard")
      expect(result.quota).toBeNull()
    })

    it("returns not allowed when feature is disabled", async () => {
      const result = await checkFeature(TENANT_ESSENCIAL.id, "course_designer")

      expect(result.allowed).toBe(false)
      expect(result.featureKey).toBe("course_designer")
      expect(result.currentPlan).toBe("essencial")
      expect(result.requiredPlan).toBeDefined()
    })

    it("returns allowed when feature has quota and usage is below limit", async () => {
      // courses on essencial: enabled, quota 5, mock usage count = 3
      const result = await checkFeature(TENANT_ESSENCIAL.id, "courses")

      expect(result.allowed).toBe(true)
      expect(result.quota).toBe(5)
      expect(result.used).toBe(3)
      expect(result.currentPlan).toBe("essencial")
    })

    it("returns not allowed when quota is exceeded", async () => {
      // Override the count query to return 5 (at quota limit for essencial courses)
      const originalFrom = mockSupabase.from
      mockSupabase.from = vi.fn((table: string) => {
        if (table === "courses") {
          const countQb = createMockQueryBuilder(null)
          const countTerminal = () => Promise.resolve({ data: null, error: null, count: 5 })
          countQb.then = vi.fn((resolve: (val: unknown) => unknown, reject?: (err: unknown) => unknown) =>
            countTerminal().then(resolve, reject),
          )
          countQb.select = vi.fn(() => {
            countQb.then = vi.fn((resolve: (val: unknown) => unknown, reject?: (err: unknown) => unknown) =>
              countTerminal().then(resolve, reject),
            )
            return countQb
          })
          countQb.eq = vi.fn(() => {
            countQb.then = vi.fn((resolve: (val: unknown) => unknown, reject?: (err: unknown) => unknown) =>
              countTerminal().then(resolve, reject),
            )
            return countQb
          })
          return countQb
        }
        return originalFrom(table)
      })

      const result = await checkFeature(TENANT_ESSENCIAL.id, "courses")

      expect(result.allowed).toBe(false)
      expect(result.quota).toBe(5)
      expect(result.used).toBe(5)
      expect(result.currentPlan).toBe("essencial")
    })

    it("returns not allowed for nonexistent feature key (safe default)", async () => {
      const result = await checkFeature(TENANT_ESSENCIAL.id, "nonexistent_feature")

      expect(result.allowed).toBe(false)
      expect(result.featureKey).toBe("nonexistent_feature")
    })

    it("defaults unknown tenant to essencial plan (most restrictive)", async () => {
      // Unknown tenant defaults to essencial plan where course_designer is disabled
      const result = await checkFeature("unknown-tenant-id", "course_designer")

      expect(result.allowed).toBe(false)
      expect(result.currentPlan).toBe("essencial")
    })
  })

  // =========================================================================
  // 2. countFeatureUsage tests
  // =========================================================================
  describe("countFeatureUsage", () => {
    it("returns numeric count for a known feature key", async () => {
      const count = await countFeatureUsage(TENANT_ESSENCIAL.id, "courses")

      expect(typeof count).toBe("number")
      expect(count).toBeGreaterThanOrEqual(0)
    })
  })

  // =========================================================================
  // 3. requireFeatureAction tests
  // =========================================================================
  describe("requireFeatureAction", () => {
    it("throws FeatureNotAvailableError when feature is blocked", async () => {
      await expect(
        requireFeatureAction(TENANT_ESSENCIAL.id, "course_designer"),
      ).rejects.toThrow(FeatureNotAvailableError)

      try {
        await requireFeatureAction(TENANT_ESSENCIAL.id, "course_designer")
      } catch (err) {
        expect(err).toBeInstanceOf(FeatureNotAvailableError)
        const featureErr = err as InstanceType<typeof FeatureNotAvailableError>
        expect(featureErr.feature).toBe("course_designer")
        expect(featureErr.currentPlan).toBe("essencial")
        expect(featureErr.requiredPlan).toBeDefined()
        expect(typeof featureErr.requiredPlan).toBe("string")
      }
    })

    it("resolves without error when feature is allowed", async () => {
      await expect(
        requireFeatureAction(TENANT_STANDARD.id, "course_designer"),
      ).resolves.toBeUndefined()
    })
  })

  // =========================================================================
  // 4. Cache tests
  // =========================================================================
  describe("cache behavior", () => {
    it("does not re-query DB on second call for same tenant (cache hit)", async () => {
      // Clear cache to start fresh
      invalidateFeatureCache(TENANT_ESSENCIAL.id)
      dbQueryCount = 0

      await checkFeature(TENANT_ESSENCIAL.id, "courses")
      const queriesAfterFirst = dbQueryCount

      await checkFeature(TENANT_ESSENCIAL.id, "courses")
      const queriesAfterSecond = dbQueryCount

      // Second call should NOT have increased query count (or increased minimally
      // only for the count query but NOT the tenant/plan_features lookups)
      expect(queriesAfterSecond).toBeLessThanOrEqual(queriesAfterFirst + 1)
    })

    it("re-queries DB after invalidateFeatureCache is called", async () => {
      // Prime the cache
      await checkFeature(TENANT_ESSENCIAL.id, "courses")
      const queriesAfterFirst = dbQueryCount

      // Invalidate
      invalidateFeatureCache(TENANT_ESSENCIAL.id)
      dbQueryCount = 0

      // Next call should query DB again
      await checkFeature(TENANT_ESSENCIAL.id, "courses")

      expect(dbQueryCount).toBeGreaterThan(0)
    })
  })

  // =========================================================================
  // 5. getAllFeatures tests
  // =========================================================================
  describe("getAllFeatures", () => {
    it("returns an array of feature results for the tenant plan", async () => {
      const features = await getAllFeatures(TENANT_ESSENCIAL.id)

      expect(Array.isArray(features)).toBe(true)
      expect(features.length).toBeGreaterThan(0)

      // Each result should have the expected shape
      for (const feature of features) {
        expect(feature).toHaveProperty("allowed")
        expect(feature).toHaveProperty("featureKey")
        expect(feature).toHaveProperty("currentPlan")
        expect(typeof feature.allowed).toBe("boolean")
        expect(typeof feature.featureKey).toBe("string")
      }
    })

    it("includes correct allowed/blocked status per feature for essencial plan", async () => {
      const features = await getAllFeatures(TENANT_ESSENCIAL.id)

      const courseDesigner = features.find((f) => f.featureKey === "course_designer")
      expect(courseDesigner).toBeDefined()
      expect(courseDesigner?.allowed).toBe(false)

      const courses = features.find((f) => f.featureKey === "courses")
      expect(courses).toBeDefined()
      expect(courses?.allowed).toBe(true)
    })

    it("returns all features allowed for premium plan", async () => {
      const features = await getAllFeatures(TENANT_PREMIUM.id)

      for (const feature of features) {
        expect(feature.allowed).toBe(true)
        expect(feature.currentPlan).toBe("premium")
      }
    })
  })

  // =========================================================================
  // 6. FeatureNotAvailableError class tests
  // =========================================================================
  describe("FeatureNotAvailableError", () => {
    it("is an instance of Error", () => {
      const err = new FeatureNotAvailableError("webhooks", "essencial", "standard")

      expect(err).toBeInstanceOf(Error)
      expect(err).toBeInstanceOf(FeatureNotAvailableError)
      expect(err.name).toBe("FeatureNotAvailableError")
    })

    it("exposes feature, currentPlan, and requiredPlan properties", () => {
      const err = new FeatureNotAvailableError("api_access", "essencial", "standard")

      expect(err.feature).toBe("api_access")
      expect(err.currentPlan).toBe("essencial")
      expect(err.requiredPlan).toBe("standard")
    })

    it("includes a descriptive message", () => {
      const err = new FeatureNotAvailableError("trails", "essencial", "standard")

      expect(err.message).toBeTruthy()
      expect(typeof err.message).toBe("string")
      expect(err.message.length).toBeGreaterThan(0)
    })
  })
})
