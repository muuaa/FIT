import { BarChart3, BookOpen, ChefHat, Flame, Receipt, Sparkles, StickyNote, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Tile } from '@/components/ui/Tile';
import { useBillsSummary } from '@/features/admin/bills';
import { useChoresSummary } from '@/features/admin/chores';
import { useMealsSummary } from '@/features/admin/meals';
import { useNotesSummary } from '@/features/admin/notes';
import { t } from '@/lib/i18n';
import { HabitsToday, useHabitsSummary } from './habits';
import { useJournalSummary } from './journal';
import { useMoneySummary } from './money';

function Tiles() {
  return (
    <div className="grid grid-cols-3 gap-2.5 md:grid-cols-4">
      <Tile to="/life/habits" icon={Flame} label={t('Habits')} value={useHabitsSummary()} accent="var(--color-habit)" />
      <Tile to="/life/money" icon={Wallet} label={t('Money')} value={useMoneySummary()} accent="var(--color-money)" />
      <Tile to="/life/bills" icon={Receipt} label={t('Bills')} value={useBillsSummary()} accent="var(--color-money)" />
      <Tile to="/life/meals" icon={ChefHat} label={t('Meals')} value={useMealsSummary()} accent="var(--color-fuel)" />
      <Tile to="/life/chores" icon={Sparkles} label={t('Chores')} value={useChoresSummary()} accent="var(--color-steps)" />
      <Tile to="/life/journal" icon={BookOpen} label={t('Journal')} value={useJournalSummary()} accent="var(--color-journal)" />
      <Tile to="/life/notes" icon={StickyNote} label={t('Notes')} value={useNotesSummary()} accent="var(--color-lift)" />
      <Tile to="/life/insights" icon={BarChart3} label={t('Insights')} value={t('Your week')} accent="var(--color-accent)" />
    </div>
  );
}

export function LifePage() {
  return (
    <>
      <PageHeader title={t('Life')} subtitle={t('Home · Money · Mind')} />
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
