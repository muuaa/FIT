import { Bell, ChevronRight, Droplets, Flame, LayoutList, Sparkles, Timer, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cloudEnabled } from '@/lib/supabase';
import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/States';
import { SplitSwitcher } from '@/features/train/TrainPage';
import { useHomeSettings } from '@/hooks/useHome';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { appInfo, bridge } from '@/lib/push';
import { toast } from '@/stores/toastStore';
import type { Language, Profile } from '@/types/db';
import { Segmented } from '@/components/ui/Segmented';
import { TodayCardsEditor } from '@/features/today/TodayPage';
import { ARABIC_ENABLED, t } from '@/lib/i18n';
import { Logo } from '@/components/Logo';
import { BackupCard } from './BackupCard';
import { AccountCard } from './AccountCard';
import { InstallCard } from './InstallCard';

type Form = Record<
  'display_name' | 'kcal_target' | 'protein_target_g' | 'carbs_target_g' | 'fat_target_g' | 'water_target_ml' | 'bottle_ml' | 'water_step_ml' | 'steps_target' | 'sleep_target_h' | 'monthly_budget' | 'default_rest_seconds',
  string
>;

const toForm = (p: Profile, budget: number): Form => ({
  display_name: p.display_name,
  kcal_target: String(p.kcal_target),
  protein_target_g: String(p.protein_target_g),
  carbs_target_g: String(p.carbs_target_g),
  fat_target_g: String(p.fat_target_g),
  water_target_ml: String(p.water_target_ml),
  bottle_ml: String(p.bottle_ml),
  water_step_ml: String(p.water_step_ml),
  steps_target: String(p.steps_target),
  sleep_target_h: String(p.sleep_target_h),
  monthly_budget: String(budget),
  default_rest_seconds: String(p.default_rest_seconds),
});

const LIMITS: Record<Exclude<keyof Form, 'display_name'>, [number, number]> = {
  kcal_target: [500, 10000],
  protein_target_g: [0, 1000],
  carbs_target_g: [0, 2000],
  fat_target_g: [0, 1000],
  water_target_ml: [250, 15000],
  bottle_ml: [100, 3000],
  water_step_ml: [50, 3000],
  steps_target: [500, 100000],
  sleep_target_h: [4, 12],
  monthly_budget: [0, 10000000],
  default_rest_seconds: [10, 900],
};

