export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Pace in min/km, formatted m:ss. */
export function formatPace(durationSeconds: number, distanceKm: number | null): string {
  if (!distanceKm || distanceKm <= 0) return '—';
  const secPerKm = durationSeconds / distanceKm;
  return `${formatClock(secPerKm)} /km`;
}

/** Parses "mm:ss", "h:mm:ss" or plain minutes ("25") into seconds. Returns null if invalid. */
export function parseDuration(input: string): number | null {
  const t = input.trim();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(parseFloat(t) * 60);
  const parts = t.split(':').map((p) => p.trim());
  if (parts.some((p) => !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.length === 2) return nums[0] * 60 + nums[1];
  if (nums.length === 3) return nums[0] * 3600 + nums[1] * 60 + nums[2];
  return null;
}

export function num(value: string): number | null {
  let v = value.trim().replace(/\s/g, '');
  if (v === '') return null;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(v)) v = v.replace(/,/g, ''); // 1,250 or 12,500.50
  else if (/^\d{1,3}(\.\d{3})+,\d+$/.test(v)) v = v.replace(/\./g, '').replace(',', '.'); // 1.250,50
  else v = v.replace(',', '.'); // 2,5 → 2.5
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function kg(n: number): string {
  return `${round1(n)} kg`;
}

/** Epley estimated one-rep max. */
export function estimated1RM(weight: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}
