import { ArrowLeftRight, HeartHandshake, ListChecks, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { MoneyToday } from '@/features/life/money';
import { useSession } from '@/features/auth/session';
import { t } from '@/lib/i18n';
import { usePartnerStore, viewMe, viewPartner } from '@/lib/partner';
import { getProfile } from '@/lib/localDb';
import { toast } from '@/stores/toastStore';
import { NudgeBar, SideBySide } from './Together';
import { GoalsCard } from './goals';
import { ReviewCard } from './review';
import { TogetherTiles } from './collections';
import { PicsCard } from './pics';

function Avatar({ name, accent }: { name: string; accent: string }) {
  return (
    <span
      className="grid size-14 place-items-center rounded-full text-xl font-bold text-bg"
      style={{ background: `linear-gradient(145deg, color-mix(in oklab, ${accent} 70%, white), ${accent})`, boxShadow: `0 10px 30px -12px ${accent}` }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function UsPage() {
  const { partner, loading, viewing, self } = usePartnerStore();
  const me = useSession((s) => s.user);
  // While showing your partner's data the on-screen profile is theirs, so use the name kept for you.
  const myName = (viewing ? self?.name : getProfile().display_name?.trim()) || me?.email?.split('@')[0] || t('Me');
  return (
    <>
      <PageHeader title={t('Us')} subtitle={t('Shared between you two')} />
      <div className="space-y-3">
        <section className="glass animate-page relative overflow-hidden rounded-[28px] p-5">
          <div
            className="pointer-events-none absolute -inset-10 opacity-60"
            style={{ background: 'radial-gradient(60% 60% at 30% 20%, color-mix(in oklab, var(--color-us) 22%, transparent), transparent 70%)' }}
          />
          <div className="relative flex items-center justify-center gap-3">
            {/* Whose day is on screen comes first. */}
            <Avatar name={viewing ? (partner?.name ?? '?') : myName} accent={viewing ? 'var(--color-us)' : 'var(--color-accent)'} />
            <HeartHandshake size={26} className="text-us" />
            <Avatar name={viewing ? myName : (partner?.name ?? '?')} accent={viewing ? 'var(--color-accent)' : 'var(--color-us)'} />
          </div>
          <p className="relative mt-3 text-center text-[15px] font-semibold">
            {partner
              ? viewing
                ? t('{me} & {partner}', { me: partner.name, partner: myName })
                : t('{me} & {partner}', { me: myName, partner: partner.name })
              : t('Waiting for your partner to join')}
          </p>
          <p className="relative mt-1 text-center text-xs text-ink-3">
            {partner
              ? t('Plans, money, lists, habits and the journal are shared. Tap below to see their day.')
              : t('When your partner creates their account, they’ll appear here.')}
          </p>
          {partner && (
            <Button
              block
              variant="secondary"
              className="relative mt-4"
              disabled={loading}
              onClick={() => (viewing ? viewMe() : void viewPartner().catch((e) => toast.error(e instanceof Error ? e.message : t('Could not load'))))}
            >
              <ArrowLeftRight size={16} /> {viewing ? t('Back to my day') : t('See {name}’s day', { name: partner.name })}
            </Button>
          )}
        </section>

        <NudgeBarCard />
        <PicsCard />
        <TogetherTiles />
        <SideBySide />
        <ReviewCard />
        <GoalsCard />

        <Card title={t('Shared lists')} icon={ListChecks} accent="var(--color-lists)" action={<Link to="/life/lists" className="text-xs font-semibold text-lists">{t('Open')}</Link>}>
          <p className="text-sm text-ink-3">{t('Groceries, chores, packing… one list you both tick off.')}</p>
          <Link to="/life/lists" className="press mt-3 flex h-11 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.05] text-sm font-semibold">
            {t('Open shared lists')}
          </Link>
        </Card>

        <Card title={t('Our money')} icon={Wallet} accent="var(--color-money)" action={<Link to="/life/money" className="text-xs font-semibold text-money">{t('All')}</Link>}>
          <MoneyToday />
        </Card>
      </div>
    </>
  );
}

function NudgeBarCard() {
  const { partner, viewing } = usePartnerStore();
  // While looking at your partner's day the page is theirs (view only): nudges are sent from your own view.
  if (!partner || viewing) return null;
  return (
    <section className="glass animate-page rounded-[28px] p-4">
      <NudgeBar />
    </section>
  );
}
