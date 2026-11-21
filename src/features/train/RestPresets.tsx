import { Timer } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { unlockAudio } from '@/lib/alerts';
import { cn } from '@/lib/cn';
import { formatClock } from '@/lib/format';
import { DurationField, durationSeconds } from '@/components/ui/DurationField';
import { useRestStore } from '@/stores/workoutStore';

const PRESETS = [60, 90, 120, 180];

/** Chooses the auto-rest length (saved to the profile) and can start a rest manually. */
export function RestPresets() {
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const start = useRestStore((s) => s.start);
  const [customOpen, setCustomOpen] = useState(false);
  const [cm, setCm] = useState('');
  const [cs, setCs] = useState('');
  const current = profile?.default_rest_seconds ?? 90;
  const isCustom = !PRESETS.includes(current);
  const parsed = durationSeconds(cm, cs);

  return (
    <div className="rounded-3xl border border-line/70 bg-surface p-3">
      <div className="mb-2 flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-ink-3">
        <Timer size={14} className="text-lift" /> Auto rest after each set
      </div>
      <div className="flex gap-1.5">
        {PRESETS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => update.mutate({ default_rest_seconds: s })}
            className={cn(
              'tabular h-10 flex-1 rounded-xl text-sm font-semibold transition active:scale-95',
              current === s ? 'bg-lift text-bg' : 'bg-surface-2 text-ink-2',
            )}
          >
            {s}s
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setCm(isCustom ? String(Math.floor(current / 60)) : '');
            setCs(isCustom ? String(current % 60).padStart(2, '0') : '');
            setCustomOpen(true);
          }}
          className={cn(
            'tabular h-10 flex-1 rounded-xl text-sm font-semibold transition active:scale-95',
            isCustom ? 'bg-lift text-bg' : 'bg-surface-2 text-ink-2',
          )}
        >
          {isCustom ? formatClock(current) : 'Custom'}
        </button>
      </div>
      <Button
        block
        size="sm"
        variant="ghost"
        className="mt-2 text-lift"
        onClick={() => {
          unlockAudio();
          start(current);
        }}
      >
        Start {formatClock(current)} rest now
      </Button>

      <Sheet
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        title="Custom rest"
        footer={
          <Button
            variant="primary"
            accent="var(--color-lift)"
            size="lg"
            block
            disabled={!parsed || parsed < 10 || parsed > 900}
            onClick={() => {
              if (!parsed) return;
              update.mutate({ default_rest_seconds: parsed });
              setCustomOpen(false);
            }}
          >
            Use {parsed ? formatClock(parsed) : '—'}
          </Button>
        }
      >
        <DurationField
          label="Rest length"
          minutes={cm}
          seconds={cs}
          onChange={(m, s) => {
            setCm(m);
            setCs(s);
          }}
          hint="Between 10 seconds and 15 minutes."
          autoFocus
        />
      </Sheet>
    </div>
  );
}
