-- Google Calendar, both ways, without signing in to Google inside the app:
--  * calendar_feeds: a private feed of your shared events that Google Calendar subscribes to.
--  * calendar_links: each person's Google "secret address in iCal format", so their Google events
--    show in Plan. Private: only you can read or change your own link.
create table if not exists public.calendar_feeds (
  token      text primary key default encode(gen_random_bytes(18), 'hex'),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tz         text not null default 'Asia/Amman',
  created_at timestamptz not null default now()
);
alter table public.calendar_feeds enable row level security;
drop policy if exists "feeds: both of us" on public.calendar_feeds;
create policy "feeds: both of us" on public.calendar_feeds for all to authenticated using (true) with check (true);

create table if not exists public.calendar_links (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  ics_url    text not null check (ics_url ~ '^https://' and char_length(ics_url) <= 600),
  updated_at timestamptz not null default now()
);
alter table public.calendar_links enable row level security;
drop policy if exists "links: own" on public.calendar_links;
create policy "links: own" on public.calendar_links for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- This project doesn't expose new tables automatically: grant access explicitly (RLS still applies).
grant select, insert, update, delete on public.calendar_feeds to authenticated, service_role;
grant select, insert, update, delete on public.calendar_links to authenticated, service_role;
notify pgrst, 'reload schema';
