import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { currentUserId, supabase, unwrap } from '@/lib/supabase';
import type { Profile } from '@/types/db';

const COLS =
  'id, display_name, kcal_target, protein_target_g, carbs_target_g, fat_target_g, water_target_ml, bottle_ml, split_mode, default_rest_seconds';

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async (): Promise<Profile> => {
      const uid = await currentUserId();
      const existing = unwrap(await supabase.from('profiles').select(COLS).eq('id', uid).maybeSingle());
      if (existing) return existing as Profile;
      // Fallback if the signup trigger was not installed when this account was created.
      return unwrap(await supabase.from('profiles').insert({ id: uid }).select(COLS).single()) as Profile;
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Omit<Profile, 'id'>>) => {
      const uid = await currentUserId();
      return unwrap(await supabase.from('profiles').update(patch).eq('id', uid).select(COLS).single()) as Profile;
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ['profile'] });
      const prev = qc.getQueryData<Profile>(['profile']);
      if (prev) qc.setQueryData<Profile>(['profile'], { ...prev, ...patch });
      return { prev };
    },
    onError: (_e, _v, c) => c?.prev && qc.setQueryData(['profile'], c.prev),
    onSuccess: (data) => qc.setQueryData(['profile'], data),
  });
}
