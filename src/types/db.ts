export type SplitMode = 'PPL-UL' | 'UL-PPL';
export type DayType = 'push' | 'pull' | 'legs' | 'upper' | 'lower';
export type CardioKind = 'running' | 'jump_rope';

export interface Profile {
  id: string;
  display_name: string;
  kcal_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
  water_target_ml: number;
  bottle_ml: number;
  split_mode: SplitMode;
  default_rest_seconds: number;
}

export interface Exercise {
  id: string;
  day_type: DayType;
  name: string;
  target_sets: number;
  target_reps: string;
  position: number;
}

export interface WorkoutSession {
  id: string;
  date: string;
  day_type: DayType;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
}

export interface SetLog {
  id: string;
  session_id: string;
  exercise_id: string | null;
  exercise_name: string;
  set_number: number;
  weight_kg: number;
  reps: number;
  created_at: string;
}

export interface FoodEntry {
  id: string;
  date: string;
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  created_at: string;
}

export interface SavedMeal {
  id: string;
  created_at?: string;
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface Supplement {
  id: string;
  name: string;
  dosage: string;
  active: boolean;
  position: number;
}

export interface BodyweightLog {
  date: string;
  weight_kg: number;
}

export interface CardioLog {
  id: string;
  date: string;
  kind: CardioKind;
  duration_seconds: number;
  distance_km: number | null;
  rounds: number | null;
  jump_count: number | null;
  notes: string;
  created_at: string;
}

export type Macros = { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
