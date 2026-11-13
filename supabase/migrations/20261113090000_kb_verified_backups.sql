-- =====================================================================
-- Selo "Verificado" e cópias de segurança automáticas
-- =====================================================================

-- ---------- Selo Verificado --------------------------------------------
alter table public.kb_tutorials
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references public.kb_profiles(id) on delete set null;

-- Mudou o conteúdo => a verificação precisa ser refeita
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
    new.author_id  := old.author_id;
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
    -- só moderadores mexem no selo diretamente
    if (new.verified_at, new.verified_by) is distinct from (old.verified_at, old.verified_by)
       and auth.uid() is not null and not public.kb_is_moderator()
       and not (new.verified_at is null and new.content_html is distinct from old.content_html) then
      new.verified_at := old.verified_at; new.verified_by := old.verified_by;
    end if;
  end if;
  return new;
end $$;

create or replace function public.kb_set_verified(p_tutorial uuid, p_verified boolean)
returns void language plpgsql security definer set search_path = public as $$
declare t record;
begin
  if not public.kb_is_moderator() then raise exception 'Apenas Field Administradores e Administradores podem verificar tutoriais'; end if;
  update public.kb_tutorials
     set verified_at = case when p_verified then now() end,
         verified_by = case when p_verified then auth.uid() end
   where id = p_tutorial
  returning id, title, short_code, author_id into t;
  if p_verified and t.id is not null then
    perform public.kb_notify(t.author_id, 'verified', 'Seu tutorial foi verificado: ' || t.title,
      'Ele agora aparece com o selo Verificado e ganha destaque na busca.', '/t/' || t.short_code, auth.uid(), t.id, 'comment');
  end if;
end $$;
revoke all on function public.kb_set_verified(uuid, boolean) from public, anon;
grant execute on function public.kb_set_verified(uuid, boolean) to authenticated;

-- Lista com o selo
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
       (select p.full_name from public.kb_profiles p where p.id = t.verified_by) as verified_by_name
from public.kb_tutorials t
join public.kb_profiles a on a.id = t.author_id
left join public.kb_categories c on c.id = t.category_id;
grant select on public.kb_tutorials_list to authenticated;
revoke all on public.kb_tutorials_list from anon;

-- Busca: tutoriais verificados primeiro
drop function if exists public.kb_search(text, int, boolean);
create function public.kb_search(p_query text, p_limit int default 30, p_log boolean default false)
returns table (kind text, id uuid, short_code text, title text, snippet text, category_name text,
               category_color text, category_icon text, author_name text, author_avatar text,
               matched_in text, score real, created_at timestamptz, verified boolean)
language plpgsql volatile security invoker set search_path = public, extensions as $$
#variable_conflict use_column
declare
  nq text := trim(public.kb_norm(p_query));
  words text[];
  tsq tsquery;
