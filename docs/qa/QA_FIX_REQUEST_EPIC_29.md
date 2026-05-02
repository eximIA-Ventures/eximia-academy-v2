# QA Fix Request: Epic 29 — Adaptive Learning & Assessments

**Generated:** 2026-03-01
**QA Report Source:** Full review of all uncommitted Epic 29 changes (6 stories, 16 new files, 3 modified)
**Reviewer:** Quinn (Test Architect)

---

## Instructions for @dev

Fix ONLY the issues listed below. Do not add features or refactor unrelated code.

**Process:**

1. Read each issue carefully
2. Fix the specific problem described
3. Verify using the verification steps provided
4. Mark the issue as fixed in this document: `- [x]`
5. Run `pnpm typecheck && pnpm --filter @eximia/web test` before marking complete

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 5 | Done |
| HIGH | 8 | Done |

**Note:** MEDIUM issues (12) are tracked as tech debt — not included here. C6 (pre-existing `jsonb_profile_merge` SECURITY DEFINER) excluded as it predates Epic 29.

---

## CRITICAL Issues

### 1. [CRITICAL] Server-side cooldown missing in Big Five submission

**Issue ID:** FIX-E29-001

- [x] Fixed

**Location:** `apps/web/src/app/(platform)/assessments/big-five/actions.ts`, function `submitBigFiveAssessment`

**Problem:** The 30-day cooldown is only checked client-side in `page.tsx`. The server action does not verify cooldown. A user can bypass the UI and call the server action directly via fetch/cURL to submit unlimited assessments.

**Fix:** Add cooldown check at the beginning of `submitBigFiveAssessment`, before the insert:

```typescript
// Check 30-day cooldown server-side
const { data: lastAssessment } = await supabase
  .from("assessment_history")
  .select("completed_at")
  .eq("user_id", user.id)
  .eq("assessment_type", "big_five")
  .order("completed_at", { ascending: false })
  .limit(1)
  .single()

if (lastAssessment?.completed_at) {
  const daysSince = Math.floor(
    (Date.now() - new Date(lastAssessment.completed_at).getTime()) / (1000 * 60 * 60 * 24),
  )
  if (daysSince < 30) {
    return { success: false, error: `Aguarde ${30 - daysSince} dias para refazer o assessment` }
  }
}
```

**Verification:** Attempt to call `submitBigFiveAssessment` twice in quick succession — second call should return error.

---

### 2. [CRITICAL] IDOR in DISC server actions — userId param without auth check

**Issue ID:** FIX-E29-002

- [x] Fixed

**Location:** `apps/web/src/app/(platform)/assessments/disc/actions.ts`, functions `getLastDiscDate`, `getDiscResult`, `checkDiscCooldown`

**Problem:** These exported server actions accept a `userId` parameter without verifying the caller is authorized. While RLS mitigates data access, the cooldown check can be bypassed by passing another user's ID (RLS returns null → appears no cooldown).

**Fix:** Remove `userId` parameter. Use `supabase.auth.getUser()` inside each function to get the authenticated user:

```typescript
export async function getLastDiscDate(): Promise<{ date: string | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { date: null, error: "Nao autenticado" }

  const { data } = await supabase
    .from("assessment_history")
    .select("completed_at")
    .eq("user_id", user.id) // Use authenticated user, not param
    .eq("assessment_type", "disc")
    .order("completed_at", { ascending: false })
    .limit(1)
    .single()

  return { date: data?.completed_at ?? null }
}
```

Apply same pattern to `getDiscResult` and `checkDiscCooldown`. Update callers in `page.tsx` to remove userId argument.

**Verification:** TypeCheck passes. Functions no longer accept userId parameter.

---

### 3. [CRITICAL] PII leakage — email fetched but never rendered in team profiles

**Issue ID:** FIX-E29-003

- [x] Fixed

**Location:** `apps/web/src/app/(platform)/team/profiles/actions.ts`

**Problem:** The `TeamMember` interface includes `email: string`, the Supabase query selects `email`, and it's mapped to the response. But `team-profiles-client.tsx` never renders email. The PII is unnecessarily serialized to the client.

**Fix:**

1. Remove `email` from `TeamMember` interface
2. Remove `email` from the `.select()` query (line ~171): change to `.select("id, full_name, job_role_id, profile")`
3. Remove `email: s.email ?? ""` from the mapping (line ~304)

**Verification:** `grep -n "email" apps/web/src/app/\(platform\)/team/profiles/actions.ts` returns no matches.

---

### 4. [CRITICAL] super_admin crashes on team profiles — tenant_id is NULL

**Issue ID:** FIX-E29-004

- [x] Fixed

**Location:** `apps/web/src/app/(platform)/team/profiles/actions.ts`, lines ~134-139

