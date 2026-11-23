import { ChevronLeft, ChevronRight, Plus, Trash2, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/AppShell';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { ProgressBar } from '@/components/ui/Progress';
import { Sheet } from '@/components/ui/Sheet';
import { Empty } from '@/components/ui/States';
import { useHomeSettings } from '@/hooks/useHome';
import { useTable, useTableActions } from '@/hooks/useTable';
import { useToday } from '@/hooks/useToday';
import { cn } from '@/lib/cn';
import { addMonths, monthLabel, relativeDay } from '@/lib/date';
import { num } from '@/lib/format';
import { t } from '@/lib/i18n';
import { categoryEmoji, daysInMonth, EXPENSE_CATEGORIES, money, monthOf, sumAmount } from '@/lib/life';
import { uid } from '@/lib/localDb';
import { toast } from '@/stores/toastStore';

const ACCENT = 'var(--color-money)';

export function ExpenseSheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const actions = useTableActions('expenses');
  const home = useHomeSettings();
  const { data: all = [] } = useTable('expenses');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [note, setNote] = useState('');
  const [day, setDay] = useState(date);
  const [seeded, setSeeded] = useState(false);
  if (open !== seeded) {
    setSeeded(open);
    if (open) {
      setAmount('');
      setNote('');
      setDay(date);
      // Start on the category used most recently.
      const last = [...all].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      setCategory(last?.category ?? 'Food');
    }
  }
  const n = num(amount);
  const valid = n !== null && n > 0 && n < 1_000_000;
  const currency = home.currency;
  const save = () => {
    if (!valid) return;
    actions.insert({ id: uid(), date: day, amount: Math.round(n! * 100) / 100, category, note: note.trim(), created_at: new Date().toISOString() });
    toast.success(t('Added {amount}', { amount: money(n!, currency) }));
    onClose();
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('Add expense')}
      footer={
        <Button variant="primary" accent={ACCENT} size="lg" block disabled={!valid} onClick={save}>
          {t('Add')} {valid ? money(n!, currency) : ''}
        </Button>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="sr-only">{t('Amount')}</span>
          <div className="flex items-baseline justify-center gap-1 py-2">
            <span className="text-2xl font-semibold text-ink-3">{currency === 'USD' ? '$' : currency}</span>
            <input
              inputMode="decimal"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
              placeholder="0"
              aria-label={t('Amount')}
              className="tabular w-40 bg-transparent text-center text-5xl font-bold text-ink outline-none placeholder:text-ink-3/50"
            />
          </div>
        </label>
        <div>
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-3">{t('Category')}</span>
          <div className="grid grid-cols-5 gap-1.5">
            {EXPENSE_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={category === c.id}
                onClick={() => setCategory(c.id)}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[10px] font-medium transition active:scale-95',
                  category === c.id ? 'bg-money/20 text-ink ring-2 ring-money' : 'bg-surface-2 text-ink-3',
                )}
              >
                <span className="text-xl">{c.emoji}</span>
                <span className="w-full truncate px-0.5">{t(c.id)}</span>
              </button>
            ))}
          </div>
        </div>
        <Field label={t('Note')} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Optional, e.g. lunch with Sam')} />
        <Field label={t('Date')} type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
      </div>
    </Sheet>
  );
}

/** This month at a glance + quick add. Used on Today and the Life hub. */
export function MoneyToday() {
  const today = useToday();
  const { data: all = [] } = useTable('expenses');
  const home = useHomeSettings();
  const [open, setOpen] = useState(false);
  const month = monthOf(today);
  const currency = home.currency;
  const spentToday = sumAmount(all.filter((e) => e.date === today));
  const spentMonth = sumAmount(all.filter((e) => monthOf(e.date) === month));
  const budget = home.monthly_budget;
  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-2">
        <div>
          <div className="tabular text-2xl font-bold">{money(spentToday, currency)}</div>
          <div className="text-xs text-ink-3">{t('today')}</div>
        </div>
        <div className="text-end">
          <div className="tabular text-sm font-semibold">{money(spentMonth, currency)}</div>
          <div className="text-xs text-ink-3">{budget ? t('of {budget} this month', { budget: money(budget, currency) }) : t('this month')}</div>
        </div>
      </div>
      {budget > 0 && <ProgressBar value={spentMonth} max={budget} accent={spentMonth > budget ? 'var(--color-danger)' : ACCENT} className="mb-3" />}
      <Button block variant="secondary" onClick={() => setOpen(true)}>
        <Plus size={16} /> {t('Add expense')}
      </Button>
      <ExpenseSheet open={open} onClose={() => setOpen(false)} date={today} />
    </div>
  );
}