export function SettingsPage() {
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const home = useHomeSettings();
  const [form, setForm] = useState<Form | null>(null);
  const base = useRef<Form | null>(null);

  // When the profile changes elsewhere (e.g. the split switch on this page), take the new values
  // only for fields the user hasn't edited, so unsaved changes aren't wiped.
  useEffect(() => {
    if (!profile) return;
    const next = toForm(profile, home.monthly_budget);
    setForm((cur) => {
      if (!cur || !base.current) return next;
      const merged = { ...next };
      for (const k of Object.keys(next) as (keyof Form)[]) if (cur[k] !== base.current[k]) merged[k] = cur[k];
      return merged;
    });
    base.current = next;
  }, [profile, home.monthly_budget]);

  if (!profile || !form)
    return (
      <>
        <PageHeader title={t('Settings')} />
        <Spinner />
      </>
    );

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const errors = (Object.keys(LIMITS) as (keyof typeof LIMITS)[]).filter((k) => {
    const n = Number(form[k]);
    return form[k].trim() === '' || !Number.isInteger(n) || n < LIMITS[k][0] || n > LIMITS[k][1];
  });
  const bottles = Math.ceil(Number(form.water_target_ml) / Math.max(1, Number(form.bottle_ml)));
  // More than 10 bottles won't fit on one row on a phone.
  const tooManyBottles = Number.isFinite(bottles) && bottles > 10;
  const macroKcal = Number(form.protein_target_g) * 4 + Number(form.carbs_target_g) * 4 + Number(form.fat_target_g) * 9;
  const macroGap = Number.isFinite(macroKcal) ? Math.abs(macroKcal - Number(form.kcal_target)) : 0;
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(profile, home.monthly_budget));

  function save() {
    if (errors.length || !form) return;
    if (Number(form.monthly_budget) !== home.monthly_budget) home.save({ monthly_budget: Number(form.monthly_budget) });
    update.mutate(
      {
        display_name: form.display_name.trim(),
        kcal_target: Number(form.kcal_target),
        protein_target_g: Number(form.protein_target_g),
        carbs_target_g: Number(form.carbs_target_g),
        fat_target_g: Number(form.fat_target_g),
        water_target_ml: Number(form.water_target_ml),
        bottle_ml: Number(form.bottle_ml),
        water_step_ml: Number(form.water_step_ml),
        steps_target: Number(form.steps_target),
        sleep_target_h: Number(form.sleep_target_h),
        default_rest_seconds: Number(form.default_rest_seconds),
      },
      {
        onSuccess: (p) => {
          setForm(toForm(p, Number(form.monthly_budget)));
          toast.success(t('Settings saved'));
        },
      },
    );
  }

  const invalid = (k: keyof typeof LIMITS) =>
    errors.includes(k) ? `Must be ${LIMITS[k][0]}–${LIMITS[k][1]}` : undefined;

  return (
    <>
      <PageHeader title={t('Settings')} subtitle={t('Targets · Split · Your data')} />
      <div className="space-y-3">
        <AccountCard />
        {cloudEnabled && (
          <Link to="/settings/reminders" className="flex items-center gap-3 glass rounded-[28px] p-4 active:bg-surface-2">
            <span className="grid size-8 place-items-center rounded-xl bg-life/15 text-life">
              <Bell size={17} />
            </span>
            <span className="flex-1 text-[15px] font-semibold">{t('Reminders')}</span>
            <span className="text-sm text-ink-3">{t('Notifications')}</span>
            <ChevronRight size={18} className="text-ink-3 rtl:-scale-x-100" />
          </Link>
        )}
        <Card title={t('Profile')} icon={User}>
          <Field label={t('Display name')} value={form.display_name} onChange={set('display_name')} />
          {ARABIC_ENABLED && (
            <div className="mt-3">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-3">{t('Language')}</span>
              <Segmented<Language>
                value={profile.language}
                onChange={(language) => update.mutate({ language })}
                options={[
                  { value: 'en', label: 'English' },
                  { value: 'ar', label: 'العربية' },
                ]}
              />
            </div>
          )}
        </Card>

        <Card title={t('Nutrition targets')} icon={Flame} accent="var(--color-fuel)">
          <div className="space-y-3">
            <Field label={t('Daily calories')} inputMode="numeric" value={form.kcal_target} onChange={set('kcal_target')} suffix="kcal" hint={invalid('kcal_target')} />
            <div className="grid grid-cols-3 gap-2">
              <Field label={t('Protein')} inputMode="numeric" value={form.protein_target_g} onChange={set('protein_target_g')} suffix="g" />
              <Field label={t('Carbs')} inputMode="numeric" value={form.carbs_target_g} onChange={set('carbs_target_g')} suffix="g" />
              <Field label={t('Fat')} inputMode="numeric" value={form.fat_target_g} onChange={set('fat_target_g')} suffix="g" />
            </div>
            {(['protein_target_g', 'carbs_target_g', 'fat_target_g'] as const).some((k) => errors.includes(k)) ? (
              <p className="text-xs text-danger">{t('Macro targets must be whole numbers of grams.')}</p>
            ) : (
              <p className={`tabular text-xs ${macroGap > 150 ? 'text-lift' : 'text-ink-3'}`}>
                {t('Macros add up to {n} kcal', { n: Math.round(macroKcal).toLocaleString() })}
                {macroGap > 150 && ` ${t('({n} kcal away from your calorie target)', { n: Math.round(macroGap).toLocaleString() })}`}
              </p>
            )}
          </div>
        </Card>

        <Card title={t('Hydration')} icon={Droplets} accent="var(--color-water)">
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('Daily goal')} inputMode="numeric" value={form.water_target_ml} onChange={set('water_target_ml')} suffix="ml" hint={invalid('water_target_ml')} />
            <Field label={t('Bottle size')} inputMode="numeric" value={form.bottle_ml} onChange={set('bottle_ml')} suffix="ml" hint={invalid('bottle_ml')} />
          </div>
          <p className={`mt-2 text-xs ${tooManyBottles ? 'text-danger' : 'text-ink-3'}`}>
            {tooManyBottles
              ? t("That's {n} bottles a day. Use a bigger bottle so it's 10 or fewer.", { n: bottles })
              : Number.isFinite(bottles) && bottles > 0
                ? t('{n} bottles per day', { n: bottles })
                : ''}
          </p>
          <Field
            className="mt-3"
            label={t('+/− button amount')}
            inputMode="numeric"
            value={form.water_step_ml}
            onChange={set('water_step_ml')}
            suffix="ml"
            hint={invalid('water_step_ml') ?? t('How much each tap of + or − adds or removes.')}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[...new Set([250, 500, Number(form.bottle_ml)])]
              .filter((v) => Number.isInteger(v) && v >= 50 && v <= 3000)
              .map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setForm({ ...form, water_step_ml: String(v) })}
                  className={`tabular h-8 rounded-full px-3 text-xs font-semibold active:scale-95 ${
                    form.water_step_ml === String(v) ? 'bg-water text-bg' : 'bg-surface-2 text-ink-2'
                  }`}
                >
                  {v} ml{v === Number(form.bottle_ml) ? ` (${t('1 bottle')})` : ''}
                </button>
              ))}
          </div>
        </Card>

        <Card title={t('Life targets')} icon={Sparkles} accent="var(--color-life)">
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('Daily steps')} inputMode="numeric" value={form.steps_target} onChange={set('steps_target')} hint={invalid('steps_target')} />
            <Field label={t('Sleep goal')} inputMode="numeric" value={form.sleep_target_h} onChange={set('sleep_target_h')} suffix={t('h')} hint={invalid('sleep_target_h')} />
          </div>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
            <Field
              label={t('Monthly budget')}
              inputMode="numeric"
              value={form.monthly_budget}
              onChange={set('monthly_budget')}
              hint={invalid('monthly_budget') ?? t('Shared with your partner · 0 = no budget')}
            />
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-3">{t('Currency')}</span>
              <select
                value={home.currency}
                onChange={(e) => home.save({ currency: e.target.value })}
                className="h-12 w-full rounded-2xl border border-line bg-surface-2 px-3 text-ink outline-none"
              >
                {['USD', 'JOD', 'EUR', 'GBP', 'SAR', 'AED', 'KWD', 'QAR', 'EGP', 'TRY'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Card>

        <SplitSwitcher />

        <Card title={t('Rest timer')} icon={Timer} accent="var(--color-lift)">
          <Field
            label={t('Default rest')}
            inputMode="numeric"
            value={form.default_rest_seconds}
            onChange={set('default_rest_seconds')}
            suffix={t('sec')}
            hint={invalid('default_rest_seconds')}
          />
        </Card>

        <div
          className={dirty ? 'sticky z-20 -mx-1 rounded-3xl bg-bg/85 p-1 backdrop-blur' : ''}
          style={dirty ? { bottom: 'calc(5rem + env(safe-area-inset-bottom))' } : undefined}
        >
          <Button
            variant="primary"
            accent="var(--color-fuel)"
            size="lg"
            block
            disabled={!dirty || errors.length > 0 || tooManyBottles || update.isPending}
            onClick={save}
          >
            {dirty ? t('Save changes') : t('All changes saved')}
          </Button>
        </div>
        <Card title={t('Today screen')} icon={LayoutList}>
          <TodayCardsEditor />
        </Card>
        <InstallCard />
        <BackupCard />
        <div className="flex flex-col items-center gap-1 pb-2 pt-4 text-center">
          <Logo size={36} />
          <div className="text-sm font-semibold">{t('Better Together')}</div>
          <div className="text-xs text-ink-3">{t('Everything, together')}</div>
          <AppVersion />
        </div>
      </div>
    </>
  );
}

/** Android app build and how opening went (helps tell which version is installed). */
function AppVersion() {
  const info = appInfo();
  if (!info.build) return null;
  const check = bridge() || info.checkMs === null ? '' : info.checkOk === 1 ? ` · ${t('opened in {ms} ms', { ms: Math.max(0, info.checkMs) })}` : ` · ${t('link check: no answer')}`;
  return <div className="tabular text-[11px] text-ink-3/70">{t('Android app build {n}', { n: info.build })}{check}</div>;
}
