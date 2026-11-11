-- Notificações por e-mail (Resend) removidas a pedido: ficam só notificações no app e push no celular.
drop trigger if exists kb_notifications_email on public.kb_notifications;
drop function if exists public.kb_notifications_email();
drop function if exists public.kb_email_digest();
drop function if exists public.kb_email_config_set(text, text);
drop function if exists public.kb_email_config_status();
drop function if exists public.kb_email_test();
drop function if exists public.kb_call_function(text, jsonb);
select cron.unschedule(jobid) from cron.job where jobname = 'kb-email-digest';
alter table public.kb_notification_prefs drop column if exists email_mode;
alter table public.kb_notifications drop column if exists emailed_at;
delete from public.kb_private where key in ('resend_api_key', 'email_from');
