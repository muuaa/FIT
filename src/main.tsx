import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import App from './App';
import { AuthGate } from './features/auth/AuthGate';
import './lib/install';
import { restoreLanguage } from './lib/i18n';
import { requestPersistence, ViewOnlyError } from './lib/localDb';
import { toast } from './stores/toastStore';
import { captureNativeLaunch } from './lib/push';
import './index.css';

captureNativeLaunch();

// Tapping something while looking at your partner's data: explain instead of failing silently.
const viewOnly = (e: unknown) => e instanceof ViewOnlyError && (toast.error(e.message), true);
window.addEventListener('error', (ev) => viewOnly(ev.error) && ev.preventDefault());
window.addEventListener('unhandledrejection', (ev) => viewOnly(ev.reason) && ev.preventDefault());
requestPersistence();

// Installed apps keep an offline copy. Check for a new version whenever the app is opened or brought
// back to the front. A new version is switched in while the app is in the background (never in front
// of you, which looked like a glitch); you see it the next time you come back.
if ('serviceWorker' in navigator && !import.meta.env.VITE_EMBEDDED) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  let pending = false;
  let reloaded = false;
  const reloadNow = () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // first install: nothing to refresh
    if (document.visibilityState === 'hidden') reloadNow();
    else pending = true;
  });
  document.addEventListener('visibilitychange', () => {
    if (pending && document.visibilityState === 'hidden') reloadNow();
  });
  // A page from the old version that's no longer online: load the new version instead of failing.
  window.addEventListener('vite:preloadError', (ev) => {
    ev.preventDefault();
    try {
      const last = Number(sessionStorage.getItem('fit.reloadedForUpdate') ?? 0);
      if (Date.now() - last < 30_000) return;
      sessionStorage.setItem('fit.reloadedForUpdate', String(Date.now()));
    } catch {
      /* ignore */
    }
    reloadNow();
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
