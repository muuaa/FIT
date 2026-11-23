import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { t } from './i18n';
import { toast } from '@/stores/toastStore';

/** The app's single React Query client (exported so non-React code can reset it). */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (err) => toast.error(err instanceof Error ? err.message : t('Could not read your data')),
  }),
  mutationCache: new MutationCache({
    onError: (err) => toast.error(err instanceof Error ? err.message : t('Could not save')),
  }),
  // Data is on-device, so it is always fresh: no refetch timers needed.
  defaultOptions: { queries: { staleTime: Infinity, retry: false, refetchOnWindowFocus: false } },
});
