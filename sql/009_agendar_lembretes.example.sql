-- OPCIONAL: somente após publicar send-reminders e configurar os Secrets.
-- Ative pg_cron, pg_net e Vault no painel do Supabase.
-- No Vault, crie evolva_project_url com https://SEU-PROJETO.supabase.co
-- e evolva_cron_secret com o MESMO valor de EVOLVA_CRON_SECRET.
-- Não coloque credenciais neste arquivo.
select cron.schedule(
 'evolva-send-reminders', '*/5 * * * *',
 $$select net.http_post(
   url := (select decrypted_secret from vault.decrypted_secrets where name='evolva_project_url') || '/functions/v1/send-reminders',
   headers := jsonb_build_object('Content-Type','application/json','x-evolva-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='evolva_cron_secret')),
   body := '{}'::jsonb,
   timeout_milliseconds := 60000
 );$$
);
