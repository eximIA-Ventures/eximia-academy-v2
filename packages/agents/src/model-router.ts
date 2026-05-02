import type { LanguageModel } from "ai"
import { ModelRouterError } from "./errors"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModelProvider = "openai" | "google"
export type AgentRole = "mestre" | "polidor" | "guardiao" | "detector" | "perfilador" | "analyst"
export type TenantPlan = "essencial" | "standard" | "premium"

export interface ModelSpec {
  provider: ModelProvider
  model: string
  apiKeyEnv: string
}

export interface RoutingContext {
  tenantPlan?: TenantPlan
  agentRole: AgentRole
  interactionType?: string
}

// ---------------------------------------------------------------------------
// Routing Table
// ---------------------------------------------------------------------------

const OPENAI_KEY = "OPENAI_API_KEY"
const GOOGLE_KEY = "GOOGLE_API_KEY"

function spec(provider: ModelProvider, model: string, apiKeyEnv: string): ModelSpec {
  return { provider, model, apiKeyEnv }
}

const ROUTING_TABLE: Record<TenantPlan, Record<AgentRole, ModelSpec>> = {
  essencial: {
    mestre: spec("openai", "gpt-4.1-mini", OPENAI_KEY),
    polidor: spec("openai", "gpt-4.1-mini", OPENAI_KEY),
    guardiao: spec("openai", "gpt-4.1", OPENAI_KEY),
    detector: spec("openai", "gpt-4.1-mini", OPENAI_KEY),
    perfilador: spec("openai", "gpt-4.1-mini", OPENAI_KEY),
    analyst: spec("openai", "gpt-4.1-mini", OPENAI_KEY),
  },
  standard: {
    mestre: spec("openai", "gpt-4.1", OPENAI_KEY),
    polidor: spec("openai", "gpt-4.1-mini", OPENAI_KEY),
    guardiao: spec("openai", "gpt-4.1", OPENAI_KEY),
    detector: spec("openai", "gpt-4.1-mini", OPENAI_KEY),
    perfilador: spec("openai", "gpt-4.1-mini", OPENAI_KEY),
    analyst: spec("openai", "gpt-4.1-mini", OPENAI_KEY),
  },
  premium: {
    mestre: spec("openai", "gpt-4.1", OPENAI_KEY),
    polidor: spec("openai", "gpt-4.1-mini", OPENAI_KEY),
    guardiao: spec("openai", "gpt-4.1", OPENAI_KEY),
    detector: spec("openai", "gpt-4.1-mini", OPENAI_KEY),
    perfilador: spec("openai", "gpt-4.1-mini", OPENAI_KEY),
    analyst: spec("openai", "gpt-4.1", OPENAI_KEY),
  },
}

// ---------------------------------------------------------------------------
// Fallback Chains
// ---------------------------------------------------------------------------

const FALLBACK_CHAINS: Record<string, ModelSpec[]> = {
  "gpt-4.1": [
    spec("openai", "gpt-4.1-mini", OPENAI_KEY),
    spec("google", "gemini-2.5-pro", GOOGLE_KEY),
  ],
  "gpt-4.1-mini": [
    spec("openai", "gpt-4.1-nano", OPENAI_KEY),
    spec("google", "gemini-2.5-flash", GOOGLE_KEY),
  ],
}

// ---------------------------------------------------------------------------
// Model Pricing (cost per token in USD)
// ---------------------------------------------------------------------------

export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4.1": { input: 0.000002, output: 0.000008 },
  "gpt-4.1-mini": { input: 0.0000004, output: 0.0000016 },
  "gpt-4.1-nano": { input: 0.0000001, output: 0.0000004 },
  "gemini-2.5-pro": { input: 0.00000125, output: 0.000005 },
  "gemini-2.5-flash": { input: 0.00000015, output: 0.0000006 },
}

// ---------------------------------------------------------------------------
// Provider Singletons (lazy initialization)
// ---------------------------------------------------------------------------

type ProviderFactory = (model: string) => LanguageModel

let _openaiProvider: ProviderFactory | undefined
let _googleProvider: ProviderFactory | undefined

function getOpenAIProvider(): ProviderFactory {
  if (!_openaiProvider) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { openai } = require("@ai-sdk/openai")
    _openaiProvider = openai as ProviderFactory
  }
  return _openaiProvider!
}

function getGoogleProvider(): ProviderFactory {
  if (!_googleProvider) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { google } = require("@ai-sdk/google")
    _googleProvider = google as ProviderFactory
  }
  return _googleProvider!
}

function createModelInstance(modelSpec: ModelSpec): LanguageModel {
  switch (modelSpec.provider) {
    case "openai":
      return getOpenAIProvider()(modelSpec.model)
    case "google":
      return getGoogleProvider()(modelSpec.model)
  }
}

function hasApiKey(envVar: string): boolean {
  return !!process.env[envVar]
}

// ---------------------------------------------------------------------------
// Exported Functions
// ---------------------------------------------------------------------------

export function getModelSpec(ctx: RoutingContext): ModelSpec {
  const plan = ctx.tenantPlan ?? "standard"
  const modelSpec = ROUTING_TABLE[plan][ctx.agentRole]

  if (plan === "standard" && ctx.agentRole === "mestre" && ctx.interactionType === "quiz") {
    return spec("openai", "gpt-4.1-mini", OPENAI_KEY)
  }

  return modelSpec
}

export function getModel(ctx: RoutingContext): LanguageModel {
  const modelSpec = getModelSpec(ctx)
  return createModelInstance(modelSpec)
}

export function getModelWithFallback(ctx: RoutingContext): LanguageModel {
  const primary = getModelSpec(ctx)
  const candidates = [primary, ...(FALLBACK_CHAINS[primary.model] ?? [])]

  for (const candidate of candidates) {
    if (hasApiKey(candidate.apiKeyEnv)) {
      return createModelInstance(candidate)
    }
  }

  throw new ModelRouterError(
    ctx.agentRole,
    ctx.tenantPlan ?? "standard",
    candidates.map((c) => c.apiKeyEnv),
  )
}
