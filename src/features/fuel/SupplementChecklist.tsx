import { Check, Pill } from 'lucide-react';
import { t } from '@/lib/i18n';
import { Empty } from '@/components/ui/States';
import { useSupplementLogs, useSupplements, useToggleSupplementTaken } from '@/hooks/useSupplements';
import { tick } from '@/lib/alerts';
import { cn } from '@/lib/cn';

export function SupplementChecklist({ date, onManage }: { date: string; onManage: () => void }) {
  const { data: all = [], isLoading } = useSupplements();
  const { data: taken = [] } = useSupplementLogs(date);
  const toggle = useToggleSupplementTaken(date);
  const active = all.filter((s) => s.active);

  if (isLoading) return null;
  if (!active.length)
    return (
      <button type="button" onClick={onManage} className="block w-full">
        <Empty icon={Pill} title={t('No active supplements')}>
          {t('Tap to open your shelf and switch on what you have.')}
        </Empty>
      </button>
    );

  const done = active.filter((s) => taken.includes(s.id)).length;
  return (
    <div>
      <div className="mb-2 text-xs text-ink-3">
        {t('{done} of {total} taken', { done, total: active.length })}
      </div>
      <ul className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
        {active.map((s) => {
          const isTaken = taken.includes(s.id);
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  tick();
                  toggle.mutate({ id: s.id, taken: !isTaken });
                }}
                aria-pressed={isTaken}
                className={cn(
                  'flex min-h-14 w-full items-center gap-2.5 rounded-2xl border px-3 py-2 text-start transition active:scale-[0.97]',
                  isTaken ? 'border-supp/40 bg-supp/12' : 'border-line bg-surface-2',
                )}
              >
                <span
                  className={cn(
                    'grid size-6 shrink-0 place-items-center rounded-full border-2 transition',
                    isTaken ? 'border-supp bg-supp text-bg' : 'border-ink-3',
                  )}
                >
                  {isTaken && <Check size={14} strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className={cn('line-clamp-2 block text-sm font-medium leading-tight', isTaken && 'text-ink-2 line-through')}>
                    {s.name}
                  </span>
                  {s.dosage && <span className="block truncate text-[11px] text-ink-3">{s.dosage}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
