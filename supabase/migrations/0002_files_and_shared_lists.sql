-- Replete: private file storage (journal attachments, handwriting, progress photos)
-- and lists shared between people (groceries, chores).
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run more than once.

-- ---------------------------------------------------------------- files
insert into storage.buckets (id, name, public, file_size_limit)
values ('files', 'files', false, 20971520) -- 20 MB per file
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- Each person's files live under a folder named after their user id; only they can touch it.
drop policy if exists "files: own folder read" on storage.objects;
create policy "files: own folder read" on storage.objects for select to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "files: own folder write" on storage.objects;
create policy "files: own folder write" on storage.objects for insert to authenticated
  with check (bucket_id = 'files' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "files: own folder update" on storage.objects;
create policy "files: own folder update" on storage.objects for update to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "files: own folder delete" on storage.objects;
create policy "files: own folder delete" on storage.objects for delete to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------- shared lists
create table if not exists public.shared_lists (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 80),
  owner      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  join_code  text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_at timestamptz not null default now()
);

create table if not exists public.shared_list_members (
  list_id   uuid not null references public.shared_lists (id) on delete cascade,
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  email     text not null default '',
  joined_at timestamptz not null default now(),
  primary key (list_id, user_id)
);

create table if not exists public.shared_list_items (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references public.shared_lists (id) on delete cascade,
  text       text not null check (char_length(text) between 1 and 200),
  done       boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shared_list_items_list on public.shared_list_items (list_id);

-- Membership check that doesn't recurse through RLS.
create or replace function public.is_list_member(lid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.shared_list_members m where m.list_id = lid and m.user_id = (select auth.uid()));
$$;

-- The creator becomes the first member automatically.
create or replace function public.shared_lists_add_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.shared_list_members (list_id, user_id, email)
  values (new.id, new.owner, coalesce((select auth.jwt()) ->> 'email', ''))
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists shared_lists_add_owner on public.shared_lists;
create trigger shared_lists_add_owner after insert on public.shared_lists
  for each row execute function public.shared_lists_add_owner();

-- Join someone's list with the code they share.
create or replace function public.join_shared_list(code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare lid uuid;
begin
  if (select auth.uid()) is null then raise exception 'not signed in'; end if;
  select id into lid from public.shared_lists where join_code = upper(trim(code));
  if lid is null then raise exception 'No list with that code'; end if;
  insert into public.shared_list_members (list_id, user_id, email)
  values (lid, (select auth.uid()), coalesce((select auth.jwt()) ->> 'email', ''))
  on conflict do nothing;
  return lid;
end $$;

create or replace function public.shared_list_items_touch() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists shared_list_items_touch on public.shared_list_items;
create trigger shared_list_items_touch before update on public.shared_list_items
  for each row execute function public.shared_list_items_touch();

alter table public.shared_lists enable row level security;
alter table public.shared_list_members enable row level security;
alter table public.shared_list_items enable row level security;

drop policy if exists "lists: members read" on public.shared_lists;
create policy "lists: members read" on public.shared_lists for select to authenticated
  using (owner = (select auth.uid()) or public.is_list_member(id));
drop policy if exists "lists: create own" on public.shared_lists;
create policy "lists: create own" on public.shared_lists for insert to authenticated
  with check (owner = (select auth.uid()));
drop policy if exists "lists: owner edits" on public.shared_lists;
create policy "lists: owner edits" on public.shared_lists for update to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
drop policy if exists "lists: owner deletes" on public.shared_lists;
create policy "lists: owner deletes" on public.shared_lists for delete to authenticated
  using (owner = (select auth.uid()));

drop policy if exists "members: see list members" on public.shared_list_members;
create policy "members: see list members" on public.shared_list_members for select to authenticated
  using (public.is_list_member(list_id));
drop policy if exists "members: leave" on public.shared_list_members;
create policy "members: leave" on public.shared_list_members for delete to authenticated
  using (user_id = (select auth.uid())
         or exists (select 1 from public.shared_lists l where l.id = list_id and l.owner = (select auth.uid())));

drop policy if exists "items: members all" on public.shared_list_items;
create policy "items: members all" on public.shared_list_items for all to authenticated
  using (public.is_list_member(list_id))
  with check (public.is_list_member(list_id));

revoke all on public.shared_lists, public.shared_list_members, public.shared_list_items from anon;
grant select, insert, update, delete on public.shared_lists to authenticated;
grant select, delete on public.shared_list_members to authenticated;
grant select, insert, update, delete on public.shared_list_items to authenticated;
revoke all on function public.join_shared_list(text) from public, anon;
grant execute on function public.join_shared_list(text) to authenticated;
revoke all on function public.is_list_member(uuid) from public, anon;
grant execute on function public.is_list_member(uuid) to authenticated;
