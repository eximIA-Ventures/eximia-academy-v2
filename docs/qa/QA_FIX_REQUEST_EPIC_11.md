# QA Fix Request: Epic 11 — Super Admin, Gestao de Empresas & Whitelabel

**Generated:** 2026-02-08T18:00:00Z
**QA Report Source:** Code review of all Epic 11 uncommitted changes (70 files)
**Reviewer:** Quinn (Test Architect)
**Stories:** 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7

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
| CRITICAL | 3 | Must fix before merge |
| HIGH | 10 | Must fix before merge |
| MEDIUM | 16 | Should fix before merge |

---

## CRITICAL Issues

### 1. [CRITICAL] Migration `ALTER TYPE user_role` Will Fail — No ENUM Type Exists

**Issue ID:** FIX-E11-C01
**Story:** 11.1

**Location:** `supabase/migrations/20260209000000_epic11_super_admin_whitelabel.sql:7`

**Problem:**
The Epic 11 migration runs `ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin'`, but no PostgreSQL ENUM type `user_role` exists. The initial migration uses a `TEXT` column with a `CHECK` constraint on `users.role`:

```sql
-- initial_schema.sql line 33:
role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin', 'manager'))
```

This migration will throw: `ERROR: type "user_role" does not exist`.

**Expected:**
Replace the `ALTER TYPE` statement with a `DROP CONSTRAINT / ADD CONSTRAINT` approach:

```sql
-- Remove old CHECK constraint and add new one with super_admin
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('student', 'teacher', 'admin', 'manager', 'super_admin'));
```

**Verification:**

- [ ] Migration runs without errors on a fresh DB with initial_schema applied
- [ ] `INSERT INTO users (..., role) VALUES (..., 'super_admin')` succeeds
- [ ] Existing roles (`student`, `teacher`, `admin`, `manager`) still work
- [ ] `INSERT ... role = 'invalid_role'` is rejected by CHECK constraint
- [ ] Seed script completes successfully

**Status:** [ ] Fixed

---

### 2. [CRITICAL] Initial Schema CHECK Constraint Blocks `super_admin` Role

**Issue ID:** FIX-E11-C02
**Story:** 11.1

**Location:** `supabase/migrations/20260207000000_initial_schema.sql:33`

**Problem:**
The CHECK constraint on `users.role` does not include `super_admin`. The seed.sql (line 36) tries to insert a super_admin user, which will be rejected by the constraint. This is related to C01 but must be verified independently — if the initial migration is ever run standalone (e.g., test environments), it must support `super_admin`.

**Expected:**
Two options:

**Option A (Recommended):** Fix in Epic 11 migration (already covered by C01 fix). Ensure the constraint replacement happens before any super_admin seed inserts.

**Option B:** Update the initial migration directly to include `super_admin`:
```sql
role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin', 'manager', 'super_admin'))
```

**Verification:**

- [ ] `supabase db reset` runs without errors
- [ ] Seed data with super_admin role inserts correctly
- [ ] `pnpm run typecheck` passes

**Status:** [ ] Fixed

---

### 3. [CRITICAL] `courses.type` Column Never Created in Any Migration

**Issue ID:** FIX-E11-C03
**Story:** 11.1 (migration chain)

**Location:**
- `supabase/migrations/20260208000001_remove_dual_mode.sql:8-11` — drops `courses.mode`
- `packages/database/src/schema/courses.ts:12` — references `type` column
- `packages/shared/src/validators/courses.ts:9` — validates `type: z.enum(["regular", "onboarding"])`

**Problem:**
The `remove_dual_mode` migration drops `courses.mode` but never creates `courses.type`. The Drizzle schema and Zod validator both reference `courses.type` with values `regular/onboarding`, which does not exist in the database. Any query touching `courses.type` will fail at runtime.

**Expected:**
Add to the `remove_dual_mode` migration (or create a new migration):

```sql
-- After dropping mode column, add type column
ALTER TABLE courses ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'regular'
  CHECK (type IN ('regular', 'onboarding'));
```

**Verification:**

