-- Replete cloud sync: one row per synced record, private to its owner.
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run more than once.

create table if not exists public.records (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  tbl        text        not null check (char_length(tbl) between 1 and 64),
  row_id     text        not null check (char_length(row_id) between 1 and 200),
  data       jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, tbl, row_id)
);

create index if not exists records_user_updated on public.records (user_id, updated_at);

-- The server stamps every write, so devices with wrong clocks can't confuse syncing.
create or replace function public.records_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
  for each row execute function public.records_touch();

-- Row Level Security: each signed-in person can only see and change their own rows.
alter table public.records enable row level security;

drop policy if exists "records: own rows" on public.records;
create policy "records: own rows" on public.records
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.records from anon;
grant select, insert, update, delete on public.records to authenticated;
