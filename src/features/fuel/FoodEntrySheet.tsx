import { BookmarkPlus, Plus, Zap } from 'lucide-react';
import { t } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { Empty } from '@/components/ui/States';
import { Toggle } from '@/components/ui/Toggle';
import { useAddFood, useAddSavedMeal, useSavedMeals } from '@/hooks/useNutrition';
import { num } from '@/lib/format';
import { toast } from '@/stores/toastStore';
import type { SavedMeal } from '@/types/db';

export function macroLine(m: { protein_g: number; carbs_g: number; fat_g: number }) {
  return `P ${Math.round(Number(m.protein_g))} · C ${Math.round(Number(m.carbs_g))} · F ${Math.round(Number(m.fat_g))}`;
}

export function SavedMealList({ date, onLogged }: { date: string; onLogged?: () => void }) {
  const { data: meals = [], isLoading } = useSavedMeals();
  const addFood = useAddFood(date);
  const log = (m: SavedMeal) =>
    addFood.mutate(
      { name: m.name, kcal: m.kcal, protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g },
      {
        onSuccess: () => {
          toast.success(t('Logged {name}', { name: m.name }));
          onLogged?.();
        },
      },
    );
  if (isLoading) return null;
  if (!meals.length)
    return (
      <Empty icon={BookmarkPlus} title={t('No saved meals yet')}>
        {t('Log a meal with “Save to library” on and it\'ll appear here for one-tap logging.')}
      </Empty>
    );
  return (
    <ul className="space-y-2">
      {meals.map((m) => (
        <li key={m.id}>
          <button
            type="button"
            onClick={() => log(m)}
            disabled={addFood.isPending}
            className="flex w-full items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-start active:scale-[0.98] active:bg-surface-3"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{m.name}</div>
              <div className="tabular text-xs text-ink-3">{macroLine(m)}</div>
            </div>
            <span className="tabular text-sm font-semibold text-fuel">{m.kcal} kcal</span>
            <span className="grid size-8 place-items-center rounded-full bg-fuel/15 text-fuel">
              <Plus size={16} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function FoodEntrySheet({
  open,
  onClose,
  date,
  initialTab = 'saved',
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  initialTab?: 'saved' | 'custom';
}) {
  const [tab, setTab] = useState<'saved' | 'custom'>(initialTab);
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [f, setF] = useState('');
  const [save, setSave] = useState(false);
  const addFood = useAddFood(date);
  const addMeal = useAddSavedMeal();

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  const protein = num(p) ?? 0;
  const carbs = num(c) ?? 0;
  const fat = num(f) ?? 0;
  const derivedKcal = Math.round(protein * 4 + carbs * 4 + fat * 9);
  const kcalValue = num(kcal) ?? (derivedKcal > 0 ? derivedKcal : null);
  const valid = name.trim().length > 0 && kcalValue !== null && kcalValue >= 0;

  const reset = () => {
    setName('');
    setKcal('');
    setP('');
    setC('');
    setF('');
    setSave(false);
  };

  async function submit() {
    if (!valid || kcalValue === null) return;
    const entry = { name: name.trim(), kcal: Math.round(kcalValue), protein_g: protein, carbs_g: carbs, fat_g: fat };
    try {
      await addFood.mutateAsync(entry);
      if (save) await addMeal.mutateAsync(entry);
      toast.success(save ? `Logged & saved ${entry.name}` : `Logged ${entry.name}`);
      reset();
      onClose();
    } catch {
      /* toast shown by mutation cache */
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('Log food')}
      footer={
        tab === 'custom' ? (
          <Button
            variant="primary"
            accent="var(--color-fuel)"
            size="lg"
            block
            disabled={!valid || addFood.isPending}
            onClick={submit}
          >
            <Zap size={18} /> {kcalValue !== null ? t('Log {n} kcal', { n: Math.round(kcalValue) }) : t('Log')}
          </Button>
        ) : undefined
      }
    >
      <Segmented
        className="mb-4"
        value={tab}
        onChange={setTab}
        accent="var(--color-fuel)"
        options={[
          { value: 'saved', label: t('Saved meals') },
          { value: 'custom', label: t('Custom') },
        ]}
      />
      {tab === 'saved' ? (
        <SavedMealList date={date} onLogged={onClose} />
      ) : (
        <div className="space-y-3">
          <Field label={t('Food / meal')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('e.g. Oats + whey')} autoFocus />
          <div className="grid grid-cols-3 gap-2">
            <Field label={t('Protein')} inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} suffix="g" />
            <Field label={t('Carbs')} inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} suffix="g" />
            <Field label={t('Fat')} inputMode="decimal" value={f} onChange={(e) => setF(e.target.value)} suffix="g" />
          </div>
          <Field
            label={t('Calories')}
            inputMode="numeric"
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
            suffix="kcal"
            placeholder={derivedKcal > 0 ? String(derivedKcal) : ''}
            hint={derivedKcal > 0 && kcal === '' ? t('Auto from macros: {n} kcal', { n: derivedKcal }) : undefined}
          />
          <label className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3">
            <span>
              <span className="block text-sm font-medium">{t('Save to meal library')}</span>
              <span className="block text-xs text-ink-3">{t('One-tap log it next time')}</span>
            </span>
            <Toggle checked={save} onChange={setSave} label={t('Save to meal library')} />
          </label>
        </div>
      )}
    </Sheet>
  );
}
