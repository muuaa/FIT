import { Eraser, Hand, Loader2, Pen, Plus, Redo2, Trash2, Undo2, X } from 'lucide-react';
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
/** Tablets (shortest side 600px or more) are pen-only. */
const isTablet = () => Math.min(window.screen.width, window.screen.height) >= 600;
const PEN_KEY = 'fit.penUsed';
function PEN_ONLY(): boolean {
  if (isTablet()) return true;
  try {
    return localStorage.getItem(PEN_KEY) === '1';
  } catch {
    return false;
  }
}
function rememberPen() {
  try {
    localStorage.setItem(PEN_KEY, '1');
  } catch {
    /* fine: just this session */
  }
}
const LINE_START = 40;
const LINE_GAP = 36;
/** The page starts this many screens tall and grows as you write near the bottom (up to MAX). */
const START_SCREENS = 2;
const MAX_SCREENS = 8;

/** Line width at a pressure (0–1). Light pen pressure gives a fine line, firm pressure a bold one. */
const widthAt = (s: Stroke, p: number) => (s.eraser ? s.size * 4 : s.size * (0.3 + 1.2 * p));

function style(ctx: CanvasRenderingContext2D, s: Stroke) {
  // The ink sits on its own transparent layer above the paper, so the eraser removes ink only
  // (never the ruled lines).
  ctx.globalCompositeOperation = s.eraser ? 'destination-out' : 'source-over';
  ctx.strokeStyle = s.eraser ? '#000' : s.color;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

/**
 * Draw the piece of a stroke that ends at point i, as a curve through the midpoints of the
 * surrounding points: fast pen movement stays smooth instead of turning into straight segments.
 */
function drawSegment(ctx: CanvasRenderingContext2D, s: Stroke, i: number) {
  const pts = s.points;
  const a = pts[Math.max(0, i - 2)];
  const b = pts[i - 1];
  const c = pts[i];
  const sx = i === 1 ? b[0] : (a[0] + b[0]) / 2;
  const sy = i === 1 ? b[1] : (a[1] + b[1]) / 2;
  ctx.lineWidth = widthAt(s, (b[2] + c[2]) / 2);
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(b[0], b[1], (b[0] + c[0]) / 2, (b[1] + c[1]) / 2);
  ctx.stroke();
}

/** The last half-segment, from the final midpoint to where the pen lifted. */
function drawTail(ctx: CanvasRenderingContext2D, s: Stroke) {
  const pts = s.points;
  if (pts.length < 2) return;
  const b = pts[pts.length - 2];
  const c = pts[pts.length - 1];
  ctx.lineWidth = widthAt(s, c[2]);
  ctx.beginPath();
  ctx.moveTo((b[0] + c[0]) / 2, (b[1] + c[1]) / 2);
  ctx.lineTo(c[0], c[1]);
  ctx.stroke();
}

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  style(ctx, s);
  const pts = s.points;
  if (pts.length === 1) {
    const [x, y, p] = pts[0];
    ctx.beginPath();
    ctx.arc(x, y, widthAt(s, p) / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  for (let i = 1; i < pts.length; i++) drawSegment(ctx, s, i);
  drawTail(ctx, s);
}

/**
 * The drawing context. `desynchronized` lets Chrome on Android draw pen strokes straight to the
 * screen (low-latency ink), so the line keeps up with an S Pen or Honor pen.
 */
function ctxOf(c: HTMLCanvasElement): CanvasRenderingContext2D {
  return c.getContext('2d', { desynchronized: true })!;
}

/** Pen side button (S Pen) or eraser end/button: erase while held. */
const penErasing = (e: PointerEvent | React.PointerEvent) =>
  e.pointerType === 'pen' && ((e.buttons & 32) !== 0 || (e.buttons & 2) !== 0 || e.button === 5);

/**
 * Full-screen handwriting page that scrolls, so there's room to keep writing. Works with fingers,
 * mouse and styluses (pen pressure changes line width). Slide the page with two fingers, with the
 * hand tool, or (once a pen is used) with one finger, so a resting palm never draws.
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
  // Fingers never write on tablets, or on a phone once its pen (e.g. S Pen) has been used here:
  // there, one finger slides the page and only the pen writes.
  const penSeen = useRef(PEN_ONLY());
  const penDown = useRef(false);
  const cursor = useRef<HTMLDivElement>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [eraser, setEraser] = useState(false);
  const [, force] = useState(0);
  const [saving, setSaving] = useState(false);
  const [lined, setLined] = useState(true);
  const [hand, setHand] = useState(false);
  const [screen, setScreen] = useState(() => Math.max(400, window.innerHeight - 120));
  const [pageH, setPageH] = useState(() => Math.max(400, window.innerHeight - 120) * START_SCREENS);
  const touches = useRef(new Map<number, number>()); // pointerId -> last clientY, for sliding
  const [hint, setHint] = useState(true);
  useEffect(() => {
    const id = window.setTimeout(() => setHint(false), 4000);
    return () => window.clearTimeout(id);
  }, []);
  const maxPage = screen * MAX_SCREENS;

  const redraw = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = ctxOf(c);
    const dpr = c.width / c.clientWidth;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const s of strokes.current) drawStroke(ctx, s);
    if (current.current) drawStroke(ctx, current.current); // the page grew mid-stroke
  }, []);

  useEffect(() => {
    const c = canvas.current;
    const w = wrap.current;
    if (!c || !w) return;
    const resize = () => {
      // Sharp on high-resolution tablets and phones, but a tall page is a big image: keep it within
      // about 16 million pixels so a long page doesn't run the device out of memory.
      const budget = Math.sqrt(16_000_000 / Math.max(1, w.clientWidth * pageH));
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3, budget));
      setScreen(Math.max(400, w.clientHeight));
      c.width = Math.round(w.clientWidth * dpr);
      c.height = Math.round(pageH * dpr);
      c.style.width = `${w.clientWidth}px`;
      c.style.height = `${pageH}px`;
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
  }, [redraw, pageH]);

  /** Add another screen of paper (keeps everything already written). */
  const grow = useCallback(() => setPageH((h) => Math.min(maxPage, h + screen)), [maxPage, screen]);

  /** Pen pressure, eased between readings so the line doesn't wobble (mouse and finger: medium). */
  const pressure = (ev: PointerEvent | React.PointerEvent, prev?: number) => {
    if (ev.pointerType !== 'pen') return 0.5;
    const raw = Math.min(1, Math.max(0.05, ev.pressure || 0.5));
    return prev === undefined ? raw : prev * 0.6 + raw * 0.4;
  };
  const pos = (e: React.PointerEvent): Point => {
    const r = canvas.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top, pressure(e)];
  };

  /** While a pen hovers over the page, show where it will write (and how big the eraser is). */
  const showCursor = (e: React.PointerEvent | null) => {
    const el = cursor.current;
    if (!el) return;
    if (!e || e.pointerType !== 'pen' || hand) {
      el.style.opacity = '0';
      return;
    }
    const r = canvas.current!.getBoundingClientRect();
    const erasing = eraser || penErasing(e);
    const d = Math.max(4, widthAt({ color, size, eraser: erasing, points: [] }, 0.5));
    el.style.width = el.style.height = `${d}px`;
    el.style.transform = `translate(${e.clientX - r.left - d / 2}px, ${e.clientY - r.top - d / 2}px)`;
    el.style.borderColor = erasing ? '#9ca3af' : color;
    el.style.opacity = '1';
  };

  /** Fingers that slide the page instead of drawing. */
  const velocity = useRef({ v: 0, t: 0 });
  const fling = useRef(0);
  const stopFling = () => cancelAnimationFrame(fling.current);
  const slide = (e: React.PointerEvent) => {
    const prev = touches.current.get(e.pointerId);
    touches.current.set(e.pointerId, e.clientY);
    if (prev === undefined || !wrap.current) return;
    // With two fingers, move by their average so the page follows both.
    const dy = (e.clientY - prev) / Math.max(1, touches.current.size === 2 ? 2 : 1);
    wrap.current.scrollTop -= dy;
    const now = performance.now();
    const dt = Math.max(1, now - velocity.current.t);
    velocity.current = { v: 0.8 * (dy / dt) + 0.2 * velocity.current.v, t: now };
  };
  /** Let go while sliding: the page keeps gliding and slows down, like normal scrolling. */
  const release = () => {
    const w = wrap.current;
    let v = velocity.current.v * 16; // px per frame
    if (!w || performance.now() - velocity.current.t > 80 || Math.abs(v) < 1) return;
    const step = () => {
      w.scrollTop -= v;
      v *= 0.95;
      if (Math.abs(v) > 0.5) fling.current = requestAnimationFrame(step);
    };
    fling.current = requestAnimationFrame(step);
  };
  useEffect(() => stopFling, []);

  const down = (e: React.PointerEvent) => {
    showCursor(null);
    stopFling();
    velocity.current = { v: 0, t: performance.now() };
    if (e.pointerType === 'pen') {
      if (!penSeen.current) rememberPen();
      penSeen.current = true;
      penDown.current = true;
    }
    if (e.pointerType === 'touch') {
      // A palm landing while the pen writes: ignore it completely (no drawing, no sliding).
      if (penDown.current) return;
      touches.current.set(e.pointerId, e.clientY);
      e.currentTarget.setPointerCapture(e.pointerId);
      // Second finger, hand tool, or a finger while using a pen (palm): slide, don't draw.
      if (touches.current.size > 1 || hand || penSeen.current) {
        if (current.current && touches.current.size > 1) {
          current.current = null; // the first finger's dot was the start of a slide
          redraw();
        }
        return;
      }
    } else if (hand) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    current.current = { color, size, eraser: eraser || penErasing(e), points: [pos(e)] };
    redo.current = [];
    drawStroke(ctxOf(canvas.current!), current.current);
  };
  const move = (e: React.PointerEvent) => {
    if (e.pointerType === 'pen' && !current.current) {
      showCursor(e); // hovering
      return;
    }
    if (e.pointerType === 'touch' && penDown.current) return; // palm while writing
    if (e.pointerType === 'touch' && touches.current.has(e.pointerId) && (touches.current.size > 1 || hand || penSeen.current)) {
      slide(e);
      return;
    }
    if (e.pointerType === 'touch') touches.current.set(e.pointerId, e.clientY);
    const s = current.current;
    if (!s) return;
    const events = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [e.nativeEvent];
    const ctx = ctxOf(canvas.current!);
    style(ctx, s);
    const r = canvas.current!.getBoundingClientRect();
    // Pens report many points per frame (S Pen up to 240 a second): use every one of them.
    for (const ev of events) {
      const prev = s.points[s.points.length - 1];
      const x = ev.clientX - r.left;
      const y = ev.clientY - r.top;
      if (Math.abs(x - prev[0]) < 0.3 && Math.abs(y - prev[1]) < 0.3) continue;
      s.points.push([x, y, pressure(ev, prev[2])]);
      drawSegment(ctx, s, s.points.length - 1);
    }
    // Writing near the bottom of the paper? Add more below.
    const last = s.points[s.points.length - 1];
    if (last && last[1] > pageH - screen * 0.35) grow();
  };
  const up = (e: React.PointerEvent) => {
    const wasSliding = e.pointerType === 'touch' && touches.current.has(e.pointerId) && !current.current;
    touches.current.delete(e.pointerId);
    if (wasSliding && touches.current.size === 0) release();
    if (e.pointerType === 'pen') penDown.current = false;
    else if (e.pointerType === 'touch' && penDown.current) return; // a palm lifting mid-stroke
    if (current.current) {
      const ctx = ctxOf(canvas.current!);
      style(ctx, current.current);
      drawTail(ctx, current.current);
      strokes.current.push(current.current);
      current.current = null;
      force((n) => n + 1);
    }
  };

  const save = async () => {
    const c = canvas.current;
    if (!c || !strokes.current.length) return;
    setSaving(true);
    // Save only down to the last thing written (at least one screen), not the empty paper below.
    const bottom = Math.max(...strokes.current.flatMap((st) => st.points.map((pt) => pt[1])));
    const keep = Math.min(pageH, Math.max(screen, bottom + 48));
    const dpr = c.width / c.clientWidth;
    const out = document.createElement('canvas');
    out.width = c.width;
    out.height = Math.round(keep * dpr);
    // Paper (and lines, if shown) underneath, then the ink on top.
    const o = out.getContext('2d')!;
    o.fillStyle = PAPER;
    o.fillRect(0, 0, out.width, out.height);
    if (lined) {
      o.fillStyle = LINE;
      for (let y = LINE_START; y < keep; y += LINE_GAP) o.fillRect(0, Math.round(y * dpr), out.width, Math.max(1, Math.round(dpr)));
    }
    o.drawImage(c, 0, 0);
    const blob = await new Promise<Blob | null>((res) => out.toBlob(res, 'image/png'));
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
          <button
            type="button"
            aria-label={t('Pen')}
            aria-pressed={!eraser && !hand}
            onClick={() => {
              setEraser(false);
              setHand(false);
            }}
            className={tool(!eraser && !hand)}
          >
            <Pen size={18} />
          </button>
          <button
            type="button"
            aria-label={t('Eraser')}
            aria-pressed={eraser && !hand}
            onClick={() => {
              setEraser(true);
              setHand(false);
            }}
            className={tool(eraser && !hand)}
          >
            <Eraser size={18} />
          </button>
          <button type="button" aria-label={t('Move the page')} aria-pressed={hand} onClick={() => setHand((v) => !v)} className={tool(hand)}>
            <Hand size={18} />
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
                setHand(false);
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
      <div ref={wrap} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white pb-safe">
        <div
          className="relative select-none [-webkit-touch-callout:none]"
          style={{
            height: pageH,
            background: lined ? `linear-gradient(${LINE} 1px, transparent 1px) 0 ${LINE_START}px / 100% ${LINE_GAP}px ${PAPER}` : PAPER,
          }}
        >
          <div
            ref={cursor}
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 z-10 rounded-full border-2 opacity-0 transition-opacity"
          />
          <canvas
            ref={canvas}
            className={cn('absolute inset-x-0 top-0 touch-none', hand && 'cursor-grab')}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onPointerLeave={(e) => {
              showCursor(null);
              if (e.pointerType !== 'touch') up(e);
            }}
            onContextMenu={(e) => e.preventDefault()} // S Pen button / long-press shouldn't open a menu
          />
        </div>
        {pageH < maxPage && (
          <div className="flex justify-center bg-white py-4">
            <button
              type="button"
              onClick={grow}
              className="flex h-10 items-center gap-1.5 rounded-full border border-gray-200 px-4 text-sm font-semibold text-gray-600"
            >
              <Plus size={16} /> {t('More space')}
            </button>
          </div>
        )}
      </div>
      {hint && (
        <p className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+8px)] start-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[11px] text-white rtl:translate-x-1/2">
          {penSeen.current ? t('Write with the pen · slide with one finger') : t('Slide with two fingers')}
        </p>
      )}
    </div>
  );
}
