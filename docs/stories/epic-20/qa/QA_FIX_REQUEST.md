# QA Fix Request: Epic 20 Checkpoint 1 (Stories 20.1, 20.2, 20.3)

**Generated:** 2026-02-17T20:00:00Z
**QA Review Source:** In-session review by Quinn (Checkpoint 1)
**Reviewer:** Quinn (Test Architect)
**Stories:** 20.1 (PASS), 20.2 (PASS w/ concern), 20.3 (CONCERNS)

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
| CRITICAL | 0 | — |
| MAJOR | 4 | Must fix before merge |
| MINOR | 2 | Optional improvements |

---

## Issues to Fix

### 1. [MAJOR] Brief Score weights sum to 90, not 100

**Issue ID:** FIX-20.3-001

**Location:** `packages/course-designer/src/schemas/input.ts:175-205`

**Story:** 20.3 (AC3)

**Problem:**

Architecture §6.6 declares "Total: 100 pts" but the listed weights (and the implementation) only sum to **90**. Max achievable score = 90. A perfect brief scores 90 ("Excelente" by 0-point margin). Scores 91-100 are unreachable.

```typescript
// Camada 1: Proposito (30 pts)  ← comment says 30, actual = 35
if (input.course_title) score += 5        // 5
if (input.business_goal) score += 10      // 10
if (input.behavior_change) score += 10    // 10
if (input.success_metrics...) score += 5  // 5
if (input.problem_statement) score += 5   // 5  → subtotal = 35

// Camadas 2-5 subtotals: 25 + 10 + 15 + 5 = 55
// Grand total: 35 + 55 = 90  (not 100)
```

**Expected:**

Add 10 pts to unweighted fields to reach 100. Suggested distribution:

```typescript
// Camada 3: Escopo (20 pts total — was 10)
if (input.core_competencies && input.core_competencies.length > 0) score += 10
if (input.topics_outline && input.topics_outline.length > 0) score += 5       // NEW +5
if (input.context_files && input.context_files.length > 0) score += 5         // NEW +5
```

Alternative: Accept 90 as max and adjust rating thresholds. Either way, fix the Camada 1 comment (says 30, actual 35).

**Verification:**

- [x] Sum all score increments — total must be exactly 100 (35+25+20+15+5=100)
- [x] Comment `// Camada 1: Proposito (35 pts)` matches actual sum
- [x] A fully-filled brief scores 100 — test confirms
- [x] `getBriefScoreRating(100)` returns "Excelente" — test confirms

**Status:** [x] Fixed — Added topics_outline (+5) and context_files (+5) to Camada 3

---

### 2. [MAJOR] `validateBrief()` type incompatible with pre-validation usage

**Issue ID:** FIX-20.3-002

**Location:** `packages/course-designer/src/schemas/input.ts:86-97`

**Story:** 20.3 (AC2)

**Problem:**

`validateBrief` is typed as `(input: RawInput)` where `RawInput = z.infer<typeof baseInputSchema>`. This means all required fields (`business_goal`, `behavior_change`, `course_title`, etc.) are already guaranteed by the type system. But the function checks for their absence — dead code paths.

Dev Notes say "operates on raw input (pre-refinement) for UI-friendly error messages" — if called BEFORE Zod parsing, the type is too strict (would reject partial objects at compile time).

```typescript
// Current — type guarantees business_goal exists, so !input.business_goal is always false
type RawInput = z.infer<typeof baseInputSchema>
export function validateBrief(input: RawInput): BriefValidationResult {
  if (!input.business_goal && !input.behavior_change) { // dead code
```

**Expected:**

Use `z.input` (pre-transform/pre-default type) with `Partial` for pre-validation:

```typescript
// Option A: Accept partial input (pre-Zod)
type PartialBriefInput = Partial<z.input<typeof baseInputSchema>> & {
  target_audience?: Partial<z.input<typeof baseInputSchema>["target_audience"]>
}
export function validateBrief(input: PartialBriefInput): BriefValidationResult {

// Option B: Use Record<string, unknown> with runtime checks (simplest)
export function validateBrief(input: Record<string, unknown>): BriefValidationResult {
```

**Verification:**

- [x] `validateBrief({})` returns `{ valid: false, errors: [...] }` without type error — test confirms
- [x] `validateBrief(fullValidInput)` returns `{ valid: true, errors: [] }` — test confirms
- [x] TypeScript compiles without errors — typecheck passes

**Status:** [x] Fixed — Created `PartialBriefInput` interface for pre-validation usage

---

### 3. [MAJOR] `FrameworkSelectionInput.experience_level` typed as `string`

**Issue ID:** FIX-20.2-001

**Location:** `packages/course-designer/src/framework-registry.ts:231-236`

**Story:** 20.2 (AC5)

**Problem:**

