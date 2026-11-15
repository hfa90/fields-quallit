-- Reforço de segurança da central (somente objetos kb_; não toca no Inventário).
-- O RLS já bloqueava tudo, isto é defesa em profundidade: mesmo que uma política
-- seja criada errada no futuro, quem não está logado continua sem acesso.

-- 1) Visitante sem login (anon) não tem nenhum privilégio nas tabelas/views/sequências kb_
do $$
declare r record;
begin
  for r in
    select c.relname, c.relkind from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname like 'kb\_%' and c.relkind in ('r','v','m','p','S')
  loop
    if r.relkind = 'S' then
      execute format('revoke all on sequence public.%I from anon', r.relname);
    else
      execute format('revoke all on table public.%I from anon', r.relname);
    end if;
  end loop;
end $$;

-- 2) kb_private guarda a chave privada VAPID e o segredo interno do push/backup:
--    só o service_role (Edge Functions) e as funções internas podem ler.
revoke all on table public.kb_private from anon, authenticated;

-- 3) Funções de gatilho não devem ser chamáveis pela API (/rest/v1/rpc)
revoke execute on function public.kb_locations_unlink() from public, anon, authenticated;
revoke execute on function public.kb_profiles_cd_check() from public, anon, authenticated;

-- 4) Lista de e-mails do dono é interna (usada só por funções do próprio banco)
revoke execute on function public.kb_is_owner_email(text) from public, anon, authenticated;

-- 5) kb_cd_of: contas pendentes/estranhas não descobrem o CD dos colegas
create or replace function public.kb_cd_of(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null or p_user = auth.uid() or public.kb_is_member() then
    coalesce(
      (select c.nome from public.kb_profiles k join public.cds c on c.id = k.cd_id where k.id = p_user),
      (select l.nome from public.kb_profiles k join public.kb_locations l on l.id = k.cd_id where k.id = p_user),
      (select c.nome from public.perfis p join public.cds c on c.id = p.cd_id where p.user_id = p_user limit 1))
  end
$$;
revoke execute on function public.kb_cd_of(uuid) from public, anon;
grant execute on function public.kb_cd_of(uuid) to authenticated;
