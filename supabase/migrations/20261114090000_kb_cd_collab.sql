-- =====================================================================
-- CD de cada Field e edição colaborativa ("melhorado por")
-- =====================================================================

-- ---------- CD do Field -------------------------------------------------
alter table public.kb_profiles add column if not exists cd_id uuid references public.cds(id) on delete set null;

-- CD definido na central; se vazio, usa o do Inventário
create or replace function public.kb_cd_of(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select c.nome from public.kb_profiles k join public.cds c on c.id = k.cd_id where k.id = p_user),
    (select c.nome from public.perfis p join public.cds c on c.id = p.cd_id where p.user_id = p_user limit 1))
$$;

create or replace function public.kb_list_cds()
returns table (id uuid, codigo text, nome text, cidade text, uf text)
language sql stable security definer set search_path = public as $$
  select c.id, c.codigo, c.nome, c.cidade, c.uf from public.cds c
  where public.kb_is_member() and coalesce(c.ativo, true) order by c.nome
$$;
revoke all on function public.kb_list_cds() from public, anon;
grant execute on function public.kb_list_cds() to authenticated;

-- Só administradores definem o CD (além do papel e e-mail)
create or replace function public.kb_profiles_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.updated_at := now();
  if auth.uid() is null then return new; end if;
  if new.cd_id is distinct from old.cd_id and not public.kb_is_admin() then
    new.cd_id := old.cd_id;
  end if;
  if new.role is distinct from old.role or new.email is distinct from old.email then
    if old.id = auth.uid() and new.email is not distinct from old.email and (
         (old.role = 'pending' and new.role = public.kb_role_from_inventory(old.id))
      or (new.role = 'admin' and public.kb_is_owner_email(old.email))
    ) then
      return new;
    end if;
    if not public.kb_is_admin() then
      raise exception 'Apenas administradores podem alterar papéis';
    end if;
    if public.kb_is_owner_email(old.email) and new.role <> 'admin' then
      raise exception 'O administrador principal não pode ser rebaixado';
    end if;
    if old.id = auth.uid() and new.role <> 'admin' then
      raise exception 'Você não pode remover seu próprio acesso de administrador';
    end if;
  end if;
  return new;
end $$;

-- Estatísticas com o CD
create or replace view public.kb_user_stats with (security_invoker = true) as
select p.id as user_id, p.full_name, p.avatar_url, p.email, p.role, p.created_at,
  coalesce(t.n, 0) as tutorials,
  coalesce(h.n, 0) as helpful_received,
  coalesce(cm.n, 0) as comments,
  coalesce(ra.n, 0) as requests_answered,
  coalesce(v.n, 0) as views_received,
  coalesce(fo.n, 0) as followers,
  (coalesce(t.n,0) * 10 + coalesce(h.n,0) * 3 + coalesce(cm.n,0) + coalesce(ra.n,0) * 15 + coalesce(v.n,0) / 10)::int as points,
  public.kb_cd_of(p.id) as cd_name
from public.kb_profiles p
left join (select author_id, count(*) n from public.kb_tutorials where status = 'published' group by author_id) t on t.author_id = p.id
left join (select tt.author_id, count(*) n from public.kb_feedback f join public.kb_tutorials tt on tt.id = f.tutorial_id
           where f.helpful and f.user_id <> tt.author_id group by tt.author_id) h on h.author_id = p.id
left join (select user_id, count(*) n from public.kb_comments group by user_id) cm on cm.user_id = p.id
left join (select answered_by, count(*) n from public.kb_requests where status = 'answered' group by answered_by) ra on ra.answered_by = p.id
left join (select tt.author_id, count(*) n from public.kb_views vv join public.kb_tutorials tt on tt.id = vv.tutorial_id
           where vv.user_id <> tt.author_id group by tt.author_id) v on v.author_id = p.id
