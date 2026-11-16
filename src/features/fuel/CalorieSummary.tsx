import { ProgressBar, Ring } from '@/components/ui/Progress';
import { sumMacros, useFoodEntries } from '@/hooks/useNutrition';
import type { Profile } from '@/types/db';

export function MacroBars({
  protein,
  carbs,
  fat,
  profile,
}: {
  protein: number;
  carbs: number;
  fat: number;
  profile: Profile;
}) {
  const rows = [
    { label: 'Protein', v: protein, t: profile.protein_target_g, c: '#f472b6' },
    { label: 'Carbs', v: carbs, t: profile.carbs_target_g, c: '#fbbf24' },
    { label: 'Fat', v: fat, t: profile.fat_target_g, c: '#60a5fa' },
  ];
  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center gap-2.5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-medium text-ink-2">{r.label}</span>
            <span className="tabular text-ink-3">
              <span className="text-ink">{Math.round(r.v)}</span> / {r.t} g
            </span>
          </div>
          <ProgressBar value={r.v} max={r.t} accent={r.c} />
        </div>
      ))}
    </div>
  );
}

export function CalorieSummary({ profile, date }: { profile: Profile; date: string }) {
  const { data: entries = [] } = useFoodEntries(date);
  const totals = sumMacros(entries);
  const remaining = profile.kcal_target - totals.kcal;
  const over = remaining < 0;
  return (
    <div className="flex items-center gap-4">
      <Ring value={totals.kcal} max={profile.kcal_target} accent={over ? 'var(--color-lift)' : 'var(--color-fuel)'}>
        <div>
          <div className="tabular text-2xl font-bold leading-none">{Math.abs(Math.round(remaining)).toLocaleString()}</div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-ink-3">{over ? 'kcal over' : 'kcal left'}</div>
          <div className="tabular mt-0.5 text-[11px] text-ink-3">
            {Math.round(totals.kcal).toLocaleString()} / {profile.kcal_target.toLocaleString()}
          </div>
        </div>
      </Ring>
      <MacroBars protein={totals.protein_g} carbs={totals.carbs_g} fat={totals.fat_g} profile={profile} />
    </div>
  );
}
