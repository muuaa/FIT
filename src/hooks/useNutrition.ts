import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, unwrap } from '@/lib/supabase';
import type { FoodEntry, Macros, SavedMeal } from '@/types/db';

const FOOD_COLS = 'id, date, name, kcal, protein_g, carbs_g, fat_g, created_at';
const MEAL_COLS = 'id, name, kcal, protein_g, carbs_g, fat_g';

export function useFoodEntries(date: string) {
  return useQuery({
    queryKey: ['food', date],
    queryFn: async () =>
      unwrap(await supabase.from('food_entries').select(FOOD_COLS).eq('date', date).order('created_at')) as FoodEntry[],
  });
}

export function sumMacros(entries: Macros[]): Macros {
  return entries.reduce(
    (a, e) => ({
      kcal: a.kcal + Number(e.kcal),
      protein_g: a.protein_g + Number(e.protein_g),
      carbs_g: a.carbs_g + Number(e.carbs_g),
      fat_g: a.fat_g + Number(e.fat_g),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
}

export function useAddFood(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: Macros & { name: string }) =>
      unwrap(await supabase.from('food_entries').insert({ ...entry, date }).select(FOOD_COLS).single()) as FoodEntry,
    onSuccess: (row) => qc.setQueryData<FoodEntry[]>(['food', date], (old) => [...(old ?? []), row]),
  });
}

export function useDeleteFood(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(await supabase.from('food_entries').delete().eq('id', id));
      return id;
    },
    onMutate: (id) => {
      const prev = qc.getQueryData<FoodEntry[]>(['food', date]);
      qc.setQueryData<FoodEntry[]>(['food', date], (old) => old?.filter((e) => e.id !== id));
      return { prev };
    },
    onError: (_e, _v, c) => c?.prev && qc.setQueryData(['food', date], c.prev),
  });
}

export function useSavedMeals() {
  return useQuery({
    queryKey: ['savedMeals'],
    queryFn: async () => unwrap(await supabase.from('saved_meals').select(MEAL_COLS).order('name')) as SavedMeal[],
  });
}

export function useAddSavedMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (meal: Omit<SavedMeal, 'id'>) =>
      unwrap(await supabase.from('saved_meals').insert(meal).select(MEAL_COLS).single()) as SavedMeal,
    onSuccess: (row) =>
      qc.setQueryData<SavedMeal[]>(['savedMeals'], (old) =>
        [...(old ?? []), row].sort((a, b) => a.name.localeCompare(b.name)),
      ),
  });
}

export function useDeleteSavedMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(await supabase.from('saved_meals').delete().eq('id', id));
      return id;
    },
    onSuccess: (id) => qc.setQueryData<SavedMeal[]>(['savedMeals'], (old) => old?.filter((m) => m.id !== id)),
  });
}
