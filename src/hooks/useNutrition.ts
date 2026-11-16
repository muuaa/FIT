import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { all, insert, remove, uid } from '@/lib/localDb';
import type { FoodEntry, Macros, SavedMeal } from '@/types/db';

export function useFoodEntries(date: string) {
  return useQuery({
    queryKey: ['food', date],
    queryFn: async () =>
      all('food_entries')
        .filter((e) => e.date === date)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
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
    mutationFn: async (entry: Macros & { name: string }): Promise<FoodEntry> =>
      insert('food_entries', { ...entry, id: uid(), date, created_at: new Date().toISOString() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['food', date] }),
  });
}

export function useDeleteFood(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => remove('food_entries', (e) => e.id === id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['food', date] }),
  });
}

export function useSavedMeals() {
  return useQuery({
    queryKey: ['savedMeals'],
    queryFn: async () => [...all('saved_meals')].sort((a, b) => a.name.localeCompare(b.name)),
  });
}

export function useAddSavedMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (meal: Omit<SavedMeal, 'id'>): Promise<SavedMeal> =>
      insert('saved_meals', { ...meal, id: uid(), created_at: new Date().toISOString() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['savedMeals'] }),
  });
}

export function useDeleteSavedMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => remove('saved_meals', (m) => m.id === id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['savedMeals'] }),
  });
}
