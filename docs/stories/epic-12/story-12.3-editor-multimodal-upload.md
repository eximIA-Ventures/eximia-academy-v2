# Story 12.3: Editor Multi-Modal — Video, Audio e Upload de Imagens

**Epic:** [Epic 12 — Conteudo Multi-Modal](../../epics/epic-12-multimodal-content-delivery.md)
**Version:** 1.0
**Created:** 2026-02-09
**Updated:** 2026-02-09
**Author:** River (SM Agent)
**Status:** Done
**Story Points:** 5
**Priority:** P0 (Managers need this to create multi-modal content)
**Blocked By:** Story 12.1
**Blocks:** Story 12.4
**Assigned To:** @dev (Dex)

---

## User Story

**As a** manager/admin,
**I want** to add video URLs, upload audio files, and insert images into chapter content,
**so that** I can provide multi-modal learning materials to students.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.3, Section 7.1 |
| **PRD Ref** | `docs/prd.md` — FR2 (Content Management) |
| **Stack** | Next.js 15 (App Router), React, Supabase Storage, @eximia/ui (FormField, Input, Button) |
| **DB Tables** | `chapters` (write: video_url, audio_url), `storage.objects` (write: chapter-assets bucket) |
| **Existing Editor** | `chapter-editor-client.tsx` — textarea with markdown preview |
| **Upload Pattern** | Follows `logo-upload.tsx` pattern from Epic 5 (tenant-assets bucket) |

---

## Acceptance Criteria

- [x] **AC1:** Campo "URL do Video" adicionado ao editor com:
  - Input de URL com validacao (YouTube, Vimeo, ou URL direta .mp4/.webm)
  - Preview inline do video ao colar URL valida
  - Helper text: "Cole a URL do YouTube, Vimeo ou arquivo de video"
- [x] **AC2:** Secao "Audio do Capitulo" adicionada ao editor com:
  - Botao "Fazer Upload" para arquivo de audio
  - Aceita: MP3, WAV, OGG, M4A (max 50MB)
  - Progress bar durante upload
  - Preview do audio apos upload (mini player)
  - Opcao de remover audio (com confirmacao)
- [x] **AC3:** Botao "Inserir Imagem" na toolbar do editor de texto com:
  - Upload de imagem (PNG, JPG, WebP, max 5MB)
  - Apos upload, insere markdown `![](url)` na posicao do cursor
  - Preview da imagem na aba Preview do editor
- [x] **AC4:** Server Actions `createChapter` e `updateChapter` aceitam e persistem `video_url` e `audio_url`
- [x] **AC5:** Upload de imagem/audio vai para bucket `chapter-assets` com path `{tenant_id}/{chapter_id}/images/` ou `{tenant_id}/{chapter_id}/audio/`
- [x] **AC6:** Validacao server-side: URLs de video devem ser HTTPS, arquivos de audio devem ser MIME types permitidos
- [x] **AC7:** Ao editar capitulo existente, campos de video e audio mostram valores atuais
- [x] **AC8:** FormField e componentes @eximia/ui usados para todos os novos campos

---

## CodeRabbit Integration

> CodeRabbit will review this story's PR for: File upload security (MIME type validation, size limits), storage path sanitization, XSS prevention in URLs, proper error handling on upload failures, FormField accessibility.

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 5) Create chapter asset upload utility
  - [x] Create `apps/web/src/lib/utils/chapter-asset-upload.ts`
  - [x] Implement `uploadChapterAsset(supabase, file, tenantId, chapterId, type)` function
  - [x] Derive file extension from MIME type (mimeToExt lookup with fallback)
  - [x] Generate UUID filename to prevent collisions
  - [x] Return public URL after successful upload
  - [x] Client-side size validation: 5MB for images, 50MB for audio

- [x] **Task 2** (AC: 1, 7, 8) Add video URL field to editor
  - [x] Add `video_url` state to `ChapterEditorClient`
  - [x] Add `FormField` with `Input` for video URL after learning_objective
  - [x] Add helper text and URL format validation
  - [x] Create `video-preview.tsx` component (inline video preview on valid URL)
  - [x] Load existing `chapter?.video_url` as default value

- [x] **Task 3** (AC: 2, 7, 8) Add audio upload to editor
  - [x] Create `audio-uploader.tsx` component
  - [x] Implement file picker with MIME type filter (audio/mpeg, audio/wav, audio/ogg, audio/mp4, audio/x-m4a)
  - [x] Show upload progress bar during upload
  - [x] Show mini audio player preview after upload
  - [x] Add remove button with confirmation dialog
  - [x] Load existing `chapter?.audio_url` as current state

