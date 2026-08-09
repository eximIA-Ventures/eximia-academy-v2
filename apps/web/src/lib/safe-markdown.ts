/**
 * Safe inline markdown formatting.
 *
 * Renders a small subset of inline markdown (links, images, bold, italic, code)
 * to HTML for use with `dangerouslySetInnerHTML`. To prevent stored XSS, all
 * raw text is HTML-escaped BEFORE any formatting replacement, and link/image
 * URLs are validated to reject dangerous schemes (e.g. `javascript:`, `data:`).
 */

/** Escape HTML-significant characters so user content can never inject markup. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Return the URL if it uses a safe scheme, otherwise "#".
 * Allows http(s), mailto, relative paths and anchors; rejects javascript:, data:, vbscript:, etc.
 */
export function sanitizeUrl(url: string): string {
  const trimmed = url.trim()
  // Strip all whitespace and control characters that could be used to obscure
  // the scheme (e.g. "java\tscript:alert(1)") before inspecting it.
  // eslint-disable-next-line no-control-regex
  const normalized = trimmed.replace(/[\s\u0000-\u001f]/g, "").toLowerCase()
  if (
    normalized.startsWith("javascript:") ||
    normalized.startsWith("data:") ||
    normalized.startsWith("vbscript:")
  ) {
    return "#"
  }
  // Allow http(s), mailto, protocol-relative, root-relative and anchor/relative links.
  if (
    /^https?:\/\//.test(normalized) ||
    normalized.startsWith("mailto:") ||
    normalized.startsWith("/") ||
    normalized.startsWith("#") ||
    normalized.startsWith("./") ||
    normalized.startsWith("../")
  ) {
    return trimmed
  }
  // Bare scheme-less URLs (e.g. "example.com/foo") or relative filenames are safe.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(normalized)) {
    return trimmed
  }
  // Unknown scheme — reject.
  return "#"
}

interface InlineFormatOptions {
  /** When true, render markdown links and images. Defaults to false. */
  links?: boolean
}

/**
 * Safely format inline markdown to HTML.
 *
 * The input is HTML-escaped first, so any markup in the source is rendered as
 * text. Only the supported markdown tokens are then turned into HTML, and all
 * URLs are passed through {@link sanitizeUrl}.
 */
export function inlineFormat(text: string, options: InlineFormatOptions = {}): string {
  let html = escapeHtml(text)

  if (options.links) {
    // Image: ![alt](url) — must run before links to avoid the leading "!" being lost.
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt: string, url: string) => {
      const safeUrl = escapeHtml(sanitizeUrl(url))
      return `<img src="${safeUrl}" alt="${alt}" class="my-6 w-full rounded-xl" />`
    })
    // Link: [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, url: string) => {
      const safeUrl = escapeHtml(sanitizeUrl(url))
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-varzea underline underline-offset-2 hover:text-varzea-light">${label}</a>`
    })
  }

  return html
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-text-primary">$1</strong>')
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="rounded bg-bg-elevated px-1.5 py-0.5 text-[0.85em] text-cerrado-400">$1</code>')
}
