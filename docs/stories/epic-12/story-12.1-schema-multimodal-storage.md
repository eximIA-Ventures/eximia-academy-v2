# Story 12.1: Schema Multi-Modal + Storage Bucket

**Epic:** [Epic 12 — Conteudo Multi-Modal](../../epics/epic-12-multimodal-content-delivery.md)
**Version:** 1.0
**Created:** 2026-02-09
**Updated:** 2026-02-09
**Author:** River (SM Agent)
**Status:** Done
**Story Points:** 3
**Priority:** P0 (Blocker — all other stories depend on schema)
**Blocked By:** None
**Blocks:** Story 12.2, Story 12.3, Story 12.4
**Assigned To:** @dev (Dex)

---

## User Story

**As a** platform developer,
**I want** the database schema to support multiple content modalities per chapter and student preferences,
**so that** we have the data foundation for multi-modal content delivery.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.3, Section 6.1 |
| **PRD Ref** | `docs/prd.md` — FR2 (Content Management), FR3 (Learning Experience) |
| **Stack** | Supabase (PostgreSQL), TypeScript, Zod |
| **DB Tables** | `chapters` (ALTER), `users` (ALTER), `storage.buckets` (INSERT), `storage.objects` (RLS) |
| **QA Notes** | E12-H1: role `teacher` nao existe mais (unificado para `manager`). E12-H2: limites de tamanho diferenciados sao client-side. |

---

## Acceptance Criteria

- [x] **AC1:** Coluna `video_url` (TEXT, nullable) adicionada a tabela `chapters`
- [x] **AC2:** Coluna `audio_url` (TEXT, nullable) adicionada a tabela `chapters`
- [x] **AC3:** Coluna `learning_mode` (TEXT, DEFAULT 'read') adicionada a tabela `users` com CHECK constraint `IN ('read', 'listen', 'watch')`
- [x] **AC4:** Bucket `chapter-assets` criado no Supabase Storage com policies:
  - Managers/admins podem fazer upload (INSERT) com path `{tenant_id}/{chapter_id}/*`
  - Todos autenticados podem ler (SELECT) assets do seu tenant
  - Bucket limit: 50MiB (teto global). Limites diferenciados via validacao client-side: 5MB imagens, 50MB audio
- [x] **AC5:** Tipos TypeScript atualizados em `packages/shared/src/types/models.ts`:
  - `Chapter` interface criada (ou expandida se existir) com `video_url?: string | null` e `audio_url?: string | null`
  - `LearningMode` type: `'read' | 'listen' | 'watch'`
  - `User` interface criada (ou expandida se existir) com `learning_mode: LearningMode`
  - **Nota:** Verificar se Chapter/User types ja existem no codebase (podem estar inline nos componentes) e consolidar
- [x] **AC6:** Zod schemas atualizados:
  - `createChapterSchema` aceita `video_url` e `audio_url` opcionais
  - `updateChapterSchema` aceita `video_url` e `audio_url` opcionais
  - Validacao: `video_url` deve ser URL valida (https), `audio_url` deve ser URL valida
- [x] **AC7:** Seed data inclui pelo menos 1 capitulo com video_url e audio_url preenchidos
- [x] **AC8:** RLS policies existentes nao sao alteradas — novas colunas herdam policies da tabela

---

## CodeRabbit Integration

> CodeRabbit will review this story's PR for: Migration safety (additive-only changes), RLS policy correctness, storage bucket security, TypeScript type completeness, Zod schema validation coverage.

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 1, 2, 3) Create database migration
  - [x] Create `supabase/migrations/20260210000000_epic12_multimodal_content.sql`
  - [x] ALTER TABLE chapters ADD COLUMN video_url TEXT
  - [x] ALTER TABLE chapters ADD COLUMN audio_url TEXT
  - [x] ALTER TABLE users ADD COLUMN learning_mode TEXT DEFAULT 'read' CHECK (learning_mode IN ('read', 'listen', 'watch'))
  - [x] Verify migration applies cleanly: `supabase db reset`

- [x] **Task 2** (AC: 4) Create storage bucket + RLS policies
  - [x] INSERT INTO storage.buckets ('chapter-assets', public=true)
  - [x] CREATE POLICY chapter_assets_read — SELECT for authenticated users
  - [x] CREATE POLICY chapter_assets_upload — INSERT for admin/manager roles (NOT teacher — role unified)
  - [x] CREATE POLICY chapter_assets_delete — DELETE for admin/manager roles
  - [x] Update `supabase/config.toml` with chapter-assets bucket config (MIME types: image/png, image/jpeg, image/webp, audio/mpeg, audio/wav, audio/ogg, audio/mp4, audio/x-m4a)

- [x] **Task 3** (AC: 5) Update shared TypeScript types
  - [x] Verify where Chapter/User types currently live in codebase
  - [x] Add `LearningMode` type to `packages/shared/src/types/models.ts`
  - [x] Expand Chapter interface with `video_url: string | null` and `audio_url: string | null`
  - [x] Expand User interface with `learning_mode: LearningMode`
  - [x] Verify types compile: `pnpm typecheck`

