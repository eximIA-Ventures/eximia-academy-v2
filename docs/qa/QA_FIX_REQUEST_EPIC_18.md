# QA Fix Request: Epic 18 (Analytics & Output Analitico Avancado)

**Generated:** 2026-02-15T22:00:00Z
**QA Report Source:** Code Review — uncommitted changes (40 files, 1105+ insertions)
**Reviewer:** Quinn (Test Architect)

---

## Instructions for @dev

Fix ONLY the issues listed below. Do not add features or refactor unrelated code.

**Process:**

1. Read each issue carefully
2. Fix the specific problem described
3. Verify using the verification steps provided
4. Mark the issue as fixed in this document
5. Run all tests before marking complete

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 4 | All fixed |
| HIGH | 8 | All fixed |
| MEDIUM | 0 | Not included (use `--include-minor` to add) |

---

## Issues to Fix

### 1. [CRITICAL] Tenant isolation missing on sub-queries in aggregate API

**Issue ID:** FIX-E18-001

**Location:** `apps/web/src/app/api/analytics/aggregate/route.ts` (lines ~85-114)

**Problem:**
The `chapters` and `courses` sub-queries for `courseId` / `areaId` filters lack `.eq("tenant_id", tenantId)`. Security relies entirely on RLS — if RLS is disabled for debugging or a migration, these queries leak cross-tenant data. Inconsistent with the main sessions query which always includes tenant filter.

```typescript
// Current — NO tenant filter on sub-queries
if (courseId) {
  const { data: chapterIds } = await supabase
    .from("chapters")
    .select("id")
    .eq("course_id", courseId)
}
if (areaId) {
  const { data: courses } = await supabase
    .from("courses")
    .select("id")
    .eq("area_id", areaId)
}
```

**Expected:**

```typescript
if (courseId) {
  const { data: chapterIds } = await supabase
    .from("chapters")
    .select("id")
    .eq("course_id", courseId)
    .eq("tenant_id", tenantId)
}
if (areaId) {
  const { data: courses } = await supabase
    .from("courses")
    .select("id")
    .eq("area_id", areaId)
    .eq("tenant_id", tenantId)
}
```

**Verification:**
- [ ] `.eq("tenant_id", tenantId)` added to chapters sub-query
- [ ] `.eq("tenant_id", tenantId)` added to courses sub-query (area filter)
- [ ] Pattern matches main sessions query

**Status:** [x] Fixed

---

### 2. [CRITICAL] `select("*")` on learner_profiles exposes entire row

**Issue ID:** FIX-E18-002

**Location:** `apps/web/src/app/api/analytics/students/[studentId]/route.ts` (line ~65)

**Problem:**
Using `select("*")` fetches every column from `learner_profiles`, including any future internal columns. The code only maps specific fields downstream, but the full row is in memory and could be logged or exposed through error serialization.

```typescript
const { data: lpData } = await supabase
  .from("learner_profiles")
  .select("*")
  .eq("student_id", studentId)
  .eq("tenant_id", tenantId)
  .single()
```

**Expected:**
Replace with explicit column list matching the fields actually used:

```typescript
const { data: lpData } = await supabase
  .from("learner_profiles")
  .select("engagement_style, detail_orientation, reasoning_style, avg_depth_achieved, avg_qa_score, confidence, comprehension_trend, kolb_grasping_axis, kolb_transforming_axis, kolb_dominant_style, kolb_style_confidence, strengths, growth_areas, adaptation_hints, preferred_question_types, summary, session_count")
  .eq("student_id", studentId)
  .eq("tenant_id", tenantId)
  .single()
```

**Verification:**
- [ ] `select("*")` replaced with explicit column list
- [ ] All fields used downstream are included in the select
- [ ] Typecheck passes

**Status:** [x] Fixed

---

### 3. [CRITICAL] Stale closure on queryParams in analytics-dashboard

**Issue ID:** FIX-E18-003

