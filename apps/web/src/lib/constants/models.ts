/**
 * AI model identifiers used across the platform.
 *
 * - CHAT: default model for Socratic dialogue / profile generation
 * - Tenant-configurable models are listed in AI_MODEL_OPTIONS
 */

export const DEFAULT_CHAT_MODEL = process.env.CHAT_MODEL || "claude-sonnet-4-5-20250929"

/** Models available for tenant-level AI configuration */
export const AI_MODEL_OPTIONS = [
  { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
  { value: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
] as const

/** Cost estimates per token (USD) — used for analytics tracking */
export const MODEL_PRICING = {
  "claude-sonnet-4-5-20250929": {
    inputTokenCost: 0.000003,
    outputTokenCost: 0.000015,
  },
} as const