**Problem:** `super_admin` is allowed in the role check, but then `if (!callerProfile.tenant_id)` returns error. Since super_admin has `tenant_id = NULL`, they always hit the error. The page-level guard also allows super_admin, so they see a confusing error.

**Fix:** Remove `super_admin` from the role check in both `page.tsx` and `actions.ts`. This feature is tenant-scoped and doesn't make sense without a tenant:

In `page.tsx`:
```typescript
if (!profile || !["manager", "admin"].includes(profile.role)) {
```

In `actions.ts`:
```typescript
if (!callerProfile?.role || !["manager", "admin"].includes(callerProfile.role)) {
```

**Verification:** Confirm `super_admin` is not in the role arrays for team profiles.

---

### 5. [CRITICAL] IDOR in getAdaptationHints — no authorization check

**Issue ID:** FIX-E29-005

- [x] Fixed

**Location:** `apps/web/src/lib/assessments/adaptation-hints.ts`, function `getAdaptationHints`

**Problem:** Accepts any `userId` without verifying the caller is authorized. Any authenticated user can request adaptation hints for any other user, leaking personality profile data.

**Fix:** Add authorization guard after auth check:

```typescript
if (user.id !== userId) {
  const { data: callerProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()
  if (!callerProfile || !["admin", "super_admin"].includes(callerProfile.role)) {
    return { data: buildAdaptationHints({}), error: "Acesso negado" }
  }
}
```

**Verification:** Function rejects requests where `userId !== auth user` unless caller is admin/super_admin.

---

## HIGH Issues

### 6. [HIGH] Missing `role="radiogroup"` on Likert/answer containers

**Issue ID:** FIX-E29-006

- [x] Fixed

**Location:**
- `apps/web/src/app/(platform)/assessments/big-five/big-five-wizard-client.tsx` — Likert options container
- `apps/web/src/app/(platform)/assessments/disc/disc-wizard-client.tsx` — answer buttons container

**Problem:** Radio-style option groups lack `role="radiogroup"` and `aria-label`. Screen readers cannot identify them as cohesive input groups.

**Fix:** Add to the parent div of the radio options:

```tsx
<div className="..." role="radiogroup" aria-label="Selecione sua resposta">
```

**Verification:** Inspect the DOM — container div has `role="radiogroup"` and `aria-label`.

---

### 7. [HIGH] Error divs missing `role="alert"`

**Issue ID:** FIX-E29-007

- [x] Fixed

**Location:**
- `apps/web/src/app/(platform)/assessments/big-five/big-five-wizard-client.tsx` — error display
- `apps/web/src/app/(platform)/assessments/disc/disc-wizard-client.tsx` — error display

**Problem:** Error messages don't have `role="alert"` or `aria-live="assertive"`. Screen readers won't announce errors.

**Fix:** Add `role="alert"` to each error div:

```tsx
<div role="alert" className="rounded-md border border-semantic-error/30 ...">
```

**Verification:** Error divs have `role="alert"`.

---

### 8. [HIGH] Hardcoded hex colors in team profiles charts

**Issue ID:** FIX-E29-008

- [x] Fixed

**Location:** `apps/web/src/app/(platform)/team/profiles/team-profiles-client.tsx`, lines ~58-63

**Problem:** `DISC_COLORS` uses hardcoded hex values (`#EF4444`, `#F59E0B`, etc). CLAUDE.md mandates "zero hardcoded hex/rgba values".

**Fix:** Replace with CSS variable references:

```typescript
const DISC_COLORS: Record<string, string> = {
  D: "var(--color-semantic-error)",
  I: "var(--color-accent-gold)",
  S: "var(--color-semantic-success)",
  C: "var(--color-accent-blue-mid)",
}
```

**Verification:** `grep -n "#[0-9A-Fa-f]\{6\}" apps/web/src/app/\(platform\)/team/profiles/team-profiles-client.tsx` returns no matches.

---

### 9. [HIGH] Missing navigation entry for /team/profiles

**Issue ID:** FIX-E29-009

- [x] Fixed

**Location:** `apps/web/src/lib/navigation.ts` — `manager` array

**Problem:** The team profiles page exists and is role-gated for managers, but there's no sidebar nav entry. Managers have no way to discover or navigate to it.

**Fix:** Add to the `manager` navigation array:

```typescript
{ label: "Perfis da Equipe", href: "/team/profiles", icon: Users },
```

Ensure `Users` is imported from `lucide-react`.

**Verification:** Manager sidebar includes "Perfis da Equipe" link pointing to `/team/profiles`.

---

### 10. [HIGH] RLS over-fetch in team profiles — assessments query not filtered by studentIds

**Issue ID:** FIX-E29-010

- [x] Fixed

**Location:** `apps/web/src/app/(platform)/team/profiles/actions.ts` — assessment_history query

