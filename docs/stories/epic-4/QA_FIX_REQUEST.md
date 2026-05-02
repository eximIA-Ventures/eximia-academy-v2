# QA Fix Request — Epic 4: Dashboards & Analytics

**QA Agent:** Quinn (Test Architect)
**Review Date:** 2026-02-08
**Stories:** 4.1 (Student), 4.2 (Teacher), 4.3 (Manager)
**Verdict:** CONCERNS — Functionally complete but critical findings block merge
**Composite Test Score:** 52/100

---

## P0 — CRITICAL (Must fix before merge)

### FIX-01: Admin/unknown role fallback renders student-scoped data
- **File:** `apps/web/src/app/(platform)/dashboard/page.tsx` lines 85-155
- **Problem:** When `profile.role` is not `student`, `teacher`, or `manager` (e.g., `admin` or unknown), the code falls through to a fallback that queries `sessions` filtered by `student_id = user.id` — returning misleading zero-count data for admins. Also defaults `tenant_id` to `""` if null.
- **Fix:** Add explicit `if (profile.role === "admin")` block with admin-appropriate data. Add `else` clause that redirects to error page or returns "role not recognized" UI.

### FIX-02: Zero error handling on ALL Supabase queries
- **Files:**
  - `apps/web/src/app/(platform)/dashboard/page.tsx` — ALL queries (lines 17-21, 164-536)
  - `apps/web/src/app/api/analytics/student/route.ts` — ALL queries
  - `apps/web/src/app/api/analytics/teacher/route.ts` — ALL queries
  - `apps/web/src/app/api/analytics/manager/route.ts` — ALL queries
- **Problem:** Every Supabase query destructures only `{ data }` or `{ count }`, ignoring the `error` field. Failed queries silently produce `null` data → dashboards show all zeros with no error indication. The `profile` query failure redirects to `/login` even for authenticated users (DB error ≠ unauthenticated).
- **Fix:** Destructure `{ data, error }` from every query. On error, log server-side and either throw (trigger `error.tsx` boundary) or return error state to the user.

### FIX-03: Fetch response status not checked in client components
- **Files:**
  - `apps/web/src/components/dashboard/teacher-dashboard-client.tsx` lines 52, 59
  - `apps/web/src/components/dashboard/manager-dashboard-client.tsx` line 54
- **Problem:** `fetch(...).then((r) => r.json())` does not check `r.ok`. API 4xx/5xx responses are silently parsed as if they were valid analytics data (e.g., `{ error: "Unauthorized" }` used as chart data).
- **Fix:** Add response status checking:
  ```typescript
  queryFn: async () => {
    const r = await fetch(`/api/analytics/...`)
    if (!r.ok) throw new Error(`Analytics fetch failed: ${r.status}`)
    return r.json()
  }
  ```

---

## P1 — HIGH (Should fix before merge)

### FIX-04: N+1 query explosion in manager/teacher analytics
- **Files:**
  - `apps/web/src/app/(platform)/dashboard/page.tsx` lines 459-524 (manager), 329-362 (teacher)
  - `apps/web/src/app/api/analytics/manager/route.ts` lines 127-201
  - `apps/web/src/app/api/analytics/teacher/route.ts` lines 79-198
- **Problem:** For each course: 3-4 sequential queries. Teacher with 10 courses + 50 students = ~230 queries. Manager with 100 courses = ~400 queries. This is a DoS vector.
- **Fix (minimum):** Batch queries — fetch all enrollments in one query, group in JS. Use Supabase joins where possible. Add pagination limit (e.g., max 50 courses per request).

### FIX-05: Duplicate auth + profile fetch (layout + page)
- **Files:**
  - `apps/web/src/app/(platform)/layout.tsx` lines 14-27
  - `apps/web/src/app/(platform)/dashboard/page.tsx` lines 10-24
- **Problem:** Layout fetches user + profile with `select("*, tenants(*)")`. Page does the same. Two redundant calls per page load.
- **Fix:** Use React `cache()` to memoize the auth/profile lookup, or pass data via RSC context.

