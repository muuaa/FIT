import { Footprints, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { useAddCardio } from '@/hooks/useCardio';
import { todayISO } from '@/lib/date';
import { formatPace, num, parseDuration } from '@/lib/format';
import { toast } from '@/stores/toastStore';
import type { CardioKind } from '@/types/db';

export const CARDIO_LABEL: Record<CardioKind, string> = { running: 'Running', jump_rope: 'Jump rope' };

export function CardioSheet({
  open,
  onClose,
  initialKind = 'running',
}: {
  open: boolean;
  onClose: () => void;
  initialKind?: CardioKind;
}) {
  const add = useAddCardio();
  const [kind, setKind] = useState<CardioKind>(initialKind);
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [rounds, setRounds] = useState('');
  const [count, setCount] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) setKind(initialKind);
  }, [open, initialKind]);

  const seconds = parseDuration(duration);
  const km = num(distance);
  const roundsN = num(rounds);
  const countN = num(count);
  const valid =
    seconds !== null &&
    seconds > 0 &&
    (kind === 'running' ? km === null || km > 0 : (roundsN === null || roundsN > 0) && (countN === null || countN > 0));

  function reset() {
    setDuration('');
    setDistance('');
    setRounds('');
    setCount('');
    setNotes('');
  }

  function submit() {
    if (!valid || seconds === null) return;
    add.mutate(
      {
        date: todayISO(),
        kind,
        duration_seconds: seconds,
        distance_km: kind === 'running' ? km : null,
        rounds: kind === 'jump_rope' && roundsN ? Math.round(roundsN) : null,
        jump_count: kind === 'jump_rope' && countN ? Math.round(countN) : null,
        notes: notes.trim(),
      },
      {
        onSuccess: () => {
          toast.success(`${CARDIO_LABEL[kind]} logged`);
          reset();
          onClose();
        },
      },
    );
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Log cardio"
      footer={
        <Button variant="primary" accent="var(--color-cardio)" size="lg" block disabled={!valid || add.isPending} onClick={submit}>
          <Zap size={18} /> Save {CARDIO_LABEL[kind].toLowerCase()}
        </Button>
      }
    >
      <Segmented<CardioKind>
        className="mb-4"
        value={kind}
        onChange={setKind}
        accent="var(--color-cardio)"
        options={[
          { value: 'running', label: 'Running' },
          { value: 'jump_rope', label: 'Jump rope' },
        ]}
      />
      <div className="space-y-3">
        <Field
          label="Duration"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="25 or 24:30"
          inputMode="numeric"
          hint="Minutes (25) or m:ss / h:mm:ss"
          autoFocus
        />
        {kind === 'running' ? (
          <>
            <Field
              label="Distance"
              inputMode="decimal"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              suffix="km"
            />
            <div className="flex items-center gap-2 rounded-2xl bg-cardio/10 px-4 py-3 text-sm">
              <Footprints size={16} className="text-cardio" />
              <span className="text-ink-2">Pace</span>
              <span className="tabular ml-auto font-semibold">{seconds ? formatPace(seconds, km) : '—'}</span>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Rounds" inputMode="numeric" value={rounds} onChange={(e) => setRounds(e.target.value)} />
            <Field label="Total skips" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
        )}
        <Field label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
      </div>
    </Sheet>
  );
}
