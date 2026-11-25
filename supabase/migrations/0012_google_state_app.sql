-- Remember whether a Google sign-in started in the Android app, so it returns into the app.
alter table public.google_oauth_states add column if not exists app boolean not null default false;
notify pgrst, 'reload schema';
