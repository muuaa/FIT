import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { t } from './lib/i18n';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import App from './App';
import { AuthGate } from './features/auth/AuthGate';
import './lib/install';
import { restoreLanguage } from './lib/i18n';
import { requestPersistence } from './lib/localDb';
import { toast } from './stores/toastStore';
import './index.css';

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (err) => toast.error(err instanceof Error ? err.message : t('Could not read your data')),
  }),
  mutationCache: new MutationCache({
    onError: (err) => toast.error(err instanceof Error ? err.message : t('Could not save')),
  }),
  // Data is on-device, so it is always fresh: no refetch timers needed.
  defaultOptions: { queries: { staleTime: Infinity, retry: false, refetchOnWindowFocus: false } },
});

requestPersistence();
restoreLanguage();

/** Embedded single-file builds (VITE_EMBEDDED=1) can't rely on URL paths, so they route in memory. */
function Router({ children }: { children: ReactNode }) {
  return import.meta.env.VITE_EMBEDDED ? <MemoryRouter>{children}</MemoryRouter> : <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>{children}</BrowserRouter>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthGate>
          <App />
        </AuthGate>
      </Router>
    </QueryClientProvider>
  </StrictMode>,
);
