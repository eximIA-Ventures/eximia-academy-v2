-- Biblioteca: books + book_chapters tables + storage bucket
-- Allows managers/admins to manage books; all authenticated tenant users can read.

-- 1. Books table
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete set null,
  title text not null,
  author text not null,
  category text not null default 'Lean',
  description text,
  cover_url text,
  cover_color text,
  rating integer not null default 0 check (rating >= 0 and rating <= 5),
  year integer,
  pages integer,
  tags text[] not null default '{}',
  synopsis text,
  author_bio text,
  file_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- 2. Book chapters table (chapters + summary sections)
create table if not exists public.book_chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  content text not null default '',
  content_type text not null default 'chapter' check (content_type in ('chapter', 'summary')),
  chapter_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- 3. Indexes
create index idx_books_tenant on public.books(tenant_id);
create index idx_book_chapters_book on public.book_chapters(book_id);
create index idx_book_chapters_type_order on public.book_chapters(book_id, content_type, chapter_order);
-- 4. RLS on books
alter table public.books enable row level security;
create policy "books_select" on public.books
  for select to authenticated
  using (tenant_id = auth_tenant_id());
create policy "books_insert" on public.books
  for insert to authenticated
  with check (
    tenant_id = auth_tenant_id()
    and auth_user_role() in ('manager', 'admin', 'super_admin')
  );
create policy "books_update" on public.books
  for update to authenticated
  using (
    tenant_id = auth_tenant_id()
    and auth_user_role() in ('manager', 'admin', 'super_admin')
  );
create policy "books_delete" on public.books
  for delete to authenticated
  using (
    tenant_id = auth_tenant_id()
    and auth_user_role() in ('manager', 'admin', 'super_admin')
  );
-- 5. RLS on book_chapters
alter table public.book_chapters enable row level security;
create policy "book_chapters_select" on public.book_chapters
  for select to authenticated
  using (tenant_id = auth_tenant_id());
create policy "book_chapters_insert" on public.book_chapters
  for insert to authenticated
  with check (
    tenant_id = auth_tenant_id()
    and auth_user_role() in ('manager', 'admin', 'super_admin')
  );
create policy "book_chapters_update" on public.book_chapters
  for update to authenticated
  using (
    tenant_id = auth_tenant_id()
    and auth_user_role() in ('manager', 'admin', 'super_admin')
  );
create policy "book_chapters_delete" on public.book_chapters
  for delete to authenticated
  using (
    tenant_id = auth_tenant_id()
    and auth_user_role() in ('manager', 'admin', 'super_admin')
  );
-- 6. Storage bucket for book covers and PDFs
insert into storage.buckets (id, name, public)
values ('books', 'books', true)
on conflict (id) do nothing;
create policy "books_storage_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'books');
create policy "books_storage_upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'books'
    and auth_user_role() in ('manager', 'admin', 'super_admin')
  );
create policy "books_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'books'
    and auth_user_role() in ('manager', 'admin', 'super_admin')
  );