export function MoneyPage() {
  const today = useToday();
  const [month, setMonth] = useState(monthOf(today));
  const { data: all = [] } = useTable('expenses');
  const home = useHomeSettings();
  const actions = useTableActions('expenses');
  const [open, setOpen] = useState(false);
  const currency = home.currency;
  const budget = home.monthly_budget;
  const list = useMemo(
    () => all.filter((e) => monthOf(e.date) === month).sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)),
    [all, month],
  );
  const total = sumAmount(list);
  const byCat = EXPENSE_CATEGORIES.map((c) => ({ ...c, total: sumAmount(list.filter((e) => e.category === c.id)) }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);
  const days = month === monthOf(today) ? Number(today.slice(8)) : daysInMonth(month);
  const groups = new Map<string, typeof list>();
  for (const e of list) groups.set(e.date, [...(groups.get(e.date) ?? []), e]);
  const left = budget - total;
  const daysLeft = daysInMonth(month) - days;

  return (
    <>
      <PageHeader
        title={t('Money')}
        back="/life"
        right={
          <IconButton label={t('Add expense')} onClick={() => setOpen(true)}>
            <Plus size={22} />
          </IconButton>
        }
      />
      <div className="mb-4 flex items-center justify-between rounded-2xl bg-surface px-1 py-1">
        <IconButton label={t('Previous month')} onClick={() => setMonth(addMonths(month, -1))}>
          <ChevronLeft size={20} className="rtl:-scale-x-100" />
        </IconButton>
        <span className="text-sm font-semibold">{monthLabel(month)}</span>
        <IconButton label={t('Next month')} disabled={month >= monthOf(today)} onClick={() => setMonth(addMonths(month, 1))}>
          <ChevronRight size={20} className="rtl:-scale-x-100" />
        </IconButton>
      </div>
      <div className="space-y-3">
        <Card title={t('Spent')} icon={Wallet} accent={ACCENT}>
          <div className="tabular text-3xl font-bold">{money(total, currency)}</div>
          <div className="tabular text-xs text-ink-3">{t('about {n} a day', { n: money(Math.round((total / Math.max(1, days)) * 100) / 100, currency) })}</div>
          {budget > 0 ? (
            <>
              <ProgressBar value={total} max={budget} accent={left < 0 ? 'var(--color-danger)' : ACCENT} className="mt-3" />
              <p className={`tabular mt-1.5 text-xs ${left < 0 ? 'text-danger' : 'text-ink-3'}`}>
                {left >= 0
                  ? month === monthOf(today) && daysLeft > 0
                    ? t('{left} left · {perDay} a day for {days} more days', {
                        left: money(left, currency),
                        perDay: money(Math.floor((left / daysLeft) * 100) / 100, currency),
                        days: daysLeft,
                      })
                    : t('{left} under budget', { left: money(left, currency) })
                  : t('{over} over budget', { over: money(-left, currency) })}
              </p>
            </>
          ) : (
            <p className="mt-2 text-xs text-ink-3">
              {t('Set a monthly budget in')}{' '}
              <Link to="/settings" className="font-semibold text-money">
                {t('Settings')}
              </Link>
            </p>
          )}
          {byCat.length > 0 && (
            <ul className="mt-4 space-y-2">
              {byCat.map((c) => (
                <li key={c.id}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-ink-2">
                      {c.emoji} {t(c.id)}
                    </span>
                    <span className="tabular font-semibold">{money(c.total, currency)}</span>
                  </div>
                  <ProgressBar value={c.total} max={total} accent={ACCENT} className="h-1.5" />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t('Expenses')} icon={Wallet} accent={ACCENT}>
          {list.length === 0 ? (
            <Empty icon={Wallet} title={t('Nothing spent this month')} />
          ) : (
            <div className="space-y-3">
              {[...groups.entries()].map(([d, items]) => (
                <div key={d}>
                  <div className="mb-1 flex justify-between text-xs text-ink-3">
                    <span>{relativeDay(d)}</span>
                    <span className="tabular">{money(sumAmount(items), currency)}</span>
                  </div>
                  <ul className="divide-y divide-line/60">
                    {items.map((e) => (
                      <li key={e.id} className="flex items-center gap-3 py-2">
                        <span className="text-xl">{categoryEmoji(e.category)}</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{e.note || t(e.category)}</div>
                          {e.note && <div className="text-xs text-ink-3">{t(e.category)}</div>}
                        </div>
                        <span className="tabular text-sm font-semibold">{money(e.amount, currency)}</span>
                        <IconButton label={t('Delete')} className="-me-2 size-9" onClick={() => actions.remove(e.id, t('Expense deleted'))}>
                          <Trash2 size={14} />
                        </IconButton>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      <ExpenseSheet open={open} onClose={() => setOpen(false)} date={month === monthOf(today) ? today : `${month}-01`} />
    </>
  );
}

export function useMoneySummary(): string {
  const today = useToday();
  const { data: all = [] } = useTable('expenses');
  const home = useHomeSettings();
  return money(sumAmount(all.filter((e) => e.date === today)), home.currency);
}