### FIX-06: Duplicate type interfaces across files
- **Files:** Multiple dashboard components define the same interfaces:
  - `TeacherAnalytics` in `teacher-dashboard.tsx` AND `teacher-dashboard-client.tsx`
  - `ManagerAnalytics` in `manager-dashboard.tsx` AND `manager-dashboard-client.tsx`
  - `StudentMetric` in `course-metrics-table.tsx` AND `student-metrics-table.tsx`
  - `CourseTableRow` in `course-analytics-table.tsx` AND `csv-export-button.tsx`
- **Fix:** Create `apps/web/src/components/dashboard/types.ts` with all shared interfaces exported from one location.

### FIX-07: Hardcoded colors in engagement-chart.tsx
- **File:** `apps/web/src/components/dashboard/engagement-chart.tsx` lines 28-43
- **Problem:** 6 hardcoded hex/rgba values: `rgba(255,255,255,0.1)`, `#a0a0a0`, `#1e1e1e`, `#ffffff`, `#2a6ab0`. Design System mandate says zero hardcoded values.
- **Fix:** Extract into a `CHART_THEME` constant referencing design tokens. For Recharts JS values, use CSS variable fallback pattern or explicit token constants with comments.

### FIX-08: Accessibility gaps (WCAG AA)
- **Files & Issues:**
  - `course-metrics-table.tsx:102` — Interactive `<tr>` missing `tabIndex={0}`, `role="button"`, `aria-expanded`
  - `manager-dashboard-client.tsx:66` — `<select>` missing `aria-label`
  - `ai-detection-badge.tsx:28` — Tooltip keyboard-inaccessible, no `aria-describedby`
  - `period-filter.tsx:16` — Missing `role="group"`, `aria-label`, `aria-pressed`
  - `summary-cards.tsx:21` — Decorative icons missing `aria-hidden="true"`
  - `enrolled-course-card.tsx:40` — "Continuar" link missing contextual `aria-label`

---

## P2 — MEDIUM (Fix in next sprint if not now)

### FIX-09: Missing test files — 5 components with zero tests
- **Components without tests:**
  - `enrolled-course-card.tsx` — Test progress bar, CTA href, relative dates
  - `recent-sessions-list.tsx` — Test empty array, "Em andamento", date formatting
  - `student-metrics-table.tsx` — Test AI badge conditional, null lastActivity fallback
  - `teacher-dashboard-client.tsx` — Test period filter refetch, expand course query
  - `manager-dashboard-client.tsx` — Test filter state, URL params, refetch behavior

### FIX-10: Missing API route tests (CRITICAL gap)
- **Routes without tests:**
  - `/api/analytics/student/route.ts`
  - `/api/analytics/teacher/route.ts`
  - `/api/analytics/manager/route.ts`
- **Required test scenarios:** 401 unauthenticated, 403 wrong role, correct response shape, period filtering, optional courseId, empty results

### FIX-11: CSV export test does not verify CSV content
- **File:** `__tests__/csv-export-button.test.tsx`
- **Problem:** Only asserts `URL.createObjectURL` was called. Does NOT verify Blob content, headers, AI detection column presence/absence, or download filename. The "with AI" and "without AI" tests are functionally identical.
- **Fix:** Capture `Blob` constructor arg and assert actual CSV string content.

### FIX-12: PostHog audit event untested
- **File:** `csv-export-button.tsx` lines 44-54
- **Problem:** Story 4.3 AC7 requires `analytics_csv_exported` event — never mocked or asserted in tests.
- **Fix:** Mock `posthog-js` and assert `capture()` is called with correct metadata.

### FIX-13: Test isolation issues
- **Shared `QueryClient`** in `teacher-dashboard.test.tsx` and `manager-dashboard.test.tsx` — create in `beforeEach`
- **Global mock mutation** in `csv-export-button.test.tsx` — cleanup in `afterEach`
- **Silent `if` guards** in `ai-detection-badge.test.tsx` — replace with explicit assertions

### FIX-14: Unsafe type casts throughout
- **Files:**
  - `dashboard/page.tsx` — Multiple `as unknown as` casts (lines 41-43, 195, 259, 499-506)
  - `ai-detection-badge.tsx:25` — `verdict as Verdict`
  - `dual-mode-labels.ts:21` — `mode as TenantMode`
  - `course-metrics-table.tsx:121` — `status as "draft" | "published" | "archived"`
