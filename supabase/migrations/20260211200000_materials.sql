-- Materials table + storage bucket
-- Allows managers/admins to upload files; all authenticated tenant users can read/download.

-- 1. Table
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete set null,
  title text not null,
  file_name text not null,
  file_url text not null,
  file_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);
-- Index for tenant queries
create index idx_materials_tenant on public.materials(tenant_id);
-- 2. RLS
alter table public.materials enable row level security;
-- Read: any authenticated user in the same tenant
create policy "materials_select" on public.materials
  for select to authenticated
  using (tenant_id = auth_tenant_id());
-- Insert: manager or admin only
create policy "materials_insert" on public.materials
  for insert to authenticated
  with check (
    tenant_id = auth_tenant_id()
    and auth_user_role() in ('manager', 'admin', 'super_admin')
  );
-- Delete: manager or admin only
create policy "materials_delete" on public.materials
  for delete to authenticated
  using (
    tenant_id = auth_tenant_id()
    and auth_user_role() in ('manager', 'admin', 'super_admin')
  );
-- 3. Storage bucket
insert into storage.buckets (id, name, public)
values ('materials', 'materials', true)
on conflict (id) do nothing;
-- Storage policies
create policy "materials_storage_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'materials');
create policy "materials_storage_upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'materials'
    and auth_user_role() in ('manager', 'admin', 'super_admin')
  );
create policy "materials_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'materials'
    and auth_user_role() in ('manager', 'admin', 'super_admin')
  );
