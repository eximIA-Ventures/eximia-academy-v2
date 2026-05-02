# QA Fix Request: Epic 18 — Round 2 (Post-Fix Re-Review)

**Generated:** 2026-02-15T23:00:00Z
**QA Report Source:** Re-review of all uncommitted Epic 18 changes after Round 1 fixes
**Reviewer:** Quinn (Test Architect)

---

## Instructions for @dev

Fix ONLY the issues listed below. Do not add features or refactor unrelated code.

**Process:**

1. Read each issue carefully
2. Fix the specific problem described
3. Verify using the verification steps provided
4. Mark the issue as fixed in this document
5. Run `pnpm typecheck` before marking complete

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| HIGH | 3 | All fixed |
| MEDIUM | 1 | All fixed |

---

## Issues to Fix

### 1. [HIGH] Native `<button>` instead of `Button` from @eximia/ui

**Issue ID:** FIX-E18-R2-001

**Location:** `apps/web/src/components/analytics/alert-attention-list.tsx` (lines 82-89)

**Problem:**
Native `<button>` with manual styling for "Ver todos" toggle. Design system mandate: *"All UI must use components from @eximia/ui. Never create ad-hoc HTML/CSS for elements that already exist in the library."*

```tsx
<button
  type="button"
  onClick={() => setShowAll(true)}
  className="w-full rounded-md bg-bg-surface py-2 text-center text-sm text-text-secondary hover:text-text-primary"
>
  Ver todos ({alerts.length - 5} restantes)
</button>
```

**Expected:**

```tsx
import { Button } from "@eximia/ui"
// ...
<Button variant="ghost" className="w-full" onClick={() => setShowAll(true)}>
  Ver todos ({alerts.length - 5} restantes)
</Button>
```

**Verification:**
- [ ] Native `<button>` replaced with `Button` from `@eximia/ui`
- [ ] `Button` added to import statement
- [ ] Toggle functionality preserved

**Status:** [x] Fixed

---

### 2. [HIGH] Dead code — trend prop always `undefined`

**Issue ID:** FIX-E18-R2-002

**Location:** `apps/web/src/components/analytics/summary-cards-row.tsx` (line 18)

**Problem:**
Ternary expression where both branches return `undefined`, making it dead code:

```tsx
trend={summary.deltaDepth != null ? undefined : undefined}
```

This was likely intended to compute a trend for the "Sessoes Ativas" card (similar to "Profundidade Media" on lines 24-32), but the logic was never implemented. The `AggregateSummary` type does not have a `deltaSessions` field, so no trend data exists for this card.

**Expected:**
Remove the dead prop entirely:

```tsx
<StatCard
  icon={<Activity size={20} />}
  label="Sessoes Ativas"
  value={summary.totalSessions}
/>
```

**Verification:**
- [ ] Dead `trend` prop removed from first StatCard
- [ ] No runtime behavior change (prop was already always undefined)

**Status:** [x] Fixed

---

### 3. [HIGH] Index-only `key` on alerts list with expand/collapse

**Issue ID:** FIX-E18-R2-003

**Location:** `apps/web/src/components/analytics/alert-attention-list.tsx` (line 59)

**Problem:**
`key={i}` on a list that toggles between `alerts.slice(0, 5)` and the full `alerts` array. When `showAll` changes from `false` to `true`, React reuses DOM nodes by index, which can cause visual glitches during transitions (stale CSS states, animation mismatches). The `AnalyticsAlert` type has `studentId` and `type` fields that can form a composite key.

```tsx
{visibleAlerts.map((alert, i) => (
  <div key={i} ...>
```

**Expected:**

```tsx
{visibleAlerts.map((alert) => (
  <div key={`${alert.studentId}-${alert.type}`} ...>
```

Also fix `gestor-recommendations.tsx` line 25 which uses `key={i}` on a static list. Use the recommendation message as key since each is unique:

```tsx
{recommendations.map((rec) => (
  <div key={rec.message} ...>
```

**Verification:**
- [ ] `alert-attention-list.tsx` uses composite key `${alert.studentId}-${alert.type}`
- [ ] `gestor-recommendations.tsx` uses `rec.message` as key
- [ ] Unused `i` parameter removed from `.map()` callback

**Status:** [x] Fixed

---

### 4. [MEDIUM] `select("*")` in sessions API route

**Issue ID:** FIX-E18-R2-004

**Location:** `apps/web/src/app/api/analytics/sessions/[sessionId]/route.ts` (line 58-59)

**Problem:**
The sessions API route still uses `select("*")` which was the same pattern fixed in the students route (FIX-E18-002). While this is a single-row fetch by PK+tenant, it still exposes all columns including future additions.

```typescript
.select(
  "*, chapters(id, title, courses(id, title))",
)
```

**Expected:**
Replace with explicit column list matching fields actually used:

```typescript
.select(
  "id, student_id, analytics, created_at, turn_number, status, chapter_id, chapters(id, title, courses(id, title))",
)
```

**Verification:**
- [ ] `select("*")` replaced with explicit columns
- [ ] All fields used downstream are included
- [ ] Typecheck passes

**Status:** [x] Fixed

---

## Excluded from this request

| Issue | Severity | Reason |
|-------|----------|--------|
| Hardcoded hex/rgba in chart components | HIGH | Documented as tech debt — Recharts requires inline values and design system lacks opacity-aware tokens |
| Secondary queries lack error destructuring in sessions route | LOW | Graceful fallbacks mitigate; non-blocking |
| Users queries lack explicit tenant_id in helpers | LOW | RLS mitigates; non-blocking |

---

## Constraints

- [ ] Fix ONLY the issues listed above
- [ ] Do NOT add new features
- [ ] Do NOT refactor unrelated code
- [ ] Run `pnpm typecheck` before marking complete

---

## After Fixing

1. Mark each issue as fixed in this document
2. Request QA re-review: `@qa *code-review`

---

_Generated by Quinn (Test Architect) - AIOS QA System_