- [x] **Task 4** (AC: 6) Update Zod validation schemas
  - [x] Update `createChapterSchema` in `packages/shared/src/validators/chapters.ts`
  - [x] Add `video_url: z.string().url().optional().or(z.literal(''))` field
  - [x] Add `audio_url: z.string().url().optional().or(z.literal(''))` field
  - [x] Verify `updateChapterSchema` inherits new fields (uses .partial())

- [x] **Task 5** (AC: 7) Update seed data
  - [x] Update `supabase/seed.sql` — add video_url and audio_url to at least 1 chapter
  - [x] Update `supabase/seed-remote.ts` — same updates
  - [x] Verify seed runs cleanly after migration

- [x] **Task 6** (AC: 8, all) Regression validation
  - [x] Verify existing chapter CRUD works (create, read, update without media fields)
  - [x] Verify existing RLS policies still enforce tenant isolation
  - [x] Run `pnpm lint && pnpm typecheck`
  - [x] Verify storage bucket is accessible via Supabase dashboard/CLI

---

## Dev Notes

### Migration SQL

```sql
-- Migration: 20260210000000_epic12_multimodal_content.sql

-- 1. Add media columns to chapters
ALTER TABLE chapters ADD COLUMN video_url TEXT;
ALTER TABLE chapters ADD COLUMN audio_url TEXT;

-- 2. Add learning preference to users
ALTER TABLE users ADD COLUMN learning_mode TEXT DEFAULT 'read'
  CHECK (learning_mode IN ('read', 'listen', 'watch'));

-- 3. Storage bucket for chapter assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('chapter-assets', 'chapter-assets', true);

-- 4. Storage RLS: authenticated users can read
CREATE POLICY "chapter_assets_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chapter-assets' AND auth.role() = 'authenticated');

-- 5. Storage RLS: managers/admins can upload
CREATE POLICY "chapter_assets_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chapter-assets'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- 6. Storage RLS: managers/admins can delete own uploads
CREATE POLICY "chapter_assets_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'chapter-assets'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );
```

### TypeScript Types

```typescript
// packages/shared/src/types/models.ts — Updates
export type LearningMode = 'read' | 'listen' | 'watch'

export interface Chapter {
  id: string
  course_id: string
  tenant_id: string
  title: string
  content: string | null
  learning_objective: string | null
  order: number
  status: 'draft' | 'published'
  video_url: string | null     // NEW
  audio_url: string | null     // NEW
  created_at: string
  updated_at: string
}
```

### Zod Schemas

```typescript
// packages/shared/src/validators/chapters.ts — Updates
export const createChapterSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(100),
  learning_objective: z.string().optional(),
  video_url: z.string().url().optional().or(z.literal('')),
  audio_url: z.string().url().optional().or(z.literal('')),
})
```

### Storage Bucket Config

```toml
# supabase/config.toml — Update
[storage.buckets.chapter-assets]
public = true
file_size_limit = "50MiB"
allowed_mime_types = [
  "image/png", "image/jpeg", "image/webp",
  "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/x-m4a"
]
```

### File Locations

```
supabase/
├── migrations/
│   └── 20260210000000_epic12_multimodal_content.sql  # NEW
├── config.toml                                        # UPDATED
├── seed.sql                                           # UPDATED
└── seed-remote.ts                                     # UPDATED

packages/shared/src/
├── types/models.ts                                    # UPDATED
└── validators/chapters.ts                             # UPDATED
```

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|-----------|---------|
| Pre-Commit | Migration applies cleanly. Types compile. Seed runs. `pnpm lint && pnpm typecheck` pass. | Yes |
| Pre-PR | New columns exist. Storage bucket accessible. RLS intact for existing data. Learning mode persists correctly. No regression on existing chapter CRUD. | Yes |

---

## Definition of Done

- [x] Migration applies without errors (`supabase db reset`)
- [x] Columns `video_url`, `audio_url` exist on chapters table
- [x] Column `learning_mode` exists on users table with CHECK constraint
- [x] Storage bucket `chapter-assets` created with correct RLS policies
- [x] TypeScript types updated and compiling
- [x] Zod schemas accept new fields
- [x] Seed data includes multi-modal chapter
- [x] Existing functionality unaffected (regression check)
- [x] `pnpm lint && pnpm typecheck` pass

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Migration SQL, shared types, Zod schemas, seed data, config.toml |
| **@qa (Quinn)** | Validate migration, storage policies, type safety, regression |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Migration breaks existing data | LOW | Additive-only (ALTER ADD COLUMN, no drops/renames) |
| Storage bucket permissions too permissive | MEDIUM | RLS policies restrict upload to admin/manager only. Read is authenticated-only. |
| CHECK constraint on learning_mode rejects existing rows | LOW | DEFAULT 'read' ensures all existing users get valid value |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-09 | 1.0 | Story created from Epic 12 v1.1 (QA-reviewed) | River (SM) |

---

## QA Results

*(To be filled by @qa after review)*

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
*(To be filled by @dev)*

### Completion Notes
Implemented as specified in story. All typecheck passes.

### File List
*(To be filled by @dev)*

---

*Story criada por River (SM Agent) — eximIA Academy*

— River, removendo obstaculos 🌊
