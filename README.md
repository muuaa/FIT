# FIT — Fitness Command Center

A mobile-first, installable PWA for lifting, nutrition, hydration, supplements, bodyweight and cardio. It supports multiple users, and each account's data is kept separate in the database.

**Stack:** React 19 · TypeScript · Vite · Tailwind CSS 4 · TanStack Query · Zustand · Recharts · Lucide · Supabase (Auth + Postgres with Row Level Security) · Vercel.
**Cost:** $0. It runs on the Supabase Free plan and the Vercel Hobby plan.

---

## Features

| Tab | What it does |
|---|---|
| **Today** | Today's workout or rest status with one-tap start, calories remaining with macro bars, tap-to-fill water bottles, morning weigh-in with a 7-day sparkline, supplement checklist, and quick cardio logging (Run / Jump rope). |
| **Train** | PPL·UL ⇄ UL·PPL split switch, the week's schedule (Thu, Fri, Sat, Mon, Tue), exercises for each day type (add, edit, reorder, delete), live workout timer, previous session's weight × reps shown for every exercise and set, auto rest timer after each logged set (60/90/120/180 s or custom) with sound and vibration, and workout history. |
| **Fuel** | Look back at any day. Log calories and macros (kcal can be calculated from macros), a saved-meals library for one-tap logging, hydration, and the supplement shelf (turn items on or off, add custom items with dosage, edit, delete). |
| **Progress** | Bodyweight chart with daily weigh-ins and a 7-day rolling average (7/30/90 days), latest / average / weekly-change stats, a table of all entries, strength progress per exercise (estimated 1RM and top set), and cardio history with pace. |
| **Settings** (⚙ in the header) | Each user's own calorie and macro targets, water goal and bottle size, split, default rest time, and sign out. |

Units are **kg** and **km**. Exercise templates and saved meals start empty. The seven default supplements are created for every new account, all switched **off**.

---

## Project structure

```
FIT/
├── index.html                  # mobile meta tags, iOS PWA tags
├── vite.config.ts              # React, Tailwind, PWA manifest + service worker
├── vercel.json                 # SPA rewrites
├── .env.example
├── public/                     # favicon.svg + generated PNG icons
├── scripts/generate-icons.mjs  # re-renders PNG icons from favicon.svg (npm run icons)
├── supabase/migrations/
│   └── 0001_init.sql           # full schema, RLS policies, signup trigger
└── src/
    ├── main.tsx                # QueryClient (global error toasts), router, auth provider
    ├── App.tsx                 # auth gate + lazy-loaded routes
    ├── index.css               # design tokens (dark theme, module accent colours)
    ├── types/db.ts             # row types
    ├── lib/                    # supabase client, dates, split logic, formatting, alerts, chart colours
    ├── stores/                 # zustand: active workout + rest timer (persisted), toasts
    ├── hooks/                  # data layer: one React Query module per domain
    ├── components/ui/          # Card, Button, Sheet, Field, Stepper, Segmented, Toggle, Progress, …
    ├── components/layout/      # AppShell, PageHeader, BottomNav, global RestTimerBar
    └── features/
        ├── auth/               # sign in / sign up / reset password
        ├── today/              # dashboard
        ├── train/              # split switcher, templates, active workout, rest presets, history
        ├── fuel/               # calories, saved meals, water, supplements
        ├── progress/           # bodyweight + strength charts
        ├── cardio/             # running / jump rope logging
        └── settings/
```

## Database schema

All tables live in `public`. Each has a `user_id` column (defaulting to `auth.uid()`) and an RLS policy limiting reads and writes to `user_id = auth.uid()`. Log rows (`set_logs`, `supplement_logs`) are also checked to make sure they point at a session or supplement owned by the same user.

| Table | Purpose |
|---|---|
| `profiles` | One row per user: kcal/macro targets, water goal, bottle size, split mode, default rest |
| `exercises` | Exercises for each day type (`push`/`pull`/`legs`/`upper`/`lower`) with target sets/reps and order |
| `workout_sessions` | One row per workout: date, day type, start/end, duration |
| `set_logs` | Each set: weight (kg), reps, set number, exercise |
| `food_entries` | Calories and macros eaten each day |
| `saved_meals` | Reusable meals for one-tap logging |
| `water_days` | Water (ml) for each user and day |
| `supplements` / `supplement_logs` | The shelf (on/off, dosage) and which ones were taken each day |
| `bodyweight_logs` | One weigh-in per user per day |
| `cardio_logs` | Running (duration, distance → pace) and jump rope (duration, rounds, total skips) |

When someone signs up, a trigger (`handle_new_user`) creates their profile with the defaults (2,700 kcal, 160 P / 340 C / 75 F, 4,000 ml in 800 ml bottles, PPL-UL, 90 s rest) and adds the seven supplements, all switched off.

---

## Setup guide (free)

### 1. Create the Supabase project
1. Sign up at [supabase.com](https://supabase.com) and create a new project on the **Free** plan.
2. Open **SQL Editor → New query**, paste all of `supabase/migrations/0001_init.sql`, and click **Run**.
3. Go to **Project Settings → API** and copy the **Project URL** and the **anon public** key.
4. Go to **Authentication → URL Configuration** and set **Site URL** to your Vercel URL once you have it (step 3). For local testing, add `http://localhost:5173` under Redirect URLs.
5. Optional: under **Authentication → Providers → Email** you can turn off "Confirm email" if you'd rather skip the email confirmation step for the two of you.

> The Supabase Free plan **pauses a project after 7 days with no activity**. Using the app daily keeps it active. If it does pause, click **Restore** in the dashboard and no data is lost.

### 2. Run locally
```bash
cp .env.example .env.local   # then paste your URL + anon key
npm install
npm run dev                  # http://localhost:5173
```

### 3. Deploy to Vercel (Hobby, free)
1. Push this repo to GitHub, then on [vercel.com](https://vercel.com) choose **Add New → Project** and import it. Vercel detects Vite automatically.
2. Under **Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Deploy, then put the resulting URL into Supabase's **Site URL** (step 1.4).

### 4. Install on your phone
- **iPhone (Safari):** open the site → Share → **Add to Home Screen**.
- **Android (Chrome):** open the site → ⋮ menu → **Install app**.

Each of you creates your own account, and your data stays separate.

---

## Notes
- **Timers** are based on timestamps and saved locally, so a workout or rest timer keeps running after a reload or when you switch apps. Browsers pause JavaScript in background tabs, so if the phone is locked when a rest ends, the alert plays as soon as you return to the app. iOS Safari doesn't support vibration, so on iPhone you only get the sound.
- **Previous-session values** come from the most recent other workout that included the exercise (matched by ID, or by name for older history). The next set is pre-filled with today's working weight and last session's reps for that set.
- `npm run build` runs a type check and produces `dist/` with a service worker that caches the app shell.
