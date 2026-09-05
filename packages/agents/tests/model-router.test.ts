import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ModelRouterError } from "../src/errors"
import { MODEL_PRICING, getModelSpec, getModelWithFallback } from "../src/model-router"
import type { AgentRole, RoutingContext, TenantPlan } from "../src/model-router"

// Mock dos providers usados pelo model-router (não fazemos chamadas reais de rede em teste)
vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn((model: string) => ({ provider: "openai", modelId: model })),
}))

vi.mock("@ai-sdk/google", () => ({
  google: vi.fn((model: string) => ({ provider: "google", modelId: model })),
}))

describe("getModelSpec", () => {
  // --- Tabela de roteamento: 18 casos (6 papéis x 3 planos) ---
  // Espelha a ROUTING_TABLE real de src/model-router.ts (sem provider deepseek: não implementado em produção)

  const expectedRouting: Array<{
    plan: TenantPlan
    role: AgentRole
    expectedModel: string
    expectedProvider: string
  }> = [
    // Essencial
    {
      plan: "essencial",
      role: "mestre",
      expectedModel: "gpt-4.1-mini",
      expectedProvider: "openai",
    },
    {
      plan: "essencial",
      role: "polidor",
      expectedModel: "gpt-4.1-mini",
      expectedProvider: "openai",
    },
    { plan: "essencial", role: "guardiao", expectedModel: "gpt-4.1", expectedProvider: "openai" },
    {
      plan: "essencial",
      role: "detector",
      expectedModel: "gpt-4.1-mini",
      expectedProvider: "openai",
    },
    {
      plan: "essencial",
      role: "perfilador",
      expectedModel: "gpt-4.1-mini",
      expectedProvider: "openai",
    },
    {
      plan: "essencial",
      role: "analyst",
      expectedModel: "gpt-4.1-mini",
      expectedProvider: "openai",
    },
    // Standard
    { plan: "standard", role: "mestre", expectedModel: "gpt-4.1", expectedProvider: "openai" },
    {
      plan: "standard",
      role: "polidor",
      expectedModel: "gpt-4.1-mini",
      expectedProvider: "openai",
    },
    { plan: "standard", role: "guardiao", expectedModel: "gpt-4.1", expectedProvider: "openai" },
    {
      plan: "standard",
      role: "detector",
      expectedModel: "gpt-4.1-mini",
      expectedProvider: "openai",
    },
    {
      plan: "standard",
      role: "perfilador",
      expectedModel: "gpt-4.1-mini",
      expectedProvider: "openai",
    },
    {
      plan: "standard",
      role: "analyst",
      expectedModel: "gpt-4.1-mini",
      expectedProvider: "openai",
    },
    // Premium
    { plan: "premium", role: "mestre", expectedModel: "gpt-4.1", expectedProvider: "openai" },
    { plan: "premium", role: "polidor", expectedModel: "gpt-4.1-mini", expectedProvider: "openai" },
    { plan: "premium", role: "guardiao", expectedModel: "gpt-4.1", expectedProvider: "openai" },
    {
      plan: "premium",
      role: "detector",
      expectedModel: "gpt-4.1-mini",
      expectedProvider: "openai",
    },
    {
      plan: "premium",
      role: "perfilador",
      expectedModel: "gpt-4.1-mini",
      expectedProvider: "openai",
    },
    { plan: "premium", role: "analyst", expectedModel: "gpt-4.1", expectedProvider: "openai" },
  ]

  it.each(expectedRouting)(
    "routes $plan/$role to $expectedModel ($expectedProvider)",
    ({ plan, role, expectedModel, expectedProvider }) => {
      const spec = getModelSpec({ tenantPlan: plan, agentRole: role })
      expect(spec.model).toBe(expectedModel)
      expect(spec.provider).toBe(expectedProvider)
    },
  )

  it("applies quiz override for standard plan mestre", () => {
    const spec = getModelSpec({
      tenantPlan: "standard",
      agentRole: "mestre",
      interactionType: "quiz",
    })
    expect(spec.model).toBe("gpt-4.1-mini")
  })

  it("does NOT apply quiz override for premium plan", () => {
    const spec = getModelSpec({
      tenantPlan: "premium",
      agentRole: "mestre",
      interactionType: "quiz",
    })
    expect(spec.model).toBe("gpt-4.1")
  })

  it("defaults to standard plan when tenantPlan is undefined", () => {
    const spec = getModelSpec({ agentRole: "mestre" })
    expect(spec.model).toBe("gpt-4.1")
  })

  it("guardiao is always gpt-4.1 regardless of plan", () => {
    for (const plan of ["essencial", "standard", "premium"] as TenantPlan[]) {
      const spec = getModelSpec({ tenantPlan: plan, agentRole: "guardiao" })
      expect(spec.model).toBe("gpt-4.1")
    }
  })
})

describe("getModelWithFallback", () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("returns primary model when API key is present", () => {
    process.env.OPENAI_API_KEY = "sk-test"
    const model = getModelWithFallback({ tenantPlan: "standard", agentRole: "mestre" })
    expect(model).toBeDefined()
  })

  it("falls back to Google when OpenAI key is missing", () => {
    Reflect.deleteProperty(process.env, "OPENAI_API_KEY")
    process.env.GOOGLE_API_KEY = "goog-test"
    const model = getModelWithFallback({ tenantPlan: "standard", agentRole: "mestre" })
    expect(model).toBeDefined()
  })

  it("throws ModelRouterError when all provider keys are missing", () => {
    Reflect.deleteProperty(process.env, "OPENAI_API_KEY")
    Reflect.deleteProperty(process.env, "GOOGLE_API_KEY")
    expect(() => getModelWithFallback({ tenantPlan: "standard", agentRole: "mestre" })).toThrow(
      ModelRouterError,
    )
  })

  it("ModelRouterError contains agent role and plan info", () => {
    Reflect.deleteProperty(process.env, "OPENAI_API_KEY")
    Reflect.deleteProperty(process.env, "GOOGLE_API_KEY")
    try {
      getModelWithFallback({ tenantPlan: "essencial", agentRole: "polidor" })
      expect.fail("Should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(ModelRouterError)
      const error = err as ModelRouterError
      expect(error.agentRole).toBe("polidor")
      expect(error.tenantPlan).toBe("essencial")
    }
  })
})

describe("MODEL_PRICING", () => {
  it("has pricing for all primary models", () => {
    const models = ["gpt-4.1", "gpt-4.1-mini", "gemini-2.5-pro", "gemini-2.5-flash"]
    for (const model of models) {
      expect(MODEL_PRICING[model]).toBeDefined()
      expect(MODEL_PRICING[model].input).toBeGreaterThan(0)
      expect(MODEL_PRICING[model].output).toBeGreaterThan(0)
    }
  })
})
