import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock @upstash/redis with a real class
vi.mock("@upstash/redis", () => ({
  Redis: class FakeRedis {},
}))

// Mock @upstash/ratelimit — needs to be both constructable and have a static method
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: Object.assign(function FakeRatelimit() {}, {
    slidingWindow: (_limit: number, _window: string) => "sliding-window-config",
  }),
}))

describe("rate-limit", () => {
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    // Restore env
    if (originalUrl) process.env.UPSTASH_REDIS_REST_URL = originalUrl
    else process.env.UPSTASH_REDIS_REST_URL = ""
    if (originalToken) process.env.UPSTASH_REDIS_REST_TOKEN = originalToken
    else process.env.UPSTASH_REDIS_REST_TOKEN = ""
  })

  it("exports null limiters when env vars are missing", async () => {
    process.env.UPSTASH_REDIS_REST_URL = ""
    process.env.UPSTASH_REDIS_REST_TOKEN = ""

    const mod = await import("../rate-limit")

    expect(mod.chatLimiter).toBeNull()
    expect(mod.authLimiter).toBeNull()
    expect(mod.questionGenLimiter).toBeNull()
    expect(mod.courseCreateLimiter).toBeNull()
    expect(mod.privacyLimiter).toBeNull()
    expect(mod.ingestionLimiter).toBeNull()
    expect(mod.ingestionApprovalLimiter).toBeNull()
    expect(mod.batchQuestionGenLimiter).toBeNull()
    expect(mod.enrichmentLimiter).toBeNull()
    expect(mod.analyticsAggregateLimiter).toBeNull()
    expect(mod.analyticsIndividualLimiter).toBeNull()
    expect(mod.courseDesignerGenerateLimiter).toBeNull()
    expect(mod.contentAnalysisLimiter).toBeNull()
    expect(mod.courseDesignerCrudLimiter).toBeNull()
    expect(mod.catchAllLimiter).toBeNull()
  })

  it("creates limiters when env vars are set", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io"
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token"

    const mod = await import("../rate-limit")

    expect(mod.chatLimiter).not.toBeNull()
    expect(mod.authLimiter).not.toBeNull()
    expect(mod.questionGenLimiter).not.toBeNull()
    expect(mod.courseCreateLimiter).not.toBeNull()
    expect(mod.privacyLimiter).not.toBeNull()
    expect(mod.ingestionLimiter).not.toBeNull()
    expect(mod.ingestionApprovalLimiter).not.toBeNull()
    expect(mod.batchQuestionGenLimiter).not.toBeNull()
    expect(mod.enrichmentLimiter).not.toBeNull()
    expect(mod.analyticsAggregateLimiter).not.toBeNull()
    expect(mod.analyticsIndividualLimiter).not.toBeNull()
    expect(mod.courseDesignerGenerateLimiter).not.toBeNull()
    expect(mod.contentAnalysisLimiter).not.toBeNull()
    expect(mod.courseDesignerCrudLimiter).not.toBeNull()
    expect(mod.catchAllLimiter).not.toBeNull()
  })

  it("exports exactly 15 named limiters", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io"
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token"

    const mod = await import("../rate-limit")
    const exportedKeys = Object.keys(mod)

    expect(exportedKeys).toContain("chatLimiter")
    expect(exportedKeys).toContain("authLimiter")
    expect(exportedKeys).toContain("questionGenLimiter")
    expect(exportedKeys).toContain("courseCreateLimiter")
    expect(exportedKeys).toContain("privacyLimiter")
    expect(exportedKeys).toContain("ingestionLimiter")
    expect(exportedKeys).toContain("ingestionApprovalLimiter")
    expect(exportedKeys).toContain("batchQuestionGenLimiter")
    expect(exportedKeys).toContain("enrichmentLimiter")
    expect(exportedKeys).toContain("analyticsAggregateLimiter")
    expect(exportedKeys).toContain("analyticsIndividualLimiter")
    expect(exportedKeys).toContain("courseDesignerGenerateLimiter")
    expect(exportedKeys).toContain("contentAnalysisLimiter")
    expect(exportedKeys).toContain("courseDesignerCrudLimiter")
    expect(exportedKeys).toContain("catchAllLimiter")
    expect(exportedKeys).toHaveLength(15)
  })
})
