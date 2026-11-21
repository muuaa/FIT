import { BookmarkPlus, Droplets, Flame, Pencil, Pill, Plus, Settings2, Trash2, Utensils } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DayPicker } from '@/components/ui/DayPicker';
import { Field } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { Empty, Spinner } from '@/components/ui/States';
import {
  useAddFood,
  useAddSavedMeal,
  useDeleteFood,
  useDeleteSavedMeal,
  useFoodEntries,
  useSavedMeals,
  useUpdateSavedMeal,
} from '@/hooks/useNutrition';
import { useProfile } from '@/hooks/useProfile';
import { tick } from '@/lib/alerts';
import { relativeDay, todayISO } from '@/lib/date';
import { num } from '@/lib/format';
import { toast } from '@/stores/toastStore';
import type { SavedMeal } from '@/types/db';
import { CalorieSummary } from './CalorieSummary';
import { FoodEntrySheet, macroLine } from './FoodEntrySheet';
import { SupplementChecklist } from './SupplementChecklist';
import { SupplementManagerSheet } from './SupplementManagerSheet';
import { WaterTracker } from './WaterTracker';

function FoodLog({ date }: { date: string }) {
  const { data: entries = [], isLoading } = useFoodEntries(date);
  const del = useDeleteFood(date);
  if (isLoading) return <Spinner />;
  if (!entries.length) return <Empty icon={Utensils} title="Nothing logged yet" />;
  return (
    <ul className="divide-y divide-line/60">
      {entries.map((e) => (
        <li key={e.id} className="flex items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{e.name}</div>
            <div className="tabular text-xs text-ink-3">
              {new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {macroLine(e)}
            </div>
          </div>
          <span className="tabular text-sm font-semibold">{e.kcal}</span>
          <IconButton label={`Delete ${e.name}`} onClick={() => del.mutate(e.id)} className="-mr-2">
            <Trash2 size={16} />
          </IconButton>
        </li>
      ))}
    </ul>
  );
}

function SavedMealSheet({ meal, open, onClose }: { meal: SavedMeal | null; open: boolean; onClose: () => void }) {
  const add = useAddSavedMeal();
  const edit = useUpdateSavedMeal();
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [f, setF] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(meal?.name ?? '');
    setKcal(meal ? String(meal.kcal) : '');
    setP(meal ? String(meal.protein_g) : '');
    setC(meal ? String(meal.carbs_g) : '');
    setF(meal ? String(meal.fat_g) : '');
  }, [open, meal]);

  const derived = Math.round((num(p) ?? 0) * 4 + (num(c) ?? 0) * 4 + (num(f) ?? 0) * 9);
  const kcalValue = num(kcal) ?? (derived > 0 ? derived : null);
  const valid = name.trim() !== '' && kcalValue !== null && kcalValue >= 0;
  const pending = add.isPending || edit.isPending;

  function submit() {
    if (!valid || kcalValue === null) return;
    const values = {
      name: name.trim(),
      kcal: Math.round(kcalValue),
      protein_g: num(p) ?? 0,
      carbs_g: num(c) ?? 0,
      fat_g: num(f) ?? 0,
    };
    const done = () => {
      toast.success(meal ? 'Meal updated' : `Saved ${values.name}`);
      onClose();
    };
    if (meal) edit.mutate({ id: meal.id, ...values }, { onSuccess: done });
    else add.mutate(values, { onSuccess: done });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={meal ? 'Edit saved meal' : 'New saved meal'}
      footer={
        <Button variant="primary" accent="var(--color-fuel)" size="lg" block disabled={!valid || pending} onClick={submit}>
          {meal ? 'Save changes' : 'Save meal'}
        </Button>
      }
    >
      <div className="space-y-3">
        <Field label="Meal name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken, rice & veg" />
        <div className="grid grid-cols-3 gap-2">
          <Field label="Protein" inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} suffix="g" />
          <Field label="Carbs" inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} suffix="g" />
          <Field label="Fat" inputMode="decimal" value={f} onChange={(e) => setF(e.target.value)} suffix="g" />
        </div>
        <Field
          label="Calories"
          inputMode="numeric"
          value={kcal}
          onChange={(e) => setKcal(e.target.value)}
          suffix="kcal"
          placeholder={derived > 0 ? String(derived) : ''}
          hint={derived > 0 && kcal === '' ? `Auto from macros: ${derived} kcal` : undefined}
        />
      </div>
    </Sheet>
  );
}

