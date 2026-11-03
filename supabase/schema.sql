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
  role text not null default 'editor',
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
    case when first_user then 'admin' else 'editor' end,
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
       case when row_number() over (order by u.created_at) = 1 then 'admin' else 'editor' end, now()
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

-- ---------------------------------------------------------------------------
-- Roles: admin / editor / viewer. Viewers read everything but cannot write.
-- Safe to re-run.
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'editor' where role = 'member';
alter table public.profiles alter column role set default 'editor';
alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'editor', 'viewer'));

create or replace function private.can_edit() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status = 'approved' and p.role in ('admin', 'editor')
  )
$$;
revoke all on function private.can_edit() from public, anon;
grant execute on function private.can_edit() to authenticated;

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare first_user boolean := not exists (select 1 from public.profiles);
begin
  insert into public.profiles (id, email, status, role, decided_at)
  values (
    new.id,
    new.email,
    case when first_user then 'approved' else 'pending' end,
    case when first_user then 'admin' else 'editor' end,
    case when first_user then now() else null end
  )
  on conflict (id) do nothing;
  return new;
end $$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

-- An admin cannot change their own role or access, so the team keeps an admin.
create or replace function private.guard_own_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.id = (select auth.uid()) and (new.role is distinct from old.role or new.status is distinct from old.status) then
    raise exception 'You cannot change your own role or access';
  end if;
  return new;
end $$;
revoke all on function private.guard_own_profile() from public, anon, authenticated;
drop trigger if exists guard_own_profile on public.profiles;
create trigger guard_own_profile before update on public.profiles
  for each row execute function private.guard_own_profile();

do $$
declare t text;
begin
  foreach t in array array['inspections', 'photos', 'contractors', 'work_orders', 'camps', 'tickets', 'kpi_months', 'manpower', 'weekly_counts'] loop
    execute format('drop policy if exists "team rows" on public.%I', t);
    execute format('drop policy if exists "team read" on public.%I', t);
    execute format('drop policy if exists "team add" on public.%I', t);
    execute format('drop policy if exists "team change" on public.%I', t);
    execute format('drop policy if exists "team remove" on public.%I', t);
    execute format('create policy "team read" on public.%I for select to authenticated using ((select private.is_approved()))', t);
    execute format('create policy "team add" on public.%I for insert to authenticated with check ((select private.can_edit()))', t);
    execute format('create policy "team change" on public.%I for update to authenticated using ((select private.can_edit())) with check ((select private.can_edit()))', t);
    execute format('create policy "team remove" on public.%I for delete to authenticated using ((select private.can_edit()))', t);
  end loop;
end $$;

drop policy if exists "team activity add" on public.activity_log;
create policy "team activity add" on public.activity_log
  for insert to authenticated with check ((select private.can_edit()) and user_id = (select auth.uid()));

drop policy if exists "team photo files" on storage.objects;
drop policy if exists "team photo read" on storage.objects;
drop policy if exists "team photo add" on storage.objects;
drop policy if exists "team photo change" on storage.objects;
drop policy if exists "team photo remove" on storage.objects;
create policy "team photo read" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = 'team' and (select private.is_approved()));
create policy "team photo add" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = 'team' and (select private.can_edit()));
create policy "team photo change" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = 'team' and (select private.can_edit()))
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = 'team' and (select private.can_edit()));
create policy "team photo remove" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = 'team' and (select private.can_edit()));

