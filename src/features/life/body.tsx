import { Camera, Footprints, Loader2, Minus, Plus, Ruler, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { AttachmentThumb, AttachmentViewer } from '@/components/ui/AttachmentView';
import { Bars } from '@/components/ui/Bars';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Ring } from '@/components/ui/Progress';
import { Sheet } from '@/components/ui/Sheet';
import { Empty } from '@/components/ui/States';
import { useProfile } from '@/hooks/useProfile';
import { useTable, useTableActions } from '@/hooks/useTable';
import { useToday } from '@/hooks/useToday';
import { tick } from '@/lib/alerts';
import { addDays, parseISODate, relativeDay, shortDate, weekdayNarrow } from '@/lib/date';
import { filesAvailable } from '@/lib/files';
import { num, round1 } from '@/lib/format';
import { t } from '@/lib/i18n';
import { uid } from '@/lib/localDb';
import { toast } from '@/stores/toastStore';
import type { Attachment, Measurement } from '@/types/db';
import { useAttachments } from './useAttachments';

// ---------------------------------------------------------------- steps

export function StepsToday() {
  const today = useToday();
  const { data: rows = [] } = useTable('steps_days');
  const { data: profile } = useProfile();
  const actions = useTableActions('steps_days');
  const cur = rows.find((r) => r.date === today)?.steps ?? 0;
  const [value, setValue] = useState('');
  const target = profile?.steps_target ?? 10000;
  const set = (n: number) => {
    tick();
    const v = Math.max(0, Math.min(200000, Math.round(n)));
    if (v === 0) actions.remove(today);
    else actions.put({ date: today, steps: v });
  };
  return (
    <div className="flex items-center gap-4">
      <Ring value={cur} max={target} accent="var(--color-steps)" size={96} stroke={9}>
        <div>
          <div className="tabular text-lg font-bold leading-none">{cur.toLocaleString()}</div>
          <div className="mt-0.5 text-[10px] text-ink-3">/ {target.toLocaleString()}</div>
        </div>
      </Ring>
      <div className="min-w-0 flex-1 space-y-2">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = num(value);
            if (n === null) return;
            set(n);
            setValue('');
          }}
        >
          <input
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ''))}
            placeholder={t('Total steps')}
            aria-label={t('Total steps today')}
            className="tabular h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-ink outline-none placeholder:text-ink-3"
          />
          <button type="submit" disabled={!value} className="h-11 rounded-xl bg-steps px-3 text-sm font-semibold text-bg disabled:opacity-40">
            {t('Set')}
          </button>
        </form>
        <div className="flex gap-1.5">
          <button type="button" aria-label={t('Remove 1,000 steps')} onClick={() => set(cur - 1000)} disabled={!cur} className="flex h-9 flex-1 items-center justify-center rounded-xl bg-surface-2 text-xs font-semibold text-ink-2 disabled:opacity-40">
            <Minus size={12} /> 1k
          </button>
          <button type="button" aria-label={t('Add 1,000 steps')} onClick={() => set(cur + 1000)} className="flex h-9 flex-1 items-center justify-center rounded-xl bg-steps/15 text-xs font-semibold text-steps">
            <Plus size={12} /> 1k
          </button>
        </div>
        <p className="text-[11px] text-ink-3">{t('Copy the number from your phone’s Health or Fitness app.')}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- measurements

const FIELDS: { key: keyof Measurement & `${string}_cm`; label: string }[] = [
  { key: 'waist_cm', label: 'Waist' },
  { key: 'chest_cm', label: 'Chest' },
  { key: 'arm_cm', label: 'Arm' },
  { key: 'thigh_cm', label: 'Thigh' },
  { key: 'hips_cm', label: 'Hips' },
  { key: 'neck_cm', label: 'Neck' },
];

function MeasureSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const today = useToday();
  const actions = useTableActions('measurements');
  const [vals, setVals] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const any = Object.values(vals).some((v) => num(v) !== null && num(v)! > 0);
  const save = () => {
    const row: Measurement = {
      id: uid(),
      date: today,
      waist_cm: null,
      chest_cm: null,
      arm_cm: null,
      thigh_cm: null,
      hips_cm: null,
      neck_cm: null,
      note: note.trim(),
      created_at: new Date().toISOString(),
    };
    for (const f of FIELDS) {
      const n = num(vals[f.key] ?? '');
      row[f.key] = n !== null && n > 0 ? round1(n) : null;
    }
    actions.insert(row);
    setVals({});
    setNote('');
    toast.success(t('Measurements saved'));
    onClose();
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('New measurements')}
      footer={
        <Button variant="primary" accent="var(--color-body)" size="lg" block disabled={!any} onClick={save}>
          {t('Save')}
        </Button>
      }
    >
      <p className="mb-3 text-sm text-ink-3">{t('Fill in what you measured. Measure at the same time of day for fair comparisons.')}</p>
      <div className="grid grid-cols-2 gap-2">
        {FIELDS.map((f) => (
          <Field
            key={f.key}
            label={t(f.label)}
            inputMode="decimal"
            suffix="cm"
            value={vals[f.key] ?? ''}
            onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}
          />
        ))}
      </div>
      <Field className="mt-3" label={t('Note')} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Optional')} />
    </Sheet>
  );
}

