-- WW App cloud sync schema for Supabase.
-- Run this once in your Supabase project: SQL Editor → New query → paste → Run.
-- Safe to re-run. The app's built-in project (.env.production) already has it.

-- Inspections: the whole inspection object is stored as JSON; last-write-wins
-- by updated_at. Rows are soft-deleted so every device learns about deletions.
create table if not exists public.inspections (
  uuid uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null,
  deleted boolean not null default false
);

create table if not exists public.photos (
  uuid uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  inspection_uuid uuid not null,
  item_id text,
  caption text not null default '',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted boolean not null default false
);

create index if not exists photos_inspection_idx on public.photos (inspection_uuid);
create index if not exists inspections_user_idx on public.inspections (user_id);
create index if not exists photos_user_idx on public.photos (user_id);

-- Row Level Security: each user can only see and change their own rows.
alter table public.inspections enable row level security;
alter table public.photos enable row level security;

drop policy if exists "own inspections" on public.inspections;
create policy "own inspections" on public.inspections
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "own photos" on public.photos;
create policy "own photos" on public.photos
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Private storage bucket for photo files, one folder per user.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "own photo files" on storage.objects;
create policy "own photo files" on storage.objects
  for all using (
    bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- Co-pilot records (tickets, contractors, monthly KPIs, manpower counts,
-- weekly open-ticket counts). Same shape as inspections: whole record as JSON,
-- last-write-wins by updated_at, soft deletes. Safe to re-run.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['contractors', 'work_orders', 'camps', 'tickets', 'kpi_months', 'manpower', 'weekly_counts'] loop
    execute format(
      'create table if not exists public.%I (
         uuid uuid primary key,
         user_id uuid not null references auth.users (id) on delete cascade,
         data jsonb not null,
         updated_at timestamptz not null,
         deleted boolean not null default false
       )', t);
    execute format('create index if not exists %I on public.%I (user_id)', t || '_user_idx', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t);
  end loop;
end $$;

-- Activity log: append-only. Only insert + select policies exist, so rows can
-- never be edited or deleted through the API.
create table if not exists public.activity_log (
  uuid uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  time timestamptz not null,
  data jsonb not null
);
create index if not exists activity_log_time_idx on public.activity_log (time);
create index if not exists activity_log_user_idx on public.activity_log (user_id);
alter table public.activity_log enable row level security;
drop policy if exists "own activity read" on public.activity_log;
create policy "own activity read" on public.activity_log
  for select using ((select auth.uid()) = user_id);
drop policy if exists "own activity add" on public.activity_log;
create policy "own activity add" on public.activity_log
  for insert with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Team access with admin approval. Every new account starts "pending"; the
-- first account ever is the approved admin. Approved users share one data
-- set (the policies below replace the per-user "own rows" ones). Safe to re-run.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
alter table public.profiles enable row level security;

-- Helper functions live in a schema the API does not expose.
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_approved() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.status = 'approved')
$$;

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.status = 'approved' and p.role = 'admin'
  )
$$;

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare first_user boolean := not exists (select 1 from public.profiles);
begin
  insert into public.profiles (id, email, status, role, decided_at)
  values (
    new.id,
    new.email,
    case when first_user then 'approved' else 'pending' end,
    case when first_user then 'admin' else 'member' end,
    case when first_user then now() else null end
  )
  on conflict (id) do nothing;
  return new;
end $$;

revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.is_approved() from public, anon;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_approved() to authenticated;
grant execute on function private.is_admin() to authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Accounts that existed before approval was introduced: oldest = admin.
insert into public.profiles (id, email, status, role, decided_at)
select u.id, u.email, 'approved',
       case when row_number() over (order by u.created_at) = 1 then 'admin' else 'member' end, now()
from auth.users u
on conflict (id) do nothing;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
drop policy if exists "admin reads profiles" on public.profiles;
create policy "admin reads profiles" on public.profiles
  for select to authenticated using ((select private.is_admin()));
drop policy if exists "admin decides" on public.profiles;
create policy "admin decides" on public.profiles
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

do $$
declare t text;
begin
  foreach t in array array['inspections', 'photos', 'contractors', 'work_orders', 'camps', 'tickets', 'kpi_months', 'manpower', 'weekly_counts'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('drop policy if exists "own inspections" on public.%I', t);
    execute format('drop policy if exists "own photos" on public.%I', t);
    execute format('drop policy if exists "team rows" on public.%I', t);
    execute format(
      'create policy "team rows" on public.%I for all to authenticated using ((select private.is_approved())) with check ((select private.is_approved()))',
      t);
  end loop;
end $$;

drop policy if exists "own activity read" on public.activity_log;
drop policy if exists "own activity add" on public.activity_log;
drop policy if exists "team activity read" on public.activity_log;
create policy "team activity read" on public.activity_log
  for select to authenticated using ((select private.is_approved()));
drop policy if exists "team activity add" on public.activity_log;
create policy "team activity add" on public.activity_log
  for insert to authenticated with check ((select private.is_approved()) and user_id = (select auth.uid()));

-- Photos: one shared folder "team/" for approved users.
drop policy if exists "own photo files" on storage.objects;
drop policy if exists "team photo files" on storage.objects;
create policy "team photo files" on storage.objects
  for all to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = 'team' and (select private.is_approved()))
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = 'team' and (select private.is_approved()));
