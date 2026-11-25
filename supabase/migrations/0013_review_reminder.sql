-- A weekly-review reminder kind.
alter table public.reminders drop constraint if exists reminders_kind_check;
alter table public.reminders add constraint reminders_kind_check
  check (kind in ('water','supplements','weighin','workout','journal','bedtime','habits','habit','review','custom'));
