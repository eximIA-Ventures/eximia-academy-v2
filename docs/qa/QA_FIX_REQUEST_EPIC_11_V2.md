# QA Fix Request V2: Epic 11 — Post-Fix Re-Review

**Generated:** 2026-02-08T22:00:00Z
**QA Report Source:** Full code review of all uncommitted changes (71 modified + 30 new files)
**Reviewer:** Quinn (Test Architect)
**Context:** Re-review after Waves 1-4 fixes applied. Previous 29 issues reduced to 7 persisting + 31 new = 38 total.

---

## Instructions for @dev

Fix ONLY the issues listed below. Do not add features or refactor unrelated code.

**Process:**

1. Read each issue carefully
2. Fix the specific problem described
3. Verify using the verification steps provided
4. Mark the issue as fixed in this document
5. Run all checks before marking complete

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 5 | Must fix before merge |
| HIGH | 13 | Must fix before merge |
| MEDIUM | 14 | Should fix before merge |
| LOW | 6 | Optional (not listed — see review notes) |

**Previous Fix Request Status:**
- 22 of 29 issues fully resolved
- 3 partially resolved (regressions or incomplete)
- 4 resolved but new related issues found

---

## Wave 1 — CRITICAL (Must fix immediately)

### 1. [CRITICAL] `is_super_admin()` Doesn't Filter Soft-Deleted Users

**Issue ID:** FIX-E11-V2-C01
**Type:** NEW

**Location:** `supabase/migrations/20260209000000_epic11_super_admin_whitelabel.sql:47-54`

**Problem:**
The `is_super_admin()` SECURITY DEFINER function checks `role = 'super_admin'` but does NOT check `deleted_at IS NULL` or `status = 'active'`. A soft-deleted super_admin (via LGPD `lgpd_soft_delete_user`) retains their role and can bypass ALL RLS policies.

```sql
-- Current (vulnerable):
SELECT EXISTS (
  SELECT 1 FROM public.users
  WHERE id = auth.uid() AND role = 'super_admin'
);
```

**Expected:**
```sql
SELECT EXISTS (
  SELECT 1 FROM public.users
  WHERE id = auth.uid()
    AND role = 'super_admin'
    AND status = 'active'
    AND deleted_at IS NULL
);
```

**Verification:**

- [ ] Soft-deleted super_admin cannot access any RLS-protected data
- [ ] Active super_admin still has full access
- [ ] `supabase db reset` completes without errors

**Status:** [x] Fixed

---

### 2. [CRITICAL] Missing `whitelabel_enabled`/`whitelabel_config` in SELECT Queries

**Issue ID:** FIX-E11-V2-C02
**Type:** NEW (functional bug)

**Location:**
- `apps/web/src/app/(platform)/admin/settings/page.tsx:22-24` — SELECT missing `whitelabel_enabled, whitelabel_config`
- `apps/web/src/lib/super-admin-context.ts:38-39` — `getSuperAdminTenantContext` SELECT missing same columns

**Problem:**
The settings page renders `whitelabelEnabled={!!tenant.whitelabel_enabled}` and `whitelabelConfig={tenant.whitelabel_config}`, but neither field is in the SELECT. Both will always be `undefined`, meaning:
1. Whitelabel tab never renders for admin users
2. Whitelabel config always reset to `{}` for super_admin in tenant context

**Expected:**
```typescript
// settings/page.tsx line 22:
.select("id, name, slug, branding, settings, plan, whitelabel_enabled, whitelabel_config")

// super-admin-context.ts line 38:
.select("id, name, slug, branding, settings, whitelabel_enabled, whitelabel_config")
```

**Verification:**

- [ ] Settings page shows Whitelabel tab when `whitelabel_enabled = true`
- [ ] Whitelabel config loads existing values (not empty)
- [ ] Super admin in tenant context sees correct whitelabel config
- [ ] TypeScript passes

**Status:** [x] Fixed

---

### 3. [CRITICAL] Audit Logging Uses RLS-Bound Client — Silent Failures

