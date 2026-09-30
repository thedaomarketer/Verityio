-- Push reminder scheduler: every 15 minutes, POST to the app's
-- /api/cron/notifications endpoint (see lib/push/reminders.ts). pg_cron works
-- on any Vercel plan, unlike sub-daily Vercel Cron.
--
-- The target URL and the shared secret live in Supabase Vault, never in this
-- file. Create them once per environment (matching CRON_SECRET in Vercel):
--   select vault.create_secret('https://your-app.example', 'workledger_app_url');
--   select vault.create_secret('<CRON_SECRET>', 'workledger_cron_secret');
-- Until both exist the job does nothing.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'workledger-reminders',
  '*/15 * * * *',
  $job$
    select net.http_post(
      url := s.url || '/api/cron/notifications',
      headers := jsonb_build_object('Authorization', 'Bearer ' || s.secret, 'Content-Type', 'application/json'),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    )
    from (
      select
        (select decrypted_secret from vault.decrypted_secrets where name = 'workledger_app_url') as url,
        (select decrypted_secret from vault.decrypted_secrets where name = 'workledger_cron_secret') as secret
    ) s
    where s.url is not null and s.secret is not null;
  $job$
);