left join (select author_id, count(*) n from public.kb_follows where author_id is not null group by author_id) fo on fo.author_id = p.id
where p.role in ('admin','field_admin','field');
grant select on public.kb_user_stats to authenticated;
revoke all on public.kb_user_stats from anon;

-- ---------- Edição colaborativa ----------------------------------------
-- Qualquer Field pode melhorar uma publicação publicada (tudo fica no histórico de versões)
create or replace function public.kb_can_edit_tutorial(p_tutorial uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.kb_is_moderator()
      or exists (select 1 from public.kb_tutorials t
                 where t.id = p_tutorial and public.kb_is_member()
                   and (t.author_id = auth.uid() or t.status = 'published'))
$$;

drop policy if exists kb_tutorials_update on public.kb_tutorials;
create policy kb_tutorials_update on public.kb_tutorials for update to authenticated
  using (public.kb_is_moderator() or (public.kb_is_member() and (author_id = auth.uid() or status = 'published')))
  with check (public.kb_is_moderator() or (public.kb_is_member() and (author_id = auth.uid() or status = 'published')));

-- Anexos: colegas podem adicionar; remover continua com o autor e os moderadores
drop policy if exists kb_attachments_write on public.kb_attachments;
drop policy if exists kb_attachments_insert on public.kb_attachments;
create policy kb_attachments_insert on public.kb_attachments for insert to authenticated
  with check (public.kb_can_edit_tutorial(tutorial_id));
drop policy if exists kb_attachments_update on public.kb_attachments;
create policy kb_attachments_update on public.kb_attachments for update to authenticated
  using (public.kb_can_edit_tutorial(tutorial_id)) with check (public.kb_can_edit_tutorial(tutorial_id));
drop policy if exists kb_attachments_delete on public.kb_attachments;
create policy kb_attachments_delete on public.kb_attachments for delete to authenticated
  using (public.kb_is_moderator() or exists (select 1 from public.kb_tutorials t where t.id = tutorial_id and t.author_id = auth.uid()));

-- Quem não é autor nem moderador melhora o conteúdo, mas não muda status nem a regra de revisão
create or replace function public.kb_tutorials_collab_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and auth.uid() <> old.author_id and not public.kb_is_moderator() then
    new.status := old.status;
    new.review_interval_months := old.review_interval_months;
  end if;
  return new;
end $$;
drop trigger if exists kb_tutorials_collab_guard on public.kb_tutorials;
create trigger kb_tutorials_collab_guard before update on public.kb_tutorials
  for each row execute function public.kb_tutorials_collab_guard();
revoke all on function public.kb_tutorials_collab_guard() from public, anon, authenticated;

-- "Marcar como revisado" continua sendo do autor ou moderador
create or replace function public.kb_mark_reviewed(p_tutorial uuid, p_resolve_outdated boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.kb_is_moderator() or exists (select 1 from public.kb_tutorials where id = p_tutorial and author_id = auth.uid())) then
    raise exception 'Sem permissão';
  end if;
  update public.kb_tutorials set reviewed_at = now(), reviewed_by = auth.uid(), review_notified_at = null where id = p_tutorial;
  if p_resolve_outdated then
    update public.kb_comments set resolved = true, resolved_by = auth.uid()
     where tutorial_id = p_tutorial and kind = 'outdated' and not resolved;
  end if;
end $$;

-- Avisa o autor quando um colega melhora a publicação
create or replace function public.kb_tutorials_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; v_author text; v_actor uuid := coalesce(auth.uid(), new.author_id); v_editor text;
begin
  if new.status <> 'published' then return new; end if;
  select full_name into v_author from public.kb_profiles where id = new.author_id;
  if tg_op = 'INSERT' or old.status <> 'published' then
    for r in
      select distinct f.user_id from public.kb_follows f
      where (f.category_id = new.category_id and new.category_id is not null) or f.author_id = new.author_id
    loop
      perform public.kb_notify(r.user_id, 'new_tutorial', 'Novo tutorial: ' || new.title,
        coalesce(new.summary, 'Publicado por ' || coalesce(v_author, 'um colega')), '/t/' || new.short_code, v_actor, new.id, 'new');
    end loop;
  elsif new.content_html is distinct from old.content_html or new.title is distinct from old.title then
    if auth.uid() is not null and auth.uid() <> new.author_id then
      select full_name into v_editor from public.kb_profiles where id = auth.uid();
      perform public.kb_notify(new.author_id, 'improved', coalesce(v_editor, 'Um colega') || ' melhorou seu tutorial “' || new.title || '”',
        'Veja o que mudou no histórico de versões. Juntos a biblioteca fica cada vez melhor!', '/t/' || new.short_code, auth.uid(), new.id, 'update');
    end if;
    for r in select user_id from public.kb_favorites where tutorial_id = new.id loop
      perform public.kb_notify(r.user_id, 'updated', 'Tutorial atualizado: ' || new.title,
        'Um tutorial dos seus favoritos recebeu alterações.', '/t/' || new.short_code, v_actor, new.id, 'update');
    end loop;
  end if;
  return new;
end $$;

-- Quem colaborou (além do autor)
create or replace function public.kb_contributors(p_tutorial uuid)
returns table (user_id uuid, full_name text, avatar_url text, cd_name text, edits bigint, last_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.avatar_url, public.kb_cd_of(p.id), count(*), max(v.created_at)
  from public.kb_tutorial_versions v
  join public.kb_tutorials t on t.id = v.tutorial_id
  join public.kb_profiles p on p.id = v.edited_by
  where v.tutorial_id = p_tutorial and v.edited_by <> t.author_id and public.kb_is_member()
  group by p.id
  order by max(v.created_at) desc
$$;
revoke all on function public.kb_contributors(uuid) from public, anon;
grant execute on function public.kb_contributors(uuid) to authenticated;

-- Lista com número de colaboradores
create or replace view public.kb_tutorials_list with (security_invoker = true) as
select t.id, t.short_code, t.title, t.summary, t.category_id, t.tags, t.difficulty,
       t.status, t.author_id, t.created_at, t.updated_at, t.search,
       a.full_name as author_name, a.avatar_url as author_avatar,
       c.name as category_name, c.color as category_color, c.icon as category_icon,
       (select count(distinct v.user_id) from public.kb_views v where v.tutorial_id = t.id) as viewer_count,
       (select count(*) from public.kb_views v where v.tutorial_id = t.id) as view_count,
       (select count(*) from public.kb_attachments x where x.tutorial_id = t.id) as attachment_count,
       (select count(*) from public.kb_feedback f where f.tutorial_id = t.id and f.helpful) as helpful_count,
       (select count(*) from public.kb_feedback f where f.tutorial_id = t.id and not f.helpful) as not_helpful_count,
       (select count(*) from public.kb_comments m where m.tutorial_id = t.id) as comment_count,
       (select count(*) from public.kb_comments m where m.tutorial_id = t.id and m.kind = 'outdated' and not m.resolved) as outdated_count,
       t.reviewed_at, t.review_interval_months,
       (t.reviewed_at + make_interval(months => t.review_interval_months) < now()) as review_due,
       t.verified_at,
       (t.verified_at is not null) as verified,
       (select p.full_name from public.kb_profiles p where p.id = t.verified_by) as verified_by_name,
       t.kind,
       (select count(*) from public.kb_thanks k where k.tutorial_id = t.id) as thanks_count,
       (select count(distinct vv.edited_by) from public.kb_tutorial_versions vv where vv.tutorial_id = t.id and vv.edited_by <> t.author_id) as contributors_count,
       public.kb_cd_of(t.author_id) as author_cd
from public.kb_tutorials t
join public.kb_profiles a on a.id = t.author_id
left join public.kb_categories c on c.id = t.category_id;
grant select on public.kb_tutorials_list to authenticated;
revoke all on public.kb_tutorials_list from anon;
