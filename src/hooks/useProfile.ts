import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getProfile, setProfile } from '@/lib/localDb';
import type { Profile } from '@/types/db';

export function useProfile() {
  return useQuery({ queryKey: ['profile'], queryFn: async () => getProfile() });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Omit<Profile, 'id'>>) => setProfile(patch),
    onSuccess: (data) => qc.setQueryData(['profile'], data),
  });
}
