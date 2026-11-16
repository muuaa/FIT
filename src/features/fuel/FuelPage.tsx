import { BookmarkPlus, Droplets, Flame, Pill, Plus, Settings2, Trash2, Utensils } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DayPicker } from '@/components/ui/DayPicker';
import { Field } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { Empty, Spinner } from '@/components/ui/States';
import { useAddSavedMeal, useDeleteFood, useDeleteSavedMeal, useFoodEntries, useSavedMeals } from '@/hooks/useNutrition';
import { useProfile } from '@/hooks/useProfile';
import { todayISO } from '@/lib/date';
import { num } from '@/lib/format';
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

function NewSavedMealSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const add = useAddSavedMeal();
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [f, setF] = useState('');
  const derived = Math.round((num(p) ?? 0) * 4 + (num(c) ?? 0) * 4 + (num(f) ?? 0) * 9);
  const kcalValue = num(kcal) ?? (derived > 0 ? derived : null);
  const valid = name.trim() && kcalValue !== null;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="New saved meal"
      footer={
        <Button
          variant="primary"
          accent="var(--color-fuel)"
          size="lg"
          block
          disabled={!valid || add.isPending}
          onClick={() =>
            add.mutate(
              {
                name: name.trim(),
                kcal: Math.round(kcalValue ?? 0),
                protein_g: num(p) ?? 0,
                carbs_g: num(c) ?? 0,
                fat_g: num(f) ?? 0,
              },
              {
                onSuccess: () => {
                  setName('');
                  setKcal('');
                  setP('');
                  setC('');
                  setF('');
                  onClose();
                },
              },
            )
          }
        >
          Save meal
        </Button>
      }
    >
      <div className="space-y-3">
        <Field label="Meal name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
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
        />
      </div>
    </Sheet>
  );
}

function SavedMealsCard({ onQuickLog }: { onQuickLog: () => void }) {
  const { data: meals = [] } = useSavedMeals();
  const del = useDeleteSavedMeal();
  const [creating, setCreating] = useState(false);
  return (
    <Card
      title="Saved meals"
      icon={BookmarkPlus}
      accent="var(--color-fuel)"
      action={
        <IconButton label="New saved meal" onClick={() => setCreating(true)}>
          <Plus size={20} />
        </IconButton>
      }
    >
      {meals.length === 0 ? (
        <Empty icon={BookmarkPlus} title="Your meal library is empty">
          Add your go-to bulk meals for one-tap logging.
        </Empty>
      ) : (
        <>
          <ul className="divide-y divide-line/60">
            {meals.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{m.name}</div>
                  <div className="tabular text-xs text-ink-3">
                    {m.kcal} kcal · {macroLine(m)}
                  </div>
                </div>
                <IconButton label={`Delete ${m.name}`} onClick={() => del.mutate(m.id)} className="-mr-2">
                  <Trash2 size={16} />
                </IconButton>
              </li>
            ))}
          </ul>
          <Button block variant="secondary" className="mt-2" onClick={onQuickLog}>
            Quick-log a saved meal
          </Button>
        </>
      )}
      <NewSavedMealSheet open={creating} onClose={() => setCreating(false)} />
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

          <SavedMealsCard onQuickLog={() => setFoodOpen('saved')} />

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
