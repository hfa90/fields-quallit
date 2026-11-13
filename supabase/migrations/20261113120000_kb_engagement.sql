-- =====================================================================
-- Engajamento: dicas rápidas, agradecimentos, resumo de impacto,
-- mural "procuraram e não acharam" e lembretes gentis
-- =====================================================================

-- ---------- Dica rápida ----------------------------------------------
alter table public.kb_tutorials
  add column if not exists kind text not null default 'tutorial' check (kind in ('tutorial','quick'));

-- ---------- CD de cada pessoa (somente leitura do Inventário) ---------
create or replace function public.kb_cd_of(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select c.nome from public.perfis p join public.cds c on c.id = p.cd_id where p.user_id = p_user limit 1
$$;
revoke all on function public.kb_cd_of(uuid) from public, anon;
grant execute on function public.kb_cd_of(uuid) to authenticated;

-- ---------- Agradecimentos ---------------------------------------------
create table if not exists public.kb_thanks (
  tutorial_id uuid not null references public.kb_tutorials(id) on delete cascade,
  user_id     uuid not null references public.kb_profiles(id) on delete cascade default auth.uid(),
  message     text check (message is null or char_length(message) <= 280),
  created_at  timestamptz not null default now(),
  primary key (tutorial_id, user_id)
);
alter table public.kb_thanks enable row level security;
drop policy if exists kb_thanks_select on public.kb_thanks;
create policy kb_thanks_select on public.kb_thanks for select to authenticated using (public.kb_is_member());
drop policy if exists kb_thanks_own on public.kb_thanks;
create policy kb_thanks_own on public.kb_thanks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.kb_is_member());

create or replace function public.kb_thanks_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare t record; v_name text;
begin
  select title, short_code, author_id into t from public.kb_tutorials where id = new.tutorial_id;
  select full_name into v_name from public.kb_profiles where id = new.user_id;
  perform public.kb_notify(t.author_id, 'thanks', coalesce(v_name, 'Um colega') || ' agradeceu pelo tutorial “' || t.title || '”',
    coalesce(nullif(trim(new.message), ''), 'Seu conhecimento ajudou a resolver um problema. Obrigado por compartilhar!'),
    '/t/' || t.short_code, new.user_id, new.tutorial_id, 'comment');
  return new;
end $$;
drop trigger if exists kb_thanks_notify on public.kb_thanks;
create trigger kb_thanks_notify after insert on public.kb_thanks for each row execute function public.kb_thanks_notify();
revoke all on function public.kb_thanks_notify() from public, anon, authenticated;

-- ---------- Impacto de quem compartilha --------------------------------
create or replace function public.kb_impact(p_user uuid, p_days int default null)
returns jsonb language sql stable security definer set search_path = public as $$
  with mine as (select id from public.kb_tutorials where author_id = p_user and status = 'published'),
  v as (
    select vv.user_id from public.kb_views vv
    where vv.tutorial_id in (select id from mine) and vv.user_id <> p_user
      and (p_days is null or vv.viewed_at > now() - make_interval(days => p_days))
  )
  select case when not public.kb_is_member() then '{}'::jsonb else jsonb_build_object(
    'tutorials', (select count(*) from mine),
    'views', (select count(*) from v),
    'people', (select count(distinct user_id) from v),
    'cds', coalesce((select jsonb_agg(distinct cd) from (select public.kb_cd_of(user_id) cd from (select distinct user_id from v) u) x where cd is not null), '[]'::jsonb),
    'helpful', (select count(*) from public.kb_feedback f where f.tutorial_id in (select id from mine) and f.helpful and f.user_id <> p_user
                 and (p_days is null or f.updated_at > now() - make_interval(days => p_days))),
    'thanks', (select count(*) from public.kb_thanks k where k.tutorial_id in (select id from mine)
                 and (p_days is null or k.created_at > now() - make_interval(days => p_days))),
    'cd', public.kb_cd_of(p_user)
  ) end
$$;
revoke all on function public.kb_impact(uuid, int) from public, anon;
grant execute on function public.kb_impact(uuid, int) to authenticated;

