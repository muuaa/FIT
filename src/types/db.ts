export type SplitMode = 'PPL-UL' | 'UL-PPL';
export type DayType = 'push' | 'pull' | 'legs' | 'upper' | 'lower';
export type CardioKind = 'running' | 'jump_rope';
export type Language = 'en' | 'ar';
export type DayItemKind = 'workout' | 'water' | 'supplements' | 'habits' | 'routines' | 'bills' | 'chores';

export type TodayCard =
  | 'workout'
  | 'calories'
  | 'water'
  | 'weight'
  | 'supplements'
  | 'cardio'
  | 'habits'
  | 'routines'
  | 'sleep'
  | 'checkin'
  | 'money'
  | 'journal';

export interface Profile {
  id: string;
  display_name: string;
  kcal_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
  water_target_ml: number;
  bottle_ml: number;
  /** Amount the water +/− buttons add or remove. */
  water_step_ml: number;
  steps_target: number;
  sleep_target_h: number;
  /** Monthly spending budget in `currency` (0 = no budget). */
  monthly_budget: number;
  currency: string;
  language: Language;
  /** Today screen cards, in order. Cards not listed are hidden. */
  today_cards: TodayCard[];
  /** What counts in the "Your day" ring on Home (missing = everything). */
  day_items?: DayItemKind[];
  /** Partner activity notifications to receive (missing = on). */
  activity_prefs: Record<string, boolean>;
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

// ---------------------------------------------------------------- Life

export interface SleepLog {
  /** The morning you woke up (YYYY-MM-DD). */
  date: string;
  bed: string; // HH:MM
  wake: string; // HH:MM
  quality: number; // 1–5
  nap_min: number;
  note: string;
}

export interface CheckIn {
  date: string;
  mood: number; // 1–5
  energy: number; // 1–5
  stress: number; // 1–5
  note: string;
}

export interface StepsDay {
  date: string;
  steps: number;
}

export interface Measurement {
  id: string;
  date: string;
  waist_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  hips_cm: number | null;
  neck_cm: number | null;
  note: string;
  created_at: string;
}

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  /** JS weekdays the habit is due (0 = Sunday). Empty = every day. */
  days: number[];
  position: number;
  archived: boolean;
  created_at: string;
}

export interface HabitLog {
  habit_id: string;
  date: string;
  /** Who ticked it (user id). Habits are shared; each of you ticks your own. */
  by: string;
}

export type Repeat = 'none' | 'daily' | 'weekdays' | 'weekly';

export interface Todo {
  id: string;
  title: string;
  /** Day it's planned for (YYYY-MM-DD). For repeating to-dos, the first day. Null = someday. */
  date: string | null;
  repeat: Repeat;
  /** One-off to-dos: when it was done. */
  done_at: string | null;
  note: string;
  created_at: string;
}

export interface TodoDone {
  todo_id: string;
  date: string;
}

export interface Expense {
  id: string;
  date: string;
  amount: number;
  category: string;
  note: string;
  created_at: string;
}

export interface JournalEntry {
  date: string;
  /** Who wrote it (user id). The journal is shared; each of you writes your own entry per day. */
  by: string;
  gratitude: string[];
  text: string;
  updated_at: string;
}

export type AttachmentKind = 'photo' | 'file' | 'drawing' | 'progress';

export interface Attachment {
  id: string;
  /** Day it belongs to (journal day, or progress-photo day). */
  date: string;
  kind: AttachmentKind;
  /** Path in the private file storage. */
  path: string;
  name: string;
  mime: string;
  size: number;
  created_at: string;
}

// ---------------------------------------------------------------- Plan & Us

export type EventRepeat = 'none' | 'weekly' | 'monthly' | 'yearly';

/** A calendar event (joint: both of you see and edit it). */
export interface CalEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD (first occurrence)
  time: string | null; // HH:MM, null = all day
  emoji: string;
  /** Who it's for. */
  who: 'both' | string; // 'both' or a user id
  repeat: EventRepeat;
  note: string;
  created_at: string;
}

