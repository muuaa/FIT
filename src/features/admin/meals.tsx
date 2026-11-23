import { useQueryClient } from '@tanstack/react-query';
import { ChefHat, ChevronLeft, ChevronRight, ShoppingCart, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { useTable, useTableActions } from '@/hooks/useTable';
import { useToday } from '@/hooks/useToday';
import { addDays, relativeDay } from '@/lib/date';
import { t } from '@/lib/i18n';
import { uid } from '@/lib/localDb';
import { weekOf } from '@/lib/plan';
import { addItem, createList, fetchLists } from '@/lib/sharedLists';
import { cloudEnabled } from '@/lib/supabase';
import { toast } from '@/stores/toastStore';
import type { MealSlot, PlannedMeal } from '@/types/db';

const SLOTS: { id: MealSlot; label: string; emoji: string }[] = [
  { id: 'breakfast', label: 'Breakfast', emoji: '🍳' },
  { id: 'lunch', label: 'Lunch', emoji: '🥗' },
  { id: 'dinner', label: 'Dinner', emoji: '🍲' },
];

function MealSheet({ meal, date, slot, onClose }: { meal: PlannedMeal | null; date: string; slot: MealSlot | null; onClose: () => void }) {
  const actions = useTableActions('meal_plan');
  const [title, setTitle] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [seeded, setSeeded] = useState<string | null>(null);
  const key = slot ? `${date}-${slot}-${meal?.id ?? ''}` : null;
  if (key !== seeded) {
    setSeeded(key);
    setTitle(meal?.title ?? '');
    setIngredients(meal?.ingredients.join('\n') ?? '');
  }
  const save = () => {
    if (!slot || !title.trim()) return;
    actions.put({
      id: meal?.id ?? uid(),
      date,
      slot,
      title: title.trim().slice(0, 80),
      ingredients: ingredients.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 40),
      created_at: meal?.created_at ?? new Date().toISOString(),
    });
    onClose();
  };
  const label = SLOTS.find((s) => s.id === slot);
  return (
    <Sheet
      open={slot !== null}
      onClose={onClose}
      title={label ? `${label.emoji} ${t(label.label)} · ${relativeDay(date)}` : ''}
      footer={
        <div className="flex gap-2">
          {meal && (
            <IconButton
              label={t('Delete')}
              className="size-12 bg-danger/12 text-danger"
              onClick={() => {
                actions.remove(meal.id);
                onClose();
              }}
            >
              <Trash2 size={18} />
            </IconButton>
          )}
          <Button variant="primary" accent="var(--color-fuel)" size="lg" className="flex-1" disabled={!title.trim()} onClick={save}>
            {t('Save')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Field label={t('Meal')} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('e.g. Chicken mansaf')} />
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-3">{t('Ingredients (one per line)')}</span>
          <textarea
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            rows={6}
            placeholder={t('Rice\nChicken\nJameed')}
            className="w-full rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3 text-ink outline-none placeholder:text-ink-3 focus:border-accent/60"
          />
        </label>
      </div>
    </Sheet>
  );
}

export function MealsPage() {
  const today = useToday();
  const qc = useQueryClient();
  const [anchor, setAnchor] = useState(today);
  const { data: meals = [] } = useTable('meal_plan');
  const [edit, setEdit] = useState<{ date: string; slot: MealSlot; meal: PlannedMeal | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const week = weekOf(anchor);
  const weekMeals = meals.filter((m) => week.includes(m.date));

  const toGroceries = async () => {
    const wanted = [...new Set(weekMeals.flatMap((m) => m.ingredients).map((s) => s.trim()).filter(Boolean))];
    if (!wanted.length) return toast.info(t('Add ingredients to this week’s meals first.'));
    setBusy(true);
    try {
      const data = await fetchLists();
      let list = data.lists.find((l) => /grocer|shopping|بقال|تسوق/i.test(l.name));
      if (!list) list = await createList(t('Groceries'));
      const have = new Set(data.items.filter((i) => i.list_id === list!.id && !i.done).map((i) => i.text.trim().toLowerCase()));
      const add = wanted.filter((w) => !have.has(w.toLowerCase()));
      for (const w of add) await addItem(list.id, w.slice(0, 200));
      await qc.invalidateQueries({ queryKey: ['sharedLists'] });
      toast.success(add.length ? t('Added {n} items to {list}', { n: add.length, list: list.name }) : t('Everything is already on {list}', { list: list.name }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Could not save'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={t('Meal plan')} back="/life" />
      <div className="glass animate-page mb-3 flex items-center justify-between rounded-[22px] px-1 py-1">
        <IconButton label={t('Previous week')} onClick={() => setAnchor(addDays(anchor, -7))}>
          <ChevronLeft size={20} className="rtl:-scale-x-100" />
        </IconButton>
        <button type="button" className="text-sm font-semibold" onClick={() => setAnchor(today)}>
          {relativeDay(week[0])} – {relativeDay(week[6])}
        </button>
        <IconButton label={t('Next week')} onClick={() => setAnchor(addDays(anchor, 7))}>
          <ChevronRight size={20} className="rtl:-scale-x-100" />
        </IconButton>
      </div>
      <div className="space-y-3">
        {cloudEnabled && (
          <Button block variant="primary" accent="var(--color-fuel)" disabled={busy} onClick={() => void toGroceries()}>
            <ShoppingCart size={17} /> {t('Send this week’s ingredients to the grocery list')}
          </Button>
        )}
        {week.map((d) => (
          <Card key={d} title={relativeDay(d)} icon={ChefHat} accent={d === today ? 'var(--color-accent)' : 'var(--color-fuel)'}>
            <ul className="space-y-1.5">
              {SLOTS.map((s) => {
                const m = weekMeals.find((x) => x.date === d && x.slot === s.id);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setEdit({ date: d, slot: s.id, meal: m ?? null })}
                      className="press flex w-full items-center gap-3 rounded-2xl bg-white/[0.035] px-3 py-2.5 text-start"
                    >
                      <span className="text-lg">{s.emoji}</span>
                      <span className="w-20 shrink-0 text-xs font-medium uppercase tracking-wider text-ink-3">{t(s.label)}</span>
                      <span className={m ? 'min-w-0 flex-1 truncate text-[15px] font-medium' : 'min-w-0 flex-1 truncate text-sm text-ink-3'}>
                        {m ? m.title : t('Plan a meal')}
                      </span>
                      {m && m.ingredients.length > 0 && <span className="tabular text-[11px] text-ink-3">🧺 {m.ingredients.length}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
      <MealSheet date={edit?.date ?? today} slot={edit?.slot ?? null} meal={edit?.meal ?? null} onClose={() => setEdit(null)} />
    </>
  );
}

export function useMealsSummary(): string {
  const today = useToday();
  const { data: meals = [] } = useTable('meal_plan');
  const dinner = meals.find((m) => m.date === today && m.slot === 'dinner');
  return dinner ? dinner.title : t('Plan');
}
