-- Replete for two: lock the app to two accounts, let them read each other's data, and keep joint
-- data (to-dos, money) in one shared space both can edit.

-- ---------------------------------------------------------------- only two accounts
create or replace function public.limit_to_two_users() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from auth.users) >= 2 then
    raise exception 'Replete is private: sign-ups are closed.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists limit_to_two_users on auth.users;
create trigger limit_to_two_users before insert on auth.users
  for each row execute function public.limit_to_two_users();

-- ---------------------------------------------------------------- read each other's records
-- With at most two accounts, "everyone signed in" is exactly the two of you.
drop policy if exists "records: household read" on public.records;
create policy "records: household read" on public.records for select to authenticated using (true);

-- Each other's photos, handwriting and attachments.
drop policy if exists "files: household read" on storage.objects;
create policy "files: household read" on storage.objects for select to authenticated using (bucket_id = 'files');

-- ---------------------------------------------------------------- joint data
create table if not exists public.household_records (
  tbl        text        not null check (char_length(tbl) between 1 and 64),
  row_id     text        not null check (char_length(row_id) between 1 and 200),
  data       jsonb,
  deleted    boolean     not null default false,
  updated_by uuid        default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (tbl, row_id)
);
create index if not exists household_records_updated on public.household_records (updated_at);

create or replace function public.household_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists household_touch on public.household_records;
create trigger household_touch before insert or update on public.household_records
  for each row execute function public.household_touch();

alter table public.household_records enable row level security;
drop policy if exists "household: both of us" on public.household_records;
create policy "household: both of us" on public.household_records for all to authenticated using (true) with check (true);
revoke all on public.household_records from anon;
grant select, insert, update, delete on public.household_records to authenticated;
grant select on public.household_records to service_role;
