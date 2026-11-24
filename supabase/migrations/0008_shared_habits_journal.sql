-- Habits and the journal become shared. Habits move as-is; each habit tick and journal entry is
-- stamped with who made it (`by`) and keyed per person. Safe to run again: newer shared rows win.
insert into public.household_records (tbl, row_id, data, deleted)
select r.tbl,
       case when r.tbl = 'habits' then r.row_id else r.row_id || '|' || r.user_id end,
       case when r.tbl = 'habits' then r.data else r.data || jsonb_build_object('by', r.user_id) end,
       false
from public.records r
where r.tbl in ('habits', 'habit_logs', 'journal') and not r.deleted
on conflict (tbl, row_id) do nothing;