**Problem:** When manager has area-scoped students, the assessment query fetches ALL tenant assessments instead of filtering by the scoped `studentIds`.

**Fix:** Add `.in("user_id", [...studentIdSet])` to the assessment queries when `studentIds` is available:

```typescript
let assessmentQuery = service
  .from("assessment_history")
  .select("user_id, assessment_type, result, completed_at")
  .eq("tenant_id", tenantId)
  .in("assessment_type", ["big_five", "disc"])
  .order("completed_at", { ascending: false })

if (studentIdSet.size > 0) {
  assessmentQuery = assessmentQuery.in("user_id", [...studentIdSet])
}
```

**Verification:** Query includes `.in("user_id", ...)` when filtering by area.

---

### 11. [HIGH] JSDoc/code mismatch on DISC override threshold

**Issue ID:** FIX-E29-011

- [x] Fixed

**Location:** `packages/shared/src/utils/adaptation.ts`, JSDoc on `buildAdaptationHints`

**Problem:** JSDoc says "the highest score > 50% of total" but code checks `> 0.35` (35%).

**Fix:** Update JSDoc line to: `"DISC has a strong dominant type (the highest score > 35% of total)"`

**Verification:** JSDoc matches code behavior.

---

### 12. [HIGH] computeProfileScore called twice per trail during sort

**Issue ID:** FIX-E29-012

- [x] Fixed

**Location:** `apps/web/src/lib/trails/recommendations.ts` — sort comparator

**Problem:** Inside `.sort()`, `computeProfileScore` is called for both `a` and `b` on every comparison. O(n log n) calls instead of O(n). For large trail pools this is a performance regression.

**Fix:** Cache the profile score during the scoring loop and use it in sorting:

```typescript
// In the scoring loop, store the score:
const profileScoreMap = new Map<string, number>()

for (const trail of candidateTrails) {
  // ... existing logic ...
  const profileScore = hasProfile ? computeProfileScore(trailText, bigFiveScores, discScores) : 0
  profileScoreMap.set(trail.id, profileScore)
  // ... push to scored ...
}

// In sort:
scored.sort((a, b) => {
  if (a.relevance !== b.relevance) return a.relevance - b.relevance
  const aProfile = profileScoreMap.get(a.id) ?? 0
  const bProfile = profileScoreMap.get(b.id) ?? 0
  const aBase = a.enrollment_count / maxEnrollments
  const bBase = b.enrollment_count / maxEnrollments
  const aComposite = BASE_SCORE_WEIGHT * aBase + PROFILE_SCORE_WEIGHT * aProfile
  const bComposite = BASE_SCORE_WEIGHT * bBase + PROFILE_SCORE_WEIGHT * bProfile
  return bComposite - aComposite
})
```

**Verification:** `computeProfileScore` is NOT called inside `.sort()`. Search: `grep -n "computeProfileScore" apps/web/src/lib/trails/recommendations.ts` — should appear only in the scoring loop, not in sort.

---

### 13. [HIGH] Unsafe JSONB type casts without runtime validation

**Issue ID:** FIX-E29-013

- [x] Fixed

**Location:** Multiple files — `adaptation-hints.ts:36-42`, `recommendations.ts:297-301`, `big-five/page.tsx:43`, `disc/actions.ts:169-179`

**Problem:** JSONB `result` from `assessment_history` is cast with `as` without runtime validation. Malformed data silently produces wrong scores or NaN.

**Fix:** Create a shared validation helper and use across all files:

```typescript
// apps/web/src/lib/assessments/schemas.ts
import { z } from "zod"

export const bigFiveResultSchema = z.object({
  openness: z.number().min(0).max(100),
  conscientiousness: z.number().min(0).max(100),
  extraversion: z.number().min(0).max(100),
  agreeableness: z.number().min(0).max(100),
  neuroticism: z.number().min(0).max(100),
})

export const discResultSchema = z.object({
  d: z.number().min(0),
  i: z.number().min(0),
  s: z.number().min(0),
  c: z.number().min(0),
})
```

Then replace each `as` cast with `schema.safeParse(a.result)` — use parsed data on success, null on failure.

**Verification:** No `as unknown as BigFive` or `as { openness: number...` patterns in the changed files. `grep -rn "as unknown as" apps/web/src/app/\(platform\)/assessments/ apps/web/src/lib/assessments/ apps/web/src/app/\(platform\)/profile/learning/` returns no matches.

---

## Checklist Final

Apos todos os fixes:

- [x] `pnpm turbo typecheck` — 0 errors
- [x] `pnpm --filter @eximia/web test` — all pass (298/298)
- [x] `npx biome check --diagnostic-level=error` on changed files — 0 errors
- [x] All issues above marked `[x]`

---

*— Quinn, guardiao da qualidade*
