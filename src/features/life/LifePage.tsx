import { BedDouble, BookOpen, Flame, Footprints, ListTodo, Smile, Users, Wallet, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { t } from '@/lib/i18n';
import { cloudEnabled } from '@/lib/supabase';
import { CheckInForm, useCheckInSummary } from './checkin';
import { useStepsSummary } from './body';
import { HabitsToday, useHabitsSummary } from './habits';
import { useJournalSummary } from './journal';
import { useListsSummary } from './lists';
import { useMoneySummary } from './money';
import { useSleepSummary } from './sleep';
import { TodosToday, useTodosSummary } from './todos';
import { useToday } from '@/hooks/useToday';

function Tile({ to, icon: Icon, label, value, accent }: { to: string; icon: LucideIcon; label: string; value: string; accent: string }) {
  return (
    <Link
      to={to}
      className="flex flex-col gap-2 rounded-3xl border border-line/70 bg-surface p-3 transition active:scale-[0.97] active:bg-surface-2"
    >
      <span className="grid size-9 place-items-center rounded-xl" style={{ background: `color-mix(in oklab, ${accent} 16%, transparent)`, color: accent }}>
        <Icon size={18} strokeWidth={2.25} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold">{label}</span>
        <span className="tabular block truncate text-xs text-ink-3">{value}</span>
      </span>
    </Link>
  );
}

function Tiles() {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Tile to="/life/habits" icon={Flame} label={t('Habits')} value={useHabitsSummary()} accent="var(--color-habit)" />
      <Tile to="/life/todos" icon={ListTodo} label={t('To-dos')} value={useTodosSummary()} accent="var(--color-todo)" />
      <Tile to="/life/sleep" icon={BedDouble} label={t('Sleep')} value={useSleepSummary()} accent="var(--color-sleep)" />
      <Tile to="/life/mood" icon={Smile} label={t('Mood')} value={useCheckInSummary()} accent="var(--color-mood)" />
      <Tile to="/life/body" icon={Footprints} label={t('Steps & body')} value={useStepsSummary()} accent="var(--color-steps)" />
      <Tile to="/life/money" icon={Wallet} label={t('Money')} value={useMoneySummary()} accent="var(--color-money)" />
      <Tile to="/life/journal" icon={BookOpen} label={t('Journal')} value={useJournalSummary()} accent="var(--color-journal)" />
      {cloudEnabled && <ListsTile />}
    </div>
  );
}

function ListsTile() {
  return <Tile to="/life/lists" icon={Users} label={t('Shared lists')} value={useListsSummary()} accent="var(--color-lists)" />;
}

export function LifePage() {
  const today = useToday();
  return (
    <>
      <PageHeader title={t('Life')} subtitle={t('Habits · Plans · Sleep · Mood · Money · Journal')} />
      <div className="space-y-3">
        <Tiles />
        <Card title={t('Habits today')} icon={Flame} accent="var(--color-habit)" action={<Link to="/life/habits" className="text-xs font-semibold text-habit">{t('All')}</Link>}>
          <HabitsToday />
        </Card>
        <Card title={t('Today’s plan')} icon={ListTodo} accent="var(--color-todo)" action={<Link to="/life/todos" className="text-xs font-semibold text-todo">{t('All')}</Link>}>
          <TodosToday limit={6} />
        </Card>
        <Card title={t('How are you feeling?')} icon={Smile} accent="var(--color-mood)">
          <CheckInForm date={today} />
        </Card>
      </div>
    </>
  );
}
