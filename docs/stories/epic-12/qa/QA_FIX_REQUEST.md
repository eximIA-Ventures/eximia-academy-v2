# QA Fix Request: Story 12.3 — Editor Multi-Modal Upload

**Generated:** 2026-02-10T22:00:00Z
**QA Report Source:** Quality Gate review — Story 12.3
**Reviewer:** Quinn (Test Architect)
**Gate Decision:** PASS WITH CONCERNS

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

| Severity | Count | Status                  |
|----------|-------|-------------------------|
| MAJOR    | 2     | Fixed                   |
| MINOR    | 1     | Fixed                   |

---

## Issues to Fix

### 1. [MAJOR] AC6: Video URL does not enforce HTTPS

**Issue ID:** FIX-12.3-001

**Location:** `packages/shared/src/validators/chapters.ts:8,21`

**Problem:**

AC6 states: *"URLs de video devem ser HTTPS"*. The Zod schema uses `.url()` which accepts any scheme including `http://`. A manager can paste `http://example.com/video.mp4` and it will pass validation.

```typescript
// Current (both schemas)
video_url: z.string().url("URL do video invalida").optional().or(z.literal("")),
```

**Expected:**

Add HTTPS enforcement via `.refine()`:

```typescript
video_url: z
  .string()
  .url("URL do video invalida")
  .refine((url) => url.startsWith("https://"), "URL do video deve ser HTTPS")
  .optional()
  .or(z.literal("")),
```

**Verification:**

- [ ] Submit chapter with `http://youtube.com/watch?v=abc` — should show validation error
- [ ] Submit chapter with `https://youtube.com/watch?v=abc` — should pass
- [ ] Submit chapter with empty video URL — should pass (optional field)
- [ ] `pnpm typecheck` passes
- [ ] Both `createChapterSchema` and `updateChapterSchema` enforce HTTPS

**Status:** [x] Fixed

---

### 2. [MAJOR] Storage RLS policy excludes teacher role from uploads

**Issue ID:** FIX-12.3-002

**Location:** `supabase/migrations/20260210000003_epic12_multimodal_content.sql:30-33`

**Problem:**

The `chapter_assets_upload` policy only permits `admin` and `manager` roles. However, `chapters/actions.ts` now allows `teacher` to create/edit chapters (per Epic 9 fix `aab7cd0`). Teachers can save chapter metadata but **cannot upload audio/images** via the client-side Supabase Storage SDK — the upload will fail with a permissions error.

```sql
-- Current
AND role IN ('admin', 'manager')
```

**Expected:**

Add `teacher` to both upload and delete policies:

```sql
-- chapter_assets_upload policy
AND role IN ('admin', 'manager', 'teacher')

-- chapter_assets_delete policy
AND role IN ('admin', 'manager', 'teacher')
```

**Note:** This is technically Story 12.1 scope (migration file), but it blocks Story 12.3 functionality for teachers. Create a new migration file to alter the policies rather than editing the existing migration.

**Verification:**

- [ ] Create a new migration file (e.g., `20260210000005_fix_teacher_storage_policy.sql`)
- [ ] Drop and recreate both `chapter_assets_upload` and `chapter_assets_delete` policies with `teacher` included
- [ ] Verify a teacher-role user can upload audio via the editor
- [ ] Verify a teacher-role user can upload images via the block editor
- [ ] Verify student role still CANNOT upload (negative test)
- [ ] `supabase db reset` applies cleanly

**Status:** [x] Fixed

---

### 3. [MINOR] Orphaned audio files not deleted from Storage on remove

**Issue ID:** FIX-12.3-003

**Location:** `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/edit/_components/audio-uploader.tsx:51-58`

**Problem:**

`handleRemove` clears the audio URL from component state but never deletes the file from Supabase Storage. Over time, orphaned audio files accumulate in the `chapter-assets` bucket.

```typescript
// Current
function handleRemove() {
  if (!confirmRemove) { setConfirmRemove(true); return }
  setConfirmRemove(false)
  onRemove()
  toast({ variant: "success", title: "Audio removido" })
}
```

**Expected:**

Extract the storage path from the URL and call `supabase.storage.remove()`:

```typescript
async function handleRemove() {
  if (!confirmRemove) { setConfirmRemove(true); return }
  setConfirmRemove(false)

  // Delete from Storage if URL points to chapter-assets bucket
  if (currentUrl?.includes("/chapter-assets/")) {
    try {
      const supabase = createClient()
      // Extract path after bucket name
      const pathMatch = currentUrl.match(/chapter-assets\/(.+)$/)
      if (pathMatch?.[1]) {
        await supabase.storage.from("chapter-assets").remove([decodeURIComponent(pathMatch[1])])
      }
    } catch {
      // Non-blocking — file remains but URL is cleared
    }
  }

  onRemove()
  toast({ variant: "success", title: "Audio removido" })
}
```

**Verification:**

- [ ] Upload an audio file, note the Storage path
- [ ] Click Remove and confirm
- [ ] Check Supabase Storage dashboard — file should be deleted
- [ ] If delete fails (permissions), audio URL is still cleared from editor (non-blocking)
- [ ] `pnpm typecheck` passes

**Status:** [x] Fixed

---

## Constraints

**CRITICAL: @dev must follow these constraints:**

- [x] Fix ONLY the issues listed above
- [x] Do NOT add new features
- [x] Do NOT refactor unrelated code
- [x] Run type check before marking complete: `pnpm --filter @eximia/web typecheck`
- [x] Run lint before marking complete: `pnpm --filter @eximia/web lint`
- [ ] For migration changes, ensure `supabase db reset` applies cleanly
- [x] Update story file list if any new files created

---

## After Fixing

1. Mark each issue as fixed in this document
2. Update the story's Dev Agent Record with summary
3. Request QA re-review: `@qa *gate 12.3`

---

_Generated by Quinn (Test Architect) - AIOS QA System_
