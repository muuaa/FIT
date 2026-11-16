import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, relativeDay, todayISO } from '@/lib/date';
import { IconButton } from './Button';

export function DayPicker({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const isToday = date >= todayISO();
  return (
    <div className="mb-4 flex items-center justify-between rounded-2xl bg-surface px-1 py-1">
      <IconButton label="Previous day" onClick={() => onChange(addDays(date, -1))}>
        <ChevronLeft size={20} />
      </IconButton>
      <button type="button" className="text-sm font-semibold" onClick={() => onChange(todayISO())}>
        {relativeDay(date)}
      </button>
      <IconButton label="Next day" onClick={() => onChange(addDays(date, 1))} disabled={isToday}>
        <ChevronRight size={20} />
      </IconButton>
    </div>
  );
}
