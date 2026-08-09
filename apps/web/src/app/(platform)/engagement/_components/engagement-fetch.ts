// ---------------------------------------------------------------------------
// Engagement Center v2 — client fetch helper (Rodada 3, 2026-07-09).
// ---------------------------------------------------------------------------
// The tab components refetch /api/engagement/* client-side. When the manager has
// drilled INTO a node (the `?focus=` breadcrumb), those refetches MUST carry the
// same `focus` so the tab data lands on the SAME node the server-rendered cards
// do — otherwise the page (scoped to the node) and a tab (scoped to the root)
// would disagree, the exact incoherence the Engagement Center exists to avoid.
//
// The server re-scopes `focus` against the caller's own subtree (fail-closed), so
// appending it here never widens reach — it only NARROWS the read to the node.
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Appends `focus=<uuid>` to an /api/engagement/* URL when a valid drill-down
 * node is active. `path` may already carry a query string; the helper merges the
 * param without clobbering existing ones. A null/invalid focus is a no-op, so
 * every call-site is safe to wrap unconditionally.
 */
export function withFocus(path: string, focus: string | null | undefined): string {
  if (!focus || !UUID_RE.test(focus)) return path
  const sep = path.includes("?") ? "&" : "?"
  return `${path}${sep}focus=${encodeURIComponent(focus)}`
}
