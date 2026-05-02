const RETRY_DELAYS_MS = [
  1 * 60 * 1000, // 1 minute
  5 * 60 * 1000, // 5 minutes
  30 * 60 * 1000, // 30 minutes
  2 * 60 * 60 * 1000, // 2 hours
  24 * 60 * 60 * 1000, // 24 hours
]

export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length

export function getNextRetryAt(attempt: number): Date | null {
  if (attempt >= MAX_ATTEMPTS) return null
  return new Date(Date.now() + RETRY_DELAYS_MS[attempt])
}
