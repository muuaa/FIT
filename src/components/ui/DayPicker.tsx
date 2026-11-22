import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, relativeDay, todayISO } from '@/lib/date';
import { t } from '@/lib/i18n';
import { IconButton } from './Button';

export function DayPicker({
  date,
  onChange,
  allowFuture = false,
  className = 'mb-4',
}: {
  date: string;
  onChange: (d: string) => void;
  allowFuture?: boolean;
  className?: string;
}) {
  const today = todayISO();
  const atEnd = !allowFuture && date >= today;
  return (
    <div className={`flex items-center justify-between rounded-2xl bg-surface px-1 py-1 ${className}`}>
      <IconButton label={t('Previous day')} onClick={() => onChange(addDays(date, -1))}>
        <ChevronLeft size={20} className="rtl:-scale-x-100" />
      </IconButton>
      <button type="button" className="min-h-10 flex-1 text-sm font-semibold" onClick={() => onChange(today)}>
        {relativeDay(date)}
        {date !== today && <span className="ms-2 text-xs font-medium text-ink-3">{t('Back to today')}</span>}
      </button>
      <IconButton label={t('Next day')} onClick={() => onChange(addDays(date, 1))} disabled={atEnd}>
        <ChevronRight size={20} className="rtl:-scale-x-100" />
      </IconButton>
    </div>
  );
}