function SavedMealsCard({ date }: { date: string }) {
  const { data: meals = [] } = useSavedMeals();
  const addFood = useAddFood(date);
  const del = useDeleteSavedMeal();
  const [sheet, setSheet] = useState<{ meal: SavedMeal | null } | null>(null);
  const isToday = date === todayISO();
  return (
    <Card
      title="Saved meals"
      icon={BookmarkPlus}
      accent="var(--color-fuel)"
      action={
        <IconButton label="New saved meal" onClick={() => setSheet({ meal: null })}>
          <Plus size={20} />
        </IconButton>
      }
    >
      {meals.length === 0 ? (
        <button type="button" className="block w-full" onClick={() => setSheet({ meal: null })}>
          <Empty icon={BookmarkPlus} title="Your meal library is empty">
            Tap to add your go-to bulk meals, then log them with one tap.
          </Empty>
        </button>
      ) : (
        <>
          <p className="mb-2 text-xs text-ink-3">Tap a meal to log it{isToday ? '' : ` to ${relativeDay(date)}`}.</p>
          <ul className="space-y-1.5">
            {meals.map((m) => (
              <li key={m.id} className="flex items-center gap-1 rounded-2xl bg-surface-2 pr-1">
                <button
                  type="button"
                  disabled={addFood.isPending}
                  onClick={() => {
                    tick();
                    addFood.mutate(
                      { name: m.name, kcal: m.kcal, protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g },
                      { onSuccess: () => toast.success(`Logged ${m.name} · ${m.kcal} kcal`) },
                    );
                  }}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl py-2.5 pl-3 text-left active:bg-surface-3"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-fuel/15 text-fuel">
                    <Plus size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{m.name}</span>
                    <span className="tabular block truncate text-xs text-ink-3">
                      {m.kcal} kcal · {macroLine(m)}
                    </span>
                  </span>
                </button>
                <IconButton label={`Edit ${m.name}`} onClick={() => setSheet({ meal: m })}>
                  <Pencil size={16} />
                </IconButton>
                <IconButton label={`Delete ${m.name}`} onClick={() => del.mutate(m.id)}>
                  <Trash2 size={16} />
                </IconButton>
              </li>
            ))}
          </ul>
        </>
      )}
      <SavedMealSheet open={sheet !== null} meal={sheet?.meal ?? null} onClose={() => setSheet(null)} />
    </Card>
  );
}

export function FuelPage() {
  const { data: profile } = useProfile();
  const [date, setDate] = useState(todayISO());
  const [foodOpen, setFoodOpen] = useState<false | 'saved' | 'custom'>(false);
  const [suppOpen, setSuppOpen] = useState(false);

  return (
    <>
      <PageHeader title="Fuel" subtitle="Calories · Water · Supplements" />
      <DayPicker date={date} onChange={setDate} />
      {!profile ? (
        <Spinner />
      ) : (
        <div className="space-y-3">
          <Card
            title="Calories"
            icon={Flame}
            accent="var(--color-fuel)"
            action={
              <Button size="sm" variant="primary" accent="var(--color-fuel)" onClick={() => setFoodOpen('custom')}>
                <Plus size={16} /> Log
              </Button>
            }
          >
            <CalorieSummary profile={profile} date={date} />
            <div className="mt-4">
              <FoodLog date={date} />
            </div>
          </Card>

          <SavedMealsCard date={date} />

          <Card title="Hydration" icon={Droplets} accent="var(--color-water)">
            <WaterTracker profile={profile} date={date} />
          </Card>

          <Card
            title="Supplements"
            icon={Pill}
            accent="var(--color-supp)"
            action={
              <IconButton label="Manage supplements" onClick={() => setSuppOpen(true)}>
                <Settings2 size={18} />
              </IconButton>
            }
          >
            <SupplementChecklist date={date} onManage={() => setSuppOpen(true)} />
          </Card>
        </div>
      )}
      <FoodEntrySheet
        open={foodOpen !== false}
        initialTab={foodOpen || 'saved'}
        onClose={() => setFoodOpen(false)}
        date={date}
      />
      <SupplementManagerSheet open={suppOpen} onClose={() => setSuppOpen(false)} />
    </>
  );
}