/** Joint countdown to a date (trip, anniversary, birthday). */
export interface Countdown {
  id: string;
  title: string;
  emoji: string;
  date: string;
  yearly: boolean;
  created_at: string;
}

/** A goal you work on together, with a numeric target. */
export interface Goal {
  id: string;
  title: string;
  emoji: string;
  target: number;
  progress: number;
  unit: string;
  due: string | null;
  done_at: string | null;
  created_at: string;
}

/** Personal routine (morning / evening) with checklist steps. */
export interface Routine {
  id: string;
  name: string;
  emoji: string;
  part: 'morning' | 'evening' | 'any';
  steps: string[];
  position: number;
  created_at: string;
}

export interface RoutineLog {
  routine_id: string;
  date: string;
  done: number[]; // indexes of finished steps
}

export interface FocusSession {
  id: string;
  date: string;
  minutes: number;
  label: string;
  created_at: string;
}

// ---------------------------------------------------------------- Life admin

export type BillCycle = 'weekly' | 'monthly' | 'yearly';

/** A bill or subscription (joint). */
export interface Bill {
  id: string;
  name: string;
  emoji: string;
  amount: number;
  cycle: BillCycle;
  /** Next due date (YYYY-MM-DD); moves forward when marked paid. */
  next_due: string;
  category: string;
  /** Add an expense automatically when marked paid. */
  log_expense: boolean;
  created_at: string;
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner';

/** A planned meal (joint). */
export interface PlannedMeal {
  id: string;
  date: string;
  slot: MealSlot;
  title: string;
  ingredients: string[];
  created_at: string;
}

/** A recurring chore (joint), optionally alternating between the two of you. */
export interface Chore {
  id: string;
  name: string;
  emoji: string;
  every_days: number;
  /** 'alternate' takes turns; otherwise a user id. */
  assignee: 'alternate' | string;
  last_done: string | null;
  last_by: string | null;
  created_at: string;
}

/** Personal note (readable by your partner, like the rest of your data). */
export interface Note {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  updated_at: string;
}

/** One person's weekly review (shared: you each write your own, and see each other's). */
export interface WeekReview {
  /** First day of the week (Saturday), YYYY-MM-DD. */
  week: string;
  by: string;
  wins: string;
  hard: string;
  proud: string;
  focus: string;
  /** How the week felt, 1–10 (0 = not given). */
  score: number;
  updated_at: string;
}

export type WishType = 'get' | 'do' | 'surprise' | 'place';
export type IdeaStatus = 'idea' | 'planned' | 'done';

/** Wishlist & bucket list. A surprise is hidden from the person it's for. */
export interface Wish {
  id: string;
  title: string;
  type: WishType;
  /** 'both' or a user id. */
  for: string;
  status: IdeaStatus;
  cost: number | null;
  link: string;
  note: string;
  created_by: string;
  created_at: string;
}

export type DateCategory = 'movie' | 'game' | 'cook' | 'study' | 'creative' | 'talk' | 'out' | 'other';

/** A date idea, and later a date you went on (with a rating). */
export interface DateIdea {
  id: string;
  title: string;
  category: DateCategory;
  status: IdeaStatus;
  /** When it's planned for (YYYY-MM-DD), if it is. */
  planned: string | null;
  /** 1–5 once done (0 = not rated). */
  rating: number;
  note: string;
  created_at: string;
}

export type MemoryType = 'milestone' | 'first' | 'sweet' | 'funny' | 'trip' | 'photo';

/** A moment in your story. Photos are attachments with this memory's id. */
export interface Memory {
  id: string;
  title: string;
  date: string;
  type: MemoryType;
  story: string;
  favorite: boolean;
  /** Paths of photos in file storage (either of you can upload; both can see). */
  photos?: string[];
  created_by: string;
  created_at: string;
}
