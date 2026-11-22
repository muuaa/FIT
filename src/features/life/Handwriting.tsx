import { Eraser, Loader2, Pen, Redo2, Trash2, Undo2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

type Point = [number, number, number]; // x, y, pressure
interface Stroke {
  color: string;
  size: number;
  eraser: boolean;
  points: Point[];
}

const COLORS = ['#111827', '#2563eb', '#dc2626', '#16a34a', '#9333ea'];
const SIZES = [2, 4, 8];
const PAPER = '#ffffff';
const LINE = '#e5e7eb';

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  ctx.strokeStyle = s.eraser ? PAPER : s.color;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const pts = s.points;
  if (pts.length === 1) {
    const [x, y, p] = pts[0];
    ctx.beginPath();
    ctx.arc(x, y, (s.size * (s.eraser ? 4 : 0.5 + p)) / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0, p0] = pts[i - 1];
    const [x1, y1, p1] = pts[i];
    ctx.lineWidth = s.eraser ? s.size * 4 : s.size * (0.5 + (p0 + p1) / 2);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
}

/**
 * Full-screen handwriting page. Works with fingers, mouse and styluses (Apple Pencil pressure
 * changes line width). Once a pen is detected, finger touches are ignored so a resting palm
 * doesn't draw.
 */
export function Handwriting({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (png: Blob) => Promise<boolean> }) {
  if (!open) return null;
  return createPortal(<Pad onClose={onClose} onSave={onSave} />, document.body);
}

function Pad({ onClose, onSave }: { onClose: () => void; onSave: (png: Blob) => Promise<boolean> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const redo = useRef<Stroke[]>([]);
  const current = useRef<Stroke | null>(null);
  const penSeen = useRef(false);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [eraser, setEraser] = useState(false);
  const [, force] = useState(0);
  const [saving, setSaving] = useState(false);
  const [lined, setLined] = useState(true);

  const redraw = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const dpr = c.width / c.clientWidth;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (lined) {
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1;
      for (let y = 40; y < c.clientHeight; y += 36) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(c.clientWidth, y);
        ctx.stroke();
      }
    }
    for (const s of strokes.current) drawStroke(ctx, s);
  }, [lined]);

  useEffect(() => {
    const c = canvas.current;
    const w = wrap.current;
    if (!c || !w) return;
    const resize = () => {
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      c.width = Math.round(w.clientWidth * dpr);
      c.height = Math.round(w.clientHeight * dpr);
      c.style.width = `${w.clientWidth}px`;
      c.style.height = `${w.clientHeight}px`;
      redraw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(w);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      ro.disconnect();
      document.body.style.overflow = prev;
    };
  }, [redraw]);

  const pos = (e: React.PointerEvent): Point => {
    const r = canvas.current!.getBoundingClientRect();
    const p = e.pointerType === 'pen' ? Math.max(0.1, e.pressure || 0.5) : 0.5;
    return [e.clientX - r.left, e.clientY - r.top, p];
  };

  const down = (e: React.PointerEvent) => {
    if (e.pointerType === 'pen') penSeen.current = true;
    else if (e.pointerType === 'touch' && penSeen.current) return; // palm rejection
    e.currentTarget.setPointerCapture(e.pointerId);
    current.current = { color, size, eraser, points: [pos(e)] };
    redo.current = [];
    const ctx = canvas.current!.getContext('2d')!;
    drawStroke(ctx, current.current);
  };
  const move = (e: React.PointerEvent) => {
    const s = current.current;
    if (!s) return;
    const events = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [e.nativeEvent];
    const ctx = canvas.current!.getContext('2d')!;
    for (const ev of events) {
      const r = canvas.current!.getBoundingClientRect();
      const p: Point = [ev.clientX - r.left, ev.clientY - r.top, ev.pointerType === 'pen' ? Math.max(0.1, ev.pressure || 0.5) : 0.5];
      s.points.push(p);
      drawStroke(ctx, { ...s, points: s.points.slice(-2) });
    }
  };
  const up = () => {
    if (current.current) {
      strokes.current.push(current.current);
      current.current = null;
      force((n) => n + 1);
    }
  };

  const save = async () => {
    const c = canvas.current;
    if (!c || !strokes.current.length) return;
    setSaving(true);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
    const ok = blob ? await onSave(blob) : false;
    setSaving(false);
    if (ok) onClose();
  };

  const tool = (active: boolean) =>
    cn('grid size-10 shrink-0 place-items-center rounded-xl transition', active ? 'bg-journal text-bg' : 'text-ink-2 active:bg-surface-3');

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-bg" role="dialog" aria-modal="true" aria-label={t('Handwriting')}>
      <div className="pt-safe border-b border-line bg-surface">
        <div className="flex items-center gap-1 px-2 py-2">
          <button type="button" aria-label={t('Close')} onClick={onClose} className={tool(false)}>
            <X size={20} />
          </button>
          <div className="mx-1 h-6 w-px bg-line" />
          <button type="button" aria-label={t('Pen')} aria-pressed={!eraser} onClick={() => setEraser(false)} className={tool(!eraser)}>
            <Pen size={18} />
          </button>
          <button type="button" aria-label={t('Eraser')} aria-pressed={eraser} onClick={() => setEraser(true)} className={tool(eraser)}>
            <Eraser size={18} />
          </button>
          <button
            type="button"
            aria-label={t('Undo')}
            disabled={!strokes.current.length}
            onClick={() => {
              const s = strokes.current.pop();
              if (s) redo.current.push(s);
              redraw();
              force((n) => n + 1);
            }}
            className={cn(tool(false), 'disabled:opacity-30')}
          >
            <Undo2 size={18} />
          </button>
          <button
            type="button"
            aria-label={t('Redo')}
            disabled={!redo.current.length}
            onClick={() => {
              const s = redo.current.pop();
              if (s) strokes.current.push(s);
              redraw();
              force((n) => n + 1);
            }}
            className={cn(tool(false), 'disabled:opacity-30')}
          >
            <Redo2 size={18} />
          </button>
          <button
            type="button"
            aria-label={t('Clear page')}
            disabled={!strokes.current.length}
            onClick={() => {
              redo.current = [...strokes.current].reverse();
              strokes.current = [];
              redraw();
              force((n) => n + 1);
            }}
            className={cn(tool(false), 'disabled:opacity-30')}
          >
            <Trash2 size={18} />
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={save}
            disabled={!strokes.current.length || saving}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-journal px-4 text-sm font-semibold text-bg disabled:opacity-40"
          >
            {saving && <Loader2 size={16} className="animate-spin" />} {t('Save')}
          </button>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto px-3 pb-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={t('Colour')}
              aria-pressed={!eraser && color === c}
              onClick={() => {
                setColor(c);
                setEraser(false);
              }}
              className={cn('size-8 shrink-0 rounded-full border-2', !eraser && color === c ? 'border-ink' : 'border-transparent')}
              style={{ background: c }}
            />
          ))}
          <div className="mx-1 h-6 w-px bg-line" />
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              aria-label={t('Thickness {n}', { n: s })}
              aria-pressed={size === s}
              onClick={() => setSize(s)}
              className={cn('grid size-8 shrink-0 place-items-center rounded-full', size === s ? 'bg-surface-3' : '')}
            >
              <span className="rounded-full bg-ink" style={{ width: s * 2 + 2, height: s * 2 + 2 }} />
            </button>
          ))}
          <div className="mx-1 h-6 w-px bg-line" />
          <button
            type="button"
            onClick={() => setLined((v) => !v)}
            className={cn('h-8 shrink-0 rounded-full px-3 text-xs font-semibold', lined ? 'bg-surface-3 text-ink' : 'text-ink-3')}
          >
            {t('Lines')}
          </button>
        </div>
      </div>
      <div ref={wrap} className="relative min-h-0 flex-1 pb-safe">
        <canvas
          ref={canvas}
          className="absolute inset-0 touch-none"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
        />
      </div>
    </div>
  );
}
