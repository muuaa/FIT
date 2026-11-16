import { Activity, Footprints, Trash2 } from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import { Empty, Spinner } from '@/components/ui/States';
import { useCardio, useDeleteCardio } from '@/hooks/useCardio';
import { relativeDay } from '@/lib/date';
import { formatClock, formatPace } from '@/lib/format';
import type { CardioLog } from '@/types/db';
import { CARDIO_LABEL } from './CardioSheet';

export function cardioSummary(c: CardioLog): string {
  if (c.kind === 'running') {
    return [formatClock(c.duration_seconds), c.distance_km ? `${c.distance_km} km` : null, c.distance_km ? formatPace(c.duration_seconds, c.distance_km) : null]
      .filter(Boolean)
      .join(' · ');
  }
  return [
    formatClock(c.duration_seconds),
    c.rounds ? `${c.rounds} rounds` : null,
    c.jump_count ? `${c.jump_count.toLocaleString()} skips` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function CardioList({ limit = 20 }: { limit?: number }) {
  const { data = [], isLoading } = useCardio(limit);
  const del = useDeleteCardio();
  if (isLoading) return <Spinner />;
  if (!data.length) return <Empty icon={Activity} title="No cardio logged yet" />;
  return (
    <ul className="divide-y divide-line/60">
      {data.map((c) => {
        const Icon = c.kind === 'running' ? Footprints : Activity;
        return (
          <li key={c.id} className="flex items-center gap-3 py-2.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cardio/12 text-cardio">
              <Icon size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">
                {CARDIO_LABEL[c.kind]} <span className="font-normal text-ink-3">· {relativeDay(c.date)}</span>
              </div>
              <div className="tabular truncate text-xs text-ink-3">{cardioSummary(c)}</div>
              {c.notes && <div className="truncate text-xs text-ink-3">{c.notes}</div>}
            </div>
            <IconButton label="Delete cardio session" onClick={() => del.mutate(c.id)} className="-mr-2">
              <Trash2 size={16} />
            </IconButton>
          </li>
        );
      })}
    </ul>
  );
}