```typescript
export interface FrameworkSelectionInput {
  instructor_preferred_framework?: FrameworkId
  behavior_change: string
  total_duration_hours: number
  experience_level: string  // ← should use literal union
}
```

`selectFramework` compares `experience_level !== "iniciante"` but the type allows any string — no compile-time safety.

**Expected:**

```typescript
export interface FrameworkSelectionInput {
  instructor_preferred_framework?: FrameworkId
  behavior_change: string
  total_duration_hours: number
  experience_level: "iniciante" | "intermediario" | "avancado" | "especialista"
}
```

**Verification:**

- [x] Type uses literal union matching `target_audience.experience_level` enum from input schema
- [x] `selectFramework({ ..., experience_level: "invalid" })` shows compile error
- [x] `pnpm typecheck` passes

**Status:** [x] Fixed — Changed from `string` to `"iniciante" | "intermediario" | "avancado" | "especialista"`

---

### 4. [MAJOR] Zero unit tests for `@eximia/course-designer`

**Issue ID:** FIX-20.X-001

**Location:** `packages/course-designer/` (no test files exist)

**Stories:** 20.1, 20.2, 20.3 (cross-cutting)

**Problem:**

The package has `vitest` configured in `package.json` but zero test files. Three stories of schemas, registry, and validation logic with no automated verification.

**Expected:**

Create test files covering:

1. `packages/course-designer/src/__tests__/shared.test.ts`
   - Schema validation: valid/invalid inputs for each enum and sub-schema
   - `frameworkConfigSchema` accepts valid config, rejects invalid

2. `packages/course-designer/src/__tests__/framework-registry.test.ts`
   - `getFrameworkConfig` returns correct config for each id
   - `getFrameworkConfig` throws for unknown id
   - `listFrameworks` returns 3 items with correct structure
   - `selectFramework` decision tree (4 priority paths)
   - Integrity: time_percentage, quality_criteria.weight, assessment_dimensions.weight sum to 100

3. `packages/course-designer/src/__tests__/input.test.ts`
   - `courseDesignerInputSchema` accepts valid input
   - Refinement: rejects missing `dominant_interaction_type` when strategy is "dominant"
   - Refinement: rejects missing content source
   - `validateBrief` returns errors for blocking conditions
   - `validateBrief` returns warnings for quality conditions
   - `calculateBriefScore` returns correct score for known input
   - `getBriefScoreRating` maps scores to correct labels

**Verification:**

- [x] `pnpm --filter @eximia/course-designer test` passes — 48 tests passing
- [x] At least 15 test cases total across the 3 files — 48 total (10+21+17)
- [x] All schemas, registry functions, and validation functions covered

**Status:** [x] Fixed — Created 3 test files: shared.test.ts, framework-registry.test.ts, input.test.ts

---

### 5. [MINOR] Comment error in `calculateBriefScore`

**Issue ID:** FIX-20.3-003

**Location:** `packages/course-designer/src/schemas/input.ts:178`

**Story:** 20.3

**Problem:**

```typescript
// Camada 1: Proposito (30 pts)  ← says 30
// actual: 5+10+10+5+5 = 35 pts
```

**Expected:**

```typescript
// Camada 1: Proposito (35 pts)
```

Note: This will be resolved together with FIX-20.3-001 if the weight distribution changes.

**Verification:**

- [x] Comment matches actual sum of score increments in that section

**Status:** [x] Fixed — Resolved together with FIX-20.3-001

---

### 6. [MINOR] Story 20.3 title says "6 Camadas" but schema has 5

**Issue ID:** FIX-20.3-004

**Location:** `docs/stories/epic-20/story-20.3-input-schema-course-design-brief.md` (title)

**Story:** 20.3

**Problem:**

Story title: "Input Schema — Course Design Brief **6 Camadas**"
Implementation: 5 schema layers + Pre-validation Gate (functions, not a schema layer).
Dev Notes correctly say "5-layer schema".

**Expected:**

Update story title to "Input Schema — Course Design Brief" (remove layer count from title) or clarify that Camada 6 = Pre-validation Gate.

**Verification:**

- [x] Title no longer misleads about layer count

**Status:** [x] Fixed — Removed "6 Camadas" from title

---

## Constraints

**CRITICAL: @dev must follow these constraints:**

- [x] Fix ONLY the issues listed above
- [x] Do NOT add new features
- [x] Do NOT refactor unrelated code
- [x] Run all tests before marking complete: 48 tests passing
- [x] Run linting before marking complete: 0 errors (biome auto-fixed formatting)
- [x] Run type check before marking complete: typecheck passes
- [x] Update story file list if any new files created

---

## After Fixing

1. Mark each issue as fixed in this document
2. Update the story's Dev Agent Record with summary
3. Request QA re-review: `@qa *review 20.1 - 20.3`

---

_Generated by Quinn (Test Architect) - AIOS QA System_