- [x] **Task 4** (AC: 3) Add image upload button to content editor
  - [x] Create `image-upload-button.tsx` component
  - [x] Implement file picker with image MIME filter (image/png, image/jpeg, image/webp)
  - [x] Upload to `chapter-assets/{tenant_id}/{chapter_id}/images/`
  - [x] On success, insert `![](publicUrl)` at textarea cursor position
  - [x] Verify image renders in markdown Preview tab

- [x] **Task 5** (AC: 4, 6) Update server actions for media fields
  - [x] Update `createChapter` in courses/chapters/actions.ts to read `video_url` and `audio_url` from FormData
  - [x] Update `updateChapter` to read `video_url` and `audio_url` from FormData
  - [x] Convert empty strings to null before DB insert/update
  - [x] Verify Zod schema validates URL format (from Story 12.1)

- [x] **Task 6** (AC: 7) Update editor props interface
  - [x] Expand `ChapterEditorClientProps.chapter` to include `video_url: string | null` and `audio_url: string | null`
  - [x] Update edit page.tsx to fetch and pass `video_url` and `audio_url` to editor

- [x] **Task 7** (AC: all) Regression + integration validation
  - [x] Test create chapter with video URL only
  - [x] Test create chapter with audio upload only
  - [x] Test create chapter with all 3 (text + video + audio)
  - [x] Test edit existing chapter — fields pre-populated
  - [x] Test image insert in markdown content
  - [x] Test file size validation (reject >5MB image, >50MB audio)
  - [x] Test MIME type validation (reject .exe, .pdf, etc.)
  - [x] Verify existing create/edit flow works without media (regression)
  - [x] Run `pnpm lint && pnpm typecheck`

---

## Dev Notes

### Upload Utility

```typescript
// apps/web/src/lib/utils/chapter-asset-upload.ts
export async function uploadChapterAsset(
  supabase: SupabaseClient,
  file: File,
  tenantId: string,
  chapterId: string,
  type: 'images' | 'audio',
): Promise<string> {
  const mimeToExt: Record<string, string> = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
    'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg',
    'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a',
  }
  const ext = mimeToExt[file.type] ?? file.name.split('.').pop() ?? 'bin'
  const fileName = `${crypto.randomUUID()}.${ext}`
  const path = `${tenantId}/${chapterId}/${type}/${fileName}`

  const { error } = await supabase.storage
    .from('chapter-assets')
    .upload(path, file, { cacheControl: '3600', upsert: false })

  if (error) throw new Error(`Upload failed: ${error.message}`)

  const { data: { publicUrl } } = supabase.storage
    .from('chapter-assets')
    .getPublicUrl(path)

  return publicUrl
}
```

### Editor Fields (JSX snippets)

```typescript
// Video URL field
<FormField label="URL do Video" htmlFor="video_url">
  <Input
    id="video_url"
    name="video_url"
    placeholder="https://youtube.com/watch?v=... ou https://vimeo.com/..."
    defaultValue={chapter?.video_url ?? ""}
  />
  <p className="text-xs text-text-muted mt-1">
    YouTube, Vimeo ou URL direta (.mp4, .webm)
  </p>
</FormField>

// Audio upload
<FormField label="Audio do Capitulo" htmlFor="audio">
  <AudioUploader
    currentUrl={chapter?.audio_url}
    chapterId={chapter?.id}
    courseId={courseId}
    onUpload={(url) => setAudioUrl(url)}
    onRemove={() => setAudioUrl(null)}
  />
</FormField>

// Image insert button (above textarea)
<ImageUploadButton
  chapterId={chapter?.id ?? "new"}
  courseId={courseId}
  onInsert={(url) => insertAtCursor(`![](${url})`)}
/>
```

### File Locations

```
apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/edit/_components/
├── chapter-editor-client.tsx          # UPDATED: add video/audio/image fields
├── video-preview.tsx                  # NEW
├── audio-uploader.tsx                 # NEW
└── image-upload-button.tsx            # NEW

apps/web/src/lib/utils/
├── chapter-asset-upload.ts            # NEW

apps/web/src/app/(platform)/courses/[courseId]/chapters/
├── actions.ts                         # UPDATED: createChapter/updateChapter accept media fields
```

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. Editor renders with new fields. | Yes |
| Pre-PR | Video URL saves and loads. Audio uploads to Storage. Images insert markdown correctly. File type validation works. Preview shows in editor. Existing editor functionality intact. Upload progress visible. Remove audio works. | Yes |

---

## Definition of Done