- [ ] `supabase db reset` runs without errors
- [ ] `SELECT type FROM courses` works
- [ ] Drizzle schema matches DB schema
- [ ] Course creation with `type: "regular"` succeeds
- [ ] Course creation with `type: "onboarding"` succeeds
- [ ] Course creation with `type: "invalid"` is rejected

**Status:** [ ] Fixed

---

## HIGH Issues

### 4. [HIGH] DevCredentials Component Ships Test Passwords to Production

**Issue ID:** FIX-E11-H01
**Story:** 11.6

**Location:** `apps/web/src/components/auth/login-form.tsx:9-16, 203-210`

**Problem:**
The `DevCredentials` component renders test user credentials (emails + password `"123456"`) with **no environment guard**. This component will be included in the production bundle, exposing test credentials to any user inspecting page source.

```tsx
// Lines 9-16: Always defined, no env check
const DEV_CREDENTIALS = [
  { label: "Admin", email: "admin@demo.com" },
  { label: "Professor", email: "professor@demo.com" },
  // ...
]
```

**Expected:**
Wrap in environment check:

```tsx
// Only render in development
{process.env.NODE_ENV === "development" && <DevCredentials ... />}
```

Or better, use `NEXT_PUBLIC_SHOW_DEV_TOOLS`:
```tsx
{process.env.NEXT_PUBLIC_SHOW_DEV_TOOLS === "true" && <DevCredentials ... />}
```

**Verification:**

- [ ] `DevCredentials` NOT rendered when `NODE_ENV=production`
- [ ] `DevCredentials` still works in development
- [ ] Build output does NOT contain test credential strings (tree-shaking)
- [ ] Login page still works without DevCredentials

**Status:** [ ] Fixed

---

### 5. [HIGH] Dashboard API Uses Regular Client — RLS Returns Empty Data

**Issue ID:** FIX-E11-H02
**Story:** 11.7

**Location:** `apps/web/src/app/api/super-admin/dashboard/route.ts:26-98`

