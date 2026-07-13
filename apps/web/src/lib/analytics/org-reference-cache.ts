// ---------------------------------------------------------------------------
// org-reference-cache — per-TENANT memoization of the org reference (SH-F.3)
// ---------------------------------------------------------------------------
// Mirrors the canonical process-local cache pattern of `feature-gate.ts`
// (Map<tenantId, {payload, expiry}> + TTL). The org reference (the tenant
// population aggregate behind "Média da organização") is IDENTICAL for every
// student of the tenant within a short window, so requests of the same tenant
// stop repeating the org-wide scans (users + chapters/courses + the 4 org scans).
//
// PRODUCT DECISION (ratificada pelo @po, SH-F.3): the "Média da organização" may
// be stale by up to the TTL (60s). This is intentional and bounded — a moving
// average changes in a window, not every second. The STUDENT'S OWN block is
// NEVER cached (computed fresh per request in computeStudentComparison).
//
// KEYED ONLY BY `tenantId`. The cached value is ONLY the OrgReference (org
// population data) — it holds NO `studentId` and no per-student block. That is
// the structural proof that the individual student never enters the cache.
//
// Process-local cache is valid here for the same reason it is for feature-gate.ts
// in production: the app runs as a long-lived process (EasyPanel/Docker, not
// serverless). No Redis. Invalidation is by TTL only (manual invalidation is out
// of scope for this slice).
// ---------------------------------------------------------------------------

import {
  type OrgReference,
  type ServiceClient,
  loadOrgReference,
} from "@/lib/analytics/area-gestor"

/**
 * TTL of the org reference cache. 60s: the home must feel alive, but the org
 * aggregate only moves in a window. Calibrable in this ONE named constant — a
 * different product target is a one-line change, not a refactor.
 */
export const ORG_REFERENCE_TTL_MS = 60 * 1000

interface CacheEntry {
  ref: OrgReference
  expiry: number
}

// key = tenantId (string) ONLY. value = OrgReference ONLY. No studentId, ever.
const tenantCache = new Map<string, CacheEntry>()

/**
 * Serve the org reference from the valid cache entry, or load it and populate the
 * cache. `now` is injected (not `Date.now()` inline) so callers/tests control the
 * clock; the freshness check is `now > entry.expiry`. On a cache HIT within the
 * TTL, ZERO org scans run (the entry is returned as-is, numerically identical).
 */
export async function getOrgReference(
  db: ServiceClient,
  tenantId: string,
  now: number,
): Promise<OrgReference> {
  const entry = tenantCache.get(tenantId)
  if (entry && now <= entry.expiry) {
    return entry.ref
  }
  const ref = await loadOrgReference(db, tenantId, now)
  tenantCache.set(tenantId, { ref, expiry: now + ORG_REFERENCE_TTL_MS })
  return ref
}

/**
 * Test-only reset of the process-local cache, so each test starts clean (there is
 * no manual invalidation in the product surface — TTL only, by design).
 */
export function __resetOrgReferenceCache(): void {
  tenantCache.clear()
}