begin
  if not public.kb_is_member() or char_length(nq) < 2 then return; end if;
  words := array(select w from unnest(regexp_split_to_array(nq, '[^a-z0-9]+')) w where w <> '' limit 8);
  if array_length(words, 1) is null then return; end if;
  tsq := to_tsquery('public.kb_pt', array_to_string(array(select w || ':*' from unnest(words) w), ' & '));

  return query
  with tut as (
    select t.*, c.name cname, c.color ccolor, c.icon cicon, a.full_name aname, a.avatar_url aavatar,
      ts_rank_cd(t.search, tsq, 32) as fts,
      greatest(similarity(t.norm_title, nq), word_similarity(nq, t.norm_title)) as fuzzy,
      (select string_agg(x.file_name, ', ') from public.kb_attachments x where x.tutorial_id = t.id and public.kb_norm(regexp_replace(x.file_name, '[_.-]+', ' ', 'g')) like '%' || nq || '%') as att,
      (select string_agg(coalesce(l.title, l.url), ', ') from public.kb_links l where l.tutorial_id = t.id and public.kb_norm(coalesce(l.title,'') || ' ' || l.url) like '%' || nq || '%') as lnk,
      (select left(m.body, 160) from public.kb_comments m where m.tutorial_id = t.id and public.kb_norm(m.body) like '%' || nq || '%' limit 1) as cmt,
      (select count(*) from public.kb_views v where v.tutorial_id = t.id) as views
    from public.kb_tutorials t
    join public.kb_profiles a on a.id = t.author_id
    left join public.kb_categories c on c.id = t.category_id
    where t.status = 'published' or t.author_id = auth.uid()
  )
  select * from (
    select 'tutorial'::text, tut.id, tut.short_code, tut.title,
      case
        when tut.search @@ tsq then ts_headline('public.kb_pt', coalesce(tut.summary, '') || ' · ' || public.kb_strip_html(tut.content_html), tsq,
             'StartSel=[[, StopSel=]], MaxWords=26, MinWords=12, MaxFragments=2, FragmentDelimiter=" … "')
        when tut.att is not null then 'Anexo: ' || tut.att
        when tut.lnk is not null then 'Link: ' || tut.lnk
        when tut.cmt is not null then 'Comentário: ' || tut.cmt
        else coalesce(tut.summary, left(public.kb_strip_html(tut.content_html), 160)) end,
      tut.cname, tut.ccolor, tut.cicon, tut.aname, tut.aavatar,
      case when tut.norm_title like '%' || nq || '%' or tut.fuzzy > 0.45 then 'título'
           when tut.search @@ tsq then 'conteúdo'
           when tut.att is not null then 'anexo'
           when tut.lnk is not null then 'link'
           when tut.cmt is not null then 'comentário'
           else 'semelhante' end,
      (tut.fts * 4 + tut.fuzzy * 2
        + case when tut.norm_title like nq || '%' then 1.5 when tut.norm_title like '%' || nq || '%' then 1 else 0 end
        + case when tut.att is not null then 0.6 else 0 end
        + case when tut.lnk is not null then 0.4 else 0 end
        + case when tut.cmt is not null then 0.3 else 0 end
        + ln(1 + tut.views) * 0.05)::real,
      tut.created_at,
      tut.verified_at is not null
    from tut
    where tut.search @@ tsq or tut.fuzzy > 0.3 or tut.norm_title like '%' || nq || '%'
       or tut.att is not null or tut.lnk is not null or tut.cmt is not null

    union all
    select 'request', r.id, null, r.title, coalesce(left(r.details, 160), ''), c.name, c.color, c.icon, p.full_name, p.avatar_url,
      case r.status when 'answered' then 'pedido atendido' else 'pedido em aberto' end,
      (greatest(similarity(public.kb_norm(r.title), nq), word_similarity(nq, public.kb_norm(r.title))) * 1.5)::real, r.created_at, false
    from public.kb_requests r join public.kb_profiles p on p.id = r.user_id left join public.kb_categories c on c.id = r.category_id
    where public.kb_norm(r.title || ' ' || coalesce(r.details,'')) like '%' || nq || '%'
       or word_similarity(nq, public.kb_norm(r.title)) > 0.35

    union all
    select 'person', p.id, null, p.full_name, p.email, null, null, null, null, p.avatar_url, 'pessoa',
      (greatest(similarity(public.kb_norm(p.full_name), nq), word_similarity(nq, public.kb_norm(p.full_name))))::real, p.created_at, false
    from public.kb_profiles p
    where p.role in ('admin','field_admin','field')
      and (public.kb_norm(p.full_name || ' ' || p.email) like '%' || nq || '%' or word_similarity(nq, public.kb_norm(p.full_name)) > 0.45)
  ) res
  order by 14 desc, 12 desc
  limit p_limit;

  if p_log then
    insert into public.kb_search_log (user_id, query, results)
    values (auth.uid(), left(trim(p_query), 200), (select count(*) from public.kb_tutorials t where t.search @@ tsq));
  end if;
end $$;
revoke all on function public.kb_search(text, int, boolean) from public, anon;
grant execute on function public.kb_search(text, int, boolean) to authenticated;

-- ---------- Cópias de segurança ----------------------------------------
-- Bucket privado: só administradores leem; só o servidor (Edge Function) grava
insert into storage.buckets (id, name, public) values ('kb-backups', 'kb-backups', false)
on conflict (id) do nothing;
drop policy if exists kb_backups_admin_read on storage.objects;
create policy kb_backups_admin_read on storage.objects for select to authenticated
  using (bucket_id = 'kb-backups' and public.kb_is_admin());

create or replace function public.kb_run_backup()
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_base text; v_secret text;
begin
  select value into v_secret from public.kb_private where key = 'push_secret';
  select regexp_replace(value, '/kb-push$', '') into v_base from public.kb_private where key = 'push_function_url';
  if v_base is null or v_secret is null then return; end if;
  perform net.http_post(url := v_base || '/kb-backup', body := '{"source":"cron"}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-kb-secret', v_secret),
    timeout_milliseconds := 120000);
end $$;
revoke all on function public.kb_run_backup() from public, anon, authenticated;

-- Domingo 03:00 (Brasília)
select cron.unschedule(jobid) from cron.job where jobname = 'kb-weekly-backup';
select cron.schedule('kb-weekly-backup', '0 6 * * 0', $$select public.kb_run_backup()$$);
