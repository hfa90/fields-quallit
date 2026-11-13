-- =====================================================================
-- Excluir um Field da central (somente administradores)
--  * publicações: transferidas para outra pessoa ou excluídas junto
--  * quem também usa o Inventário: perde o acesso ao Fields (bloqueado),
--    a conta do Inventário continua intacta
--  * quem só usa o Fields: perfil apagado (a conta de login é apagada
--    pela função kb-admin-users logo em seguida)
-- =====================================================================

-- Permite trocar o autor somente dentro de kb_admin_remove_user
create or replace function public.kb_tutorials_before()
returns trigger language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if tg_op = 'INSERT' then
    if new.short_code is null or new.short_code = '' then
      loop
        c := public.kb_random_code(6);
        exit when not exists (select 1 from public.kb_tutorials where short_code = c);
      end loop;
      new.short_code := c;
    end if;
    new.author_id := coalesce(auth.uid(), new.author_id);
    new.reviewed_at := now();
    new.reviewed_by := new.author_id;
    new.verified_at := null; new.verified_by := null;
  else
    new.short_code := old.short_code;
    if coalesce(current_setting('kb.transfer_author', true), '') <> 'on' then
      new.author_id := old.author_id;
    end if;
    new.created_at := old.created_at;
    if (new.title, new.summary, new.content_html, new.tags, new.category_id, new.difficulty, new.status)
       is distinct from (old.title, old.summary, old.content_html, old.tags, old.category_id, old.difficulty, old.status) then
      new.updated_at := now();
      new.updated_by := coalesce(auth.uid(), old.updated_by);
      if new.content_html is distinct from old.content_html then
        new.reviewed_at := now(); new.reviewed_by := coalesce(auth.uid(), old.reviewed_by); new.review_notified_at := null;
        if new.verified_at is not distinct from old.verified_at then
          new.verified_at := null; new.verified_by := null;
        end if;
      end if;
    else
      new.updated_at := old.updated_at;
      new.updated_by := old.updated_by;
    end if;
    if (new.verified_at, new.verified_by) is distinct from (old.verified_at, old.verified_by)
       and auth.uid() is not null and not public.kb_is_moderator()
       and not (new.verified_at is null and new.content_html is distinct from old.content_html) then
      new.verified_at := old.verified_at; new.verified_by := old.verified_by;
    end if;
  end if;
  return new;
end $$;

-- O que acontece ao excluir (para a tela de confirmação)
create or replace function public.kb_admin_user_info(p_user uuid)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.kb_is_admin() then raise exception 'Apenas administradores'; end if;
  return json_build_object(
    'published', (select count(*) from public.kb_tutorials where author_id = p_user and status = 'published'),
    'drafts', (select count(*) from public.kb_tutorials where author_id = p_user and status <> 'published'),
    'inventory', exists (select 1 from public.perfis where user_id = p_user),
    'owner', exists (select 1 from public.kb_profiles where id = p_user and public.kb_is_owner_email(email)),
    'me', p_user = auth.uid());
end $$;

create or replace function public.kb_admin_remove_user(p_user uuid, p_transfer_to uuid, p_delete_posts boolean)
returns json language plpgsql security definer set search_path = public as $$
declare v_inv boolean; v_n int; v_paths text[] := '{}';
begin
  if not public.kb_is_admin() then raise exception 'Apenas administradores podem excluir usuários'; end if;
  if p_user = auth.uid() then raise exception 'Você não pode excluir a si mesmo'; end if;
  if not exists (select 1 from public.kb_profiles where id = p_user) then raise exception 'Usuário não encontrado na central'; end if;
  if exists (select 1 from public.kb_profiles where id = p_user and public.kb_is_owner_email(email)) then
    raise exception 'O administrador principal não pode ser excluído';
  end if;

  v_inv := exists (select 1 from public.perfis where user_id = p_user);
  select count(*) into v_n from public.kb_tutorials where author_id = p_user;

  if v_n > 0 then
    if coalesce(p_delete_posts, false) then
      select coalesce(array_agg(a.storage_path), '{}') into v_paths
        from public.kb_attachments a join public.kb_tutorials t on t.id = a.tutorial_id where t.author_id = p_user;
      delete from public.kb_tutorials where author_id = p_user;
    else
      if p_transfer_to is null or p_transfer_to = p_user or not exists (
        select 1 from public.kb_profiles where id = p_transfer_to and role in ('admin','field_admin','field')) then
        raise exception 'Escolha para quem transferir as publicações';
      end if;
      perform set_config('kb.transfer_author', 'on', true);
      update public.kb_tutorials set author_id = p_transfer_to where author_id = p_user;
      perform set_config('kb.transfer_author', '', true);
    end if;
  end if;

  if v_inv then
    update public.kb_profiles set role = 'blocked', cd_id = null where id = p_user;
    delete from public.kb_follows where author_id = p_user or user_id = p_user;
    delete from public.kb_push_subscriptions where user_id = p_user;
    delete from public.kb_autosaves where user_id = p_user;
  else
    delete from public.kb_profiles where id = p_user;
  end if;

  return json_build_object('inventory', v_inv, 'tutorials', v_n, 'deleted_posts', coalesce(p_delete_posts, false) and v_n > 0, 'attachments', v_paths);
end $$;

revoke all on function public.kb_admin_user_info(uuid) from public, anon;
revoke all on function public.kb_admin_remove_user(uuid, uuid, boolean) from public, anon;
grant execute on function public.kb_admin_user_info(uuid) to authenticated;
grant execute on function public.kb_admin_remove_user(uuid, uuid, boolean) to authenticated;
