import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { NextResponse } from "next/server"

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (redis) return redis
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
  return redis
}

// --- In-memory fallback (fixed-window) used when Redis is unavailable ---
// Prevents fail-open behaviour on sensitive endpoints. Per-instance only.
interface MemoryWindow {
  count: number
  resetAt: number
}
const memoryStore = new Map<string, MemoryWindow>()
let warnedNoRedis = false

function checkMemoryLimit(key: string, limit: number, windowMs: number): { ok: boolean; reset: number } {
  const now = Date.now()
  const entry = memoryStore.get(key)
  if (!entry || now >= entry.resetAt) {
    const resetAt = now + windowMs
    memoryStore.set(key, { count: 1, resetAt })
    return { ok: true, reset: resetAt }
  }
  entry.count += 1
  return { ok: entry.count <= limit, reset: entry.resetAt }
}

function rateLimitResponse(scope: string, reset: number): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
  return NextResponse.json(
    { error: `Rate limit exceeded (${scope})`, retryAfter },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  )
}

export async function checkApiKeyRateLimit(
  apiKeyId: string,
  rpm: number,
  rpd: number,
): Promise<NextResponse | null> {
  const r = getRedis()
  if (!r) {
    // Fail-closed via in-memory fallback: never silently allow unlimited requests.
    if (!warnedNoRedis) {
      console.warn(
        "[rate-limit-api] Upstash Redis unavailable — falling back to in-memory rate limiting (per-instance only).",
      )
      warnedNoRedis = true
    }
    const minute = checkMemoryLimit(`rpm:${apiKeyId}`, rpm, 60_000)
    if (!minute.ok) return rateLimitResponse("per minute", minute.reset)
    const day = checkMemoryLimit(`rpd:${apiKeyId}`, rpd, 86_400_000)
    if (!day.ok) return rateLimitResponse("per day", day.reset)
    return null
  }

  // Per-minute limit
  const minuteLimiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(rpm, "1 m"),
    prefix: "rl:apikey:rpm",
  })

  try {
    const { success: minuteOk, reset: minuteReset } = await minuteLimiter.limit(apiKeyId)
    if (!minuteOk) {
      const retryAfter = Math.max(1, Math.ceil((minuteReset - Date.now()) / 1000))
      return NextResponse.json(
        { error: "Rate limit exceeded (per minute)", retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      )
    }
  } catch (err) {
    // Redis errored mid-request: fall back to in-memory limit instead of failing open.
    console.warn("[rate-limit-api] Redis per-minute limit failed, using in-memory fallback:", err)
    const minute = checkMemoryLimit(`rpm:${apiKeyId}`, rpm, 60_000)
    if (!minute.ok) return rateLimitResponse("per minute", minute.reset)
  }

  // Per-day limit
  const dayLimiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(rpd, "1 d"),
    prefix: "rl:apikey:rpd",
  })

  try {
    const { success: dayOk, reset: dayReset } = await dayLimiter.limit(apiKeyId)
    if (!dayOk) {
      const retryAfter = Math.max(1, Math.ceil((dayReset - Date.now()) / 1000))
      return NextResponse.json(
        { error: "Rate limit exceeded (per day)", retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      )
    }
  } catch (err) {
    // Redis errored mid-request: fall back to in-memory limit instead of failing open.
    console.warn("[rate-limit-api] Redis per-day limit failed, using in-memory fallback:", err)
    const day = checkMemoryLimit(`rpd:${apiKeyId}`, rpd, 86_400_000)
    if (!day.ok) return rateLimitResponse("per day", day.reset)
  }

  return null
}