-- ---------------------------------------------------------------------------
-- "Live site" map (Dashboard → 3D): where each site sits (site_places) and the
-- roads, highways, palms, camps and villages drawn on it (map_items). Shared
-- by the team; everyone approved can read it, only Admins can change it.
-- Same row shape as the other record tables. Safe to re-run.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['site_places', 'map_items'] loop
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
    execute format('drop policy if exists "team read" on public.%I', t);
    execute format('drop policy if exists "team add" on public.%I', t);
    execute format('drop policy if exists "team change" on public.%I', t);
    execute format('drop policy if exists "team remove" on public.%I', t);
    execute format('drop policy if exists "admin add" on public.%I', t);
    execute format('drop policy if exists "admin change" on public.%I', t);
    execute format('drop policy if exists "admin remove" on public.%I', t);
    execute format('create policy "team read" on public.%I for select to authenticated using ((select private.is_approved()))', t);
    execute format('create policy "admin add" on public.%I for insert to authenticated with check ((select private.is_admin()))', t);
    execute format('create policy "admin change" on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
    execute format('create policy "admin remove" on public.%I for delete to authenticated using ((select private.is_admin()))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Routine tasks (Home): to-dos the team adds with the + button, once or
-- repeating (daily / weekly / monthly). Shared like tickets: everyone approved
-- reads them; Editors and Admins add, tick off and change them.
-- Same row shape as the other record tables. Safe to re-run.
-- ---------------------------------------------------------------------------
create table if not exists public.routines (
  uuid uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null,
  deleted boolean not null default false
);
create index if not exists routines_user_idx on public.routines (user_id);
alter table public.routines enable row level security;
drop policy if exists "team read" on public.routines;
drop policy if exists "team add" on public.routines;
drop policy if exists "team change" on public.routines;
drop policy if exists "team remove" on public.routines;
create policy "team read" on public.routines for select to authenticated using ((select private.is_approved()));
create policy "team add" on public.routines for insert to authenticated with check ((select private.can_edit()));
create policy "team change" on public.routines for update to authenticated
  using ((select private.can_edit())) with check ((select private.can_edit()));
create policy "team remove" on public.routines for delete to authenticated using ((select private.can_edit()));
grant select, insert, update, delete on public.routines to authenticated;

-- ---------------------------------------------------------------------------
-- Who did it: each person has a name and a username; everyone approved can
-- read the team's names (not emails); every activity entry is stamped by the
-- server with who sent it. Records are kept if a user is deleted. Safe to re-run.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9][a-z0-9._-]{2,23}$');
alter table public.profiles drop constraint if exists profiles_full_name_len;
alter table public.profiles add constraint profiles_full_name_len
  check (full_name is null or char_length(full_name) between 1 and 60);
create unique index if not exists profiles_username_key on public.profiles (lower(username));

-- The team as approved users see it: names only.
create or replace function public.team_members()
returns table (id uuid, username text, full_name text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.full_name from public.profiles p where (select private.is_approved())
$$;
revoke all on function public.team_members() from public, anon;
grant execute on function public.team_members() to authenticated;

-- Anyone signed in (pending too) sets their own name and username.
create or replace function public.set_my_profile(p_username text, p_full_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  u text := lower(trim(coalesce(p_username, '')));
  n text := trim(coalesce(p_full_name, ''));
begin
  if (select auth.uid()) is null then raise exception 'Sign in first'; end if;
  if u !~ '^[a-z0-9][a-z0-9._-]{2,23}$' then
    raise exception 'Username: 3 to 24 letters or numbers (. _ - allowed)' using errcode = '22023';
  end if;
  if char_length(n) not between 1 and 60 then
    raise exception 'Type your name' using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles p where lower(p.username) = u and p.id <> (select auth.uid())) then
    raise exception 'That username is taken' using errcode = '23505';
  end if;
  update public.profiles set username = u, full_name = n where id = (select auth.uid());
end $$;
revoke all on function public.set_my_profile(text, text) from public, anon;
grant execute on function public.set_my_profile(text, text) to authenticated;

-- The server writes who sent each activity entry (it can't be faked by a device).
create or replace function private.who_name(uid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(p.full_name, ''), p.username, split_part(p.email, '@', 1))
  from public.profiles p where p.id = uid
$$;
revoke all on function private.who_name(uuid) from public, anon, authenticated;

create or replace function private.stamp_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.data := new.data || jsonb_build_object('by', new.user_id, 'byName', private.who_name(new.user_id));
  return new;
end $$;
revoke all on function private.stamp_activity() from public, anon, authenticated;
create or replace trigger stamp_activity before insert on public.activity_log
  for each row execute function private.stamp_activity();

-- Entries from before this change: stamp them from user_id.
update public.activity_log a
set data = a.data || jsonb_build_object('by', a.user_id, 'byName', private.who_name(a.user_id))
where not (a.data ? 'by');

-- Deleting a user must never delete the tickets, KPIs or log rows they saved.
do $$
declare t text;
begin
  foreach t in array array['inspections', 'photos', 'contractors', 'work_orders', 'camps', 'tickets', 'kpi_months',
                           'manpower', 'weekly_counts', 'activity_log', 'site_places', 'map_items', 'routines'] loop
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_user_id_fkey');
    execute format('alter table public.%I add constraint %I foreign key (user_id) references auth.users (id) on delete restrict',
                   t, t || '_user_id_fkey');
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Only an Admin removes (or restores) a ticket. A change to `deleted` from
-- anyone else is quietly kept at the old value, and updated_at moves forward
-- so that phone pulls the truth on its next sync (an error would fail the
-- whole 200-row upsert batch on every sync). Server-side work (no signed-in
-- user, e.g. the SQL editor) is not limited. Safe to re-run.
-- ---------------------------------------------------------------------------
create or replace function private.guard_ticket_removal() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.deleted is distinct from old.deleted and (select auth.uid()) is not null and not private.is_admin() then
    new.deleted := old.deleted;
    new.updated_at := greatest(now(), old.updated_at + interval '1 millisecond');
  end if;
  return new;
end $$;
revoke all on function private.guard_ticket_removal() from public, anon, authenticated;
create or replace trigger guard_ticket_removal before update on public.tickets
  for each row execute function private.guard_ticket_removal();

-- Hard deletes of tickets: admins only (the app never hard-deletes).
drop policy if exists "team remove" on public.tickets;
drop policy if exists "admin remove" on public.tickets;
create policy "admin remove" on public.tickets for delete to authenticated using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- New accounts keep the name and username typed on Create account (checked;
-- a bad or taken username is simply left empty). Role and status never come
-- from what the person sends. This replaces the two earlier definitions above.
-- Sign in with a username: the sign-in Edge Function (supabase/functions/sign-in,
-- service role only) finds the email and stops guessing after 10 wrong tries in
-- 15 minutes. Safe to re-run.
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  first_user boolean := not exists (select 1 from public.profiles);
  u text := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  n text := trim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
begin
  if u !~ '^[a-z0-9][a-z0-9._-]{2,23}$' or exists (select 1 from public.profiles p where lower(p.username) = u) then
    u := null;
  end if;
  if char_length(n) not between 1 and 60 then n := null; end if;
  begin
    insert into public.profiles (id, email, status, role, decided_at, username, full_name)
    values (new.id, new.email,
            case when first_user then 'approved' else 'pending' end,
            case when first_user then 'admin' else 'editor' end,
            case when first_user then now() else null end, u, n)
    on conflict (id) do nothing;
  exception when unique_violation then
    insert into public.profiles (id, email, status, role, decided_at, full_name)
    values (new.id, new.email,
            case when first_user then 'approved' else 'pending' end,
            case when first_user then 'admin' else 'editor' end,
            case when first_user then now() else null end, n)
    on conflict (id) do nothing;
  end;
  return new;
end $$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

create table if not exists private.sign_in_attempts (
  key text not null,
  at timestamptz not null default now(),
  ok boolean not null
);
create index if not exists sign_in_attempts_key_at on private.sign_in_attempts (key, at);

create or replace function public.login_email(p_username text) returns text
language sql stable security definer set search_path = '' as $$
  select u.email from public.profiles p join auth.users u on u.id = p.id
  where lower(p.username) = lower(trim(both '@' from trim(p_username))) limit 1
$$;

create or replace function public.sign_in_blocked(p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select count(*) >= 10 from private.sign_in_attempts a
  where a.key = lower(p_key) and not a.ok and a.at > now() - interval '15 minutes'
    and a.at > coalesce((select max(b.at) from private.sign_in_attempts b where b.key = lower(p_key) and b.ok), '-infinity'::timestamptz)
$$;

create or replace function public.note_sign_in(p_key text, p_ok boolean) returns void
language sql security definer set search_path = '' as $$
  insert into private.sign_in_attempts (key, ok) values (lower(p_key), p_ok);
$$;

revoke all on function public.login_email(text) from public, anon, authenticated;
revoke all on function public.sign_in_blocked(text) from public, anon, authenticated;
revoke all on function public.note_sign_in(text, boolean) from public, anon, authenticated;
grant execute on function public.login_email(text) to service_role;
grant execute on function public.sign_in_blocked(text) to service_role;
grant execute on function public.note_sign_in(text, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- Invites: who invited a person and when, and when they first signed in
-- (the Users page shows "Invited · not joined yet" until then). Invites are
-- made by the invite-user Edge Function (supabase/functions/invite-user).
-- Safe to re-run.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists invited_by uuid;
alter table public.profiles add column if not exists invited_at timestamptz;
alter table public.profiles add column if not exists joined_at timestamptz;

create or replace function private.mark_joined() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.last_sign_in_at is not null then
    update public.profiles set joined_at = coalesce(joined_at, new.last_sign_in_at) where id = new.id and joined_at is null;
  end if;
  return new;
end $$;
revoke all on function private.mark_joined() from public, anon, authenticated;
create or replace trigger on_auth_user_signed_in after update of last_sign_in_at on auth.users
  for each row execute function private.mark_joined();

update public.profiles p set joined_at = u.last_sign_in_at
from auth.users u where u.id = p.id and p.joined_at is null and u.last_sign_in_at is not null;

-- ---------------------------------------------------------------------------
-- The server writes who sent each activity entry. Only an Admin removes
-- tickets: a "Deleted" ticket entry from anyone else (an old copy of the app)
-- did not happen — the ticket comes back on the next sync — so it is not
-- logged. Replaces the stamp_activity above. Safe to re-run.
-- ---------------------------------------------------------------------------
create or replace function private.stamp_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.data ->> 'entity' = 'ticket' and new.data ->> 'action' = 'delete'
     and not exists (select 1 from public.profiles p where p.id = new.user_id and p.status = 'approved' and p.role = 'admin') then
    return null;
  end if;
  new.data := new.data || jsonb_build_object('by', new.user_id, 'byName', private.who_name(new.user_id));
  return new;
end $$;
revoke all on function private.stamp_activity() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Launch hardening (2 Nov 2026). Safe to re-run.
-- ---------------------------------------------------------------------------

-- The app never reads or writes tables without signing in: the public key alone
-- gets nothing, and signed-in users get only what the API needs (RLS still
-- decides which rows). TRUNCATE, TRIGGER and REFERENCES are never needed.
do $$
declare t text;
begin
  foreach t in array array['inspections', 'photos', 'contractors', 'work_orders', 'camps', 'tickets', 'kpi_months',
                           'manpower', 'weekly_counts', 'activity_log', 'site_places', 'map_items', 'routines', 'profiles'] loop
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke truncate, trigger, references on public.%I from authenticated', t);
  end loop;
end $$;
alter default privileges in schema public revoke all on tables from anon;

-- Sign-in attempts: not reachable from the API either way; RLS on with no
-- policies makes that explicit. Only the last day is kept.
alter table private.sign_in_attempts enable row level security;
create or replace function public.note_sign_in(p_key text, p_ok boolean) returns void
language sql security definer set search_path = '' as $$
  delete from private.sign_in_attempts where at < now() - interval '1 day';
  insert into private.sign_in_attempts (key, ok) values (lower(p_key), p_ok);
$$;
revoke all on function public.note_sign_in(text, boolean) from public, anon, authenticated;
grant execute on function public.note_sign_in(text, boolean) to service_role;

-- Profiles: you can't change your own role or access; nobody can change an
-- account's email or id from the app; and the team always keeps one approved
-- admin (two admins can't remove each other down to none).
create or replace function private.guard_own_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.id = (select auth.uid()) and (new.role is distinct from old.role or new.status is distinct from old.status) then
    raise exception 'You cannot change your own role or access';
  end if;
  if (select auth.uid()) is not null and (new.id is distinct from old.id or new.email is distinct from old.email) then
    raise exception 'The email of an account cannot be changed here';
  end if;
  if old.role = 'admin' and old.status = 'approved' and (new.role <> 'admin' or new.status <> 'approved')
     and not exists (select 1 from public.profiles p where p.id <> old.id and p.role = 'admin' and p.status = 'approved') then
    raise exception 'The team needs at least one admin';
  end if;
  return new;
end $$;
revoke all on function private.guard_own_profile() from public, anon, authenticated;

-- Deleted records: the row stays (every phone must learn about the deletion),
-- but after 180 days its contents are emptied, and storage files of deleted
-- photos are removed by the app when it sends the deletion.
create or replace function private.purge_deleted() returns void
language plpgsql security definer set search_path = '' as $$
declare t text;
begin
  foreach t in array array['inspections', 'contractors', 'work_orders', 'camps', 'tickets', 'kpi_months',
                           'manpower', 'weekly_counts', 'site_places', 'map_items', 'routines'] loop
    execute format(
      'update public.%I set data = jsonb_build_object(''purged'', true) where deleted and updated_at < now() - interval ''180 days'' and not (data ? ''purged'')',
      t);
  end loop;
end $$;
revoke all on function private.purge_deleted() from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'ww-purge-deleted';
select cron.schedule('ww-purge-deleted', '17 2 * * *', 'select private.purge_deleted()');
