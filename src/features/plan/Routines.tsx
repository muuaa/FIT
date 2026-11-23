import { Check, ChevronDown, Plus, Settings2, Sun, Moon, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { useTable, useTableActions } from '@/hooks/useTable';
import { useToday } from '@/hooks/useToday';
import { tick } from '@/lib/alerts';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';
import { uid } from '@/lib/localDb';
import type { Routine } from '@/types/db';

const PRESETS: { name: string; emoji: string; part: Routine['part']; steps: string[] }[] = [
  { name: 'Morning', emoji: '🌅', part: 'morning', steps: ['Drink a glass of water', 'Make the bed', 'Stretch 5 minutes', 'Plan the day'] },
  { name: 'Evening', emoji: '🌙', part: 'evening', steps: ['Tidy up 10 minutes', 'Prepare tomorrow', 'No screens 30 min before bed', 'Read'] },
];

function RoutineEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: routines = [] } = useTable('routines');
  const actions = useTableActions('routines');
  const [name, setName] = useState('');
  const [part, setPart] = useState<Routine['part']>('morning');
  const [steps, setSteps] = useState('');
  const add = (r: Omit<Routine, 'id' | 'position' | 'created_at'>) =>
    actions.insert({ ...r, id: uid(), position: routines.length, created_at: new Date().toISOString() });
  return (
    <Sheet open={open} onClose={onClose} title={t('Routines')}>
      <div className="space-y-4">
        {routines.length > 0 && (
          <ul className="space-y-2">
            {routines.map((r) => (
              <li key={r.id} className="flex items-center gap-2 rounded-2xl bg-white/[0.04] py-2 ps-3 pe-1">
                <span className="text-xl">{r.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.name}</span>
                  <span className="block truncate text-xs text-ink-3">{t('{n} steps', { n: r.steps.length })}</span>
                </span>
                <IconButton label={t('Delete')} onClick={() => actions.remove(r.id, t('Deleted “{title}”', { title: r.name }))}>
                  <Trash2 size={16} />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
        {routines.length === 0 && (
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => add({ name: t(p.name), emoji: p.emoji, part: p.part, steps: p.steps.map((s) => t(s)) })}
                className="press rounded-2xl border border-white/[0.06] bg-white/[0.04] p-3 text-start"
              >
                <div className="text-2xl">{p.emoji}</div>
                <div className="mt-1 text-sm font-semibold">{t('Add {name} routine', { name: t(p.name) })}</div>
                <div className="text-xs text-ink-3">{t('{n} steps', { n: p.steps.length })}</div>
              </button>
            ))}
          </div>
        )}
        <div className="space-y-2 rounded-2xl border border-dashed border-white/10 p-3">
          <div className="text-sm font-semibold">{t('New routine')}</div>
          <Field label={t('Name')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('e.g. After work')} />
          <Segmented<Routine['part']>
            size="sm"
            value={part}
            onChange={setPart}
            accent="var(--color-todo)"
            options={[
              { value: 'morning', label: t('Morning') },
              { value: 'evening', label: t('Evening') },
              { value: 'any', label: t('Any time') },
            ]}
          />
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-3">{t('Steps (one per line)')}</span>
            <textarea
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3 text-ink outline-none focus:border-accent/60"
            />
          </label>
          <Button
            block
            variant="primary"
            accent="var(--color-todo)"
            disabled={!name.trim() || !steps.trim()}
            onClick={() => {
              add({
                name: name.trim(),
                emoji: part === 'morning' ? '🌅' : part === 'evening' ? '🌙' : '✨',
                part,
                steps: steps.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 20),
              });
              setName('');
              setSteps('');
            }}
          >
            <Plus size={16} /> {t('Add routine')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

export function RoutinesCard() {
  const today = useToday();
  const { data: routines = [] } = useTable('routines');
  const { data: logs = [] } = useTable('routine_logs');
  const logActions = useTableActions('routine_logs');
  const [open, setOpen] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);
  const hour = new Date().getHours();
  const sorted = [...routines].sort((a, b) => {
    // Show the one that fits the time of day first.
    const rank = (r: Routine) => (r.part === (hour < 15 ? 'morning' : 'evening') ? 0 : r.part === 'any' ? 1 : 2);
    return rank(a) - rank(b) || a.position - b.position;
  });
  const toggle = (r: Routine, i: number) => {
    tick();
    const cur = logs.find((l) => l.routine_id === r.id && l.date === today)?.done ?? [];
    const next = cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i];
    if (next.length) logActions.put({ routine_id: r.id, date: today, done: next });
    else logActions.remove(`${r.id}|${today}`);
  };
  return (
    <Card
      title={t('Routines')}
      icon={hour < 15 ? Sun : Moon}
      accent="var(--color-sleep)"
      action={
        <IconButton label={t('Edit routines')} onClick={() => setEdit(true)}>
          <Settings2 size={18} />
        </IconButton>
      }
    >
      {sorted.length === 0 ? (
        <button type="button" onClick={() => setEdit(true)} className="press w-full rounded-2xl border border-dashed border-white/10 p-4 text-sm text-ink-3">
          {t('Add a morning or evening routine: small steps you tick off each day.')}
        </button>
      ) : (
        <ul className="space-y-2">
          {sorted.map((r) => {
            const done = logs.find((l) => l.routine_id === r.id && l.date === today)?.done ?? [];
            const complete = done.length >= r.steps.length;
            const isOpen = open === r.id || (open === null && r === sorted[0] && !complete);
            return (
              <li key={r.id} className="rounded-2xl bg-white/[0.035]">
                <button type="button" onClick={() => setOpen(isOpen ? '' : r.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-start">
                  <span className="text-xl">{r.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-sm font-semibold', complete && 'text-ink-3')}>{r.name}</span>
                    <span className="tabular block text-xs text-ink-3">
                      {done.length}/{r.steps.length}
                    </span>
                  </span>
                  {complete ? (
                    <span className="grid size-6 place-items-center rounded-full bg-sleep text-bg">
                      <Check size={14} strokeWidth={3} />
                    </span>
                  ) : (
                    <ChevronDown size={18} className={cn('text-ink-3 transition-transform', isOpen && 'rotate-180')} />
                  )}
                </button>
                {isOpen && (
                  <ul className="space-y-1 px-2 pb-2">
                    {r.steps.map((s, i) => {
                      const on = done.includes(i);
                      return (
                        <li key={i}>
                          <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(r, i)} className="press flex w-full items-center gap-3 rounded-xl px-2 py-2 text-start">
                            <span className={cn('grid size-5 shrink-0 place-items-center rounded-md border-2', on ? 'border-sleep bg-sleep text-bg' : 'border-ink-3')}>
                              {on && <Check size={12} strokeWidth={3} />}
                            </span>
                            <span className={cn('text-sm', on && 'text-ink-3 line-through')}>{s}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <RoutineEditor open={edit} onClose={() => setEdit(false)} />
    </Card>
  );
}
