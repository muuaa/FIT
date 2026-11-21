-- FIT — Fitness Command Center
-- Initial schema. Run once in Supabase → SQL Editor (or `supabase db push`).
-- Every table is per-user and protected by Row Level Security: a signed-in user
-- can only ever read or write rows where user_id = auth.uid().

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles: per-user targets and preferences
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  display_name         text not null default '',
  kcal_target          integer not null default 2700 check (kcal_target between 500 and 10000),
  protein_target_g     integer not null default 160 check (protein_target_g between 0 and 1000),
  carbs_target_g       integer not null default 340 check (carbs_target_g between 0 and 2000),
  fat_target_g         integer not null default 75  check (fat_target_g between 0 and 1000),
  water_target_ml      integer not null default 4000 check (water_target_ml between 250 and 15000),
  bottle_ml            integer not null default 800  check (bottle_ml between 100 and 3000),
  water_step_ml        integer not null default 250  check (water_step_ml between 50 and 3000),
  split_mode           text not null default 'PPL-UL' check (split_mode in ('PPL-UL', 'UL-PPL')),
  default_rest_seconds integer not null default 90 check (default_rest_seconds between 10 and 900),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Training
-- ---------------------------------------------------------------------------
create table public.exercises (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day_type    text not null check (day_type in ('push', 'pull', 'legs', 'upper', 'lower')),
  name        text not null check (char_length(name) between 1 and 80),
  target_sets integer not null default 3 check (target_sets between 1 and 20),
  target_reps text not null default '8-12',
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index exercises_user_day_idx on public.exercises (user_id, day_type, position);

create table public.workout_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date             date not null,
  day_type         text not null check (day_type in ('push', 'pull', 'legs', 'upper', 'lower')),
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  duration_seconds integer,
  created_at       timestamptz not null default now()
);
create index workout_sessions_user_date_idx on public.workout_sessions (user_id, date desc);

create table public.set_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id    uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id   uuid references public.exercises (id) on delete set null,
  exercise_name text not null,
  set_number    integer not null check (set_number between 1 and 50),
  weight_kg     numeric(6, 2) not null check (weight_kg >= 0),
  reps          integer not null check (reps between 0 and 1000),
  created_at    timestamptz not null default now()
);
create index set_logs_user_exercise_idx on public.set_logs (user_id, exercise_id, created_at desc);
create index set_logs_session_idx on public.set_logs (session_id);

-- ---------------------------------------------------------------------------
-- Nutrition
-- ---------------------------------------------------------------------------
create table public.food_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date       date not null,
  name       text not null check (char_length(name) between 1 and 80),
  kcal       integer not null check (kcal between 0 and 10000),
  protein_g  numeric(6, 1) not null default 0 check (protein_g >= 0),
  carbs_g    numeric(6, 1) not null default 0 check (carbs_g >= 0),
  fat_g      numeric(6, 1) not null default 0 check (fat_g >= 0),
  created_at timestamptz not null default now()
);
create index food_entries_user_date_idx on public.food_entries (user_id, date);

create table public.saved_meals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 80),
  kcal       integer not null check (kcal between 0 and 10000),
  protein_g  numeric(6, 1) not null default 0,
  carbs_g    numeric(6, 1) not null default 0,
  fat_g      numeric(6, 1) not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Hydration (one row per user per day)
-- ---------------------------------------------------------------------------
create table public.water_days (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date       date not null,
  ml         integer not null default 0 check (ml between 0 and 20000),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- ---------------------------------------------------------------------------
-- Supplements
-- ---------------------------------------------------------------------------
create table public.supplements (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  dosage     text not null default '',
  active     boolean not null default false,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);
create index supplements_user_idx on public.supplements (user_id, position);

create table public.supplement_logs (
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  supplement_id uuid not null references public.supplements (id) on delete cascade,
  date          date not null,
  taken_at      timestamptz not null default now(),
  primary key (user_id, supplement_id, date)
);

-- ---------------------------------------------------------------------------
-- Bodyweight & cardio
-- ---------------------------------------------------------------------------
create table public.bodyweight_logs (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date       date not null,
  weight_kg  numeric(5, 2) not null check (weight_kg between 20 and 400),
  created_at timestamptz not null default now(),
  primary key (user_id, date)
);

create table public.cardio_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date             date not null,
  kind             text not null check (kind in ('running', 'jump_rope')),
  duration_seconds integer not null check (duration_seconds between 1 and 86400),
  distance_km      numeric(6, 2) check (distance_km is null or distance_km > 0),
  rounds           integer check (rounds is null or rounds > 0),
  jump_count       integer check (jump_count is null or jump_count > 0),
  notes            text not null default '',
  created_at       timestamptz not null default now()
);
create index cardio_logs_user_date_idx on public.cardio_logs (user_id, date desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
create policy "own profile: select" on public.profiles for select using (id = auth.uid());
create policy "own profile: insert" on public.profiles for insert with check (id = auth.uid());
create policy "own profile: update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array[
    'exercises', 'workout_sessions', 'food_entries', 'saved_meals',
    'water_days', 'supplements', 'bodyweight_logs', 'cardio_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t
    );
  end loop;
end $$;

-- Child rows must also point at parents owned by the same user (foreign keys bypass RLS).
alter table public.set_logs enable row level security;
create policy "own rows" on public.set_logs for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = auth.uid())
    and (exercise_id is null or exists (select 1 from public.exercises e where e.id = exercise_id and e.user_id = auth.uid()))
  );

alter table public.supplement_logs enable row level security;
create policy "own rows" on public.supplement_logs for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.supplements x where x.id = supplement_id and x.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- New-user bootstrap: profile + default supplement shelf (all inactive)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));

  insert into public.supplements (user_id, name, dosage, active, position) values
    (new.id, 'Whey Protein',           '1 scoop (~25 g protein)', false, 0),
    (new.id, 'Creatine Monohydrate',   '5 g',                     false, 1),
    (new.id, 'Omega-3',                '1–2 g EPA+DHA',           false, 2),
    (new.id, 'Zinc',                   '15–25 mg',                false, 3),
    (new.id, 'Magnesium Glycinate',    '200–400 mg',              false, 4),
    (new.id, 'Vitamin D3',             '1,000–2,000 IU',          false, 5),
    (new.id, 'Vitamin B12',            'per label',               false, 6);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger water_days_touch before update on public.water_days
  for each row execute function public.touch_updated_at();
