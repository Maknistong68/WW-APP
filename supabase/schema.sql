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
