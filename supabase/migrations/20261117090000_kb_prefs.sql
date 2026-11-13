-- Preferências pessoais (ex.: modo de visualizar tutoriais), sincronizadas entre site e app
alter table public.kb_profiles add column if not exists prefs jsonb not null default '{}'::jsonb;

create or replace function public.kb_set_pref(p_key text, p_value jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_key !~ '^[a-z0-9_.-]{1,40}$' then raise exception 'chave inválida'; end if;
  if pg_column_size(p_value) > 2000 then raise exception 'valor muito grande'; end if;
  update public.kb_profiles set prefs = coalesce(prefs, '{}'::jsonb) || jsonb_build_object(p_key, p_value)
   where id = auth.uid() returning prefs into v;
  return v;
end $$;
revoke all on function public.kb_set_pref(text, jsonb) from public, anon;
grant execute on function public.kb_set_pref(text, jsonb) to authenticated;
