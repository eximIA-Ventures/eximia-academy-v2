# QA Fix Request: Epic 5 (Stories 5.1-5.4)

**Generated:** 2026-02-08T18:00:00Z
**QA Report Source:** Code review of uncommitted Epic 5 changes on `main`
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
| HIGH     | 2     | Fixed |
| MEDIUM   | 3     | Fixed |
| LOW      | 2     | Fixed |

---

## Issues to Fix

### 1. [HIGH] PostgREST filter injection via unescaped search input

**Issue ID:** FIX-5.01

**Location:** `apps/web/src/app/api/admin/users/route.ts:57`

**Problem:**

```ts
query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
```

The `search` URL parameter is interpolated directly into the PostgREST filter string without escaping. Special characters in the search value (`,`, `.`, `(`, `)`, `%`, `_`) can manipulate the filter syntax or expand wildcards beyond intended scope.

**Expected:**

Escape PostgREST-significant characters before interpolation:

```ts
// Escape special PostgREST filter characters and SQL ILIKE wildcards
function escapeSearchTerm(term: string): string {
  return term
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/[,.()]/g, "")
}

// Usage:
if (search) {
  const escaped = escapeSearchTerm(search)
  query = query.or(`full_name.ilike.%${escaped}%,email.ilike.%${escaped}%`)
}
```

**Verification:**

- [ ] Search with `%` character does not match all records
- [ ] Search with `,` character does not break filter syntax
- [ ] Search with `.` character does not inject filter operators
- [ ] Normal alphanumeric search still works correctly
- [ ] Existing user-list tests still pass

**Status:** [x] Fixed

---

### 2. [HIGH] Avatar saved as .png regardless of actual file type

**Issue ID:** FIX-5.02

**Location:** `apps/web/src/components/onboarding/step-welcome.tsx:54`

**Problem:**

```ts
const filePath = `${tenantId}/avatars/${userId}.png`
```

The storage path is hardcoded as `.png` but the component accepts `image/jpeg` and `image/jpg` types. A JPEG file gets saved with a `.png` extension, causing Content-Type mismatches in CDN/storage headers and confusion for any downstream image processing.

**Expected:**

Derive the extension from the actual file MIME type:

```ts
const ext = file.type === "image/png" ? "png" : "jpg"
const filePath = `${tenantId}/avatars/${userId}.${ext}`
```

**Verification:**

- [ ] Upload a `.jpg` file — storage path ends with `.jpg`
- [ ] Upload a `.png` file — storage path ends with `.png`
- [ ] Avatar preview still renders correctly after upload
- [ ] Remove photo button still works

**Status:** [x] Fixed

---

### 3. [MEDIUM] Silent catch on pagination failure — no user feedback

**Issue ID:** FIX-5.03

**Location:** `apps/web/src/components/admin/user-list.tsx:97-98`

**Problem:**

```ts
} catch {
  // silently fail — user can retry
}
```

If `loadMore` fails (network error, API 500), the user receives zero feedback. The "Carregar mais" button returns to its normal state and nothing happens. The user has no way to know the request failed.

**Expected:**

Add an error state and display feedback:

```ts
const [loadError, setLoadError] = useState<string | null>(null)

// In loadMore:
try {
  setLoadError(null)
  // ... existing fetch logic ...
} catch {
  setLoadError("Erro ao carregar mais usuarios. Tente novamente.")
} finally {
  setLoading(false)
}
```

Then render the error below the table (before the "Carregar mais" button):

```tsx
{loadError && (
  <p className="text-center text-sm text-semantic-error">{loadError}</p>
)}
```

**Verification:**

- [ ] Simulate a network error — error message appears below table
- [ ] Clicking "Carregar mais" again clears the previous error
- [ ] Successful load still works normally
- [ ] Existing user-list tests still pass

**Status:** [x] Fixed

---

### 4. [MEDIUM] Uses window.confirm/window.alert instead of design system

**Issue ID:** FIX-5.04

**Location:** `apps/web/src/components/admin/user-list.tsx:112,135`

**Problem:**

```ts
if (!window.confirm(`Tem certeza que deseja ${actionLabel} este usuario?`)) return
// ...
window.alert(message)
```

