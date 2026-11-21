import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';
import { cn } from '@/lib/cn';

export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+12px)]"
    >
      {toasts.map((t) => {
        const Icon = t.tone === 'error' ? AlertCircle : t.tone === 'success' ? CheckCircle2 : Info;
        return (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'animate-toast pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-2xl border bg-surface-2/95 py-2 pl-4 pr-2 text-sm shadow-2xl backdrop-blur',
              t.tone === 'error' ? 'border-danger/40' : 'border-line',
            )}
          >
            <Icon
              size={18}
              className={cn('shrink-0', t.tone === 'error' ? 'text-danger' : t.tone === 'success' ? 'text-fuel' : 'text-ink-2')}
            />
            <button type="button" onClick={() => dismiss(t.id)} className="min-h-9 flex-1 py-1 text-left">
              {t.message}
            </button>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
                className="h-9 shrink-0 rounded-xl bg-surface-3 px-3 text-sm font-semibold text-water active:scale-95"
              >
                {t.action.label}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
