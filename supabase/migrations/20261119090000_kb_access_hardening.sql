-- =====================================================================
-- Reforço de acesso: quem não é membro ativo do Fields não lê NEM altera nada.
-- 1) Conta bloqueada no login (ex.: desativada no Inventário) perde o acesso
--    na hora, mesmo com uma sessão ainda aberta (o token vale até 1 h).
-- 2) Apagar/alterar os próprios registros (comentários, "funcionou", obrigado,
--    seguir, votos, arquivos enviados, perfil) passa a exigir acesso ativo.
-- 3) Notificações antigas e preferências só para quem tem acesso.
-- =====================================================================

-- 1) papel efetivo: nenhum se a conta de login estiver banida ou excluída
create or replace function public.kb_current_role()
returns kb_role language sql stable security definer set search_path = public as $$
  select k.role from public.kb_profiles k
  where k.id = auth.uid()
    and not exists (
      select 1 from auth.users u
      where u.id = k.id and ((u.banned_until is not null and u.banned_until > now()) or u.deleted_at is not null))
$$;

-- 2) registros próprios: escrever/apagar só com acesso ativo
alter policy kb_comments_delete on public.kb_comments
  using (kb_is_moderator() or (user_id = (select auth.uid()) and kb_is_member()));

alter policy kb_feedback_write on public.kb_feedback
  using (user_id = (select auth.uid()) and kb_is_member());

alter policy kb_thanks_own on public.kb_thanks
  using (user_id = (select auth.uid()) and kb_is_member());

alter policy kb_follows_own on public.kb_follows
  using (user_id = (select auth.uid()) and kb_is_member());

alter policy kb_request_votes_write on public.kb_request_votes
  using (user_id = (select auth.uid()) and kb_is_member());

alter policy kb_favorites_own on public.kb_favorites
  using (user_id = (select auth.uid()) and kb_is_member());

alter policy kb_trail_progress_del on public.kb_trail_progress
  using (user_id = (select auth.uid()) and kb_is_member());

alter policy kb_autosaves_own on public.kb_autosaves
  using (user_id = (select auth.uid()) and kb_is_member());

alter policy kb_push_own on public.kb_push_subscriptions
  using (user_id = (select auth.uid()) and kb_is_member());

alter policy kb_prefs_own on public.kb_notification_prefs
  using (user_id = (select auth.uid()) and kb_is_member())
  with check (user_id = (select auth.uid()) and kb_is_member());

-- 3) notificações: só quem tem acesso lê/marca/apaga
alter policy kb_notifications_own on public.kb_notifications
  using (user_id = (select auth.uid()) and kb_is_member());
alter policy kb_notifications_update on public.kb_notifications
  using (user_id = (select auth.uid()) and kb_is_member())
  with check (user_id = (select auth.uid()) and kb_is_member());
alter policy kb_notifications_delete on public.kb_notifications
  using (user_id = (select auth.uid()) and kb_is_member());

-- perfil: a própria pessoa só edita (nome, foto) se tiver acesso; admin continua podendo
alter policy kb_profiles_update_self on public.kb_profiles
  using ((id = (select auth.uid()) and kb_is_member()) or kb_is_admin())
  with check ((id = (select auth.uid()) and kb_is_member()) or kb_is_admin());

-- arquivos enviados: apagar só com acesso ativo
alter policy kb_images_delete on storage.objects
  using (bucket_id = 'kb-images' and ((owner = auth.uid() and kb_is_member()) or kb_is_moderator()));
alter policy kb_att_delete on storage.objects
  using (bucket_id = 'kb-attachments' and ((owner = auth.uid() and kb_is_member()) or kb_is_moderator()));

-- preferências pessoais (modo de visualizar etc.): só com acesso
create or replace function public.kb_set_pref(p_key text, p_value jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if auth.uid() is null or not public.kb_is_member() then raise exception 'sem acesso'; end if;
  if p_key !~ '^[a-z0-9_.-]{1,40}$' then raise exception 'chave inválida'; end if;
  if pg_column_size(p_value) > 2000 then raise exception 'valor muito grande'; end if;
  update public.kb_profiles set prefs = coalesce(prefs, '{}'::jsonb) || jsonb_build_object(p_key, p_value)
   where id = auth.uid() returning prefs into v;
  return v;
end $$;
