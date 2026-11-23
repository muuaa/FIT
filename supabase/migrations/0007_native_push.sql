-- Native Android notifications via Firebase: a subscription is either a browser one ('web',
-- endpoint + keys) or the Android app's Firebase token ('fcm', endpoint = 'fcm:<token>').
alter table public.push_subscriptions add column if not exists kind text not null default 'web' check (kind in ('web', 'fcm'));
alter table public.push_subscriptions add column if not exists fcm_token text;
