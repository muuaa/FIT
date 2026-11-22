-- Run the send-reminders edge function every minute. The shared secret lives in Vault.
select cron.unschedule('replete-reminders') where exists (select 1 from cron.job where jobname = 'replete-reminders');
select cron.schedule(
  'replete-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://kpppglfhwbcztcfhopcz.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'replete_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);
