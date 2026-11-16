/** Example data so the app can be explored before real logging starts. Clearly flagged and erasable. */
import { addDays, todayISO } from './date';
import { all, getProfile, insert, setMeta, uid, update, upsert } from './localDb';
import { SPLITS, TRAINING_WEEKDAYS } from './split';
import type { DayType } from '@/types/db';

const EXERCISES: Record<DayType, [string, number, string, number][]> = {
  push: [['Bench Press', 3, '6-8', 80], ['Overhead Press', 3, '8-10', 47.5], ['Lateral Raise', 3, '12-15', 10]],
  pull: [['Barbell Row', 3, '6-8', 70], ['Lat Pulldown', 3, '10-12', 60], ['Hammer Curl', 3, '10-12', 16]],
  legs: [['Back Squat', 3, '5-8', 100], ['Romanian Deadlift', 3, '8-10', 90], ['Leg Curl', 3, '10-12', 45]],
  upper: [['Incline DB Press', 3, '8-10', 30], ['Pull-up', 3, '6-10', 0], ['Cable Fly', 3, '12-15', 15]],
  lower: [['Deadlift', 3, '4-6', 130], ['Leg Press', 3, '10-12', 180], ['Calf Raise', 3, '12-15', 60]],
};

export function loadSampleData(): void {
  const profile = getProfile();
  const today = todayISO();

  const ids: Record<string, string> = {};
  (Object.keys(EXERCISES) as DayType[]).forEach((day) =>
    EXERCISES[day].forEach(([name, sets, reps], position) => {
      const id = uid();
      ids[name] = id;
      insert('exercises', { id, day_type: day, name, target_sets: sets, target_reps: reps, position });
    }),
  );

  // Three weeks of finished workouts following the split, with slow progression.
  for (let back = 21; back >= 1; back--) {
    const date = addDays(today, -back);
    const d = new Date(`${date}T18:00:00`);
    const slot = (TRAINING_WEEKDAYS as readonly number[]).indexOf(d.getDay());
    if (slot === -1) continue;
    const day = SPLITS[profile.split_mode][slot];
    const week = Math.floor((21 - back) / 7);
    const sessionId = uid();
    const duration = 3600 + Math.round(Math.random() * 900);
    insert('workout_sessions', {
      id: sessionId,
      date,
      day_type: day,
      started_at: d.toISOString(),
      ended_at: new Date(d.getTime() + duration * 1000).toISOString(),
      duration_seconds: duration,
    });
    EXERCISES[day].forEach(([name, sets, , base], ei) => {
      for (let s = 1; s <= sets; s++) {
        insert('set_logs', {
          id: uid(),
          session_id: sessionId,
          exercise_id: ids[name],
          exercise_name: name,
          set_number: s,
          weight_kg: base + week * 2.5,
          reps: 8 - (s === sets ? 1 : 0) + (week % 2),
          created_at: new Date(d.getTime() + (ei * 10 + s * 3) * 60000).toISOString(),
        });
      }
    });
  }

  // Bodyweight: a slow bulk with daily noise, a few skipped mornings.
  for (let back = 27; back >= 0; back--) {
    if (back % 6 === 4) continue;
    const trend = 74 + (27 - back) * 0.035;
    const noise = Math.sin(back * 1.7) * 0.35;
    upsert('bodyweight_logs', { date: addDays(today, -back), weight_kg: Math.round((trend + noise) * 10) / 10 }, (l) => l.date === addDays(today, -back));
  }

  const meals = [
    { name: 'Oats, whey & banana', kcal: 720, protein_g: 45, carbs_g: 105, fat_g: 12 },
    { name: 'Chicken, rice & veg', kcal: 850, protein_g: 55, carbs_g: 110, fat_g: 18 },
    { name: 'Greek yoghurt & granola', kcal: 450, protein_g: 28, carbs_g: 55, fat_g: 12 },
  ];
  meals.forEach((m) => insert('saved_meals', { ...m, id: uid(), created_at: new Date().toISOString() }));
  meals.slice(0, 2).forEach((m, i) =>
    insert('food_entries', { ...m, id: uid(), date: today, created_at: new Date(Date.now() - (2 - i) * 3600000).toISOString() }),
  );

  upsert('water_days', { date: today, ml: 1600 }, (w) => w.date === today);

  const supps = all('supplements');
  for (const name of ['Whey Protein', 'Creatine Monohydrate', 'Vitamin D3']) {
    const s = supps.find((x) => x.name === name);
    if (s) update('supplements', (x) => x.id === s.id, { active: true });
  }
  const creatine = all('supplements').find((x) => x.name === 'Creatine Monohydrate');
  if (creatine) insert('supplement_logs', { supplement_id: creatine.id, date: today, taken_at: new Date().toISOString() });

  insert('cardio_logs', {
    id: uid(), date: addDays(today, -2), kind: 'running', duration_seconds: 1710, distance_km: 5,
    rounds: null, jump_count: null, notes: 'Easy pace', created_at: new Date().toISOString(),
  });
  insert('cardio_logs', {
    id: uid(), date: addDays(today, -1), kind: 'jump_rope', duration_seconds: 600, distance_km: null,
    rounds: 5, jump_count: 1100, notes: '', created_at: new Date().toISOString(),
  });

  setMeta({ welcomed: true, sample: true });
}