**Location:** `apps/web/src/components/analytics/analytics-dashboard.tsx` (lines ~36-48)

**Problem:**
`queryParams` is constructed at render time outside `queryFn`. The closure may capture stale values if React batches state updates. The `queryParams` object is built fresh every render but can diverge from `queryKey` array values.

```typescript
const queryParams = new URLSearchParams({ period })
if (courseId) queryParams.set("courseId", courseId)
if (areaId) queryParams.set("areaId", areaId)

const { data } = useQuery<AggregateAnalyticsResponse>({
  queryKey: ["analytics-aggregate", period, courseId, areaId],
  queryFn: async () => {
    const r = await fetch(`/api/analytics/aggregate?${queryParams.toString()}`)
    // ...
  },
  initialData,
})
```

**Expected:**
Move `queryParams` construction inside `queryFn`:

```typescript
const { data } = useQuery<AggregateAnalyticsResponse>({
  queryKey: ["analytics-aggregate", period, courseId, areaId],
  queryFn: async () => {
    const params = new URLSearchParams({ period })
    if (courseId) params.set("courseId", courseId)
    if (areaId) params.set("areaId", areaId)
    const r = await fetch(`/api/analytics/aggregate?${params.toString()}`)
    // ...
  },
  initialData,
})
```

**Verification:**
- [ ] `URLSearchParams` construction moved inside `queryFn`
- [ ] Outer `queryParams` variable removed
- [ ] Filters still work correctly (period, course, area)

**Status:** [x] Fixed

---

### 4. [CRITICAL] SVG gradient ID collision — emotionalGradient hardcoded

**Issue ID:** FIX-E18-004

**Location:** `apps/web/src/components/analytics/emotional-journey-chart.tsx` (line ~46)

**Problem:**
`<linearGradient id="emotionalGradient">` uses a hardcoded DOM ID. If this component is ever rendered more than once on the same page (e.g., in dashboard alongside other charts), the SVG references the wrong gradient definition.

```tsx
<linearGradient id="emotionalGradient" x1="0" y1="0" x2="0" y2="1">
// ...
fill="url(#emotionalGradient)"
```

**Expected:**
Use `React.useId()` for unique ID:

```tsx
const gradientId = useId()
// ...
<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
// ...
fill={`url(#${gradientId})`}
```

**Verification:**
- [ ] `useId()` imported from React and used for gradient ID
- [ ] `id` and `url(#...)` reference both use the dynamic ID
- [ ] Component renders correctly when mounted once and multiple times

**Status:** [x] Fixed

---

### 5. [HIGH] No UUID validation on URL/query parameters — all 3 API routes

**Issue ID:** FIX-E18-005

**Location:**
- `apps/web/src/app/api/analytics/students/[studentId]/route.ts` (line ~20)
- `apps/web/src/app/api/analytics/sessions/[sessionId]/route.ts` (line ~18)
- `apps/web/src/app/api/analytics/aggregate/route.ts` (lines ~69-70, courseId/areaId)

**Problem:**
`studentId`, `sessionId`, `courseId`, and `areaId` are extracted from URL/query params without UUID format validation. Malformed values generate unnecessary DB queries and may return unpredictable error formats.

**Expected:**
Add UUID validation at the top of each route handler:

```typescript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// For path params:
if (!UUID_RE.test(studentId)) {
  return NextResponse.json({ error: "Invalid student ID" }, { status: 400 })
}

// For optional query params:
if (courseId && !UUID_RE.test(courseId)) {
  return NextResponse.json({ error: "Invalid course ID" }, { status: 400 })
}
```

**Verification:**
- [ ] UUID regex validation added to `students/[studentId]/route.ts`
- [ ] UUID regex validation added to `sessions/[sessionId]/route.ts`
- [ ] UUID regex validation added for `courseId` and `areaId` in `aggregate/route.ts`
- [ ] Returns 400 with generic error message for invalid IDs

**Status:** [x] Fixed

---

### 6. [HIGH] Database errors silently swallowed — all 3 API routes + RSC pages

**Issue ID:** FIX-E18-006

**Location:**
- `apps/web/src/app/api/analytics/aggregate/route.ts` (line ~117)
- `apps/web/src/app/api/analytics/students/[studentId]/route.ts` (line ~71)
- `apps/web/src/app/api/analytics/sessions/[sessionId]/route.ts` (line ~49)
- `apps/web/src/app/(platform)/analytics/page.tsx` (lines ~46-55)

**Problem:**
Supabase returns `{ data, error }`. All routes destructure only `{ data }` — `error` is never checked. RLS failures, network issues, and permission errors are silently treated as "no results."

```typescript
const { data: sessions } = await sessionsQuery
// error is discarded — if non-null, data is null and treated as empty
```

**Expected:**
Check `error` on critical queries:

```typescript
const { data: sessions, error: sessionsError } = await sessionsQuery
if (sessionsError) {
  console.error("Failed to fetch sessions:", sessionsError.message)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}
```

For RSC pages, log the error and render an appropriate error state or throw.

**Verification:**
- [ ] `error` destructured and checked in aggregate route (main sessions query at minimum)
- [ ] `error` destructured and checked in students route (learner_profiles + sessions)
- [ ] `error` destructured and checked in sessions route (session fetch)
- [ ] Returns 500 with generic message on DB error
- [ ] RSC pages log errors for key queries

**Status:** [x] Fixed

---

### 7. [HIGH] Rate limiting silently disabled without Redis

**Issue ID:** FIX-E18-007

**Location:** `apps/web/src/lib/rate-limit.ts` (lines ~4-12, 27)

**Problem:**
`createLimiter` returns `null` when Redis env vars (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) are missing. All API routes skip rate limiting when limiter is null — silently open to abuse in any environment without Redis.

**Expected:**
In production, either fail hard or apply a fallback. At minimum, return 503 when limiter is null in production:

```typescript
// In each API route:
if (!analyticsAggregateLimiter) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 })
  }
  // In development, skip rate limiting (acceptable)
} else {
  const { success } = await analyticsAggregateLimiter.limit(key)
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })
}
```

**Verification:**
- [ ] Production environment returns 503 when limiter is null
- [ ] Development environment still works without Redis
- [ ] Rate limiting logic unchanged when Redis is configured

**Status:** [x] Fixed

---

### 8. [HIGH] `tenant_id as string` without null guard on analytics RSC pages

**Issue ID:** FIX-E18-008

**Location:**
- `apps/web/src/app/(platform)/analytics/page.tsx` (line ~41)
- `apps/web/src/app/(platform)/analytics/students/[studentId]/page.tsx` (line ~18)
- `apps/web/src/app/(platform)/analytics/sessions/[sessionId]/page.tsx` (line ~21)

**Problem:**
`super_admin` has `tenant_id = NULL`. If the role guard is extended later and someone forgets to add the new role, `as string` silently passes null.

```typescript
const tenantId = profile.tenant_id as string
```

**Expected:**

```typescript
if (!profile.tenant_id) redirect("/dashboard")
const tenantId = profile.tenant_id
```

**Verification:**
- [ ] Null guard added before `as string` cast on all 3 pages
- [ ] Redirect to `/dashboard` when tenant_id is null

**Status:** [x] Fixed

---

### 9. [HIGH] Native `<select>` instead of `Select` from @eximia/ui

**Issue ID:** FIX-E18-009

**Location:** `apps/web/src/components/analytics/analytics-dashboard.tsx` (lines ~58-86)

**Problem:**
Two native `<select>` elements used for course and area filters. Design system mandate: *"All UI must use components from @eximia/ui. Never create ad-hoc HTML/CSS for elements that already exist in the library."*

**Expected:**
Replace with `Select` from `@eximia/ui`:

```tsx
import { Select } from "@eximia/ui"
```

**Verification:**
- [ ] Both `<select>` elements replaced with `Select` from `@eximia/ui`
- [ ] Filter functionality preserved
- [ ] Visual styling matches design system

**Status:** [x] Fixed

---

### 10. [HIGH] Native `<table>` instead of Table components from @eximia/ui

**Issue ID:** FIX-E18-010

**Location:**
- `apps/web/src/components/analytics/divergence-table.tsx`
- `apps/web/src/components/analytics/divergence-comparison-table.tsx`
- `apps/web/src/components/analytics/session-history-table.tsx`

**Problem:**
All visible tables use raw HTML `<table>`, `<thead>`, `<th>`, `<tbody>`, `<tr>`, `<td>` with manual styling. The design system provides `Table, TableHeader, TableBody, TableRow, TableHead, TableCell` from `@eximia/ui`.

**Expected:**

```tsx
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@eximia/ui"
```

**Verification:**
- [ ] `divergence-table.tsx` uses `@eximia/ui` Table components
- [ ] `divergence-comparison-table.tsx` uses `@eximia/ui` Table components
- [ ] `session-history-table.tsx` uses `@eximia/ui` Table components
- [ ] Visual styling consistent with design system

**Status:** [x] Fixed

---

### 11. [HIGH] Custom avatar instead of Avatar from @eximia/ui

**Issue ID:** FIX-E18-011

**Location:** `apps/web/src/components/analytics/student-profile-header.tsx` (lines ~31-41)

**Problem:**
Custom avatar implementation with manual `<img>` and initials fallback div. Design system provides `Avatar` with `src`, `alt`, `fallback`, and `size` props.

**Expected:**

```tsx
import { Avatar } from "@eximia/ui"
// ...
<Avatar src={header.avatarUrl} fallback={initials} size="lg" alt={header.fullName} />
```

**Verification:**
- [ ] Custom avatar code replaced with `Avatar` from `@eximia/ui`
- [ ] Initials fallback works when `avatarUrl` is null
- [ ] Image displays correctly when `avatarUrl` is present

**Status:** [x] Fixed

---

### 12. [HIGH] No loading or error states on React Query components

**Issue ID:** FIX-E18-012

**Location:**
- `apps/web/src/components/analytics/analytics-dashboard.tsx`
- `apps/web/src/components/analytics/student-profile-tabs.tsx`

**Problem:**
Both components use `useQuery` but only destructure `{ data }`. The `isLoading`, `isError`, `error` states are ignored. When filters change and refetch occurs, there is no loading indicator. If fetch fails, component silently falls back to `initialData`.

**Expected:**
Destructure loading/error states and render appropriate UI:

```tsx
const { data, isLoading, isError } = useQuery<AggregateAnalyticsResponse>({ ... })

// Show loading skeleton during refetch
if (isLoading) return <AnalyticsSkeleton />

// Show error state on failure
if (isError) return <ErrorCard message="Falha ao carregar dados" />
```

Use `Skeleton` from `@eximia/ui` for loading states if available, or a simple spinner/message.

**Verification:**
- [ ] `analytics-dashboard.tsx` shows loading state during refetch
- [ ] `analytics-dashboard.tsx` shows error state on fetch failure
- [ ] `student-profile-tabs.tsx` shows loading state during refetch
- [ ] `student-profile-tabs.tsx` shows error state on fetch failure

**Status:** [x] Fixed

---

## Constraints

**CRITICAL: @dev must follow these constraints:**

- [ ] Fix ONLY the issues listed above
- [ ] Do NOT add new features
- [ ] Do NOT refactor unrelated code
- [ ] Run type check before marking complete: `pnpm typecheck`
- [ ] Run linting before marking complete: `pnpm lint`
- [ ] Update story file lists if any new files created

---

## After Fixing

1. Mark each issue as fixed in this document
2. Request QA re-review: `@qa *code-review`

---

_Generated by Quinn (Test Architect) - AIOS QA System_
