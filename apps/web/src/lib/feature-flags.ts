import posthog from "posthog-js"

export function isFeatureEnabled(flag: string): boolean {
  if (typeof window === "undefined" || !posthog.__loaded) return false
  return posthog.isFeatureEnabled(flag) ?? false
}
