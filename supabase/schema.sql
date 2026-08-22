-- WW App cloud sync schema for Supabase.
-- Run this once in your Supabase project: SQL Editor → New query → paste → Run.
-- Then in the app: Settings → Cloud sync → paste your Project URL and anon key.

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

-- Row Level Security: each user can only see and change their own rows.
alter table public.inspections enable row level security;
alter table public.photos enable row level security;

drop policy if exists "own inspections" on public.inspections;
create policy "own inspections" on public.inspections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own photos" on public.photos;
create policy "own photos" on public.photos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Private storage bucket for photo files, one folder per user.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "own photo files" on storage.objects;
create policy "own photo files" on storage.objects
  for all using (
    bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text
  );