**Issue ID:** FIX-E11-V2-C03
**Type:** PERSISTS (previous M03 fix added logging but didn't fix root cause)

**Location:** `apps/web/src/lib/audit.ts:15`

**Problem:**
`logSuperAdminAction()` receives the regular `supabase` client (RLS-bound). The `platform_audit_log` RLS policy requires `is_super_admin()`. If the user's JWT is stale, expired, or the RLS function fails, audit inserts fail silently. The Wave 3 fix added `console.error` logging but didn't address the root cause — audit writes should be guaranteed.

**Expected:**
Switch to `serviceClient` for audit writes, or accept `userId` directly instead of re-calling `getUser()`:

```typescript
import { createServiceClient } from "@/lib/supabase/service"

export async function logSuperAdminAction(
  userId: string,
  action: string,
  targetType: "tenant" | "user",
  targetId: string,
  details?: Record<string, unknown>,
) {
  const serviceClient = createServiceClient()
  const { error } = await serviceClient.from("platform_audit_log").insert({
    actor_id: userId,
    action,
    target_type: targetType,
    target_id: targetId,
    details: details || {},
  })
  if (error) {
    console.error(`[audit] Failed to log action "${action}":`, error.message)
  }
}
```

Update all callers to pass `user.id` instead of the supabase client.

**Verification:**

- [ ] Audit inserts succeed regardless of RLS state
- [ ] All callers updated to new signature
- [ ] Error logging still works on failure
- [ ] TypeScript passes

**Status:** [x] Fixed

---

### 4. [CRITICAL] Rate Limiting Fails Completely Open Without Redis

**Issue ID:** FIX-E11-V2-C04
**Type:** NEW

**Location:** `apps/web/src/lib/rate-limit.ts`, `apps/web/src/middleware.ts:22-39`

**Problem:**
When `UPSTASH_REDIS_REST_URL` is missing, `createRedis()` returns `null`, and every limiter exports `null`. In `checkLimit()`, a `null` limiter returns immediately (no block). Redis errors also fail open (line 37). All rate limiting is silently disabled — brute-force on `/api/auth` faces zero resistance.

**Expected:**
At minimum, log a startup warning when Redis is not configured. For sensitive endpoints (`/api/auth`), consider failing closed or using in-memory fallback:

```typescript
// rate-limit.ts — add startup warning
if (!redis) {
  console.warn("[rate-limit] Redis not configured — all rate limiting DISABLED")
}
```

For production, consider requiring Redis or providing an in-memory fallback for auth endpoints.

**Verification:**

- [ ] Missing Redis config produces a visible warning at startup
- [ ] Auth rate limiting documented as requiring Redis in production
- [ ] Existing rate limiting works when Redis IS configured

**Status:** [x] Fixed

---

### 5. [CRITICAL] Stale Closure in AbortController — Audit Log Client

**Issue ID:** FIX-E11-V2-C05
**Type:** REGRESSION (introduced by Wave 4 M09 fix)

**Location:** `apps/web/src/components/super-admin/audit-log-client.tsx:96`

**Problem:**
The Wave 4 fix added AbortController but used `useState` instead of `useRef`. State updates are async, so `abortController` inside `fetchEntries` reads the stale closure value. Rapid filter changes cause race conditions where old requests are NOT aborted, and stale data overwrites newer data.

```typescript
// Current (broken):
const [abortController, setAbortController] = useState<AbortController | null>(null)
```

Compare with `tenant-list-client.tsx` which correctly uses `useRef`.

**Expected:**
```typescript
const abortRef = useRef<AbortController | null>(null)

const fetchEntries = useCallback(async () => {
  if (abortRef.current) abortRef.current.abort()
  const controller = new AbortController()
  abortRef.current = controller
  // ... use controller.signal in fetch
}, [buildUrl])
```

Also remove `abortController` from the dependency array of `useCallback` (currently not listed, but the stale read is still problematic).

**Verification:**

- [ ] `useRef` used instead of `useState` for AbortController
- [ ] Rapid filter changes don't cause stale data display
- [ ] AbortError is caught and ignored (not shown as error)
- [ ] Component cleanup aborts in-flight request on unmount

**Status:** [x] Fixed

---

## Wave 2 — HIGH Security & Correctness

### 6. [HIGH] No Error State Displayed in Audit Log

**Issue ID:** FIX-E11-V2-H01
**Type:** NEW

**Location:** `apps/web/src/components/super-admin/audit-log-client.tsx:124-127`

**Problem:**
When `fetchEntries` fails, the catch block only does `console.error`. No user-visible error feedback. Compare with `tenant-list-client.tsx` which has a `fetchError` state.

**Expected:**
Add `fetchError` state and display in the UI (same pattern as tenant-list-client).

**Verification:**

- [ ] Network error shows error message in the audit log table
- [ ] Error clears on successful retry (Refresh button)

**Status:** [x] Fixed

---

### 7. [HIGH] No Server-Side Auth on 3 Super-Admin Pages

**Issue ID:** FIX-E11-V2-H02
**Type:** NEW

**Location:**
- `apps/web/src/app/super-admin/tenants/new/page.tsx`
- `apps/web/src/app/super-admin/dashboard/page.tsx`
- `apps/web/src/app/super-admin/audit/page.tsx`

**Problem:**
These pages have zero auth or role verification. They rely entirely on the layout guard. If the layout check is bypassed (e.g., route misconfiguration, refactoring), any authenticated user could access these.

**Expected:**
Add the same belt-and-suspenders auth check used in `tenants/page.tsx` and `[tenantId]/page.tsx`:

```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect("/login")
const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
if (profile?.role !== "super_admin") redirect("/dashboard")
```

**Verification:**

- [ ] All 3 pages have auth + role check
- [ ] Non-super_admin redirected to /dashboard
- [ ] Unauthenticated redirected to /login

**Status:** [x] Fixed

---

### 8. [HIGH] `select("*")` Leaks All Tenant Columns to Client

**Issue ID:** FIX-E11-V2-H03
**Type:** NEW

**Location:**
- `apps/web/src/app/super-admin/tenants/[tenantId]/page.tsx:28` — `select("*")`
- `apps/web/src/app/api/super-admin/tenants/[tenantId]/route.ts:31,117` — GET and PATCH both use `select("*")`

**Problem:**
All tenant columns sent to browser/client, including `whitelabel_config` (which may contain custom CSS), `settings`, and any future sensitive columns. The PATCH response also returns the full updated tenant.

**Expected:**
Use explicit column selection:

```typescript
.select("id, name, slug, plan, status, branding, settings, whitelabel_enabled, whitelabel_config, created_at, updated_at")
```

**Verification:**

- [ ] No `select("*")` in tenant detail page or API
- [ ] Frontend still receives all needed data
- [ ] TypeScript passes

**Status:** [x] Fixed

---

### 9. [HIGH] CSS Sanitization Bypasses — New Vectors

**Issue ID:** FIX-E11-V2-H04
**Type:** PERSISTS (Wave 2 fix was partial)

**Location:** `apps/web/src/lib/utils/sanitize-css.ts`

**Problem:**
The Wave 2 fix added comment stripping and escape normalization. New bypass vectors remain:
1. **`data:` URIs** not blocked — `url(data:image/svg+xml,<svg>...)` can inject SVG payloads
2. **Null bytes** not stripped — `expre\0ssion()` bypasses regex in some browsers
3. **`position: absolute`** not blocked — only `position: fixed` is, but absolute with high z-index also enables overlay attacks
4. **`@font-face`** not blocked — enables tracking via external font URLs

**Expected:**
Add to BLOCKED_PATTERNS:

```typescript
/url\s*\(\s*data:/gi,           // data: URI
/position\s*:\s*absolute/gi,    // absolute positioning overlay
/@font-face/gi,                 // external font tracking
```

Add before existing processing:
```typescript
// Strip null bytes and control characters
sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
```

**Verification:**

- [ ] `url(data:image/svg+xml,...)` blocked
- [ ] Null byte payloads blocked
- [ ] `position: absolute` blocked
- [ ] `@font-face` blocked
- [ ] Valid CSS still passes

**Status:** [x] Fixed

---

### 10. [HIGH] Invite Response Leaks Raw Supabase Auth Data

**Issue ID:** FIX-E11-V2-H05
**Type:** NEW

**Location:** `apps/web/src/app/api/super-admin/tenants/[tenantId]/users/route.ts:146`

**Problem:**
`return NextResponse.json({ data: inviteData })` returns the raw `inviteUserByEmail` response, which may contain `user.confirmation_sent_at`, `user.aud`, `user.email_confirmed_at`, `user.identities`, etc.

**Expected:**
Project only needed fields:

```typescript
return NextResponse.json({
  data: {
    user_id: inviteData.user?.id,
    email: parsed.data.email,
  },
}, { status: 201 })
```

**Verification:**

- [ ] Response only contains user_id and email
- [ ] No auth metadata leaked
- [ ] Frontend still works with projected response

**Status:** [x] Fixed

---

### 11. [HIGH] Drizzle-SQL Misalignment — Missing Columns

**Issue ID:** FIX-E11-V2-H06
**Type:** NEW

**Location:**
- `packages/database/src/schema/sessions.ts` — missing `completed_at` (added by Epic 3 migration)
- `packages/database/src/schema/qa-reports.ts` — missing `recommendation` (added by Epic 3)
- `packages/database/src/schema/analyses.ts` — missing `observations` (added by Epic 3)

**Problem:**
Epic 3 migration added columns that are not in the Drizzle schemas. Drizzle push/introspect would attempt to DROP these columns.

**Expected:**
Add missing columns to each Drizzle schema:

```typescript
// sessions.ts
completedAt: timestamp("completed_at", { withTimezone: true }),

// qa-reports.ts
recommendation: text("recommendation"),

// analyses.ts
observations: jsonb("observations").default([]),
```

**Verification:**

- [ ] All 3 Drizzle schemas include the missing columns
- [ ] TypeScript passes in `packages/database`
- [ ] Drizzle introspect shows no unexpected diff

**Status:** [x] Fixed

---

### 12. [HIGH] Sessions FK: CASCADE vs SET NULL Mismatch

**Issue ID:** FIX-E11-V2-H07
**Type:** NEW

**Location:**
- `packages/database/src/schema/sessions.ts:9` — `onDelete: "set null"`
- `supabase/migrations/20260207000000_initial_schema.sql:100` — `ON DELETE CASCADE`

**Problem:**
Drizzle says `set null` but the actual DB constraint is `CASCADE`. LGPD soft-delete drops NOT NULL but never changes the FK action. If a user is hard-deleted from `auth.users`, all their sessions are CASCADE deleted rather than preserved with NULL.

**Expected:**
Choose one:
- **Option A:** Add migration to change FK to `SET NULL` (aligns with LGPD intent)
- **Option B:** Update Drizzle to `onDelete: "cascade"` (aligns with current DB)

Recommend Option A for LGPD compliance.

**Verification:**

- [ ] Drizzle schema and DB constraint match
- [ ] LGPD soft-delete preserves session data

**Status:** [x] Fixed

---

### 13. [HIGH] `max_interactions_per_session` Still Capped at 5 in Shared Validators

**Issue ID:** FIX-E11-V2-H08
**Type:** PERSISTS (Wave 4 fixed actions.ts but not whitelabel.ts)

**Location:**
- `packages/shared/src/validators/whitelabel.ts:42` — `createTenantSchema` `.max(5)`
- `packages/shared/src/validators/whitelabel.ts:64` — `updateTenantSchema` `.max(5)`

**Problem:**
Wave 4 fixed `actions.ts` to `.max(20)`, but the shared `whitelabel.ts` validators used by tenant creation/update API still cap at 5. Values 6-20 rejected during tenant creation.

**Expected:**
```typescript
// Both lines:
max_interactions_per_session: z.number().int().min(1).max(20).optional(),
```

**Verification:**

- [ ] Tenant creation accepts max_interactions up to 20
- [ ] Tenant update accepts max_interactions up to 20
- [ ] Value 21+ rejected

**Status:** [x] Fixed

---

### 14. [HIGH] XSS via Unvalidated Favicon URL

**Issue ID:** FIX-E11-V2-H09
**Type:** NEW

**Location:**
- `apps/web/src/components/admin/whitelabel-settings-form.tsx:219` — `<img src={faviconUrl}>`
- `apps/web/src/components/admin/whitelabel-preview.tsx:33` — same

**Problem:**
User-supplied favicon URL rendered directly in `<img src>` without protocol validation. Could point to attacker-controlled server for session tracking. The input `type="url"` is not enforced because `handleSubmit` is a manual JS call, not native form submit.

**Expected:**
Add URL validation:

```typescript
const isValidUrl = (url: string) => {
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:"
  } catch {
    return false
  }
}
// Only render img if valid
{faviconUrl && isValidUrl(faviconUrl) && <img src={faviconUrl} ... />}
```

**Verification:**

- [ ] `javascript:` URLs not rendered
- [ ] `http://` URLs not rendered (only `https://`)
- [ ] Valid `https://` URLs render correctly
- [ ] Empty favicon still works (no broken image)

**Status:** [x] Fixed

---

### 15. [HIGH] Accessibility Gaps Across Multiple Components

**Issue ID:** FIX-E11-V2-H10
**Type:** NEW

**Location:**
- `audit-log-client.tsx:204-206` — Refresh button: icon-only, no `aria-label`
- `audit-log-client.tsx:323-326` — Expandable rows: not keyboard-accessible
- `tenant-list-client.tsx:169-173` — Search input: no `aria-label`
- `tenant-list-client.tsx:178-191` — Select filters: no `aria-label`
- `audit-log-client.tsx:215,237,249,263` — Filter labels: no `htmlFor`

**Expected:**
Add `aria-label` to icon-only buttons and unlabeled inputs. Add `tabIndex={0}` + `onKeyDown` to expandable rows.

**Verification:**

- [ ] Refresh button has `aria-label="Atualizar"`
- [ ] Search input has `aria-label="Buscar empresas"`
- [ ] Select filters have `aria-label` attributes
- [ ] Expandable rows activatable via Enter/Space key
- [ ] Filter labels have `htmlFor` matching input `id`

**Status:** [x] Fixed

---

### 16. [HIGH] No `error.tsx` Error Boundaries

**Issue ID:** FIX-E11-V2-H11
**Type:** NEW

**Location:** All route groups under `/super-admin/` and `/(platform)/`

**Problem:**
Zero `error.tsx` files exist. Unhandled errors in server components crash the entire page. `settings/page.tsx:30` explicitly `throw new Error(...)` which will be uncaught.

**Expected:**
Add `error.tsx` at minimum for:
- `apps/web/src/app/super-admin/error.tsx`
- `apps/web/src/app/(platform)/error.tsx`

```tsx
"use client"
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <p className="text-sm text-red-400">Algo deu errado: {error.message}</p>
      <button onClick={reset} className="text-sm text-accent-blue-mid underline">
        Tentar novamente
      </button>
    </div>
  )
}
```

**Verification:**

- [ ] `error.tsx` exists for both route groups
- [ ] Thrown errors show user-friendly message (not blank page)
- [ ] Reset button allows recovery

**Status:** [x] Fixed

---

### 17. [HIGH] `z.any()` on Question Validator Fields

**Issue ID:** FIX-E11-V2-H12
**Type:** NEW

**Location:** `packages/shared/src/validators/questions.ts:10-13`

**Problem:**
`followup_prompts`, `citations`, and `metadata` use `z.any()`, bypassing all validation. Arbitrary data (deeply nested objects, scripts, huge payloads) can be inserted into the database.

**Expected:**
```typescript
followup_prompts: z.array(z.string()).optional(),
citations: z.array(z.string()).optional(),
metadata: z.record(z.string(), z.unknown()).optional(),
```

**Verification:**

- [ ] No `z.any()` in question validators
- [ ] Valid data still passes
- [ ] Invalid data (wrong types) rejected

**Status:** [x] Fixed

---

### 18. [HIGH] `exitTenantContext` Missing Role Check

**Issue ID:** FIX-E11-V2-H13
**Type:** PERSISTS (Wave 3 added auth check but not role check)

**Location:** `apps/web/src/app/super-admin/tenants/actions.ts:47-56`

**Problem:**
Wave 3 fix added `if (!user) redirect("/login")` but did NOT verify `profile.role === "super_admin"`. Any authenticated user can call this server action.

**Expected:**
```typescript
export async function exitTenantContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (profile?.role !== "super_admin") redirect("/dashboard")
  await clearActiveTenant()
  redirect("/super-admin/tenants")
}
```

**Verification:**

- [ ] Non-super_admin cannot call exitTenantContext
- [ ] Super admin can still exit tenant context

**Status:** [x] Fixed

---

## Wave 3 — MEDIUM Priority

### 19. [MEDIUM] Dashboard Fetches ALL User Rows for Role Counting

**Issue ID:** FIX-E11-V2-M01

**Location:** `apps/web/src/app/api/super-admin/dashboard/route.ts:46`

**Problem:** `serviceClient.from("users").select("role")` loads every user row into memory. At scale, OOM risk.

**Expected:** Use individual count queries per role or a Postgres RPC with `GROUP BY`.

**Status:** [x] Fixed

---

### 20. [MEDIUM] Dashboard Fetches ALL Recent Rows for Growth Chart

**Issue ID:** FIX-E11-V2-M02

**Location:** `apps/web/src/app/api/super-admin/dashboard/route.ts:90-98`

**Problem:** Fetches all users/tenants from last 6 months for client-side grouping. Should use DB-side `GROUP BY`.

**Status:** [x] Fixed

---

### 21. [MEDIUM] Non-Atomic Invite + Profile Creation

**Issue ID:** FIX-E11-V2-M03

**Location:** `apps/web/src/app/api/super-admin/tenants/route.ts:156-197`, `[tenantId]/users/route.ts:102-146`

**Problem:** Invite sent via Supabase Auth, then profile created separately. If profile creation fails, user receives invite but has no profile row — causing auth failures on login.

**Expected:** If profile creation fails, attempt cleanup (delete the auth user) or clearly document the partial state.

**Status:** [x] Fixed

---

### 22. [MEDIUM] `from`/`to` Date Params Not Validated in Audit API

**Issue ID:** FIX-E11-V2-M04

**Location:** `apps/web/src/app/api/super-admin/audit/route.ts:27-28,52-58`

**Problem:** Invalid dates like `from=not-a-date` produce `not-a-dateT00:00:00.000Z`, causing DB errors that leak in response.

**Expected:** Validate date format with regex `/^\d{4}-\d{2}-\d{2}$/` before using.

**Status:** [x] Fixed

---

### 23. [MEDIUM] Tenant Cookie Not Validated Against DB

**Issue ID:** FIX-E11-V2-M05

**Location:** `apps/web/src/middleware.ts:165-172`

**Problem:** `x-sa-active-tenant` cookie set as `x-tenant-id` header without verifying tenant exists/is active. Could point to deleted tenant.

**Status:** [x] Fixed

---

### 24. [MEDIUM] `"demo"` Tenant Fallback Active in Production

**Issue ID:** FIX-E11-V2-M06

**Location:** `apps/web/src/middleware.ts:184`, `apps/web/src/lib/tenant.ts:18`

**Problem:** Hardcoded `"demo"` tenant fallback when no subdomain found. Should be restricted to `NODE_ENV === "development"`.

**Status:** [x] Fixed

---

### 25. [MEDIUM] Privacy/LGPD Export Audit Is Console-Only

**Issue ID:** FIX-E11-V2-M07

**Location:** `apps/web/src/app/api/privacy/export/route.ts:114-123`

**Problem:** Data export events logged via `console.log` but NOT persisted to `platform_audit_log`. Under LGPD, data access must have durable audit trail.

**Status:** [x] Fixed

---

### 26. [MEDIUM] Double-Click Race on Tenant Creation

**Issue ID:** FIX-E11-V2-M08

**Location:** `apps/web/src/components/super-admin/create-tenant-wizard.tsx:170`

**Problem:** `setSubmitting(true)` runs after validation. Rapid double-click can trigger two concurrent POSTs before state updates.

**Expected:** Set `submitting = true` as the first line of `handleSubmit`, before validation.

**Status:** [x] Fixed

---

### 27. [MEDIUM] `setTimeout` Feedback Not Cleaned Up on Unmount

**Issue ID:** FIX-E11-V2-M09

**Location:** `apps/web/src/components/admin/whitelabel-settings-form.tsx:79,103`

**Problem:** `setTimeout(() => setFeedback(null), 3000)` without cleanup. If component unmounts within 3s, state update fires on unmounted component.

**Expected:** Store timer ID in ref and clear on unmount.

**Status:** [x] Fixed

---

### 28. [MEDIUM] Color Fields Accept Any String (No Hex Validation)

**Issue ID:** FIX-E11-V2-M10

**Location:** `packages/shared/src/validators/whitelabel.ts:35-36`

**Problem:** `primary_color` and `secondary_color` in `createTenantSchema` accept any string. No hex color validation.

**Expected:**
```typescript
primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor hexadecimal invalida").optional(),
```

**Status:** [x] Fixed

---

### 29. [MEDIUM] TypeScript Interfaces Use snake_case vs Drizzle camelCase

**Issue ID:** FIX-E11-V2-M11

**Location:** `packages/shared/src/types/models.ts:39-51`

**Problem:** `Tenant` interface uses `whitelabel_enabled`, `created_at` (snake_case) while Drizzle outputs `whitelabelEnabled`, `createdAt` (camelCase). Mapping mismatch causes `undefined` at runtime.

**Status:** [x] Fixed

---

### 30. [MEDIUM] `TEST_USERS`/`TEST_PASSWORD` Constants in Production Bundle

**Issue ID:** FIX-E11-V2-M12

**Location:** `apps/web/src/components/auth/login-form.tsx:9-16`

**Problem:** `TEST_USERS` and `TEST_PASSWORD` defined at module scope outside the `NODE_ENV` guard. The component is tree-shaken but string literals survive in the production bundle.

**Expected:** Move constants inside the `DevCredentials` component body.

**Status:** [x] Fixed

---

### 31. [MEDIUM] `passWithNoTests: true` Masks Missing Tests

**Issue ID:** FIX-E11-V2-M13

**Location:** `packages/shared/vitest.config.ts`, `apps/web/vitest.config.ts`

**Problem:** Vitest config silences failures when no test files match. Accidentally deleted test files go unnoticed (CI exits 0).

**Status:** [x] Fixed

---

### 32. [MEDIUM] Missing AbortController Cleanup on Unmount

**Issue ID:** FIX-E11-V2-M14

**Location:**
- `apps/web/src/components/super-admin/audit-log-client.tsx:150-152`
- `apps/web/src/components/super-admin/tenant-list-client.tsx:123-136`

**Problem:** `useEffect` calls fetch but has no cleanup function to abort on unmount. The `tenant-list-client` only cleans up the debounce timeout, not the abort controller.

**Expected:** Add return cleanup:
```typescript
useEffect(() => {
  fetchEntries()
  return () => { abortRef.current?.abort() }
}, [fetchEntries])
```

**Status:** [x] Fixed

---

## Constraints

**CRITICAL: @dev deve seguir estas restricoes:**

- [x] Fix ONLY the issues listed above
- [x] Do NOT add new features
- [x] Do NOT refactor unrelated code
- [x] Run typecheck: `pnpm run typecheck` (passes — 1 pre-existing sidebar.tsx warning)
- [x] Run tests: `pnpm run test` (115/115 pass)
- [x] Update story file list if any new files created

---

## Prioridade de Execucao

**Wave 1 — CRITICAL (C01-C05):** Migration, SELECT queries, audit client, rate limiting, AbortController regression.

**Wave 2 — HIGH Security (H01-H13):** Error states, auth checks, select("*"), CSS sanitization, invite response, Drizzle alignment, accessibility, error boundaries.

**Wave 3 — MEDIUM (M01-M14):** Performance, validation, UX polish, test config.

---

## After Fixing

1. Mark each issue as fixed in this document
2. Run full validation: `pnpm run typecheck && pnpm run test`
3. Request QA re-review: `@qa *code-review`

---

_Generated by Quinn (Test Architect) — AIOS QA System_
