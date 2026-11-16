import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';
import { cn } from '@/lib/cn';

export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
      {toasts.map((t) => {
        const Icon = t.tone === 'error' ? AlertCircle : t.tone === 'success' ? CheckCircle2 : Info;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            className={cn(
              'animate-fade pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-2xl border bg-surface-2/95 px-4 py-3 text-left text-sm shadow-2xl backdrop-blur',
              t.tone === 'error' ? 'border-danger/40' : 'border-line',
            )}
          >
            <Icon
              size={18}
              className={t.tone === 'error' ? 'text-danger' : t.tone === 'success' ? 'text-fuel' : 'text-ink-2'}
            />
            <span className="flex-1">{t.message}</span>
          </button>
        );
      })}
    </div>
  );
}
