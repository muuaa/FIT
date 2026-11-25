-- Google Calendar, fully connected: each person signs in with Google once; the server keeps their
-- refresh token (never sent to the app) and reads/writes their main calendar on their behalf.
create table if not exists public.google_tokens (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  google_email  text not null default '',
  scope         text not null default '',
  updated_at    timestamptz not null default now()
);
alter table public.google_tokens enable row level security; -- no policies: server only

create table if not exists public.google_oauth_states (
  state      text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.google_oauth_states enable row level security; -- server only

grant select, insert, update, delete on public.google_tokens, public.google_oauth_states to service_role;
notify pgrst, 'reload schema';
