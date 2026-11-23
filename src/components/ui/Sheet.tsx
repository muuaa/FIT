import { X } from 'lucide-react';
import { t } from '@/lib/i18n';
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
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

  // Drag the handle/header down to dismiss, like a native sheet.
  const [drag, setDrag] = useState(0);
  const startY = useRef<number | null>(null);
  useEffect(() => {
    if (!open) setDrag(0);
  }, [open]);
  const onDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    startY.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (startY.current !== null) setDrag(Math.max(0, e.clientY - startY.current));
  };
  const onUp = () => {
    if (startY.current === null) return;
    startY.current = null;
    if (drag > 90) onClose();
    setDrag(0);
  };

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="animate-fade absolute inset-0 bg-black/55 backdrop-blur-[3px]" onClick={onClose} />
      <div
        className="animate-sheet glass-strong relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[32px] border-b-0"
        style={drag ? { transform: `translateY(${drag}px)` } : { transition: 'transform 200ms ease' }}
      >
        <div
          className="touch-none select-none"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-white/15" />
          <header className="flex items-center gap-2 px-5 pb-1 pt-2">
          <h2 className="flex-1 text-lg font-semibold tracking-tight">{title}</h2>
          <IconButton label={t('Close')} onClick={onClose} className="-me-2">
            <X size={20} />
            </IconButton>
          </header>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-line/60 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">{footer}</div>}
        {!footer && <div className="pb-safe" />}
      </div>
    </div>,
    document.body,
  );
}
