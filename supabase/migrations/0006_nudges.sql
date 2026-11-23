-- Nudges: a quick push notification to your partner. Logged server-side for rate limiting only.
create table if not exists public.nudge_log (
  id         bigint generated always as identity primary key,
  from_user  uuid not null references auth.users (id) on delete cascade,
  text       text not null,
  created_at timestamptz not null default now()
);
create index if not exists nudge_log_from on public.nudge_log (from_user, created_at desc);
alter table public.nudge_log enable row level security;   -- no policies: server only
revoke all on public.nudge_log from anon, authenticated;
grant select, insert, delete on public.nudge_log to service_role;
grant usage on sequence public.nudge_log_id_seq to service_role;
