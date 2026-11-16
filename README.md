# Replete

<img src="public/favicon.svg" width="96" alt="Replete logo">

**Train · Fuel · Hydrate · Recover.**

A mobile-first, installable PWA for lifting, nutrition, hydration, supplements, bodyweight and cardio.

**Storage: on your device.** Everything is saved in the browser of the phone you use it on (`localStorage`). There's no account or server, and nothing is uploaded. Each phone keeps its own separate data, so you and your partner can each use your own phone. Back up from **Settings → Your data** (copy, download or restore a backup).

**Stack:** React 19 · TypeScript · Vite · Tailwind CSS 4 · TanStack Query · Zustand · Recharts · Lucide. Costs $0 to host on Vercel's free Hobby plan, or any static host.

---

## Features

| Tab | What it does |
|---|---|
| **Today** | Today's workout or rest status with one-tap start, calories remaining with macro bars, tap-to-fill water bottles, morning weigh-in with a 7-day sparkline, supplement checklist, and quick cardio logging (Run / Jump rope). |
| **Train** | PPL·UL ⇄ UL·PPL split switch, the week's schedule (Thu, Fri, Sat, Mon, Tue), exercises for each day type (add, edit, reorder, delete), live workout timer, previous session's weight × reps shown for every exercise and set, auto rest timer after each logged set (60/90/120/180 s or custom) with sound and vibration, and workout history. |
| **Fuel** | Look back at any day. Log calories and macros (kcal can be calculated from macros), a saved-meals library for one-tap logging, hydration, and the supplement shelf (turn items on or off, add custom items with dosage, edit, delete). |
| **Progress** | Bodyweight chart with daily weigh-ins and a 7-day rolling average (7/30/90 days), latest / average / weekly-change stats, a table of all entries, strength progress per exercise (estimated 1RM and top set), and cardio history with pace. |
| **Settings** (⚙ in the header) | Calorie and macro targets, water goal and bottle size, split, default rest time, and your data (backup copy/download, restore from file or pasted text, erase everything). |

Units are **kg** and **km**. Exercise templates and saved meals start empty. The seven default supplements are created on first launch, all switched **off**. On first launch you can choose **Try sample data** (clearly labelled, removed with one tap) or **Start fresh**.

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

## Data model (on-device)

`src/lib/localDb.ts` keeps one JSON array per table in `localStorage` under `fit.v1.<table>`, plus the profile under `fit.v1.profile`. The tables are `exercises`, `workout_sessions`, `set_logs`, `food_entries`, `saved_meals`, `water_days`, `supplements`, `supplement_logs`, `bodyweight_logs` and `cardio_logs`. If the browser blocks storage (private browsing), the app still works for that visit and shows a warning that nothing will be kept. The app also asks the browser for persistent storage so the data isn't cleared to free up space.

`supabase/migrations/0001_init.sql` holds a tested Postgres schema with per-user Row Level Security, kept for a future optional cloud sync. The app doesn't use it right now.

## Install on your phone

The app is hosted free on **GitHub Pages** at **https://muuaa.github.io/FIT/**. Every push to `claude/kind-wright-huie8c` or `main` rebuilds and redeploys it (`.github/workflows/deploy.yml`).

- **iPhone:** open the link in **Safari** → Share → **Add to Home Screen** → Add.
- **Android:** open the link in **Chrome** → ⋮ → **Install app** (or **Add to Home screen**).

It then opens full-screen from its own icon and works offline. Data belongs to the browser it was entered in, so the home-screen app keeps its own data, separate from a normal browser tab. To move data across, use **Settings → Your data → Copy backup / Paste backup**.

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
