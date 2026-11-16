import { useQueryClient } from '@tanstack/react-query';
import { FlaskConical, HardDrive, TriangleAlert, X } from 'lucide-react';
import { useState } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { eraseAll, getMeta, setMeta, storageAvailable } from '@/lib/localDb';
import { loadSampleData } from '@/lib/sampleData';
import { useRestStore, useWorkoutStore } from '@/stores/workoutStore';

/** First-run note about on-device storage, the sample-data switch, and a storage warning when blocked. */
export function WelcomeCard() {
  const qc = useQueryClient();
  const [meta, setLocalMeta] = useState(getMeta);

  const refresh = () => {
    setLocalMeta(getMeta());
    qc.invalidateQueries();
  };

  if (!storageAvailable)
    return (
      <div className="flex gap-3 rounded-3xl border border-lift/40 bg-lift/10 p-4 text-sm">
        <TriangleAlert size={20} className="shrink-0 text-lift" />
        <p className="text-ink-2">
          This browser is blocking storage here, so anything you log will be lost when you close the page. Open the app in a
          normal (non-private) browser tab to keep your data.
        </p>
      </div>
    );

  if (meta.sample)
    return (
      <div className="flex items-center gap-3 rounded-3xl border border-lift-2/40 bg-lift-2/10 p-3 pl-4 text-sm">
        <FlaskConical size={18} className="shrink-0 text-lift-2" />
        <p className="flex-1 text-ink-2">You're looking at sample data.</p>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            eraseAll();
            useWorkoutStore.getState().setActive(null);
            useRestStore.getState().stop();
            setMeta({ welcomed: true });
            refresh();
          }}
        >
          Clear & start fresh
        </Button>
      </div>
    );

  if (meta.welcomed) return null;

  return (
    <section className="relative rounded-3xl border border-line/70 bg-surface p-4">
      <IconButton
        label="Dismiss"
        className="absolute right-2 top-2"
        onClick={() => {
          setMeta({ welcomed: true });
          refresh();
        }}
      >
        <X size={18} />
      </IconButton>
      <div className="flex items-center gap-2.5 pr-10">
        <span className="grid size-8 place-items-center rounded-xl bg-water/15 text-water">
          <HardDrive size={17} />
        </span>
        <h2 className="text-[15px] font-semibold">Saved on this device</h2>
      </div>
      <p className="mt-2 text-sm text-ink-2">
        Everything you log stays in this browser on this phone. There's no account and nothing is uploaded. Make a backup now
        and then from Settings.
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => {
            loadSampleData();
            refresh();
          }}
        >
          <FlaskConical size={16} /> Try sample data
        </Button>
        <Button
          variant="primary"
          accent="var(--color-ink)"
          className="flex-1"
          onClick={() => {
            setMeta({ welcomed: true });
            refresh();
          }}
        >
          Start fresh
        </Button>
      </div>
    </section>
  );
}
