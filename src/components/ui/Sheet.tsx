import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from './Button';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Mobile bottom sheet. Scrolls internally; footer stays pinned above the safe area. */
export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="animate-fade absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div className="animate-sheet relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[28px] border-t border-line bg-surface">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-surface-3" />
        <header className="flex items-center gap-2 px-5 pb-1 pt-2">
          <h2 className="flex-1 text-lg font-semibold tracking-tight">{title}</h2>
          <IconButton label="Close" onClick={onClose} className="-mr-2">
            <X size={20} />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-line/60 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">{footer}</div>}
        {!footer && <div className="pb-safe" />}
      </div>
    </div>,
    document.body,
  );
}
