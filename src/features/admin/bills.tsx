import { Check, Plus, Receipt, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { Toggle } from '@/components/ui/Toggle';
import { useHomeSettings } from '@/hooks/useHome';
import { useTable, useTableActions } from '@/hooks/useTable';
import { useToday } from '@/hooks/useToday';
import { tick } from '@/lib/alerts';
import { cn } from '@/lib/cn';
import { shortDate } from '@/lib/date';
import { num } from '@/lib/format';
import { t } from '@/lib/i18n';
import { money } from '@/lib/life';
import { uid } from '@/lib/localDb';
import { advanceDue, daysUntil, monthlyCost } from '@/lib/plan';
import { toast } from '@/stores/toastStore';
import type { Bill, BillCycle } from '@/types/db';

const EMOJI = ['🏠', '💡', '💧', '📶', '📱', '🎬', '🎵', '☁️', '🚗', '🛡️', '🏋️', '💳'];

function dueLabel(days: number): string {
  if (days < 0) return t('{n} days overdue', { n: -days });
  if (days === 0) return t('Due today');
  if (days === 1) return t('Due tomorrow');
  return t('In {n} days', { n: days });
}

function BillSheet({ bill, open, onClose }: { bill: Bill | null; open: boolean; onClose: () => void }) {
  const today = useToday();
  const actions = useTableActions('bills');
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('💳');
  const [amount, setAmount] = useState('');
  const [cycle, setCycle] = useState<BillCycle>('monthly');
  const [due, setDue] = useState(today);
  const [logExpense, setLogExpense] = useState(true);
  const [seeded, setSeeded] = useState<string | null>(null);
  const key = open ? (bill?.id ?? 'new') : null;
  if (key !== seeded) {
    setSeeded(key);
    if (open) {
      setName(bill?.name ?? '');
      setEmoji(bill?.emoji ?? '💳');
      setAmount(bill ? String(bill.amount) : '');
      setCycle(bill?.cycle ?? 'monthly');
      setDue(bill?.next_due ?? today);
      setLogExpense(bill?.log_expense ?? true);
    }
  }
  const n = num(amount);
  const valid = name.trim() && n !== null && n >= 0;
  const save = () => {
    if (!valid) return;
    actions.put({
      id: bill?.id ?? uid(),
      name: name.trim().slice(0, 60),
      emoji,
      amount: Math.round(n! * 100) / 100,
      cycle,
      next_due: due,
      category: 'Bills',
      log_expense: logExpense,
      created_at: bill?.created_at ?? new Date().toISOString(),
    });
    onClose();
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={bill ? t('Edit bill') : t('New bill or subscription')}
      footer={
        <div className="flex gap-2">
          {bill && (
            <IconButton
              label={t('Delete')}
              className="size-12 bg-danger/12 text-danger"
              onClick={() => {
                actions.remove(bill.id, t('Deleted “{title}”', { title: bill.name }));
                onClose();
              }}
            >
              <Trash2 size={18} />
            </IconButton>
          )}
          <Button variant="primary" accent="var(--color-money)" size="lg" className="flex-1" disabled={!valid} onClick={save}>
            {t('Save')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label={t('Name')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('e.g. Rent, Internet, Netflix')} />
        <div className="flex flex-wrap gap-1.5">
          {EMOJI.map((e) => (
            <button key={e} type="button" onClick={() => setEmoji(e)} className={cn('press grid size-10 place-items-center rounded-xl text-lg', emoji === e ? 'bg-money/25 ring-2 ring-money' : 'bg-white/[0.05]')}>
              {e}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('Amount')} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Field label={t('Next due')} type="date" value={due} onChange={(e) => e.target.value && setDue(e.target.value)} />
        </div>
        <Segmented<BillCycle>
          size="sm"
          value={cycle}
          onChange={setCycle}
          accent="var(--color-money)"
          options={[
            { value: 'weekly', label: t('Weekly') },
            { value: 'monthly', label: t('Monthly') },
            { value: 'yearly', label: t('Yearly') },
          ]}
        />
        <label className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.04] px-4 py-3">
          <span className="text-sm">{t('Add to expenses when paid')}</span>
          <Toggle checked={logExpense} onChange={setLogExpense} label={t('Add to expenses when paid')} accent="var(--color-money)" />
        </label>
      </div>
    </Sheet>
  );
}

/** Bills due within a week (or overdue). Used on Home's Next up via its own list. */
export function useBillsDue(withinDays = 7) {
  const today = useToday();
  const { data: bills = [] } = useTable('bills');
  return bills.filter((b) => daysUntil(b.next_due, today) <= withinDays).sort((a, b) => a.next_due.localeCompare(b.next_due));
}

export function usePayBill() {
  const today = useToday();
  const bills = useTableActions('bills');
  const expenses = useTableActions('expenses');
  return (b: Bill) => {
    tick();
    bills.put({ ...b, next_due: advanceDue(b.next_due, b.cycle) });
    if (b.log_expense && b.amount > 0)
      expenses.insert({ id: uid(), date: today, amount: b.amount, category: 'Bills', note: b.name, created_at: new Date().toISOString() });
    toast.success(t('{name} paid. Next due {date}', { name: b.name, date: shortDate(advanceDue(b.next_due, b.cycle)) }));
  };
}

export function BillsPage() {
  const today = useToday();
  const { data: bills = [] } = useTable('bills');
  const home = useHomeSettings();
  const pay = usePayBill();
  const [sheet, setSheet] = useState<{ bill: Bill | null } | null>(null);
  const sorted = [...bills].sort((a, b) => a.next_due.localeCompare(b.next_due));
  const perMonth = bills.reduce((a, b) => a + monthlyCost(b), 0);
  return (
    <>
      <PageHeader
        title={t('Bills & subscriptions')}
        back="/life"
        right={
          <IconButton label={t('New bill or subscription')} onClick={() => setSheet({ bill: null })}>
            <Plus size={22} />
          </IconButton>
        }
      />
      <div className="space-y-3">
        <section className="glass animate-page rounded-[28px] p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">{t('Per month')}</div>
          <div className="tabular text-[34px] font-bold leading-tight tracking-tight">{money(Math.round(perMonth * 100) / 100, home.currency)}</div>
          <div className="text-xs text-ink-3">
            {t('{n} bills and subscriptions · {y} a year', { n: bills.length, y: money(Math.round(perMonth * 12), home.currency) })}
          </div>
        </section>
        <Card title={t('Coming up')} icon={Receipt} accent="var(--color-money)">
          {sorted.length === 0 ? (
            <button type="button" onClick={() => setSheet({ bill: null })} className="press w-full rounded-2xl border border-dashed border-white/10 p-4 text-sm text-ink-3">
              {t('Add rent, utilities and subscriptions to see what’s due and what they cost you each month.')}
            </button>
          ) : (
            <ul className="space-y-1.5">
              {sorted.map((b) => {
                const days = daysUntil(b.next_due, today);
                return (
                  <li key={b.id} className="flex items-center gap-2 rounded-2xl bg-white/[0.04] py-2 ps-3 pe-2">
                    <button type="button" onClick={() => setSheet({ bill: b })} className="flex min-w-0 flex-1 items-center gap-3 text-start">
                      <span className="text-2xl">{b.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium">{b.name}</span>
                        <span className={cn('block text-xs', days < 0 ? 'text-danger' : days <= 3 ? 'text-money' : 'text-ink-3')}>
                          {dueLabel(days)} · {shortDate(b.next_due)}
                        </span>
                      </span>
                      <span className="tabular text-sm font-semibold">{money(b.amount, home.currency)}</span>
                    </button>
                    {days <= 7 && (
                      <Button size="sm" variant="primary" accent="var(--color-money)" onClick={() => pay(b)}>
                        <Check size={15} /> {t('Paid')}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
      <BillSheet open={sheet !== null} bill={sheet?.bill ?? null} onClose={() => setSheet(null)} />
    </>
  );
}

export function useBillsSummary(): string {
  const due = useBillsDue(7);
  return due.length ? t('{n} due soon', { n: due.length }) : t('All clear');
}
