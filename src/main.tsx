import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './features/auth/AuthContext';
import { toast } from './stores/toastStore';
import './index.css';

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to load data'),
  }),
  mutationCache: new MutationCache({
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not save'),
  }),
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