-- Resumo semanal para cada autor (segunda-feira 08:00 Brasília)
create or replace function public.kb_send_impact_digest()
returns int language plpgsql security definer set search_path = public as $$
declare r record; v_views int; v_people int; v_helpful int; v_thanks int; v_cds int; n int := 0; v_body text;
begin
  for r in select distinct author_id from public.kb_tutorials where status = 'published' loop
    select count(*), count(distinct vv.user_id), count(distinct public.kb_cd_of(vv.user_id))
      into v_views, v_people, v_cds
      from public.kb_views vv join public.kb_tutorials t on t.id = vv.tutorial_id
     where t.author_id = r.author_id and vv.user_id <> r.author_id and vv.viewed_at > now() - interval '7 days';
    select count(*) into v_helpful from public.kb_feedback f join public.kb_tutorials t on t.id = f.tutorial_id
     where t.author_id = r.author_id and f.helpful and f.user_id <> r.author_id and f.updated_at > now() - interval '7 days';
    select count(*) into v_thanks from public.kb_thanks k join public.kb_tutorials t on t.id = k.tutorial_id
     where t.author_id = r.author_id and k.created_at > now() - interval '7 days';
    if v_views = 0 and v_thanks = 0 then continue; end if;
    v_body := 'Seus tutoriais foram vistos ' || v_views || ' vez' || case when v_views = 1 then '' else 'es' end
      || ' por ' || v_people || ' colega' || case when v_people = 1 then '' else 's' end
      || case when v_cds > 1 then ' de ' || v_cds || ' CDs' else '' end
      || case when v_helpful > 0 then '. Funcionaram para ' || v_helpful || '.' else '.' end
      || case when v_thanks > 0 then ' Você recebeu ' || v_thanks || ' agradecimento' || case when v_thanks = 1 then '' else 's' end || '!' else '' end;
    perform public.kb_notify(r.author_id, 'impact', 'Seu impacto na semana 💡', v_body, '/pessoa/' || r.author_id, null, null, 'comment');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.kb_send_impact_digest() from public, anon, authenticated;

-- ---------- "Procuraram e não acharam" ---------------------------------
alter table public.kb_search_log add column if not exists reminded_at timestamptz;

create or replace function public.kb_has_answer(p_query text)
returns boolean language plpgsql stable security definer set search_path = public, extensions as $$
declare nq text := trim(public.kb_norm(p_query)); words text[]; tsq tsquery;
begin
  words := array(select w from unnest(regexp_split_to_array(nq, '[^a-z0-9]+')) w where w <> '' limit 8);
  if array_length(words, 1) is null then return true; end if;
  tsq := to_tsquery('public.kb_pt', array_to_string(array(select w || ':*' from unnest(words) w), ' & '));
  return exists (select 1 from public.kb_tutorials t where t.status = 'published' and (t.search @@ tsq or word_similarity(nq, t.norm_title) > 0.5));
end $$;
revoke all on function public.kb_has_answer(text) from public, anon, authenticated;

create or replace function public.kb_search_gaps(p_days int default 60)
returns table (query text, people bigint, searches bigint, last_at timestamptz)
language sql stable security definer set search_path = public as $$
  select q.query, q.people, q.searches, q.last_at from (
    select (array_agg(trim(l.query) order by l.created_at desc))[1] as query,
           count(distinct l.user_id) as people, count(*) as searches, max(l.created_at) as last_at
    from public.kb_search_log l
    where l.results = 0 and l.created_at > now() - make_interval(days => p_days) and char_length(trim(l.query)) >= 3
    group by public.kb_norm(trim(l.query))
  ) q
  where public.kb_is_member() and not public.kb_has_answer(q.query)
  order by q.people desc, q.last_at desc
  limit 30
$$;
revoke all on function public.kb_search_gaps(int) from public, anon;
grant execute on function public.kb_search_gaps(int) to authenticated;

-- Lembrete gentil: 1 a 3 dias depois de uma busca sem resultado (10:00 Brasília)
create or replace function public.kb_send_gap_reminders()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in
    select distinct on (l.user_id, public.kb_norm(trim(l.query))) l.user_id, trim(l.query) as q
    from public.kb_search_log l
    where l.results = 0 and l.reminded_at is null and l.user_id is not null and char_length(trim(l.query)) >= 3
      and l.created_at between now() - interval '3 days' and now() - interval '1 day'
    order by l.user_id, public.kb_norm(trim(l.query)), l.created_at desc
  loop
    update public.kb_search_log set reminded_at = now()
     where user_id = r.user_id and public.kb_norm(trim(query)) = public.kb_norm(r.q) and reminded_at is null;
    if public.kb_has_answer(r.q) then continue; end if;
    perform public.kb_notify(r.user_id, 'gap_reminder', 'Conseguiu resolver “' || left(r.q, 60) || '”?',
      'Você procurou e não encontrou na biblioteca. Se resolveu, conte como em 30 segundos — outros colegas podem passar pelo mesmo.',
      '/dica?problema=' || regexp_replace(left(r.q, 80), '[&#?%]', ' ', 'g'), null, null, 'request');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.kb_send_gap_reminders() from public, anon, authenticated;

-- ---------- Lista com tipo e agradecimentos -----------------------------
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
       (select count(*) from public.kb_thanks k where k.tutorial_id = t.id) as thanks_count
from public.kb_tutorials t
join public.kb_profiles a on a.id = t.author_id
left join public.kb_categories c on c.id = t.category_id;
grant select on public.kb_tutorials_list to authenticated;
revoke all on public.kb_tutorials_list from anon;

-- ---------- Agendamentos -------------------------------------------------
select cron.unschedule(jobid) from cron.job where jobname in ('kb-impact-digest', 'kb-gap-reminders');
select cron.schedule('kb-impact-digest', '0 11 * * 1', $$select public.kb_send_impact_digest()$$);
select cron.schedule('kb-gap-reminders', '0 13 * * *', $$select public.kb_send_gap_reminders()$$);
