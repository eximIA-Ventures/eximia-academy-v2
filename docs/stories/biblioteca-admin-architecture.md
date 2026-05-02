# Biblioteca Admin — Architecture Plan

**Status:** Draft
**Architect:** Aria
**Date:** 2026-02-14

---

## Context

The Biblioteca feature currently uses static data in `books-data.ts`. Phase 1 (reading chapters and summaries) is complete with static content. This plan covers migrating to a database-backed system with admin management.

## Phases

### Phase 2: Database Migration

**Migration file:** `packages/database/supabase/migrations/YYYYMMDDHHMMSS_create_books_tables.sql`

```sql
-- Books table
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Lean',
  description TEXT,
  cover_url TEXT,
  cover_color TEXT,
  rating INTEGER DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  year INTEGER,
  pages INTEGER,
  tags TEXT[] DEFAULT '{}',
  synopsis TEXT,
  author_bio TEXT,
  file_url TEXT, -- optional PDF upload
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Book chapters (both chapters and summary sections)
CREATE TABLE book_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'chapter' CHECK (content_type IN ('chapter', 'summary')),
  chapter_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_books_tenant ON books(tenant_id);
CREATE INDEX idx_book_chapters_book ON book_chapters(book_id);
CREATE INDEX idx_book_chapters_type ON book_chapters(book_id, content_type, chapter_order);

-- RLS
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_chapters ENABLE ROW LEVEL SECURITY;

-- Books: all authenticated in tenant can read
CREATE POLICY "books_select" ON books FOR SELECT
  USING (tenant_id = auth_tenant_id());

-- Books: manager/admin can manage
CREATE POLICY "books_insert" ON books FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager', 'admin', 'super_admin'));

CREATE POLICY "books_update" ON books FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager', 'admin', 'super_admin'));

CREATE POLICY "books_delete" ON books FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager', 'admin', 'super_admin'));

-- Same for book_chapters
CREATE POLICY "book_chapters_select" ON book_chapters FOR SELECT
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "book_chapters_insert" ON book_chapters FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager', 'admin', 'super_admin'));

CREATE POLICY "book_chapters_update" ON book_chapters FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager', 'admin', 'super_admin'));

CREATE POLICY "book_chapters_delete" ON book_chapters FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager', 'admin', 'super_admin'));

-- Storage bucket for book covers and PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('books', 'books', true);

CREATE POLICY "books_storage_select" ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'books');

CREATE POLICY "books_storage_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'books'
    AND auth_user_role() IN ('manager', 'admin', 'super_admin')
  );

CREATE POLICY "books_storage_delete" ON storage.objects FOR DELETE
  TO authenticated USING (
    bucket_id = 'books'
    AND auth_user_role() IN ('manager', 'admin', 'super_admin')
  );
```

**Seed script:** Migrate current `books-data.ts` static content into the new tables.

### Phase 3: Admin CRUD for Books

**Route:** `/admin/biblioteca`

**Files:**
- `apps/web/src/app/(platform)/admin/biblioteca/page.tsx` — Book list with search, filter by category
- `apps/web/src/app/(platform)/admin/biblioteca/novo/page.tsx` — Create book form
- `apps/web/src/app/(platform)/admin/biblioteca/[bookId]/page.tsx` — Edit book form
- `apps/web/src/components/admin/biblioteca/book-list-client.tsx` — List with table/grid view
- `apps/web/src/components/admin/biblioteca/book-form-client.tsx` — Form with:
  - Text fields: title, author, category, year, pages, rating, tags
  - Textareas: description, synopsis, author_bio
  - Cover: URL input OR file upload (to `books` bucket)
  - PDF: optional file upload
  - Cover color: gradient picker or predefined options

**Upload util:** `apps/web/src/lib/utils/book-upload.ts` following `material-upload.ts` pattern.
- Path: `{tenantId}/books/{bookId}/cover.{ext}` for covers
- Path: `{tenantId}/books/{bookId}/book.pdf` for PDFs

### Phase 4: Admin Editor for Chapters/Summaries

**Route:** `/admin/biblioteca/[bookId]/conteudo`

**Files:**
- `apps/web/src/app/(platform)/admin/biblioteca/[bookId]/conteudo/page.tsx`
- `apps/web/src/components/admin/biblioteca/book-content-editor-client.tsx`

**Features:**
- Two tabs: "Capitulos" and "Resumo"
- Each tab: ordered list of sections with drag-to-reorder
- Add/remove sections
- Per-section: title + markdown textarea with live preview
- Preview button to open reader in new tab

### Phase 5: Migrate Bookshelf to Database

**Modified files:**
- `apps/web/src/lib/books-queries.ts` (new) — Server-side Supabase queries
- `apps/web/src/app/(platform)/biblioteca/page.tsx` — Fetch from DB
- `apps/web/src/app/(platform)/biblioteca/[bookId]/page.tsx` — Fetch from DB
- `apps/web/src/app/(platform)/biblioteca/[bookId]/ler/page.tsx` — Fetch chapters from DB
- `apps/web/src/app/(platform)/biblioteca/[bookId]/resumo/page.tsx` — Fetch summaries from DB
- `apps/web/src/lib/books-data.ts` — Keep as fallback/seed data only

**Query patterns:**
```typescript
// books-queries.ts
export async function getBooks(supabase: SupabaseClient) {
  return supabase.from("books").select("*").order("title")
}

export async function getBookWithChapters(supabase: SupabaseClient, bookId: string) {
  const { data: book } = await supabase.from("books").select("*").eq("id", bookId).single()
  const { data: chapters } = await supabase
    .from("book_chapters")
    .select("*")
    .eq("book_id", bookId)
    .eq("content_type", "chapter")
    .order("chapter_order")
  const { data: summaries } = await supabase
    .from("book_chapters")
    .select("*")
    .eq("book_id", bookId)
    .eq("content_type", "summary")
    .order("chapter_order")
  return { book, chapters, summaries }
}
```

## Permissions Summary

| Action | student | manager | admin | super_admin |
|--------|---------|---------|-------|-------------|
| Read books | yes | yes | yes | yes |
| Read chapters/summaries | yes | yes | yes | yes |
| Create/edit/delete books | no | yes | yes | yes |
| Create/edit/delete chapters | no | yes | yes | yes |
| Upload covers/PDFs | no | yes | yes | yes |
| Access /admin/biblioteca | no | yes | yes | yes |

## Dependencies

- Supabase migration system
- Existing RLS functions (`auth_tenant_id()`, `auth_user_role()`)
- Existing upload pattern (`material-upload.ts`)
- Existing admin layout and access control pattern

---

*Aria, arquitetando o futuro*
