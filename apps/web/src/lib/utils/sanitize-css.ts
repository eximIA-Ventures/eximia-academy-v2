/**
 * Sanitizes user-provided CSS to block common XSS vectors.
 *
 * Story 11.6: Custom CSS injection for whitelabel tenants.
 * Strips CSS comments and normalizes escape sequences before applying
 * a blocklist for expression(), javascript:, @import, behavior:,
 * -moz-binding, non-HTTPS url(), HTML tags, and overlay attacks.
 */

const BLOCKED_PATTERNS = [
  /expression\s*\(/gi,
  /javascript\s*:/gi,
  /@import/gi,
  /@charset/gi,
  /@namespace/gi,
  /@font-face/gi,
  /behavior\s*:/gi,
  /-moz-binding/gi,
  /url\s*\(\s*data:/gi,
  /url\s*\(\s*['"]?\s*(?!https:)/gi,
  /<[^>]*>/g,
  /position\s*:\s*fixed/gi,
  /position\s*:\s*absolute/gi,
  /z-index\s*:\s*\d{5,}/gi,
]

const MAX_CSS_LENGTH = 5000

export function sanitizeCSS(css: string): string {
  if (!css || css.length > MAX_CSS_LENGTH) return ""

  let sanitized = css

  // Strip null bytes and control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")

  // Strip CSS comments to prevent obfuscation (e.g. expres/**/sion())
  sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, "")

  // Normalize CSS backslash escape sequences (e.g. \65xpression → expression)
  sanitized = sanitized.replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  )

  // Apply blocklist
  for (const pattern of BLOCKED_PATTERNS) {
    sanitized = sanitized.replace(pattern, "/* blocked */")
  }

  return sanitized
}
