-- Verso: Blog/Articles section for eximIA Academy
-- Posts can be draft or published, tenant-scoped

create table if not exists public.verso_posts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  slug text not null,
  excerpt text,
  content text not null default '',
  author text not null default 'eximIA',
  category text not null default 'Geral',
  cover_url text,
  cover_color text default '#0d9488',
  tags text[] default '{}',
  reading_time integer default 0,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  sources jsonb default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, slug)
);

-- RLS
alter table public.verso_posts enable row level security;

-- Anyone authenticated in the tenant can read published posts
create policy "verso_posts_select" on public.verso_posts
  for select using (
    tenant_id in (
      select tenant_id from public.users where id = auth.uid()
    )
    and (status = 'published' or created_by = auth.uid() or exists (
      select 1 from public.users where id = auth.uid() and role in ('admin', 'super_admin', 'instructor')
    ))
  );

-- Admins and instructors can insert
create policy "verso_posts_insert" on public.verso_posts
  for insert with check (
    exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'super_admin', 'instructor')
    )
  );

-- Admins and instructors can update
create policy "verso_posts_update" on public.verso_posts
  for update using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'super_admin', 'instructor')
    )
  );

-- Only admins can delete
create policy "verso_posts_delete" on public.verso_posts
  for delete using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'super_admin')
    )
  );

-- Updated_at trigger
create or replace function public.verso_posts_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger verso_posts_updated_at
  before update on public.verso_posts
  for each row execute function public.verso_posts_updated_at();
