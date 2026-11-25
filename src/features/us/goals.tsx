/** Goals, in sections (Learning, Health, Finance…): big goals with steps, or goals with a number to reach. */
import { Check, Minus, Plus, Target, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/AppShell';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { ProgressBar } from '@/components/ui/Progress';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { Toggle } from '@/components/ui/Toggle';
import { useSession } from '@/features/auth/session';
import { useTable, useTableActions } from '@/hooks/useTable';
import { sendActivity } from '@/lib/activity';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';
import { uid } from '@/lib/localDb';
import { usePartnerStore } from '@/lib/partner';
import { toast } from '@/stores/toastStore';
import type { Goal, GoalArea, GoalStatus } from '@/types/db';

const ACCENT = 'var(--color-accent)';

export const AREAS: { value: GoalArea; label: string; emoji: string }[] = [
  { value: 'learning', label: 'Learning', emoji: '📚' },
  { value: 'health', label: 'Health', emoji: '💪' },
  { value: 'finance', label: 'Finance', emoji: '💰' },
  { value: 'business', label: 'Business', emoji: '💼' },
  { value: 'relationship', label: 'Relationship', emoji: '❤️' },
  { value: 'travel', label: 'Travel', emoji: '✈️' },
  { value: 'personal', label: 'Personal', emoji: '🌱' },
];

const STATUSES: { value: GoalStatus; label: string }[] = [
  { value: 'todo', label: 'Not started' },
  { value: 'doing', label: 'In progress' },
  { value: 'done', label: 'Done' },
];

const areaOf = (g: Goal): GoalArea => g.area ?? 'personal';
/** Where a goal stands: numbers decide for number goals, otherwise its status. */
export function statusOf(g: Goal): GoalStatus {
  if (g.done_at) return 'done';
  if (g.target > 0) return g.progress > 0 ? 'doing' : 'todo';
  return g.status ?? 'todo';
}
function percent(g: Goal): number | null {
  if (g.target > 0) return Math.min(100, Math.round((g.progress / g.target) * 100));
  const steps = g.steps ?? [];
  if (steps.length) return Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
  return null;
}

function useNameOf() {
  const me = useSession((s) => s.user);
  const { partner, self } = usePartnerStore();
  return (id?: string) => (!id || id === 'both' ? '' : id === me?.id ? (self?.name ?? t('Me')) : id === partner?.id ? partner.name : '');
}

export function GoalsPage() {
  const { data: rows = [] } = useTable('goals');
  const [tab, setTabState] = useState<GoalArea>(() => {
    try {
      const v = localStorage.getItem('fit.goals.tab') as GoalArea | null;
      if (v && AREAS.some((a) => a.value === v)) return v;
    } catch {
      /* fine */
    }
    return 'learning';
  });
  const setTab = (v: GoalArea) => {
    setTabState(v);
    try {
      localStorage.setItem('fit.goals.tab', v);
    } catch {
      /* fine */
    }
  };
  const [sheet, setSheet] = useState<{ goal: Goal | null } | null>(null);
  const nameOf = useNameOf();
  const inTab = rows.filter((g) => areaOf(g) === tab).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const area = AREAS.find((a) => a.value === tab)!;
  const groups: { status: GoalStatus; title: string }[] = [
    { status: 'doing', title: t('In progress') },
    { status: 'todo', title: t('Not started') },
    { status: 'done', title: t('Done') },
  ];
  return (
    <>
      <PageHeader
        title={t('Goals')}
        subtitle={t('Short and long term, together')}
        right={
          <IconButton label={t('New goal')} onClick={() => setSheet({ goal: null })}>
            <Plus size={22} />
          </IconButton>
        }
      />
      <div className="-mx-4 mb-3 overflow-x-auto px-4 [scrollbar-width:none]" role="tablist">
        <div className="flex w-max gap-1.5">
          {AREAS.map((a) => {
            const on = a.value === tab;
            const n = rows.filter((g) => areaOf(g) === a.value && statusOf(g) !== 'done').length;
            return (
              <button
                key={a.value}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(a.value)}
                className={cn('press flex h-11 items-center gap-1.5 rounded-full px-3.5 text-sm', on ? 'bg-accent/20 font-semibold text-ink ring-1 ring-accent/50' : 'bg-white/[0.05] text-ink-2')}
              >
                <span>{a.emoji}</span>
                {t(a.label)}
                {n > 0 && <span className="tabular text-xs text-ink-3">{n}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="space-y-3">
        {!inTab.length && (
          <Card title={`${area.emoji} ${t(area.label)}`} icon={Target} accent={ACCENT}>
            <p className="text-sm text-ink-2">{t('No goals here yet.')}</p>
            <Button variant="primary" accent={ACCENT} block className="mt-3" onClick={() => setSheet({ goal: null })}>
              <Plus size={16} /> {t('Add a goal')}
            </Button>
          </Card>
        )}
        {groups.map(({ status, title }) => {
          const list = inTab.filter((g) => statusOf(g) === status);
          if (!list.length) return null;
          return (
            <Card key={status} title={`${title} · ${list.length}`} icon={status === 'done' ? Check : Target} accent={ACCENT}>
              <ul className="space-y-1.5">
                {list.map((g) => {
                  const pct = percent(g);
                  const who = nameOf(g.owner);
                  const steps = g.steps ?? [];
                  return (
                    <li key={g.id}>
                      <button type="button" onClick={() => setSheet({ goal: g })} className={cn('press w-full rounded-2xl bg-white/[0.04] px-3 py-2.5 text-start', status === 'done' && 'opacity-60')}>
                        <span className="flex items-center gap-2">
                          <span className={cn('min-w-0 flex-1 truncate text-[15px] font-medium', status === 'done' && 'line-through')}>{g.title.trim()}</span>
                          {pct !== null && <span className="tabular text-xs text-ink-3">{pct}%</span>}
                        </span>
                        {(who || steps.length > 0 || g.target > 0) && (
                          <span className="mt-0.5 block truncate text-xs text-ink-3">
                            {[
                              who,
                              g.target > 0 ? `${g.progress.toLocaleString()} / ${g.target.toLocaleString()} ${g.unit}`.trim() : null,
                              steps.length ? t('{done} of {n} steps', { done: steps.filter((s) => s.done).length, n: steps.length }) : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                        {pct !== null && status !== 'done' && <ProgressBar value={pct} max={100} accent={ACCENT} className="mt-2 h-1.5" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
      </div>
      <GoalSheet open={sheet !== null} goal={sheet?.goal ?? null} area={tab} onClose={() => setSheet(null)} />
    </>
  );
}

function GoalSheet({ open, goal, area: defaultArea, onClose }: { open: boolean; goal: Goal | null; area: GoalArea; onClose: () => void }) {
  const me = useSession((s) => s.user);
  const partner = usePartnerStore((s) => s.partner);
  const actions = useTableActions('goals');
  const [title, setTitle] = useState('');
  const [area, setArea] = useState<GoalArea>('learning');
  const [owner, setOwner] = useState('both');
  const [status, setStatus] = useState<GoalStatus>('todo');
  const [numbered, setNumbered] = useState(false);
  const [target, setTarget] = useState('');
  const [progress, setProgress] = useState(0);
  const [unit, setUnit] = useState('');
  const [steps, setSteps] = useState<NonNullable<Goal['steps']>>([]);
  const [stepText, setStepText] = useState('');
  const [note, setNote] = useState('');
  const [seeded, setSeeded] = useState<string | null>(null);
  const key = open ? (goal?.id ?? `new-${defaultArea}`) : null;
  if (key !== seeded) {
    setSeeded(key);
    if (open) {
      setTitle(goal?.title.trim() ?? '');
      setArea(goal ? areaOf(goal) : defaultArea);
      setOwner(goal?.owner ?? 'both');
      setStatus(goal ? statusOf(goal) : 'todo');
      setNumbered(Boolean(goal && goal.target > 0));
      setTarget(goal && goal.target > 0 ? String(goal.target) : '');
      setProgress(goal?.progress ?? 0);
      setUnit(goal?.unit ?? '');
      setSteps(goal?.steps ?? []);
      setStepText('');
      setNote(goal?.note ?? '');
    }
  }
  const whoOptions = [
    { value: 'both', label: t('Together') },
    ...(me ? [{ value: me.id, label: t('Me') }] : []),
    ...(partner ? [{ value: partner.id, label: partner.name }] : []),
  ];
  const n = numbered ? Number(target) : 0;
  const valid = Boolean(title.trim()) && (!numbered || n > 0);
  const addStep = () => {
    const v = stepText.trim();
    if (!v) return;
    setSteps((s) => [...s, { id: uid(), text: v.slice(0, 120), done: false }]);
    setStepText('');
  };
  const save = () => {
    if (!valid) return;
    const reached = numbered ? progress >= n : status === 'done';
    const row: Goal = {
      id: goal?.id ?? uid(),
      title: title.trim().slice(0, 80),
      emoji: AREAS.find((a) => a.value === area)?.emoji ?? '🎯',
      target: n,
      progress: numbered ? progress : 0,
      unit: numbered ? unit.trim().slice(0, 16) : '',
      due: goal?.due ?? null,
      done_at: reached ? (goal?.done_at ?? new Date().toISOString()) : null,
      created_at: goal?.created_at ?? new Date().toISOString(),
      area,
      owner,
      status: numbered ? (reached ? 'done' : progress > 0 ? 'doing' : 'todo') : status,
      steps,
      note: note.trim(),
    };
    actions.put(row);
    if (reached && !goal?.done_at) {
      toast.success(t('Goal reached: {title} 🎉', { title: row.title }));
      sendActivity('goal', { title: row.title });
    }
    onClose();
  };
  const step = n >= 100 ? Math.round(n / 20) : 1;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={goal ? t('Goal') : t('New goal')}
      footer={
        <div className="flex gap-2">
          {goal && (
            <IconButton
              label={t('Delete')}
              className="size-12 bg-danger/12 text-danger"
              onClick={() => {
                actions.remove(goal.id, t('Deleted “{title}”', { title: goal.title.trim() }));
                onClose();
              }}
            >
              <Trash2 size={18} />
            </IconButton>
          )}
          <Button variant="primary" accent={ACCENT} size="lg" className="flex-1" disabled={!valid} onClick={save}>
            {goal ? t('Save') : t('Add goal')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label={t('Goal')} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('e.g. Learn German, Buy a car')} maxLength={80} />
        <div>
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-3">{t('Section')}</span>
          <div className="flex flex-wrap gap-1.5">
            {AREAS.map((a) => (
              <button
                key={a.value}
                type="button"
                aria-pressed={area === a.value}
                onClick={() => setArea(a.value)}
                className={cn('press h-9 rounded-full px-3 text-sm', area === a.value ? 'bg-accent/20 font-semibold text-ink ring-1 ring-accent/50' : 'bg-white/[0.05] text-ink-2')}
              >
                {a.emoji} {t(a.label)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-3">{t('Whose goal')}</span>
          <Segmented value={owner} accent={ACCENT} onChange={setOwner} options={whoOptions} />
        </div>
        <label className="flex items-center justify-between rounded-2xl bg-white/[0.035] px-3 py-2.5">
          <span>
            <span className="block text-sm font-medium">{t('Track a number')}</span>
            <span className="block text-xs text-ink-3">{t('Like save 5,000 JD or read 12 books')}</span>
          </span>
          <Toggle checked={numbered} onChange={setNumbered} label={t('Track a number')} accent={ACCENT} />
        </label>
        {numbered ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label={t('Target')} inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value.replace(/[^\d.]/g, ''))} placeholder="5000" />
              <Field label={t('Unit')} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={t('e.g. JD, km, books')} />
            </div>
            {n > 0 && (
              <div className="flex items-center gap-2">
                <IconButton label={t('Less')} className="size-10 bg-white/[0.05]" onClick={() => setProgress((p) => Math.max(0, p - step))}>
                  <Minus size={16} />
                </IconButton>
                <div className="flex-1">
                  <ProgressBar value={progress} max={n} accent={ACCENT} className="h-2.5" />
                  <div className="tabular mt-1 text-center text-xs text-ink-3">
                    {progress.toLocaleString()} / {n.toLocaleString()} {unit}
                  </div>
                </div>
                <IconButton label={t('More')} className="size-10 bg-accent/20 text-accent" onClick={() => setProgress((p) => Math.round((p + step) * 100) / 100)}>
                  <Plus size={16} />
                </IconButton>
              </div>
            )}
          </div>
        ) : (
          <div>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-3">{t('Status')}</span>
            <Segmented value={status} accent={ACCENT} onChange={setStatus} options={STATUSES.map((s) => ({ value: s.value, label: t(s.label) }))} />
          </div>
        )}
        <div>
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-3">{t('Steps')}</span>
          {steps.length > 0 && (
            <ul className="mb-2 space-y-1">
              {steps.map((s) => (
                <li key={s.id} className="flex items-center gap-2 rounded-xl bg-white/[0.035] px-2 py-1.5">
                  <button
                    type="button"
                    aria-label={s.done ? t('Mark not done') : t('Mark done')}
                    onClick={() => setSteps((list) => list.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))}
                    className={cn('press grid size-6 shrink-0 place-items-center rounded-full border', s.done ? 'border-accent bg-accent text-bg' : 'border-white/25')}
                  >
                    {s.done && <Check size={14} strokeWidth={3} />}
                  </button>
                  <span className={cn('min-w-0 flex-1 text-sm', s.done && 'text-ink-3 line-through')}>{s.text}</span>
                  <button type="button" aria-label={t('Remove step')} onClick={() => setSteps((list) => list.filter((x) => x.id !== s.id))} className="press p-1 text-ink-3">
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addStep();
            }}
          >
            <input
              value={stepText}
              onChange={(e) => setStepText(e.target.value)}
              placeholder={t('Add a step, e.g. Find a course')}
              maxLength={120}
              className="h-11 min-w-0 flex-1 rounded-2xl border border-white/[0.07] bg-white/[0.04] px-3.5 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-accent/60"
            />
            <IconButton label={t('Add step')} className="size-11 bg-white/[0.06]" disabled={!stepText.trim()} onClick={addStep}>
              <Plus size={18} />
            </IconButton>
          </form>
        </div>
        <Field label={t('Note')} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Optional')} />
      </div>
    </Sheet>
  );
}

/** The Us tab's goals card: where you stand in each section, and a way in. */
export function GoalsCard() {
  const { data: rows = [] } = useTable('goals');
  const doing = rows.filter((g) => statusOf(g) === 'doing').slice(0, 3);
  const counts = AREAS.map((a) => ({ ...a, n: rows.filter((g) => areaOf(g) === a.value && statusOf(g) !== 'done').length })).filter((a) => a.n > 0);
  const reached = rows.filter((g) => statusOf(g) === 'done').length;
  return (
    <Card
      title={t('Goals')}
      icon={Target}
      accent={ACCENT}
      action={
        <Link to="/us/goals" className="text-xs font-semibold text-accent">
          {t('Open')}
        </Link>
      }
    >
      {rows.length === 0 ? (
        <Link to="/us/goals" className="press block rounded-2xl border border-dashed border-white/10 p-4 text-sm text-ink-3">
          {t('Learning, health, money, business… set goals together and break them into steps.')}
        </Link>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {counts.map((a) => (
              <Link key={a.value} to="/us/goals" onClick={() => localStorage.setItem('fit.goals.tab', a.value)} className="press rounded-full bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-ink-2">
                {a.emoji} {t(a.label)} <span className="tabular text-ink-3">{a.n}</span>
              </Link>
            ))}
          </div>
          {doing.length > 0 && (
            <ul className="mt-3 space-y-2">
              {doing.map((g) => {
                const pct = percent(g);
                return (
                  <li key={g.id}>
                    <div className="flex items-center gap-2 text-sm">
                      <span>{g.emoji}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{g.title.trim()}</span>
                      {pct !== null && <span className="tabular text-xs text-ink-3">{pct}%</span>}
                    </div>
                    {pct !== null && <ProgressBar value={pct} max={100} accent={ACCENT} className="mt-1 h-1.5" />}
                  </li>
                );
              })}
            </ul>
          )}
          {reached > 0 && <p className="mt-3 text-xs text-ink-3">{t('{n} goal(s) reached together 🎉', { n: reached })}</p>}
        </>
      )}
    </Card>
  );
}