- **Fix:** Define proper typed interfaces at source. Generate Supabase types with `supabase gen types typescript`.

### FIX-15: AI detection feature flag logic duplicated
- **File:** `dashboard/page.tsx` lines 40-43, 60-63
- **Fix:** Extract into `isFeatureEnabled(settings, 'ai_detection'): boolean` utility.

### FIX-16: Manager courses fetched twice
- **File:** `dashboard/page.tsx` lines 69-72 AND 454-457
- **Fix:** Fetch once and pass into `fetchManagerAnalytics`, or return course list from analytics function.

### FIX-17: Sequential queries that could be parallelized
- **File:** `dashboard/page.tsx` lines 32-50 (teacher), 54-82 (manager)
- **Fix:** Use `Promise.all` for independent queries (analytics + tenant settings).

### FIX-18: Layout over-fetches with `SELECT *`
- **File:** `apps/web/src/app/(platform)/layout.tsx` line 25
- **Fix:** Replace `.select("*, tenants(*)")` with `.select("full_name, role, tenant_id, tenants(id, name, slug, mode, branding, settings)")`.

### FIX-19: Unused `useState` import
- **File:** `apps/web/src/components/dashboard/course-metrics-table.tsx` line 5
- **Fix:** Remove `import { useState } from "react"`.

---

## P3 — LOW (Nice to have)

### FIX-20: `permanentRedirect` in analytics/page.tsx
- Use `redirect` (307) instead of `permanentRedirect` (308) to avoid permanent browser caching.

### FIX-21: Missing `loading.tsx` skeleton
- Add `apps/web/src/app/(platform)/dashboard/loading.tsx` for instant visual feedback.

### FIX-22: Date mutation in week calculation
- Replace manual ISO week calculation with `date-fns` `startOfISOWeek()` — both in `page.tsx:442-445` and `manager/route.ts:107-113`.

### FIX-23: Welcome banner duplicated across 3 dashboards
- Extract shared `WelcomeBanner` component from `student-dashboard.tsx:95-110`, `teacher-dashboard.tsx:73-91`, `manager-dashboard.tsx:80-98`.

### FIX-24: 537-line page.tsx file
- Extract `fetchStudentAnalytics`, `fetchTeacherAnalytics`, `fetchManagerAnalytics` into `lib/analytics/` directory.

### FIX-25: Edge case tests missing
- StatusBadge `size="md"` variant
- AiDetectionBadge `likely_ai` verdict
- CourseMetricsTable click-to-expand interaction + keyboard navigation
- EngagementChart with empty data
- SummaryCards with empty items array

---

## Remediation Priority Order

| Phase | Fixes | Estimated Effort |
|-------|-------|------------------|
| **Phase 1 (Blocker)** | FIX-01, FIX-02, FIX-03 | ~2h |
| **Phase 2 (High)** | FIX-04, FIX-05, FIX-06, FIX-07, FIX-08 | ~4h |
| **Phase 3 (Tests)** | FIX-09, FIX-10, FIX-11, FIX-12, FIX-13 | ~4h |
| **Phase 4 (Quality)** | FIX-14 thru FIX-19 | ~3h |
| **Phase 5 (Polish)** | FIX-20 thru FIX-25 | ~2h |

---

## Handoff Notes for @dev (Dex)

1. **Start with Phase 1** — FIX-01 through FIX-03 are merge blockers. No code should ship without error handling.
2. **FIX-04 (N+1)** is the biggest performance risk — consider at minimum adding a `LIMIT 50` on the courses loop and a TODO for proper batching.
3. **FIX-10 (API route tests)** is the largest testing gap — create tests with mocked Supabase client testing auth, authz, and response contracts.
4. All fixes should maintain existing test suite passing (45/45 tests).
5. Run `npx biome check ./src` after all changes to ensure lint compliance.

---

*Generated by Quinn — QA Test Architect Agent*
*Synkra AIOS v2.0*