**Problem:**
The dashboard endpoint uses the regular `supabase` client (user's auth cookie) for all queries. Super admin has `tenant_id = NULL`, so RLS policies filter by `tenant_id = auth_tenant_id()` will return **zero rows**. All other super-admin API routes correctly use `createServiceClient()`.

```typescript
// Line 26-28: Regular client — RLS blocks super_admin
const { count: totalTenants } = await supabase
  .from("tenants")
  .select("id", { count: "exact", head: true })
```

**Expected:**
Import and use `createServiceClient()` after auth verification:

```typescript
import { createServiceClient } from "@/lib/supabase/service"
// After requireSuperAdmin check:
const serviceClient = createServiceClient()
// Use serviceClient for all queries
```

**Verification:**

- [ ] Dashboard returns actual counts (not zeros)
- [ ] Auth check still happens BEFORE service client usage
- [ ] Growth chart data populates correctly
- [ ] Typecheck passes

**Status:** [ ] Fixed

---

### 6. [HIGH] Audit Log API Uses Regular Client — Same RLS Issue

**Issue ID:** FIX-E11-H03
**Story:** 11.7

**Location:** `apps/web/src/app/api/super-admin/audit/route.ts:32-83`

**Problem:**
Same as H02. The audit log endpoint uses the regular `supabase` client. `platform_audit_log` has RLS policies that likely block super_admin access via regular client.

**Expected:**
Same fix as H02 — use `createServiceClient()` after auth check.

**Verification:**

- [ ] Audit log returns entries (not empty)
- [ ] Filters (action, date, target_type) work correctly
- [ ] Pagination works
- [ ] Auth is verified before service client usage

**Status:** [ ] Fixed

---

### 7. [HIGH] Super Admin Tenant Pages Missing Role Check Before Service Client

**Issue ID:** FIX-E11-H04
**Story:** 11.3

**Location:**
- `apps/web/src/app/super-admin/tenants/page.tsx:10-14`
- `apps/web/src/app/super-admin/tenants/[tenantId]/page.tsx:6-21`

**Problem:**
Both pages only check `if (!user)` but do NOT verify the user's role is `super_admin` before calling `createServiceClient()` (which bypasses ALL RLS). The layout.tsx guard exists but this is a defense-in-depth violation. If the layout check is ever bypassed, any authenticated user could access all tenant data.

```typescript
// Only checks auth, NOT role:
const { data: { user } } = await supabase.auth.getUser()
if (!user) return null
// Then immediately uses service client:
const serviceClient = createServiceClient()
```

**Expected:**
Add role verification before service client usage:

```typescript
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect("/login")

const { data: profile } = await supabase
  .from("users").select("role").eq("id", user.id).single()
if (profile?.role !== "super_admin") redirect("/dashboard")

const serviceClient = createServiceClient()
```

**Verification:**

- [ ] Non-super_admin users redirected to /dashboard (not 403 JSON)
- [ ] Super admin can still access both pages
- [ ] Service client only used after role verification
- [ ] Typecheck passes

**Status:** [ ] Fixed

---

### 8. [HIGH] Admin Settings Page Throws for Super Admin (tenant_id is NULL)

**Issue ID:** FIX-E11-H05
**Story:** 11.4, 11.5

**Location:** `apps/web/src/app/(platform)/admin/settings/page.tsx:17`

**Problem:**
The settings page allows `super_admin` role (line 9) but then queries `.eq("id", profile.tenant_id)`. For super admins, `tenant_id` is NULL, so `.eq("id", null)` returns no results and the page throws `"Falha ao carregar dados do tenant"`.

```typescript
// Line 9: Allows super_admin through
if (!["admin", "super_admin"].includes(profile.role)) redirect("/dashboard")
// Line 17: But this fails for super_admin (tenant_id is null)
.eq("id", profile.tenant_id)
```

**Expected:**
For super_admin in tenant context, use the active tenant cookie instead of `profile.tenant_id`:

```typescript
import { getActiveTenant } from "@/lib/super-admin-context"

const tenantId = profile.role === "super_admin"
  ? await getActiveTenant()  // from cookie
  : profile.tenant_id

if (!tenantId) redirect("/super-admin/tenants")

const { data: tenant } = await supabase
  .from("tenants").select("...").eq("id", tenantId).single()
```

**Verification:**

- [ ] Super admin in tenant context can access settings page
- [ ] Super admin without active tenant redirected to /super-admin/tenants
- [ ] Regular admin still works as before
- [ ] Typecheck passes

**Status:** [ ] Fixed

---

### 9. [HIGH] QuestionStatus Mismatch Between SQL and TypeScript

**Issue ID:** FIX-E11-H06
**Story:** 11.1 (pre-existing, surfaced during review)

**Location:**
- `supabase/migrations/20260207000000_initial_schema.sql:79` — `CHECK (status IN ('draft', 'active', 'archived'))`
- `packages/shared/src/types/models.ts:6` — `"pending" | "active" | "rejected"`
- `packages/shared/src/validators/courses.ts:12` — `z.enum(["pending", "active", "rejected"])`

**Problem:**
SQL schema says `draft/active/archived` but TypeScript says `pending/active/rejected`. Application will fail when trying to insert `status = 'pending'` or `status = 'rejected'` — DB rejects them. Only `active` works in both.

**Expected:**
Align TypeScript with SQL (or vice versa). Choose one source of truth:

**Option A (Align TS to SQL — less destructive):**
```typescript
// models.ts
export type QuestionStatus = "draft" | "active" | "archived"
// validators
z.enum(["draft", "active", "archived"])
```

**Option B (Align SQL to TS — requires migration):**
```sql
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_status_check;
ALTER TABLE questions ADD CONSTRAINT questions_status_check
  CHECK (status IN ('pending', 'active', 'rejected'));
```

**Verification:**

- [ ] TypeScript types match SQL CHECK constraint exactly
- [ ] Zod validators match SQL CHECK constraint exactly
- [ ] `pnpm run typecheck` passes
- [ ] Existing data (if any) is compatible with new constraint

**Status:** [ ] Fixed

---

### 10. [HIGH] Drizzle `users` Schema Missing `status` and `avatar_url` Columns

**Issue ID:** FIX-E11-H07
**Story:** 11.1

**Location:**
- `supabase/migrations/20260207000000_initial_schema.sql:34-35` — defines `status` and `avatar_url`
- `packages/database/src/schema/users.ts` — missing both columns

**Problem:**
The SQL schema defines `status TEXT NOT NULL DEFAULT 'active'` and `avatar_url TEXT` on the users table, but the Drizzle schema does not include either column. Any Drizzle query referencing these columns will fail at TypeScript level.

**Expected:**
Add to `packages/database/src/schema/users.ts`:

```typescript
status: text("status").notNull().default("active"),
avatarUrl: text("avatar_url"),
```

**Verification:**

- [ ] Drizzle schema includes `status` and `avatarUrl`
- [ ] `pnpm run typecheck` passes in `packages/database`
- [ ] Drizzle push/introspect shows no diff

**Status:** [ ] Fixed

---

### 11. [HIGH] CSS Sanitizer Bypassable via Backslash/Comment Obfuscation

**Issue ID:** FIX-E11-H08
**Story:** 11.6

**Location:** `apps/web/src/lib/utils/sanitize-css.ts:9-17`

**Problem:**
The regex-based CSS sanitizer can be bypassed:
1. CSS backslash escapes: `\65xpression()` = `expression()` but bypasses `/expression\s*\(/gi`
2. CSS comments: `expres/**/sion()` is interpreted as `expression()` by CSS parsers but bypasses regex
3. CSS unicode escapes: `\0065xpression` = `expression`
4. `position: fixed` + `z-index: 999999` allows phishing overlay attacks

**Expected:**
Two approaches:

**Option A (Quick fix):** Strip CSS comments and normalize backslash escapes before applying blocklist:
```typescript
// Strip CSS comments first
css = css.replace(/\/\*[\s\S]*?\*\//g, "")
// Normalize CSS escape sequences
css = css.replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex) =>
  String.fromCharCode(parseInt(hex, 16))
)
// Then apply existing blocklist...
```

**Option B (Robust):** Use a CSS parser like `css-tree` or `postcss` with an allowlist approach.

**Verification:**

- [ ] `\65xpression()` is blocked
- [ ] `expres/**/sion()` is blocked
- [ ] `position: fixed; z-index: 999999` is blocked (or documented as accepted risk)
- [ ] Valid CSS still passes: `body { color: red; font-size: 14px; }`
- [ ] Typecheck passes

**Status:** [ ] Fixed

---

### 12. [HIGH] Whitelabel Action Uses Raw Payload Instead of Parsed Data

**Issue ID:** FIX-E11-H09
**Story:** 11.5

**Location:** `apps/web/src/app/(platform)/admin/settings/whitelabel-actions.ts:46`

**Problem:**
After Zod validation, the code uses the raw `payload` instead of `parsed.data` in the update query. Zod `.safeParse()` does not strip unknown keys by default, so extra fields in the request body will be written directly to the `whitelabel_config` JSONB column.

```typescript
// Line 38-40: Validates
const parsed = whitelabelConfigSchema.safeParse(payload)
if (!parsed.success) return { error: parsed.error.errors[0].message }
// Line 46: But uses RAW payload, not parsed.data
.update({ whitelabel_config: isReset ? {} : payload })
```

**Expected:**
```typescript
.update({ whitelabel_config: isReset ? {} : parsed.data })
```

**Verification:**

- [ ] `parsed.data` used instead of `payload`
- [ ] Extra fields in request body are NOT written to DB
- [ ] Valid whitelabel config still saves correctly
- [ ] Reset still works (empty object)

**Status:** [ ] Fixed

---

### 13. [HIGH] `request.json()` Not Wrapped in Try-Catch in Multiple Routes

**Issue ID:** FIX-E11-H10
**Story:** 11.3

**Location:**
- `apps/web/src/app/api/super-admin/tenants/route.ts:125` (POST)
- `apps/web/src/app/api/super-admin/tenants/[tenantId]/route.ts:102` (PATCH)
- `apps/web/src/app/api/super-admin/tenants/[tenantId]/users/route.ts:95` (POST)
- `apps/web/src/app/api/admin/tenants/route.ts:58` (PATCH)

**Problem:**
`request.json()` throws on malformed/missing JSON body. None of these endpoints handle this case, resulting in unhandled 500 errors with potentially revealing stack traces.

**Expected:**
Wrap in try-catch:

```typescript
let body: unknown
try {
  body = await request.json()
} catch {
  return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
}
```

**Verification:**

- [ ] Sending empty body returns 400 (not 500)
- [ ] Sending malformed JSON returns 400 (not 500)
- [ ] Valid JSON still works as before
- [ ] No stack trace leaked in error response

**Status:** [ ] Fixed

---

## MEDIUM Issues

### 14. [MEDIUM] `/api/super-admin/*` Routes Not Guarded at Middleware Level

**Issue ID:** FIX-E11-M01
**Story:** 11.2

**Location:** `apps/web/src/middleware.ts:128, 136`

**Problem:**
Middleware guards `pathname.startsWith("/super-admin")` but NOT `pathname.startsWith("/api/super-admin")`. API routes rely solely on per-route `requireSuperAdmin()` checks. If any future API route forgets the check, it will be completely unprotected.

**Expected:**
Add `/api/super-admin` to the middleware guard:

```typescript
if (
  (pathname.startsWith("/super-admin") || pathname.startsWith("/api/super-admin"))
  && userRole !== "super_admin"
) {
```

**Verification:**

- [ ] Non-super_admin GET to `/api/super-admin/tenants` returns 403
- [ ] Super admin API access still works
- [ ] Middleware handles both page and API routes

**Status:** [ ] Fixed

---

### 15. [MEDIUM] `exitTenantContext` Server Action Has No Auth Check

**Issue ID:** FIX-E11-M02
**Story:** 11.4

**Location:** `apps/web/src/app/super-admin/tenants/actions.ts:47-50`

**Problem:**
```typescript
export async function exitTenantContext() {
  await clearActiveTenant()  // No auth check!
  redirect("/super-admin/tenants")
}
```

Unlike `switchToTenantContext`, this action has zero auth verification. Any user who can invoke this server action will have the cookie cleared.

**Expected:**
Add auth check:
```typescript
export async function exitTenantContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  await clearActiveTenant()
  redirect("/super-admin/tenants")
}
```

**Verification:**

- [ ] Unauthenticated invocation redirects to login
- [ ] Authenticated super_admin can still exit context
- [ ] Cookie is properly cleared

**Status:** [ ] Fixed

---

### 16. [MEDIUM] Audit Log Insert Errors Silently Swallowed

**Issue ID:** FIX-E11-M03
**Story:** 11.7

**Location:** `apps/web/src/lib/audit.ts:13-21`

**Problem:**
1. If `getUser()` returns no user (line 13), the function silently returns — audit event lost
2. The Supabase `.insert()` return value is never checked (line 15-21) — insert failures are silently discarded
3. Some callers pass the regular `supabase` client (not service client) — RLS may block inserts

**Expected:**
```typescript
export async function logSuperAdminAction(
  supabase: SupabaseClient,
  action: string,
  targetType: string,
  targetId: string,
  details?: Record<string, unknown>,
) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.warn("[audit] Cannot log action: no authenticated user")
    return
  }
  const { error } = await supabase.from("platform_audit_log").insert({...})
  if (error) {
    console.error("[audit] Failed to log action:", action, error.message)
  }
}
```

**Verification:**

- [ ] Audit failures are logged to console (not silently swallowed)
- [ ] Unauthenticated calls log a warning
- [ ] Insert failures log the error
- [ ] Successful inserts still work

**Status:** [ ] Fixed

---

### 17. [MEDIUM] Missing `updated_at` in Super Admin Tenant PATCH

**Issue ID:** FIX-E11-M04
**Story:** 11.3

**Location:** `apps/web/src/app/api/super-admin/tenants/[tenantId]/route.ts:126-129`

**Problem:**
The super-admin PATCH does NOT set `updated_at`. The admin PATCH route correctly includes it.

**Expected:**
```typescript
const { data: tenant, error } = await serviceClient
  .from("tenants")
  .update({ ...payload, updated_at: new Date().toISOString() })
  .eq("id", tenantId)
  .select()
  .single()
```

**Verification:**

- [ ] `updated_at` changes when tenant is modified via super-admin
- [ ] Typecheck passes

**Status:** [ ] Fixed

---

### 18. [MEDIUM] `requireSuperAdmin` Duplicated 3 Times

**Issue ID:** FIX-E11-M05
**Story:** 11.3

**Location:**
- `apps/web/src/app/api/super-admin/tenants/route.ts:9-24`
- `apps/web/src/app/api/super-admin/tenants/[tenantId]/route.ts:9-24`
- `apps/web/src/app/api/super-admin/tenants/[tenantId]/users/route.ts:17-32`

**Problem:**
Identical helper function copy-pasted across 3 files. Maintenance burden and divergence risk.

**Expected:**
Extract to `apps/web/src/lib/auth.ts` (or a new `apps/web/src/lib/require-super-admin.ts`):

```typescript
export async function requireSuperAdmin() {
  // ... shared implementation
}
```

Import in all 3 routes.

**Verification:**

- [ ] Single source of truth for `requireSuperAdmin`
- [ ] All 3 routes import from shared location
- [ ] Auth behavior unchanged
- [ ] Typecheck passes

**Status:** [ ] Fixed

---

### 19. [MEDIUM] User Count Fetches ALL Rows to Count

**Issue ID:** FIX-E11-M06
**Story:** 11.3

**Location:**
- `apps/web/src/app/api/super-admin/tenants/route.ts:86-101`
- `apps/web/src/app/super-admin/tenants/page.tsx:32-47`

**Problem:**
Fetches ALL user rows (`.select("tenant_id")`) and counts in JavaScript. With thousands of users, this loads all rows into memory.

**Expected:**
Use a database-level count approach. For the API route, consider a single query with grouping or individual count queries per tenant:

```typescript
// Per-tenant count using head: true
for (const tenantId of tenantIds) {
  const { count } = await serviceClient
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
}
```

Or better, a single SQL function/view for aggregation.

**Verification:**

- [ ] User counts still display correctly
- [ ] No full table scan on `users`
- [ ] Performance acceptable with 1000+ users

**Status:** [ ] Fixed

---

### 20. [MEDIUM] Dashboard Client Has No Error State

**Issue ID:** FIX-E11-M07
**Story:** 11.7

**Location:** `apps/web/src/components/super-admin/global-dashboard-client.tsx:87`

**Problem:**
If the `useQuery` fails, `isLoading` becomes false and `data` remains undefined. The check `isLoading || !data` shows skeleton forever. No error state shown to user.

**Expected:**
```typescript
const { data, isLoading, isError } = useQuery(...)

if (isError) return <ErrorState message="Falha ao carregar dashboard." />
if (isLoading || !data) return <DashboardSkeleton />
```

**Verification:**

- [ ] Network error shows error message (not infinite skeleton)
- [ ] Successful load still works
- [ ] Typecheck passes

**Status:** [ ] Fixed

---

### 21. [MEDIUM] Tenant List Silent Failure on Fetch Error

**Issue ID:** FIX-E11-M08
**Story:** 11.3

**Location:** `apps/web/src/components/super-admin/tenant-list-client.tsx:89`

**Problem:**
`if (!res.ok) return` — error is completely swallowed. No toast, no console error, no user feedback.

**Expected:**
```typescript
if (!res.ok) {
  console.error("[tenant-list] Fetch failed:", res.status)
  // Optionally show a toast or set an error state
  return
}
```

**Verification:**

- [ ] Failed fetch shows user feedback (toast or error state)
- [ ] Console logs the error for debugging
- [ ] Successful fetch still works

**Status:** [ ] Fixed

---

### 22. [MEDIUM] Race Conditions — No AbortController on Filter Changes

**Issue ID:** FIX-E11-M09
**Story:** 11.3, 11.7

**Location:**
- `apps/web/src/components/super-admin/audit-log-client.tsx:110-123`
- `apps/web/src/components/super-admin/tenant-list-client.tsx:77-103`

**Problem:**
No `AbortController` used in fetch calls. Rapid filter changes fire multiple concurrent requests. Older responses may arrive after newer ones, overwriting fresh data with stale data.

**Expected:**
Add `AbortController` pattern:

```typescript
const abortRef = useRef<AbortController | null>(null)

const fetchData = useCallback(async () => {
  abortRef.current?.abort()
  abortRef.current = new AbortController()
  try {
    const res = await fetch(url, { signal: abortRef.current.signal })
    // ...
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return
    // handle real errors
  }
}, [deps])
```

**Verification:**

- [ ] Rapid filter changes do not cause stale data display
- [ ] Aborted requests do not trigger error states
- [ ] Normal usage still works

**Status:** [ ] Fixed

---

### 23. [MEDIUM] `max_interactions_per_session` Validator Cap (5) vs DB Default (20)

**Issue ID:** FIX-E11-M10
**Story:** 11.5

**Location:**
- `packages/shared/src/validators/whitelabel.ts:42,64` — `.max(5)`
- `supabase/migrations/20260207000000_initial_schema.sql:105` — `DEFAULT 20`

**Problem:**
Zod validator caps at 5, but DB default and system constant both say 20. No one can configure more than 5 interactions via the API.

**Expected:**
Align the validator with the system limits:
```typescript
max_interactions_per_session: z.number().int().min(1).max(20).optional(),
```

**Verification:**

- [ ] Values 1-20 accepted by validator
- [ ] Value 21+ rejected
- [ ] Matches DB default and system constant

**Status:** [ ] Fixed

---

### 24. [MEDIUM] `ai_model` Accepts Arbitrary Strings

**Issue ID:** FIX-E11-M11
**Story:** 11.5

**Location:** `apps/web/src/app/(platform)/admin/settings/actions.ts:21`

**Problem:**
```typescript
ai_model: z.string().min(1).optional()
```
Accepts any non-empty string. Should use enum of allowed models.

**Expected:**
```typescript
ai_model: z.enum(["gpt-4o", "gpt-4o-mini", "claude-sonnet-4-20250514", "claude-haiku-4-20250514"]).optional()
```

**Verification:**

- [ ] Only allowed model names accepted
- [ ] Invalid model names rejected with clear error
- [ ] Settings form dropdown values match validator enum

**Status:** [ ] Fixed

---

### 25. [MEDIUM] Super Admin Cannot Use Whitelabel/Settings Actions (tenant_id=null)

**Issue ID:** FIX-E11-M12
**Story:** 11.4, 11.5

**Location:**
- `apps/web/src/app/(platform)/admin/settings/whitelabel-actions.ts:49`
- `apps/web/src/app/(platform)/admin/settings/actions.ts:91`

**Problem:**
Both server actions use `.eq("id", profile.tenant_id)` for the update query. For super admins, `tenant_id` is null, so the query matches nothing and silently fails.

**Expected:**
For super admins in tenant context, resolve tenant from the active tenant cookie:

```typescript
const tenantId = profile.role === "super_admin"
  ? await getActiveTenant()
  : profile.tenant_id

if (!tenantId) return { error: "Tenant context required" }

// Use tenantId in query
.eq("id", tenantId)
```

Apply to both `whitelabel-actions.ts` and `actions.ts`.

**Verification:**

- [ ] Super admin in tenant context can save settings
- [ ] Super admin in tenant context can save whitelabel config
- [ ] Regular admin still works as before
- [ ] Super admin without tenant context gets clear error

**Status:** [ ] Fixed

---

### 26. [MEDIUM] Import Path `(super-admin)` May Not Match Directory

**Issue ID:** FIX-E11-M13
**Story:** 11.4

**Location:**
- `apps/web/src/components/super-admin/tenant-list-client.tsx:19`
- `apps/web/src/components/super-admin/tenant-detail-tabs.tsx:36`
- `apps/web/src/components/layout/tenant-context-badge.tsx:3`

**Problem:**
These files import from `@/app/(super-admin)/tenants/actions`. Verify that the route group uses parentheses `(super-admin)` — if the actual directory is `super-admin` (no parens), these imports will fail at build time.

**Expected:**
Verify the actual directory name and align imports. Based on file listing, the directory appears to be `apps/web/src/app/super-admin/` (no parentheses). If so, fix imports:

```typescript
import { switchToTenantContext } from "@/app/super-admin/tenants/actions"
```

**Verification:**

- [ ] Imports resolve correctly
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run build` succeeds

**Status:** [ ] Fixed

---

### 27. [MEDIUM] ilike Search Sanitization Incomplete

**Issue ID:** FIX-E11-M14
**Story:** 11.3

**Location:** `apps/web/src/app/api/super-admin/tenants/route.ts:45,69`

**Problem:**
Search sanitization strips `%_,.()` but not backslash (`\`) or other special characters. The value is string-interpolated into a PostgREST filter.

**Expected:**
Use a stricter allowlist:
```typescript
const search = rawSearch ? rawSearch.replace(/[^a-zA-Z0-9\s-]/g, "").trim() : null
```

**Verification:**

- [ ] Normal search terms work (letters, numbers, spaces, hyphens)
- [ ] Special characters stripped
- [ ] No injection possible via search field

**Status:** [ ] Fixed

---

### 28. [MEDIUM] Middleware Returns JSON 403 for Page Routes

**Issue ID:** FIX-E11-M15
**Story:** 11.2

**Location:** `apps/web/src/middleware.ts:128-133`

**Problem:**
Non-super_admin users accessing `/super-admin/*` pages get a JSON `{ error: "Forbidden" }` response instead of a redirect. Poor UX and leaks route existence.

**Expected:**
```typescript
if (pathname.startsWith("/super-admin") && userRole !== "super_admin") {
  if (!user) return NextResponse.redirect(new URL("/login", request.url))
  return NextResponse.redirect(new URL("/dashboard", request.url))
}
```

**Verification:**

- [ ] Authenticated non-super_admin redirected to /dashboard (not JSON 403)
- [ ] Unauthenticated users redirected to /login
- [ ] Super admin can still access /super-admin routes

**Status:** [ ] Fixed

---

### 29. [MEDIUM] Unused Badge Import in Tenant Context Badge

**Issue ID:** FIX-E11-M16
**Story:** 11.4

**Location:** `apps/web/src/components/layout/tenant-context-badge.tsx:4`

**Problem:**
`Badge` is imported from `@eximia/ui` but never used in the component. Will trigger lint warning.

**Expected:**
Remove unused import.

**Verification:**

- [ ] No unused imports
- [ ] Lint passes

**Status:** [ ] Fixed

---

## Constraints

**CRITICAL: @dev deve seguir estas restricoes:**

- [ ] Fix ONLY the issues listed above
- [ ] Do NOT add new features
- [ ] Do NOT refactor unrelated code
- [ ] Run typecheck: `pnpm run typecheck` (deve passar — 0 errors)
- [ ] Run lint: `pnpm run lint` (0 errors em todos os packages)
- [ ] Run tests: `pnpm run test` (todos passando)
- [ ] Update story file list if any new files created

---

## Prioridade de Execucao

Ordem recomendada para maxima eficiencia:

**Wave 1 — Migrations (C01, C02, C03, H06, H07):**
Fix the migration chain first since everything depends on it.

**Wave 2 — Security (H01, H08, H09, H10, M01, M02):**
Security issues that affect production safety.

**Wave 3 — Data/Logic (H02, H03, H04, H05, M03, M04, M12, M13):**
Functional correctness — dashboard, audit, auth, imports.

**Wave 4 — Quality (M05, M06, M07, M08, M09, M10, M11, M14, M15, M16):**
Code quality, performance, UX improvements.

---

## After Fixing

1. Mark each issue as fixed in this document
2. Run full validation: `pnpm run lint && pnpm run typecheck && pnpm run test`
3. Request QA re-review: `@qa *review epic-11`

---

_Generated by Quinn (Test Architect) — AIOS QA System_