Native browser dialogs are not themed, not internationalized, and break design system consistency. The app has `Modal` and `Toast` components from `@eximia/ui`.

**Expected:**

Replace `window.alert` with an inline error message or toast notification. Replace `window.confirm` with the design system `Modal` component for confirmation dialogs.

Minimal approach (inline error, keep confirm for now):

```ts
// Replace window.alert with state-based error display
const [actionError, setActionError] = useState<string | null>(null)

// In handleToggleStatus catch:
setActionError(message)

// Render:
{actionError && (
  <div className="rounded-md bg-semantic-error/10 px-4 py-3 text-sm text-semantic-error">
    {actionError}
  </div>
)}
```

**Verification:**

- [ ] Deactivating a user shows inline error on API failure (not window.alert)
- [ ] Error message auto-clears when next action starts
- [ ] Successful status toggle still works
- [ ] Existing user-list tests still pass

**Status:** [x] Fixed

---

### 5. [MEDIUM] Role selector uses window.confirm/window.alert

**Issue ID:** FIX-5.05

**Location:** `apps/web/src/components/admin/role-selector.tsx`

**Problem:**

Same issue as FIX-5.04 — uses `window.confirm()` for role change confirmation and `window.alert()` for error feedback.

**Expected:**

Same approach as FIX-5.04: replace `window.alert` with a callback or inline error. The confirmation dialog can remain as `window.confirm` for now (lower priority) but the error feedback must use design system patterns.

Add an `onError` callback prop:

```ts
interface RoleSelectorProps {
  // ... existing props ...
  onError?: (message: string) => void
}

// In catch block:
if (onError) {
  onError(message)
} else {
  window.alert(message) // fallback
}
```

Parent (`UserList`) can then handle errors with its own error state.

**Verification:**

- [ ] Role change error shows inline feedback (not window.alert)
- [ ] Successful role change still works
- [ ] Admin self-demotion prevention still works
- [ ] Existing role-selector tests still pass

**Status:** [x] Fixed

---

### 6. [LOW] Silently caps at 10 goals with no UI warning

**Issue ID:** FIX-5.06

**Location:** `apps/web/src/components/onboarding/step-goals.tsx:45`

**Problem:**

When the user reaches the 10-goal limit, new goals are silently truncated via `.slice(0, 10)`. The counter shows "Selecionados (10/10):" but there's no active feedback when the user tries to add an 11th goal.

**Expected:**

Disable the add button and/or show a hint when at the limit:

```tsx
{formGoals.length >= 10 && (
  <p className="text-xs text-semantic-warning">Limite de 10 objetivos atingido.</p>
)}
```

**Verification:**

- [ ] Adding 10 goals shows counter at "10/10"
- [ ] Attempting to add 11th goal shows warning message
- [ ] Existing step-goals tests still pass

**Status:** [x] Fixed

---

### 7. [LOW] Dropdown trigger button missing aria-label

**Issue ID:** FIX-5.07

**Location:** `apps/web/src/components/admin/user-list.tsx:188-192`

**Problem:**

```tsx
<button
  type="button"
  className="flex h-8 w-8 items-center ..."
>
  <MoreVertical size={16} />
</button>
```

The `<MoreVertical>` icon button has no `aria-label`. Screen readers announce it as an unlabeled button.

**Expected:**

```tsx
<button
  type="button"
  aria-label="Acoes do usuario"
  className="flex h-8 w-8 items-center ..."
>
  <MoreVertical size={16} />
</button>
```

**Verification:**

- [ ] Button has `aria-label="Acoes do usuario"` in rendered HTML
- [ ] Existing user-list tests still pass

**Status:** [x] Fixed

---

## Constraints

**CRITICAL: @dev must follow these constraints:**

- [x] Fix ONLY the issues listed above
- [x] Do NOT add new features
- [x] Do NOT refactor unrelated code
- [x] Run all tests before marking complete: `npm test`
- [x] Run linting before marking complete: `npm run lint`
- [x] Run type check before marking complete: `npm run typecheck`
- [x] Update story file list if any new files created

---

## After Fixing

1. Mark each issue as fixed in this document
2. Update the story's Dev Agent Record with summary
3. Request QA re-review: `@qa *code-review`

---

_Generated by Quinn (Test Architect) - AIOS QA System_
