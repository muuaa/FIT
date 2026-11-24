-- Reminders for a single habit: kind 'habit', the habit's id in `title`, with any number of times
-- and days like other reminders.
alter table public.reminders drop constraint if exists reminders_kind_check;
alter table public.reminders add constraint reminders_kind_check
  check (kind in ('water','supplements','weighin','workout','journal','bedtime','habits','habit','custom'));
