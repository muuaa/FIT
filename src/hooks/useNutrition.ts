import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { all, insert, remove, uid, update } from '@/lib/localDb';
import { toast } from '@/stores/toastStore';
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
    mutationFn: async (id: string) => {
      const row = all('food_entries').find((e) => e.id === id);
      remove('food_entries', (e) => e.id === id);
      return row;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ['food', date] });
      if (row)
        toast.undo(`Deleted ${row.name}`, () => {
          insert('food_entries', row);
          qc.invalidateQueries({ queryKey: ['food', date] });
        });
    },
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
    mutationFn: async (id: string) => {
      const row = all('saved_meals').find((m) => m.id === id);
      remove('saved_meals', (m) => m.id === id);
      return row;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ['savedMeals'] });
      if (row)
        toast.undo(`Removed ${row.name} from saved meals`, () => {
          insert('saved_meals', row);
          qc.invalidateQueries({ queryKey: ['savedMeals'] });
        });
    },
  });
}

export function useUpdateSavedMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<SavedMeal> & { id: string }) =>
      update('saved_meals', (m) => m.id === id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['savedMeals'] }),
  });
}