- [x] Video URL field added to editor with preview
- [x] Audio upload with progress bar and mini player preview
- [x] Image upload inserts markdown at cursor position
- [x] Server actions persist video_url and audio_url
- [x] File type and size validation working (client-side)
- [x] Existing editor functionality unaffected
- [x] Edit mode pre-populates existing media values
- [x] `pnpm lint && pnpm typecheck` pass

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Full implementation: editor fields, upload components, server actions |
| **@ux-design-expert (Uma)** | Upload UX, progress feedback, preview components |
| **@qa (Quinn)** | Upload validation, file type enforcement, MIME check, preview accuracy |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Large audio files slow upload | MEDIUM | Progress bar gives feedback. 50MB limit. Client-side size check before upload. |
| Image upload for new chapter (no ID yet) | MEDIUM | Use "new" as placeholder chapterId, or generate UUID client-side |
| Cursor position lost on image insert | LOW | Store cursor position before file picker opens |
| MIME type spoofing on upload | LOW | Server-side validation via storage bucket allowed_mime_types config |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-09 | 1.0 | Story created from Epic 12 v1.1 (QA-reviewed) | River (SM) |

---

## QA Results

**Gate Decision: PASS**
**Reviewed:** 2026-02-10 (re-review)
**Reviewer:** Quinn (Test Architect)

**AC Traceability:** 8/8 PASS

### Round 1 (initial gate): PASS WITH CONCERNS
**Fixes Applied by @dev (pre-gate):**
- P0-2: video-preview.tsx created (VERIFIED)
- P0-3: teacher role added to chapter CRUD (VERIFIED)
- P1-4: contentBlocks in getAvailableModes (VERIFIED)
- P1-5: fake upload progress replaced with indeterminate (VERIFIED)
- P1-6: draft UUID for new chapter uploads (VERIFIED)

### Round 2 (re-review): All concerns resolved
| Issue ID | Severity | Fix | Verification |
|----------|----------|-----|--------------|
| FIX-12.3-001 | MAJOR | `.refine()` HTTPS check added to both `createChapterSchema` and `updateChapterSchema` | VERIFIED — line 12 and line 31 in `validators/chapters.ts` |
| FIX-12.3-002 | MAJOR | New migration `20260210000005_fix_teacher_storage_policy.sql` drops and recreates both policies with `teacher` | VERIFIED — `DROP POLICY IF EXISTS` + `CREATE POLICY` with `('admin', 'manager', 'teacher')` |
| FIX-12.3-003 | MINOR | `handleRemove` now calls `supabase.storage.remove()` with non-blocking try/catch | VERIFIED — lines 58-69 in `audio-uploader.tsx` |

**Build Verification:** typecheck PASS, lint PASS
**Constraint Compliance:** No new features added, no unrelated refactoring, story file list updated
**Remaining:** `supabase db reset` not verified in this gate (requires running instance)

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- react-player v3 uses `src` prop (HTML standard), not `url` (v2 API) — false positive reverted
- Biome auto-format required after Zod `.refine()` chain addition

### Completion Notes
- Implemented as specified in story. All typecheck passes.
- QA gate: PASS WITH CONCERNS (3 issues)
- QA fixes applied: FIX-12.3-001 (HTTPS), FIX-12.3-002 (teacher RLS), FIX-12.3-003 (orphaned audio)

### File List
**New files:**
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/edit/_components/video-preview.tsx`
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/edit/_components/audio-uploader.tsx`
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/edit/_components/block-editor.tsx`
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/edit/_components/image-upload-button.tsx`
- `apps/web/src/lib/utils/chapter-asset-upload.ts`
- `apps/web/src/lib/utils/extract-headings.ts`
- `apps/web/src/lib/utils/parse-image-alt.ts`
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/_components/chapter-video-player.tsx`
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/_components/chapter-audio-player.tsx`
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/_components/chapter-blocks-renderer.tsx`
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/_components/chapter-mode-selector.tsx`
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/_components/chapter-toc-sheet.tsx`
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/_components/image-with-lightbox.tsx`
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/_components/player-skeleton.tsx`
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/_components/question-chooser-sheet.tsx`
- `apps/web/src/app/(platform)/courses/[courseId]/_components/student-chapter-list.tsx`
- `supabase/migrations/20260210000003_epic12_multimodal_content.sql`
- `supabase/migrations/20260210000004_block_editor.sql`
- `supabase/migrations/20260210000005_fix_teacher_storage_policy.sql` (QA fix)

**Modified files:**
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/edit/_components/chapter-editor-client.tsx`
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/edit/page.tsx`
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/page.tsx`
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/_components/chapter-content.tsx`
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/_components/session-button.tsx`
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/actions.ts`
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/actions.ts`
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/new/edit/page.tsx`
- `apps/web/src/app/(platform)/courses/[courseId]/page.tsx`
- `apps/web/src/app/(platform)/courses/[courseId]/_components/course-detail-client.tsx`
- `packages/shared/src/validators/chapters.ts`
- `packages/shared/src/types/models.ts`
- `supabase/config.toml`

---

*Story criada por River (SM Agent) — eximIA Academy*

— River, removendo obstaculos 🌊
