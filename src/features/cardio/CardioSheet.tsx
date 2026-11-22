import { Footprints, Zap } from 'lucide-react';
import { t } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { useAddCardio } from '@/hooks/useCardio';
import { todayISO } from '@/lib/date';
import { formatPace, num } from '@/lib/format';
import { DurationField, durationSeconds } from '@/components/ui/DurationField';
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
  const [mins, setMins] = useState('');
  const [secs, setSecs] = useState('');
  const [distance, setDistance] = useState('');
  const [rounds, setRounds] = useState('');
  const [count, setCount] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) setKind(initialKind);
  }, [open, initialKind]);

  const seconds = durationSeconds(mins, secs);
  const km = num(distance);
  const roundsN = num(rounds);
  const countN = num(count);
  const valid =
    seconds !== null &&
    seconds > 0 &&
    (kind === 'running' ? km === null || km > 0 : (roundsN === null || roundsN > 0) && (countN === null || countN > 0));

  function reset() {
    setMins('');
    setSecs('');
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
          toast.success(t('{kind} logged', { kind: t(CARDIO_LABEL[kind]) }));
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
      title={t('Log cardio')}
      footer={
        <Button variant="primary" accent="var(--color-cardio)" size="lg" block disabled={!valid || add.isPending} onClick={submit}>
          <Zap size={18} /> Save {t(CARDIO_LABEL[kind]).toLowerCase()}
        </Button>
      }
    >
      <Segmented<CardioKind>
        className="mb-4"
        value={kind}
        onChange={setKind}
        accent="var(--color-cardio)"
        options={[
          { value: 'running', label: t('Running') },
          { value: 'jump_rope', label: t('Jump rope') },
        ]}
      />
      <div className="space-y-3">
        <DurationField
          label={t('Duration')}
          minutes={mins}
          seconds={secs}
          onChange={(m, s) => {
            setMins(m);
            setSecs(s);
          }}
          hint={secs !== '' && Number(secs) > 59 ? t('Seconds must be 0–59') : undefined}
        />
        {kind === 'running' ? (
          <>
            <Field
              label={t('Distance')}
              inputMode="decimal"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              suffix="km"
            />
            <div className="flex items-center gap-2 rounded-2xl bg-cardio/10 px-4 py-3 text-sm">
              <Footprints size={16} className="text-cardio" />
              <span className="text-ink-2">{t('Pace')}</span>
              <span className="tabular ms-auto font-semibold">{seconds ? formatPace(seconds, km) : '—'}</span>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('Rounds')} inputMode="numeric" value={rounds} onChange={(e) => setRounds(e.target.value)} />
            <Field label={t('Total skips')} inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
        )}
        <Field label={t('Notes')} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('Optional')} />
      </div>
    </Sheet>
  );
}
