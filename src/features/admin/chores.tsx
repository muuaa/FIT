import { Check, Plus, Sparkles, Trash2 } from 'lucide-react';
import { sendActivity } from '@/lib/activity';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { useSession } from '@/features/auth/session';
import { useTable, useTableActions } from '@/hooks/useTable';
import { useToday } from '@/hooks/useToday';
import { tick } from '@/lib/alerts';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';
import { uid } from '@/lib/localDb';
import { usePartnerStore } from '@/lib/partner';
import { choreStatus } from '@/lib/plan';
import { toast } from '@/stores/toastStore';
import type { Chore } from '@/types/db';

const EMOJI = ['🧹', '🧺', '🍽️', '🗑️', '🛁', '🛏️', '🪴', '🐈', '🚗', '🛒', '🧽', '🪟'];
const EVERY = [1, 2, 3, 7, 14, 30];

function useNames() {
  const me = useSession((s) => s.user);
  const { partner, viewing, self } = usePartnerStore();
  // While viewing your partner's day, "You" would be them: use real names instead.
  const meLabel = viewing ? (self?.name ?? t('Me')) : t('You');
  return { meId: me?.id ?? 'me', partnerId: partner?.id ?? null, name: (id: string | null) => (!id ? '' : id === me?.id ? meLabel : id === partner?.id ? partner.name : '') };
}

export function ChoresPage() {
  const today = useToday();
  const { data: chores = [] } = useTable('chores');
  const actions = useTableActions('chores');
  const { meId, partnerId, name } = useNames();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('🧹');
  const [every, setEvery] = useState(7);
  const [assignee, setAssignee] = useState<string>('alternate');
  const list = chores
    .map((c) => ({ c, ...choreStatus(c, today, meId, partnerId) }))
    .sort((a, b) => a.days - b.days);
  const done = (c: Chore) => {
    tick();
    actions.put({ ...c, last_done: today, last_by: meId });
    sendActivity('chore', { title: c.name });
    toast.success(t('{name} done ✓', { name: c.name }));
  };
  const add = () => {
    if (!title.trim()) return;
    actions.insert({ id: uid(), name: title.trim().slice(0, 60), emoji, every_days: every, assignee, last_done: null, last_by: null, created_at: new Date().toISOString() });
    setTitle('');
    setOpen(false);
  };
  return (
    <>
      <PageHeader
        title={t('Chores')}
        back="/life"
        right={
          <IconButton label={t('New chore')} onClick={() => setOpen(true)}>
            <Plus size={22} />
          </IconButton>
        }
      />
      <Card title={t('Home chores')} icon={Sparkles} accent="var(--color-steps)">
        {list.length === 0 ? (
          <button type="button" onClick={() => setOpen(true)} className="press w-full rounded-2xl border border-dashed border-white/10 p-4 text-sm text-ink-3">
            {t('Add chores like laundry or taking out the trash. Set them to take turns and the app keeps it fair.')}
          </button>
        ) : (
          <ul className="space-y-1.5">
            {list.map(({ c, days, turn }) => (
              <li key={c.id} className="flex items-center gap-2 rounded-2xl bg-white/[0.04] py-2 ps-3 pe-2">
                <span className="text-2xl">{c.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{c.name}</span>
                  <span className={cn('block text-xs', days < 0 ? 'text-danger' : days === 0 ? 'text-steps' : 'text-ink-3')}>
                    {days < 0 ? t('{n} days late', { n: -days }) : days === 0 ? t('Due today') : t('In {n} days', { n: days })}
                    {turn && ` · ${t('{name}’s turn', { name: name(turn) })}`}
                  </span>
                </span>
                {days <= 0 && (
                  <Button size="sm" variant="primary" accent="var(--color-steps)" onClick={() => done(c)}>
                    <Check size={15} /> {t('Done')}
                  </Button>
                )}
                <IconButton label={t('Delete')} className="size-9" onClick={() => actions.remove(c.id, t('Deleted “{title}”', { title: c.name }))}>
                  <Trash2 size={14} />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('New chore')}
        footer={
          <Button variant="primary" accent="var(--color-steps)" size="lg" block disabled={!title.trim()} onClick={add}>
            {t('Add chore')}
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label={t('Chore')} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('e.g. Laundry')} />
          <div className="flex flex-wrap gap-1.5">
            {EMOJI.map((e) => (
              <button key={e} type="button" onClick={() => setEmoji(e)} className={cn('press grid size-10 place-items-center rounded-xl text-lg', emoji === e ? 'bg-steps/25 ring-2 ring-steps' : 'bg-white/[0.05]')}>
                {e}
              </button>
            ))}
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-3">{t('Every')}</span>
            <div className="flex flex-wrap gap-1.5">
              {EVERY.map((n) => (
                <button key={n} type="button" onClick={() => setEvery(n)} className={cn('press h-9 rounded-full px-3.5 text-sm font-semibold', every === n ? 'bg-steps text-bg' : 'bg-white/[0.05] text-ink-2')}>
                  {n === 1 ? t('Day') : n === 7 ? t('Week') : n === 14 ? t('2 weeks') : n === 30 ? t('Month') : t('{n} days', { n })}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-3">{t('Who')}</span>
            <Segmented
              size="sm"
              value={assignee}
              onChange={setAssignee}
              accent="var(--color-steps)"
              options={[
                { value: 'alternate', label: t('Take turns') },
                { value: meId, label: t('Me') },
                ...(partnerId ? [{ value: partnerId, label: name(partnerId) }] : []),
              ]}
            />
          </div>
        </div>
      </Sheet>
    </>
  );
}

export function useChoresSummary(): string {
  const today = useToday();
  const { data: chores = [] } = useTable('chores');
  const { meId, partnerId } = useNames();
  const due = chores.filter((c) => choreStatus(c, today, meId, partnerId).days <= 0).length;
  return due ? t('{n} due', { n: due }) : t('All clear');
}
