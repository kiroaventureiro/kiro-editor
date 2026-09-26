create extension if not exists pgcrypto;

create table if not exists public.kiro_library_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  media_type text not null check (media_type in ('video', 'audio', 'image')),
  category text not null check (category in ('video', 'image', 'audio', 'overlay', 'template')),
  tier text not null default 'free' check (tier in ('free', 'plus')),
  visibility text not null default 'internal' check (visibility in ('public', 'internal')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  storage_bucket text not null,
  storage_path text not null,
  public_url text,
  thumbnail_url text,
  duration numeric,
  tags text[] not null default '{}',
  collection text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create index if not exists kiro_library_assets_public_idx
  on public.kiro_library_assets (visibility, status, updated_at desc);

create index if not exists kiro_library_assets_category_idx
  on public.kiro_library_assets (category, tier, updated_at desc);

create or replace function public.kiro_library_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists kiro_library_assets_touch on public.kiro_library_assets;
create trigger kiro_library_assets_touch
before update on public.kiro_library_assets
for each row execute function public.kiro_library_touch_updated_at();

-- Reaproveita a tabela user_roles já usada pelo ecossistema KIRO. A consulta
-- dinâmica evita impedir a migration caso um ambiente novo ainda não tenha
-- essa tabela; nesse cenário ninguém recebe permissão administrativa até a
-- role ser criada corretamente.
create or replace function public.is_kiro_editor_admin(target_user uuid default auth.uid())
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean := false;
begin
  if target_user is null or to_regclass('public.user_roles') is null then
    return false;
  end if;

  execute 'select exists(
    select 1 from public.user_roles
    where user_id = $1 and role = ''admin''
  )'
  into allowed
  using target_user;

  return coalesce(allowed, false);
exception
  when undefined_column then
    return false;
end;
$$;

revoke all on function public.is_kiro_editor_admin(uuid) from public;
grant execute on function public.is_kiro_editor_admin(uuid) to authenticated;

alter table public.kiro_library_assets enable row level security;

drop policy if exists "kiro_library_public_read" on public.kiro_library_assets;
create policy "kiro_library_public_read"
on public.kiro_library_assets
for select
to anon, authenticated
using (visibility = 'public' and status = 'published');

drop policy if exists "kiro_library_admin_read" on public.kiro_library_assets;
create policy "kiro_library_admin_read"
on public.kiro_library_assets
for select
to authenticated
using (public.is_kiro_editor_admin(auth.uid()));

drop policy if exists "kiro_library_admin_insert" on public.kiro_library_assets;
create policy "kiro_library_admin_insert"
on public.kiro_library_assets
for insert
to authenticated
with check (public.is_kiro_editor_admin(auth.uid()));

drop policy if exists "kiro_library_admin_update" on public.kiro_library_assets;
create policy "kiro_library_admin_update"
on public.kiro_library_assets
for update
to authenticated
using (public.is_kiro_editor_admin(auth.uid()))
with check (public.is_kiro_editor_admin(auth.uid()));

drop policy if exists "kiro_library_admin_delete" on public.kiro_library_assets;
create policy "kiro_library_admin_delete"
on public.kiro_library_assets
for delete
to authenticated
using (public.is_kiro_editor_admin(auth.uid()));

grant select on public.kiro_library_assets to anon, authenticated;
grant insert, update, delete on public.kiro_library_assets to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('kiro-library-public', 'kiro-library-public', true, 524288000),
  ('kiro-library-internal', 'kiro-library-internal', false, 524288000)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

-- Público: leitura liberada somente para o bucket de distribuição.
drop policy if exists "kiro_library_storage_public_read" on storage.objects;
create policy "kiro_library_storage_public_read"
on storage.objects
for select
to public
using (bucket_id = 'kiro-library-public');

-- Upload, alteração e remoção são sempre administrativos, inclusive no bucket
-- público. O bucket interno também só pode ser lido por admin.
drop policy if exists "kiro_library_storage_admin_read" on storage.objects;
create policy "kiro_library_storage_admin_read"
on storage.objects
for select
to authenticated
using (
  bucket_id in ('kiro-library-public', 'kiro-library-internal')
  and public.is_kiro_editor_admin(auth.uid())
);

drop policy if exists "kiro_library_storage_admin_insert" on storage.objects;
create policy "kiro_library_storage_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('kiro-library-public', 'kiro-library-internal')
  and public.is_kiro_editor_admin(auth.uid())
);

drop policy if exists "kiro_library_storage_admin_update" on storage.objects;
create policy "kiro_library_storage_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id in ('kiro-library-public', 'kiro-library-internal')
  and public.is_kiro_editor_admin(auth.uid())
)
with check (
  bucket_id in ('kiro-library-public', 'kiro-library-internal')
  and public.is_kiro_editor_admin(auth.uid())
);

drop policy if exists "kiro_library_storage_admin_delete" on storage.objects;
create policy "kiro_library_storage_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('kiro-library-public', 'kiro-library-internal')
  and public.is_kiro_editor_admin(auth.uid())
);
