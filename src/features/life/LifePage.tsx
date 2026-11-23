import { BookOpen, Flame, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Tile } from '@/components/ui/Tile';
import { t } from '@/lib/i18n';
import { HabitsToday, useHabitsSummary } from './habits';
import { useJournalSummary } from './journal';
import { useMoneySummary } from './money';

function Tiles() {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      <Tile to="/life/habits" icon={Flame} label={t('Habits')} value={useHabitsSummary()} accent="var(--color-habit)" />
      <Tile to="/life/money" icon={Wallet} label={t('Money')} value={useMoneySummary()} accent="var(--color-money)" />
      <Tile to="/life/journal" icon={BookOpen} label={t('Journal')} value={useJournalSummary()} accent="var(--color-journal)" />
    </div>
  );
}

export function LifePage() {
  return (
    <>
      <PageHeader title={t('Life')} subtitle={t('Habits · Money · Journal')} />
      <div className="space-y-3">
        <Tiles />
        <Card
          title={t('Habits today')}
          icon={Flame}
          accent="var(--color-habit)"
          action={
            <Link to="/life/habits" className="text-xs font-semibold text-habit">
              {t('All')}
            </Link>
          }
        >
          <HabitsToday />
        </Card>
      </div>
    </>
  );
}
