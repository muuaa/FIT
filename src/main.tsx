import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import App from './App';
import { AuthGate } from './features/auth/AuthGate';
import './lib/install';
import { restoreLanguage } from './lib/i18n';
import { requestPersistence } from './lib/localDb';
import './index.css';



requestPersistence();

// Installed apps keep an offline copy. Check for a new version whenever the app is opened or brought
// back to the front, and reload once the new version takes over, so updates show up right away.
if ('serviceWorker' in navigator && !import.meta.env.VITE_EMBEDDED) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return; // first install: nothing to refresh
    reloaded = true;
    window.location.reload();
  });
  const check = () => void navigator.serviceWorker.getRegistration().then((r) => r?.update()).catch(() => undefined);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
  window.setTimeout(check, 3000);
}
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
