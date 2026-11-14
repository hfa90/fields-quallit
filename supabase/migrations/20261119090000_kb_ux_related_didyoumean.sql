-- Experiência do usuário:
-- 1) o autor é avisado quando alguém marca que o tutorial FUNCIONOU (antes só no "não funcionou")
-- 2) tutoriais relacionados ("quem viu este também viu" + mesmo assunto)
-- 3) "Você quis dizer…?" na busca (corrige erros de digitação com o vocabulário da biblioteca)

-- ---------- 1) Aviso de "Funcionou!" ----------------------------------------
create or replace function public.kb_feedback_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare t record; v_name text;
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and old.helpful = new.helpful then return new; end if;
  select title, short_code, author_id into t from public.kb_tutorials where id = new.tutorial_id;
  select full_name into v_name from public.kb_profiles where id = new.user_id;
  if new.helpful then
    perform public.kb_notify(t.author_id, 'helpful', coalesce(split_part(v_name, ' ', 1), 'Alguém') || ' disse que “' || t.title || '” funcionou! 🎉',
      'Seu conhecimento resolveu o problema de um colega em campo.', '/t/' || t.short_code, new.user_id, new.tutorial_id, 'comment');
  else
    perform public.kb_notify(t.author_id, 'not_helpful', coalesce(v_name,'Alguém') || ' marcou que “' || t.title || '” não funcionou',
      'Veja os comentários e confira se algum passo precisa ser atualizado.', '/t/' || t.short_code || '#comentarios', new.user_id, new.tutorial_id, 'comment');
  end if;
  return new;
end $$;
revoke all on function public.kb_feedback_notify() from public, anon, authenticated;

-- ---------- 2) Tutoriais relacionados ----------------------------------------
-- Pontuação: colegas que viram os dois (peso maior) + tags em comum + mesma categoria + verificado.
-- Só devolve ids e o motivo; quem chama busca os dados em kb_tutorials_list (respeita as regras de acesso).
create or replace function public.kb_related(p_tutorial uuid, p_limit int default 6)
returns table (tutorial_id uuid, reason text, score real)
language sql stable security definer set search_path = public as $$
  with me as (select id, category_id, tags from public.kb_tutorials where id = p_tutorial),
  viewers as (
    select distinct v.user_id from public.kb_views v
    where v.tutorial_id = p_tutorial and v.viewed_at > now() - interval '180 days'
  ),
  co as (
    select v.tutorial_id, count(distinct v.user_id) as n
    from public.kb_views v join viewers w on w.user_id = v.user_id
    where v.tutorial_id <> p_tutorial and v.viewed_at > now() - interval '180 days'
    group by v.tutorial_id
  ),
  cand as (
    select t.id, coalesce(co.n, 0) as co_n,
      (select count(*) from unnest(t.tags) x where x = any(coalesce((select me.tags from me), '{}'::text[]))) as tag_n,
      (t.category_id is not null and t.category_id = (select me.category_id from me)) as same_cat,
      t.verified_at is not null as verified
    from public.kb_tutorials t left join co on co.tutorial_id = t.id
    where t.status = 'published' and t.id <> p_tutorial
  )
  select id,
    case when co_n > 0 then 'coview' when tag_n > 0 or same_cat then 'similar' else 'other' end,
    (least(co_n, 10) * 3 + tag_n * 2 + case when same_cat then 1.5 else 0 end + case when verified then 0.5 else 0 end)::real as score
  from cand
  where public.kb_is_member() and exists (select 1 from me) and (co_n > 0 or tag_n > 0 or same_cat)
  order by 3 desc, id
  limit least(greatest(coalesce(p_limit, 6), 1), 12)
$$;
revoke all on function public.kb_related(uuid, int) from public, anon;
grant execute on function public.kb_related(uuid, int) to authenticated;

-- ---------- 3) "Você quis dizer…?" -------------------------------------------
-- Troca cada palavra que não existe na biblioteca pela mais parecida (títulos, tags, categorias).
-- Devolve null quando não há o que corrigir.
create or replace function public.kb_search_didyoumean(p_query text)
returns text language plpgsql stable security definer set search_path = public, extensions as $$
declare
  nq text := trim(public.kb_norm(coalesce(p_query, '')));
  vocab text[];
  w text; best text; outw text[] := '{}'; changed boolean := false;
begin
  if not public.kb_is_member() or char_length(nq) < 3 or char_length(nq) > 120 then return null; end if;
  vocab := array(
    select distinct x from (
      select unnest(regexp_split_to_array(t.norm_title, '[^a-z0-9]+')) x from public.kb_tutorials t where t.status = 'published'
      union all
      select unnest(regexp_split_to_array(public.kb_norm(c.name), '[^a-z0-9]+')) from public.kb_categories c
    ) s where char_length(x) >= 3
  );
  if coalesce(array_length(vocab, 1), 0) = 0 then return null; end if;
  for w in select x from unnest(regexp_split_to_array(nq, '[^a-z0-9]+')) x where x <> '' limit 8 loop
    if char_length(w) < 4 or w = any(vocab) then outw := outw || w; continue; end if;
    select v into best from unnest(vocab) v
      where similarity(v, w) >= 0.4 order by similarity(v, w) desc, abs(char_length(v) - char_length(w)), v limit 1;
    if best is not null and best <> w then outw := outw || best; changed := true; else outw := outw || w; end if;
  end loop;
  if not changed then return null; end if;
  return array_to_string(outw, ' ');
end $$;
revoke all on function public.kb_search_didyoumean(text) from public, anon;
grant execute on function public.kb_search_didyoumean(text) to authenticated;
