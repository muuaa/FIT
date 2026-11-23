# Replete

<img src="public/favicon.svg" width="96" alt="Replete logo">

**Train · Fuel · Hydrate · Recover.**

A mobile-first, installable PWA for lifting, nutrition, hydration, supplements, bodyweight and cardio.

**For two people.** Replete is set up for exactly two accounts (a database rule blocks a third sign-up). To-dos, money (expenses, budget, currency) and shared lists are one joint copy you both edit. Everything else is personal: each of you logs your own, and the switch at the top of every screen shows the other person's data, view-only.

**Storage: your private account, offline-first.** Each person signs in with their own email and password (Supabase Auth). Everything is saved on the phone first, so the app works offline, and syncs to a private account when there's internet. Sign in on another phone or tablet to see the same data. The data you and your partner keep is completely separate, except for lists you choose to share. Data that was on a phone before accounts existed moves into the account at first sign-in.

**Stack:** React 19 · TypeScript · Vite · Tailwind CSS 4 · TanStack Query · Zustand · Recharts · Lucide · Supabase (free plan). Hosted free on GitHub Pages. English and Arabic (right-to-left).

---

## Features

| Tab | What it does |
|---|---|
| **Today** | Today's workout or rest status with one-tap start, calories remaining with macro bars, tap-to-fill water bottles, morning weigh-in with a 7-day sparkline, supplement checklist, and quick cardio logging (Run / Jump rope). |
| **Train** | PPL·UL ⇄ UL·PPL split switch, the week's schedule (Thu, Fri, Sat, Mon, Tue), exercises for each day type (add, edit, reorder, delete), live workout timer, previous session's weight × reps shown for every exercise and set, auto rest timer after each logged set (60/90/120/180 s or custom) with sound and vibration, a progress bar for the session, the screen kept awake during a workout, and workout history (tap a workout to see every set, or delete it). |
| **Fuel** | Look back at any day. Log calories and macros (kcal can be calculated from macros), a saved-meals library (tap a meal to log it, edit or delete meals), hydration, and the supplement shelf (turn items on or off, add custom items with dosage, edit, delete). |
| **Life** | Habits (tap to tick, streaks, a monthly calendar to fix past days, choose the weekdays), to-dos (today's plan, future days, repeating chores, a Someday list, overdue items carried to today), sleep (bedtime, wake time, quality, naps, weekly chart against your goal), mood / energy / stress check-ins (2-week trend), steps (typed in, with goal and 7-day chart), body measurements and private progress photos, money (expenses in USD or another currency, categories, monthly budget with a daily allowance), a journal (3 gratitude lines, notes that save as you type, photos, files and a handwriting page that supports Apple Pencil pressure and ignores a resting palm), and shared lists (create a list, share its 8-character code, both people can add and tick items). |
| **Progress** | Bodyweight chart with daily weigh-ins and a 7-day rolling average (7/30/90 days), latest / average / weekly-change stats, a table of all entries, strength progress per exercise (estimated 1RM and top set), and cardio history with pace. |
| **Settings** (⚙ in the header) | Account (sync status, sync now, sign out), name and **language (English / العربية)**, calorie and macro targets, water goal, bottle size and +/− amount, steps and sleep goals, monthly budget and currency, split, default rest time, which cards Today shows and their order, install-to-home-screen help, and your data (backup copy/download, restore from file or pasted text, erase everything). |

**Today** can be customized: choose any of 13 cards (workout, calories, water, weigh-in, supplements, cardio, habits, to-dos, sleep, mood, steps, money, journal) and put them in your order. Deleting a meal, set, workout, weigh-in, cardio session, expense or to-do shows an **Undo** button for a few seconds. Sheets close with a swipe down. Units are **kg** and **km**. Exercise templates and saved meals start empty. The seven default supplements are created on first launch, all switched **off**. On first launch you can choose **Try sample data** (clearly labelled, removed with one tap) or **Start fresh**.

---

## Project structure

```
FIT/
├── index.html                  # mobile meta tags, iOS PWA tags
├── vite.config.ts              # React, Tailwind, PWA manifest + service worker
├── vercel.json                 # SPA rewrites
├── public/                     # favicon.svg + generated PNG icons
├── scripts/generate-icons.mjs  # re-renders PNG icons from favicon.svg (npm run icons)
├── scripts/build-embedded.mjs  # single-file build for previews (npm run build:embedded)
├── supabase/migrations/
│   └── 0001_init.sql           # optional future cloud sync: schema + RLS (not used yet)
└── src/
    ├── main.tsx                # QueryClient (global error toasts), router
    ├── App.tsx                 # lazy-loaded routes
    ├── index.css               # design tokens (dark theme, module accent colours)
    ├── types/db.ts             # row types
    ├── lib/                    # localDb (on-device store + backup), sample data, dates, split logic, formatting, alerts
    ├── stores/                 # zustand: active workout + rest timer (persisted), toasts
    ├── hooks/                  # data layer: one React Query module per domain
    ├── components/ui/          # Card, Button, Sheet, Field, Stepper, Segmented, Toggle, Progress, …
    ├── components/layout/      # AppShell, PageHeader, BottomNav, global RestTimerBar
    └── features/
        ├── onboarding/         # first-run card, sample data, storage warning
        ├── today/              # dashboard
        ├── train/              # split switcher, templates, active workout, rest presets, history
        ├── fuel/               # calories, saved meals, water, supplements
        ├── progress/           # bodyweight + strength charts
        ├── cardio/             # running / jump rope logging
        └── settings/
```

## Data and sync

`src/lib/localDb.ts` keeps one JSON array per table in `localStorage` (per signed-in user: `fit.v1.u.<userId>.<table>`). Every write is recorded as a row change; `src/lib/sync.ts` queues changes in a persistent outbox, pushes them to the Supabase `records` table and pulls changes from other devices (on open, when the app comes back to the foreground, when the connection returns and every 2 minutes). The server timestamps every write, and the last write to reach it wins per row.

Photos, files and handwriting are stored in a private Supabase Storage bucket under the user's own folder; shared lists live in their own tables, readable only by the list's members.

### One-time Supabase setup

1. Create a free project at supabase.com.
2. In **SQL Editor**, run `supabase/migrations/0001_sync.sql`, then `supabase/migrations/0002_files_and_shared_lists.sql`, `0003_reminders.sql`, `0004_reminders_schedule.sql` and `0005_household.sql`. Deploy `supabase/functions/send-reminders` and set its secrets (VAPID keys, CRON_SECRET).
3. **Authentication → URL Configuration:** set Site URL to the app's address (e.g. `https://muuaa.github.io/FIT/`) and add it with `**` to Redirect URLs.
4. Optional: turn off **Confirm email** (Authentication → Sign In / Providers) so sign-up is instant.
5. Put the project URL and publishable key in `src/lib/supabase.ts` (or set `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`). Both are public by design; Row Level Security keeps each person's data private.

`VITE_CLOUD=0 npm run build` (and the single-file `build:embedded`) produce a version without accounts that stores everything in the browser only.

## Install on your phone

The app is hosted free on **GitHub Pages** at **https://muuaa.github.io/FIT/**. Every push to `main` rebuilds and redeploys it (`.github/workflows/deploy.yml`).

- **iPhone:** open the link in **Safari** → Share → **Add to Home Screen** → Add.
- **Android:** open the link in **Chrome** → ⋮ → **Install app** (or **Add to Home screen**).

It then opens full-screen from its own icon and works offline. Sign in once in the installed app; your data comes with your account.

One-time setup: in the repo go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.

## Develop

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # dist/ (PWA with offline service worker; BASE_PATH=/FIT/ for Pages)
```

`npm run build:embedded` builds the whole app as a single HTML file (`dist-embedded/fit.html`) for hosts that can't serve multiple files.

## Notes
- **Timers** are based on timestamps and saved locally, so a workout or rest timer keeps running after a reload or when you switch apps. Browsers pause JavaScript in background tabs, so if the phone is locked when a rest ends, the alert plays as soon as you return to the app. iOS Safari doesn't support vibration, so on iPhone you only get the sound.
- **Previous-session values** come from the most recent other workout that included the exercise (matched by ID, or by name for older history). The next set is pre-filled with today's working weight and last session's reps for that set.
- `npm run build` runs a type check and produces `dist/` with a service worker that caches the app shell.
