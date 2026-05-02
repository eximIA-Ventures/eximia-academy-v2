import { AgentTimeoutError } from "./errors"

/**
 * Wraps a function that receives an AbortSignal in a timeout.
 * The signal is passed to the function so it can be forwarded to generateObject.
 */
export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  agentName: string,
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const result = await Promise.race([
      fn(controller.signal),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(new AgentTimeoutError(agentName))
        })
      }),
    ])
    return result
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Determines whether an error is retryable (transient) or permanent.
 * Shared across all agents to avoid duplication.
 */
export function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return true
  const msg = err.message.toLowerCase()
  if (msg.includes("rate") || msg.includes("429") || msg.includes("timeout")) return true
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("econnreset")) return true
  if (msg.includes("500") || msg.includes("502") || msg.includes("503")) return true
  if (msg.includes("validation") || msg.includes("schema") || msg.includes("parse")) return false
  return true
}

/**
 * Returns a promise that resolves after the given number of milliseconds.
 */
export async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Calculates exponential backoff delay with a cap.
 */
export function getBackoffDelay(attempt: number, baseMs = 1000, maxMs = 30000): number {
  return Math.min(baseMs * Math.pow(2, attempt), maxMs)
}
