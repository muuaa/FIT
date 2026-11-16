import { Droplets, Flame, LogOut, Timer, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/States';
import { SplitSwitcher } from '@/features/train/TrainPage';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { supabase } from '@/lib/supabase';
import { toast } from '@/stores/toastStore';
import type { Profile } from '@/types/db';
import { useAuth } from '@/features/auth/AuthContext';

type Form = Record<
  'display_name' | 'kcal_target' | 'protein_target_g' | 'carbs_target_g' | 'fat_target_g' | 'water_target_ml' | 'bottle_ml' | 'default_rest_seconds',
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
  default_rest_seconds: String(p.default_rest_seconds),
});

const LIMITS: Record<Exclude<keyof Form, 'display_name'>, [number, number]> = {
  kcal_target: [500, 10000],
  protein_target_g: [0, 1000],
  carbs_target_g: [0, 2000],
  fat_target_g: [0, 1000],
  water_target_ml: [250, 15000],
  bottle_ml: [100, 3000],
  default_rest_seconds: [10, 900],
};

export function SettingsPage() {
  const { session } = useAuth();
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const [form, setForm] = useState<Form | null>(null);

  useEffect(() => {
    if (profile && !form) setForm(toForm(profile));
  }, [profile, form]);

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
    return !Number.isInteger(n) || n < LIMITS[k][0] || n > LIMITS[k][1];
  });
  const macroKcal = Number(form.protein_target_g) * 4 + Number(form.carbs_target_g) * 4 + Number(form.fat_target_g) * 9;
  const bottles = Math.ceil(Number(form.water_target_ml) / Math.max(1, Number(form.bottle_ml)));
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
      <PageHeader title="Settings" subtitle={session?.user.email} />
      <div className="space-y-3">
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
            <p className="tabular text-xs text-ink-3">
              Macros add up to {Number.isFinite(macroKcal) ? Math.round(macroKcal).toLocaleString() : '—'} kcal
            </p>
          </div>
        </Card>

        <Card title="Hydration" icon={Droplets} accent="var(--color-water)">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Daily goal" inputMode="numeric" value={form.water_target_ml} onChange={set('water_target_ml')} suffix="ml" hint={invalid('water_target_ml')} />
            <Field label="Bottle size" inputMode="numeric" value={form.bottle_ml} onChange={set('bottle_ml')} suffix="ml" hint={invalid('bottle_ml')} />
          </div>
          <p className="mt-2 text-xs text-ink-3">{Number.isFinite(bottles) && bottles > 0 ? `${bottles} bottles per day` : ''}</p>
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

        <Button variant="primary" accent="var(--color-fuel)" size="lg" block disabled={!dirty || errors.length > 0 || update.isPending} onClick={save}>
          Save changes
        </Button>
        <Button variant="danger" size="lg" block onClick={() => supabase.auth.signOut()}>
          <LogOut size={18} /> Sign out
        </Button>
      </div>
    </>
  );
}
