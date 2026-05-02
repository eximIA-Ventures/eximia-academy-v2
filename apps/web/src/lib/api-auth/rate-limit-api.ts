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

export async function checkApiKeyRateLimit(
  apiKeyId: string,
  rpm: number,
  rpd: number,
): Promise<NextResponse | null> {
  const r = getRedis()
  if (!r) return null

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
  } catch {
    // Fail open
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
  } catch {
    // Fail open
  }

  return null
}
