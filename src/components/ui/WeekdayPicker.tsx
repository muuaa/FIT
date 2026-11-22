import { weekdayNarrow } from '@/lib/date';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

const ORDER = [6, 0, 1, 2, 3, 4, 5]; // Sat → Fri, common in Jordan; display order only

/** Pick weekdays (JS numbers). Empty selection means "every day". */
export function WeekdayPicker({ value, onChange, accent }: { value: number[]; onChange: (v: number[]) => void; accent: string }) {
  const every = value.length === 0 || value.length === 7;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-ink-3">{t('Days')}</span>
        <button type="button" onClick={() => onChange([])} className={cn('text-xs font-semibold', every ? 'text-ink' : 'text-ink-3')}>
          {t('Every day')}
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {ORDER.map((wd) => {
          const on = every || value.includes(wd);
          return (
            <button
              key={wd}
              type="button"
              aria-pressed={on}
              onClick={() => {
                const base = every ? [0, 1, 2, 3, 4, 5, 6] : value;
                const next = on ? base.filter((d) => d !== wd) : [...base, wd];
                onChange(next.length === 7 ? [] : next.length === 0 ? [wd] : next.sort());
              }}
              className={cn('h-10 rounded-xl text-sm font-semibold transition active:scale-95', on ? 'text-bg' : 'bg-surface-2 text-ink-3')}
              style={on ? { background: accent } : undefined}
            >
              {weekdayNarrow(wd)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
