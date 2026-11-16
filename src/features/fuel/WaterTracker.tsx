import { Minus, Plus } from 'lucide-react';
import { useId } from 'react';
import { nextWaterForBottleTap, useSetWater, useWater } from '@/hooks/useWater';
import { tick } from '@/lib/alerts';
import type { Profile } from '@/types/db';

function Bottle({ fill, index, onTap, ml }: { fill: number; index: number; onTap: () => void; ml: number }) {
  const clip = useId();
  const full = fill >= 1;
  const top = 14 + (1 - fill) * 70; // liquid surface y within body (14..84)
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={`Bottle ${index + 1}, ${Math.round(fill * 100)}% full (${ml} ml)`}
      className="group flex flex-1 flex-col items-center gap-1 transition active:scale-90"
    >
      <svg viewBox="0 0 40 90" className="h-20 w-full max-w-11">
        <defs>
          <clipPath id={clip}>
            <path d="M15 2h10v8c0 2 7 4 7 10v62a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6V20c0-6 7-8 7-10z" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          <rect x="0" y="0" width="40" height="90" fill="var(--color-surface-3)" />
          <rect
            x="0"
            y={top}
            width="40"
            height={90 - top}
            fill="var(--color-water)"
            opacity={full ? 1 : 0.85}
            style={{ transition: 'y 350ms ease, height 350ms ease' }}
          />
        </g>
        <path
          d="M15 2h10v8c0 2 7 4 7 10v62a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6V20c0-6 7-8 7-10z"
          fill="none"
          stroke={fill > 0 ? 'var(--color-water)' : 'var(--color-line)'}
          strokeWidth="1.5"
        />
      </svg>
      <span className={`tabular text-[11px] font-medium ${full ? 'text-water' : 'text-ink-3'}`}>
        {(ml / 1000).toFixed(ml % 1000 === 0 ? 0 : 1)}L
      </span>
    </button>
  );
}

export function WaterTracker({ profile, date }: { profile: Profile; date: string }) {
  const { data: ml = 0 } = useWater(date);
  const setWater = useSetWater(date);
  const bottleMl = profile.bottle_ml;
  const count = Math.max(1, Math.ceil(profile.water_target_ml / bottleMl));
  const pct = Math.min(100, Math.round((ml / profile.water_target_ml) * 100));

  const set = (v: number) => {
    tick();
    setWater.mutate(v);
  };

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <div className="tabular text-2xl font-bold">
          {ml.toLocaleString()}
          <span className="text-sm font-medium text-ink-3"> / {profile.water_target_ml.toLocaleString()} ml</span>
        </div>
        <span className="tabular text-sm font-semibold text-water">{pct}%</span>
      </div>
      <div className="flex justify-between gap-1.5">
        {Array.from({ length: count }, (_, i) => (
          <Bottle
            key={i}
            index={i}
            ml={(i + 1) * bottleMl}
            fill={Math.max(0, Math.min(1, (ml - i * bottleMl) / bottleMl))}
            onTap={() => set(nextWaterForBottleTap(ml, i, bottleMl))}
          />
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => set(Math.max(0, ml - 250))}
          disabled={ml === 0}
          className="flex h-10 flex-1 items-center justify-center gap-1 rounded-xl bg-surface-2 text-sm font-medium text-ink-2 active:scale-95 disabled:opacity-40"
        >
          <Minus size={14} /> 250 ml
        </button>
        <button
          type="button"
          onClick={() => set(ml + 250)}
          className="flex h-10 flex-1 items-center justify-center gap-1 rounded-xl bg-water/12 text-sm font-semibold text-water active:scale-95"
        >
          <Plus size={14} /> 250 ml
        </button>
      </div>
    </div>
  );
}
