import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

function createRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
}

const redis = createRedis()

if (!redis) {
  console.warn(
    "[rate-limit] Redis not configured — all rate limiting DISABLED. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for production.",
  )
}

/**
 * In-memory rate limiter fallback when Redis is not configured.
 * Uses a simple sliding window per key stored in a Map.
 * NOT suitable for multi-instance deployments (each instance has its own map),
 * but sufficient for single-instance EasyPanel and prevents zero-protection.
 */
class InMemoryRatelimit {
  private windows = new Map<string, { count: number; resetAt: number }>()
  private maxEntries: number
  private limitNum: number
  private windowMs: number

  constructor(limit: number, windowStr: string) {
    this.limitNum = limit
    this.windowMs = InMemoryRatelimit.parseWindow(windowStr)
    this.maxEntries = 10_000
  }

  private static parseWindow(w: string): number {
    const [num, unit] = w.trim().split(/\s+/)
    const n = Number(num)
    switch (unit) {
      case "s": return n * 1000
      case "m": return n * 60_000
      case "h": return n * 3_600_000
      default: return n * 60_000
    }
  }

  async limit(key: string): Promise<{ success: boolean; reset: number }> {
    const now = Date.now()
    const entry = this.windows.get(key)

    if (!entry || now >= entry.resetAt) {
      if (this.windows.size >= this.maxEntries) {
        // Evict expired entries
        for (const [k, v] of this.windows) {
          if (now >= v.resetAt) this.windows.delete(k)
        }
      }
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs })
      return { success: true, reset: now + this.windowMs }
    }

    entry.count++
    if (entry.count > this.limitNum) {
      return { success: false, reset: entry.resetAt }
    }
    return { success: true, reset: entry.resetAt }
  }
}

function createLimiter(config: {
  limit: number
  window: Parameters<typeof Ratelimit.slidingWindow>[1]
  prefix: string
}) {
  if (redis) {
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.limit, config.window),
      prefix: config.prefix,
      analytics: true,
    })
  }
  // Fallback: in-memory rate limiting (single instance protection)
  return new InMemoryRatelimit(config.limit, config.window)
}

export type RateLimiter = Ratelimit | InMemoryRatelimit

// 10 req/min per user
export const chatLimiter = createLimiter({ limit: 10, window: "1 m", prefix: "rl:chat" })

// 5 req/min per IP
export const authLimiter = createLimiter({ limit: 5, window: "1 m", prefix: "rl:auth" })

// 5 req/5min per user
export const questionGenLimiter = createLimiter({
  limit: 5,
  window: "5 m",
  prefix: "rl:questions",
})

// 20 req/hour per user
export const courseCreateLimiter = createLimiter({ limit: 20, window: "1 h", prefix: "rl:courses" })

// 3 req/min per user
export const privacyLimiter = createLimiter({ limit: 3, window: "1 m", prefix: "rl:privacy" })

// 3 req/5min per user (content ingestion uploads)
export const ingestionLimiter = createLimiter({ limit: 3, window: "5 m", prefix: "rl:ingestion" })

// 10 req/min per user (content ingestion review/approval)
export const ingestionApprovalLimiter = createLimiter({
  limit: 10,
  window: "1 m",
  prefix: "rl:ingestion-approval",
})

// 1 req/5min per course (batch question generation)
export const batchQuestionGenLimiter = createLimiter({
  limit: 1,
  window: "5 m",
  prefix: "rl:batch-questions",
})

// 1 req/10min per course (enrichment)
export const enrichmentLimiter = createLimiter({
  limit: 1,
  window: "10 m",
  prefix: "rl:enrichment",
})

// 60 req/min per tenant (analytics aggregate)
export const analyticsAggregateLimiter = createLimiter({
  limit: 60,
  window: "1 m",
  prefix: "rl:analytics-agg",
})

// 120 req/min per tenant (analytics individual)
export const analyticsIndividualLimiter = createLimiter({
  limit: 120,
  window: "1 m",
  prefix: "rl:analytics-ind",
})

// 3 req/10min per tenant (course designer pipeline — sliding window, not concurrency)
export const courseDesignerGenerateLimiter = createLimiter({
  limit: 3,
  window: "10 m",
  prefix: "rl:cd-generate",
})

// 5 req/hour per tenant (content analysis)
export const contentAnalysisLimiter = createLimiter({
  limit: 5,
  window: "1 h",
  prefix: "rl:cd-analyze",
})

// 30 req/min per tenant (course designer CRUD)
export const courseDesignerCrudLimiter = createLimiter({
  limit: 30,
  window: "1 m",
  prefix: "rl:cd-crud",
})

// 100 req/min per IP (catch-all)
export const catchAllLimiter = createLimiter({ limit: 100, window: "1 m", prefix: "rl:global" })
