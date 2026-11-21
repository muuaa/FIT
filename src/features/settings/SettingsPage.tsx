import { Droplets, Flame, Timer, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/States';
import { SplitSwitcher } from '@/features/train/TrainPage';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { toast } from '@/stores/toastStore';
import type { Profile } from '@/types/db';
import { Logo } from '@/components/Logo';
import { BackupCard } from './BackupCard';
import { AccountCard } from './AccountCard';
import { InstallCard } from './InstallCard';

type Form = Record<
  'display_name' | 'kcal_target' | 'protein_target_g' | 'carbs_target_g' | 'fat_target_g' | 'water_target_ml' | 'bottle_ml' | 'water_step_ml' | 'default_rest_seconds',
  string
>;

const toForm = (p: Profile): Form => ({
  display_name: p.display_name,
  kcal_target: String(p.kcal_target),
  protein_target_g: String(p.protein_target_g),
  carbs_target_g: String(p.carbs_target_g),
  fat_target_g: String(p.fat_target_g),
  water_target_ml: String(p.water_target_ml),
  bottle_ml: String(p.bottle_ml),
  water_step_ml: String(p.water_step_ml),
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
  default_rest_seconds: [10, 900],
};

export function SettingsPage() {
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const [form, setForm] = useState<Form | null>(null);
  const base = useRef<Form | null>(null);

  // When the profile changes elsewhere (e.g. the split switch on this page), take the new values
  // only for fields the user hasn't edited, so unsaved changes aren't wiped.
  useEffect(() => {
    if (!profile) return;
    const next = toForm(profile);
    setForm((cur) => {
      if (!cur || !base.current) return next;
      const merged = { ...next };
      for (const k of Object.keys(next) as (keyof Form)[]) if (cur[k] !== base.current[k]) merged[k] = cur[k];
      return merged;
    });
    base.current = next;
  }, [profile]);

  if (!profile || !form)
    return (
      <>
        <PageHeader title="Settings" />
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
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(profile));

  function save() {
    if (errors.length || !form) return;
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
        default_rest_seconds: Number(form.default_rest_seconds),
      },
      {
        onSuccess: (p) => {
          setForm(toForm(p));
          toast.success('Settings saved');
        },
      },
    );
  }

  const invalid = (k: keyof typeof LIMITS) =>
    errors.includes(k) ? `Must be ${LIMITS[k][0]}–${LIMITS[k][1]}` : undefined;

  return (
    <>
      <PageHeader title="Settings" subtitle="Targets · Split · Your data" />
      <div className="space-y-3">
        <AccountCard />
        <Card title="Profile" icon={User}>
          <Field label="Display name" value={form.display_name} onChange={set('display_name')} />
        </Card>

        <Card title="Nutrition targets" icon={Flame} accent="var(--color-fuel)">
          <div className="space-y-3">
            <Field label="Daily calories" inputMode="numeric" value={form.kcal_target} onChange={set('kcal_target')} suffix="kcal" hint={invalid('kcal_target')} />
            <div className="grid grid-cols-3 gap-2">
              <Field label="Protein" inputMode="numeric" value={form.protein_target_g} onChange={set('protein_target_g')} suffix="g" />
              <Field label="Carbs" inputMode="numeric" value={form.carbs_target_g} onChange={set('carbs_target_g')} suffix="g" />
              <Field label="Fat" inputMode="numeric" value={form.fat_target_g} onChange={set('fat_target_g')} suffix="g" />
            </div>
            {(['protein_target_g', 'carbs_target_g', 'fat_target_g'] as const).some((k) => errors.includes(k)) ? (
              <p className="text-xs text-danger">Macro targets must be whole numbers of grams.</p>
            ) : (
              <p className={`tabular text-xs ${macroGap > 150 ? 'text-lift' : 'text-ink-3'}`}>
                Macros add up to {Math.round(macroKcal).toLocaleString()} kcal
                {macroGap > 150 && ` (${Math.round(macroGap).toLocaleString()} kcal away from your calorie target)`}
              </p>
            )}
          </div>
        </Card>

        <Card title="Hydration" icon={Droplets} accent="var(--color-water)">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Daily goal" inputMode="numeric" value={form.water_target_ml} onChange={set('water_target_ml')} suffix="ml" hint={invalid('water_target_ml')} />
            <Field label="Bottle size" inputMode="numeric" value={form.bottle_ml} onChange={set('bottle_ml')} suffix="ml" hint={invalid('bottle_ml')} />
          </div>
          <p className={`mt-2 text-xs ${tooManyBottles ? 'text-danger' : 'text-ink-3'}`}>
            {tooManyBottles
              ? `That's ${bottles} bottles a day. Use a bigger bottle so it's 10 or fewer.`
              : Number.isFinite(bottles) && bottles > 0
                ? `${bottles} bottles per day`
                : ''}
          </p>
          <Field
            className="mt-3"
            label="+/− button amount"
            inputMode="numeric"
            value={form.water_step_ml}
            onChange={set('water_step_ml')}
            suffix="ml"
            hint={invalid('water_step_ml') ?? 'How much each tap of + or − adds or removes.'}
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
                  {v} ml{v === Number(form.bottle_ml) ? ' (1 bottle)' : ''}
                </button>
              ))}
          </div>
        </Card>

        <SplitSwitcher />

        <Card title="Rest timer" icon={Timer} accent="var(--color-lift)">
          <Field
            label="Default rest"
            inputMode="numeric"
            value={form.default_rest_seconds}
            onChange={set('default_rest_seconds')}
            suffix="sec"
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
            {dirty ? 'Save changes' : 'All changes saved'}
          </Button>
        </div>
        <InstallCard />
        <BackupCard />
        <div className="flex flex-col items-center gap-1 pb-2 pt-4 text-center">
          <Logo size={36} />
          <div className="text-sm font-semibold">Replete</div>
          <div className="text-xs text-ink-3">Train · Fuel · Hydrate · Recover</div>
        </div>
      </div>
    </>
  );
}
