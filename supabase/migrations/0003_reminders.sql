-- Replete: push notification reminders.
-- Each phone that allows notifications stores a push subscription; reminders are checked every
-- minute by the `send-reminders` edge function (scheduled with pg_cron + pg_net).

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);

create table if not exists public.reminders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('water','supplements','weighin','workout','journal','bedtime','habits','custom')),
  title       text not null default '' check (char_length(title) <= 80),
  times       text[] not null default '{}',          -- 'HH:MM' in the user's time zone
  days        int[]  not null default '{}',          -- JS weekdays (0 = Sunday); empty = every day
  enabled     boolean not null default true,
  smart       boolean not null default true,         -- skip when already done today
  tz          text not null default 'UTC',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, kind, title)
);
create index if not exists reminders_enabled on public.reminders (enabled) where enabled;

-- One row per reminder per time slot, so a reminder is never sent twice for the same slot.
create table if not exists public.reminder_sends (
  reminder_id uuid not null references public.reminders (id) on delete cascade,
  slot        text not null,                          -- 'YYYY-MM-DD HH:MM' local time
  sent_at     timestamptz not null default now(),
  primary key (reminder_id, slot)
);

alter table public.push_subscriptions enable row level security;
alter table public.reminders enable row level security;
alter table public.reminder_sends enable row level security;   -- no policies: server only

drop policy if exists "push: own rows" on public.push_subscriptions;
create policy "push: own rows" on public.push_subscriptions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "reminders: own rows" on public.reminders;
create policy "reminders: own rows" on public.reminders for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.push_subscriptions, public.reminders, public.reminder_sends from anon;
revoke all on public.reminder_sends from authenticated;
grant select, insert, update, delete on public.push_subscriptions, public.reminders to authenticated;

-- Old send records are only needed for de-duplication.
select cron.unschedule('replete-prune-sends') where exists (select 1 from cron.job where jobname = 'replete-prune-sends');
select cron.schedule('replete-prune-sends', '17 3 * * *', $$ delete from public.reminder_sends where sent_at < now() - interval '3 days' $$);

-- The sender (edge function) runs as service_role; new tables aren't exposed to it automatically.
grant select, insert, update, delete on public.reminders, public.reminder_sends, public.push_subscriptions to service_role;
grant select on public.records to service_role;