function Measurements() {
  const { data: rows = [] } = useTable('measurements');
  const actions = useTableActions('measurements');
  const [open, setOpen] = useState(false);
  const sorted = useMemo(() => [...rows].sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)), [rows]);
  const latestOf = (key: (typeof FIELDS)[number]['key']) => {
    const withVal = sorted.filter((r) => r[key] !== null);
    return { cur: withVal[0], prev: withVal[1] };
  };
  return (
    <Card
      title={t('Measurements')}
      icon={Ruler}
      accent="var(--color-body)"
      action={
        <Button size="sm" variant="primary" accent="var(--color-body)" onClick={() => setOpen(true)}>
          <Plus size={16} /> {t('Add')}
        </Button>
      }
    >
      {sorted.length === 0 ? (
        <Empty icon={Ruler} title={t('No measurements yet')}>
          {t('Track waist, chest, arms and more to see changes the scale misses.')}
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {FIELDS.map((f) => {
              const { cur, prev } = latestOf(f.key);
              if (!cur) return null;
              const delta = prev ? round1(cur[f.key]! - prev[f.key]!) : null;
              return (
                <div key={f.key} className="rounded-2xl bg-surface-2 p-2.5">
                  <div className="text-[11px] uppercase tracking-wider text-ink-3">{t(f.label)}</div>
                  <div className="tabular text-lg font-semibold">
                    {cur[f.key]}
                    <span className="text-xs text-ink-3"> cm</span>
                  </div>
                  {delta !== null && delta !== 0 && (
                    <div className={`tabular text-[11px] ${delta > 0 ? 'text-body' : 'text-steps'}`}>
                      {delta > 0 ? '+' : ''}
                      {delta} cm
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-ink-2">{t('History')}</summary>
            <ul className="mt-2 divide-y divide-line/60">
              {sorted.map((r) => (
                <li key={r.id} className="flex items-center gap-2 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{relativeDay(r.date)}</div>
                    <div className="tabular truncate text-xs text-ink-3">
                      {FIELDS.filter((f) => r[f.key] !== null)
                        .map((f) => `${t(f.label)} ${r[f.key]}`)
                        .join(' · ')}
                    </div>
                  </div>
                  <IconButton label={t('Delete')} className="size-9" onClick={() => actions.remove(r.id, t('Measurements deleted'))}>
                    <Trash2 size={14} />
                  </IconButton>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
      <MeasureSheet open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}

// ---------------------------------------------------------------- progress photos

function ProgressPhotos() {
  const today = useToday();
  const input = useRef<HTMLInputElement>(null);
  const photos = useAttachments((a) => a.kind === 'progress');
  const [open, setOpen] = useState<Attachment | null>(null);
  const byDate = [...photos.list].reverse();
  return (
    <Card
      title={t('Progress photos')}
      icon={Camera}
      accent="var(--color-body)"
      action={
        filesAvailable() ? (
          <Button size="sm" variant="primary" accent="var(--color-body)" disabled={photos.uploading} onClick={() => input.current?.click()}>
            {photos.uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} {t('Add')}
          </Button>
        ) : undefined
      }
    >
      {!filesAvailable() ? (
        <p className="text-sm text-ink-3">{t('Sign in to keep progress photos in your private account.')}</p>
      ) : byDate.length === 0 ? (
        <Empty icon={Camera} title={t('No photos yet')}>
          {t('Same pose, same light, every couple of weeks. Only you can see them.')}
        </Empty>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {byDate.map((a) => (
            <div key={a.id}>
              <AttachmentThumb a={a} onOpen={() => setOpen(a)} />
              <div className="mt-0.5 text-center text-[10px] text-ink-3">{shortDate(a.date)}</div>
            </div>
          ))}
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void photos.addFiles(e.target.files, 'progress', today);
          e.target.value = '';
        }}
      />
      <AttachmentViewer
        a={open}
        onClose={() => setOpen(null)}
        onDelete={(a) => {
          photos.remove(a);
          setOpen(null);
        }}
      />
    </Card>
  );
}

export function BodyPage() {
  const today = useToday();
  const { data: rows = [] } = useTable('steps_days');
  const { data: profile } = useProfile();
  const byDate = new Map(rows.map((r) => [r.date, r.steps]));
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const vals = week.map((d) => byDate.get(d) ?? null);
  const logged = vals.filter((v): v is number => v !== null);
  return (
    <>
      <PageHeader title={t('Steps & body')} back="/health" />
      <div className="space-y-3">
        <Card title={t('Steps today')} icon={Footprints} accent="var(--color-steps)">
          <StepsToday />
          <div className="mt-4">
            <Bars
              label={t('Steps, last 7 days')}
              color="var(--color-steps)"
              goal={profile?.steps_target}
              data={week.map((d, i) => ({ label: weekdayNarrow(parseISODate(d).getDay()), value: vals[i], highlight: d === today }))}
              format={(v) => (v >= 1000 ? `${round1(v / 1000)}k` : String(v))}
            />
            {logged.length > 0 && (
              <p className="tabular mt-1 text-center text-[11px] text-ink-3">
                {t('7-day average {n}', { n: Math.round(logged.reduce((a, b) => a + b, 0) / logged.length).toLocaleString() })}
              </p>
            )}
          </div>
        </Card>
        <Measurements />
        <ProgressPhotos />
      </div>
    </>
  );
}

export function useStepsSummary(): string {
  const today = useToday();
  const { data: rows = [] } = useTable('steps_days');
  const n = rows.find((r) => r.date === today)?.steps;
  return n ? (n >= 1000 ? `${round1(n / 1000)}k` : String(n)) : t('Log');
}
