/**
 * Thin telemetry abstraction over Sentry.
 * Gracefully degrades to no-ops if @sentry/node is not available,
 * making the agents package usable outside of Next.js contexts.
 */

type CaptureExceptionFn = (error: unknown, context?: Record<string, unknown>) => void
type StartSpanFn = <T>(options: { name: string; op: string }, callback: (span: { setAttribute: (key: string, value: unknown) => void }) => T) => T

let captureException: CaptureExceptionFn = () => {}
let startSpan: StartSpanFn = (_opts, cb) => cb({ setAttribute: () => {} })

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sentry = require("@sentry/node")
  captureException = Sentry.captureException.bind(Sentry)
  startSpan = Sentry.startSpan.bind(Sentry)
} catch {
  // Sentry not available — use no-ops
}

export { captureException, startSpan }
