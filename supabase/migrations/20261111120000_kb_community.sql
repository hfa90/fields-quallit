-- =====================================================================
-- Comunidade, feedback, favoritos, notificações, push e busca inteligente
-- =====================================================================
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_net;

-- ---------- Normalização (sem acento, minúsculo) ----------------------
create or replace function public.kb_norm(t text)
returns text language sql immutable parallel safe set search_path = public, extensions
as $$ select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, ''))) $$;

create or replace function public.kb_strip_html(t text)
returns text language sql immutable parallel safe set search_path = public
as $$ select regexp_replace(replace(replace(replace(replace(regexp_replace(coalesce(t,''), '<[^>]+>', ' ', 'g'), '&nbsp;', ' '), '&lt;', '<'), '&gt;', '>'), '&amp;', '&'), '\s+', ' ', 'g') $$;

-- Configuração de busca em português que ignora acentos
do $$ begin
  create text search configuration public.kb_pt (copy = pg_catalog.portuguese);
exception when unique_violation then null; end $$;
alter text search configuration public.kb_pt
  alter mapping for hword, hword_part, word with extensions.unaccent, portuguese_stem;

-- Recria a coluna de busca com a nova configuração
drop view if exists public.kb_tutorials_list;
alter table public.kb_tutorials drop column if exists search;
alter table public.kb_tutorials add column search tsvector generated always as (
  setweight(to_tsvector('public.kb_pt'::regconfig, coalesce(title,'')), 'A') ||
  setweight(to_tsvector('public.kb_pt'::regconfig, public.kb_tags_text(tags)), 'A') ||
  setweight(to_tsvector('public.kb_pt'::regconfig, coalesce(summary,'')), 'B') ||
  setweight(to_tsvector('public.kb_pt'::regconfig, public.kb_strip_html(content_html)), 'C')
) stored;
alter table public.kb_tutorials add column if not exists norm_title text generated always as (public.kb_norm(title || ' ' || public.kb_tags_text(tags))) stored;
create index if not exists kb_tutorials_search_idx on public.kb_tutorials using gin (search);
create index if not exists kb_tutorials_norm_title_trgm on public.kb_tutorials using gin (norm_title extensions.gin_trgm_ops);

-- ---------- Comentários (em tutoriais ou pedidos) ---------------------
create table if not exists public.kb_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.kb_profiles(id) on delete cascade default auth.uid(),
  title       text not null check (char_length(title) between 5 and 200),
  details     text,
  category_id uuid references public.kb_categories(id) on delete set null,
  status      text not null default 'open' check (status in ('open','answered','closed')),
  tutorial_id uuid references public.kb_tutorials(id) on delete set null,
  answered_by uuid references public.kb_profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists kb_requests_status_idx on public.kb_requests (status, created_at desc);

create table if not exists public.kb_request_votes (
  request_id uuid not null references public.kb_requests(id) on delete cascade,
  user_id    uuid not null references public.kb_profiles(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);

create table if not exists public.kb_comments (
  id          uuid primary key default gen_random_uuid(),
  tutorial_id uuid references public.kb_tutorials(id) on delete cascade,
  request_id  uuid references public.kb_requests(id) on delete cascade,
  parent_id   uuid references public.kb_comments(id) on delete cascade,
  user_id     uuid not null references public.kb_profiles(id) on delete cascade default auth.uid(),
  kind        text not null default 'comment' check (kind in ('comment','outdated','tip','question')),
  body        text not null check (char_length(body) between 1 and 5000),
  resolved    boolean not null default false,
  resolved_by uuid references public.kb_profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check ((tutorial_id is not null) <> (request_id is not null))
);
create index if not exists kb_comments_tutorial_idx on public.kb_comments (tutorial_id, created_at);
create index if not exists kb_comments_request_idx on public.kb_comments (request_id, created_at);

-- ---------- Feedback "Funcionou para mim?" ----------------------------
create table if not exists public.kb_feedback (
  tutorial_id uuid not null references public.kb_tutorials(id) on delete cascade,
  user_id     uuid not null references public.kb_profiles(id) on delete cascade default auth.uid(),
  helpful     boolean not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (tutorial_id, user_id)
);

-- ---------- Favoritos e "seguir" --------------------------------------
create table if not exists public.kb_favorites (
  user_id     uuid not null references public.kb_profiles(id) on delete cascade default auth.uid(),
  tutorial_id uuid not null references public.kb_tutorials(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, tutorial_id)
);

create table if not exists public.kb_follows (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.kb_profiles(id) on delete cascade default auth.uid(),
  category_id uuid references public.kb_categories(id) on delete cascade,
  author_id   uuid references public.kb_profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  check ((category_id is not null) <> (author_id is not null)),
  check (author_id is distinct from user_id)
);
create unique index if not exists kb_follows_cat_uq on public.kb_follows (user_id, category_id) where category_id is not null;
create unique index if not exists kb_follows_author_uq on public.kb_follows (user_id, author_id) where author_id is not null;

-- ---------- Notificações e push ---------------------------------------
create table if not exists public.kb_notifications (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.kb_profiles(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  link        text,
  actor_id    uuid references public.kb_profiles(id) on delete set null,
  tutorial_id uuid references public.kb_tutorials(id) on delete cascade,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists kb_notifications_user_idx on public.kb_notifications (user_id, created_at desc);

create table if not exists public.kb_push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.kb_profiles(id) on delete cascade default auth.uid(),
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.kb_notification_prefs (
  user_id        uuid primary key references public.kb_profiles(id) on delete cascade default auth.uid(),
  push_enabled   boolean not null default true,
  notify_new     boolean not null default true,
  notify_updates boolean not null default true,
  notify_comments boolean not null default true,
  notify_requests boolean not null default true
);

-- Segredos internos (somente service role; sem nenhuma policy)
create table if not exists public.kb_private (key text primary key, value text not null);

-- ---------- Log de buscas ---------------------------------------------
create table if not exists public.kb_search_log (
  id         bigint generated always as identity primary key,
  user_id    uuid references public.kb_profiles(id) on delete set null default auth.uid(),
  query      text not null,
  results    int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists kb_search_log_created_idx on public.kb_search_log (created_at desc);

-- ---------- RLS --------------------------------------------------------
alter table public.kb_requests           enable row level security;
alter table public.kb_request_votes      enable row level security;
alter table public.kb_comments           enable row level security;
alter table public.kb_feedback           enable row level security;
alter table public.kb_favorites          enable row level security;
alter table public.kb_follows            enable row level security;
alter table public.kb_notifications      enable row level security;
alter table public.kb_push_subscriptions enable row level security;
alter table public.kb_notification_prefs enable row level security;
alter table public.kb_private            enable row level security;
alter table public.kb_search_log         enable row level security;

-- pedidos
drop policy if exists kb_requests_select on public.kb_requests;
create policy kb_requests_select on public.kb_requests for select to authenticated using (public.kb_is_member());
drop policy if exists kb_requests_insert on public.kb_requests;
create policy kb_requests_insert on public.kb_requests for insert to authenticated with check (public.kb_is_member() and user_id = auth.uid());
drop policy if exists kb_requests_update on public.kb_requests;
create policy kb_requests_update on public.kb_requests for update to authenticated
  using (public.kb_is_moderator() or (user_id = auth.uid() and public.kb_is_member()))
  with check (public.kb_is_moderator() or (user_id = auth.uid() and public.kb_is_member()));
drop policy if exists kb_requests_delete on public.kb_requests;
create policy kb_requests_delete on public.kb_requests for delete to authenticated
  using (public.kb_is_moderator() or (user_id = auth.uid() and public.kb_is_member()));

drop policy if exists kb_request_votes_select on public.kb_request_votes;
create policy kb_request_votes_select on public.kb_request_votes for select to authenticated using (public.kb_is_member());
drop policy if exists kb_request_votes_write on public.kb_request_votes;
create policy kb_request_votes_write on public.kb_request_votes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.kb_is_member());

-- comentários
drop policy if exists kb_comments_select on public.kb_comments;
create policy kb_comments_select on public.kb_comments for select to authenticated using (public.kb_is_member());
drop policy if exists kb_comments_insert on public.kb_comments;
create policy kb_comments_insert on public.kb_comments for insert to authenticated
  with check (public.kb_is_member() and user_id = auth.uid() and resolved = false);
drop policy if exists kb_comments_update on public.kb_comments;
create policy kb_comments_update on public.kb_comments for update to authenticated
  using (public.kb_is_member() and (user_id = auth.uid() or public.kb_is_moderator()
         or exists (select 1 from public.kb_tutorials t where t.id = tutorial_id and t.author_id = auth.uid())))
  with check (public.kb_is_member());
drop policy if exists kb_comments_delete on public.kb_comments;
create policy kb_comments_delete on public.kb_comments for delete to authenticated
  using (user_id = auth.uid() or public.kb_is_moderator());

-- feedback, favoritos, seguir, preferências e inscrições push: só do próprio usuário
drop policy if exists kb_feedback_select on public.kb_feedback;
create policy kb_feedback_select on public.kb_feedback for select to authenticated using (public.kb_is_member());
drop policy if exists kb_feedback_write on public.kb_feedback;
create policy kb_feedback_write on public.kb_feedback for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.kb_is_member());

drop policy if exists kb_favorites_own on public.kb_favorites;
create policy kb_favorites_own on public.kb_favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.kb_is_member());

drop policy if exists kb_follows_own on public.kb_follows;
create policy kb_follows_own on public.kb_follows for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.kb_is_member());
drop policy if exists kb_follows_count on public.kb_follows;
create policy kb_follows_count on public.kb_follows for select to authenticated using (public.kb_is_member());

drop policy if exists kb_notifications_own on public.kb_notifications;
create policy kb_notifications_own on public.kb_notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists kb_notifications_update on public.kb_notifications;
create policy kb_notifications_update on public.kb_notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists kb_notifications_delete on public.kb_notifications;
create policy kb_notifications_delete on public.kb_notifications for delete to authenticated using (user_id = auth.uid());

drop policy if exists kb_push_own on public.kb_push_subscriptions;
create policy kb_push_own on public.kb_push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.kb_is_member());

drop policy if exists kb_prefs_own on public.kb_notification_prefs;
create policy kb_prefs_own on public.kb_notification_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists kb_search_log_admin on public.kb_search_log;
create policy kb_search_log_admin on public.kb_search_log for select to authenticated using (public.kb_is_moderator());

-- ---------- Notificações: criação + envio push -------------------------
create or replace function public.kb_pref(p_user uuid, p_kind text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select case p_kind
      when 'new' then notify_new when 'update' then notify_updates
      when 'comment' then notify_comments when 'request' then notify_requests else true end
    from public.kb_notification_prefs where user_id = p_user), true)
$$;

create or replace function public.kb_notify(p_user uuid, p_type text, p_title text, p_body text, p_link text,
                                            p_actor uuid, p_tutorial uuid, p_pref text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_user = p_actor then return; end if;
  if not exists (select 1 from public.kb_profiles where id = p_user and role in ('admin','field_admin','field')) then return; end if;
  if not public.kb_pref(p_user, p_pref) then return; end if;
  -- evita repetição: mesma notificação não lida na última hora
  if exists (select 1 from public.kb_notifications where user_id = p_user and type = p_type
             and tutorial_id is not distinct from p_tutorial and read_at is null and created_at > now() - interval '1 hour') then
    return;
  end if;
  insert into public.kb_notifications (user_id, type, title, body, link, actor_id, tutorial_id)
  values (p_user, p_type, p_title, left(p_body, 280), p_link, p_actor, p_tutorial);
end $$;

-- Envia push via Edge Function quando o usuário tem celular/navegador inscrito
create or replace function public.kb_notifications_push()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare v_url text; v_secret text;
begin
  if not exists (select 1 from public.kb_push_subscriptions where user_id = new.user_id) then return new; end if;
  if exists (select 1 from public.kb_notification_prefs where user_id = new.user_id and not push_enabled) then return new; end if;
  select value into v_url from public.kb_private where key = 'push_function_url';
  select value into v_secret from public.kb_private where key = 'push_secret';
  if v_url is null or v_secret is null then return new; end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-kb-secret', v_secret)
  );
  return new;
exception when others then
  return new; -- push nunca pode quebrar a criação da notificação
end $$;
drop trigger if exists kb_notifications_push on public.kb_notifications;
create trigger kb_notifications_push after insert on public.kb_notifications
  for each row execute function public.kb_notifications_push();

-- Tutorial publicado / atualizado
create or replace function public.kb_tutorials_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; v_author text; v_actor uuid := coalesce(auth.uid(), new.author_id);
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
    for r in select user_id from public.kb_favorites where tutorial_id = new.id loop
      perform public.kb_notify(r.user_id, 'updated', 'Tutorial atualizado: ' || new.title,
        'Um tutorial dos seus favoritos recebeu alterações.', '/t/' || new.short_code, v_actor, new.id, 'update');
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists kb_tutorials_notify on public.kb_tutorials;
create trigger kb_tutorials_notify after insert or update on public.kb_tutorials
  for each row execute function public.kb_tutorials_notify();

-- Comentário novo
create or replace function public.kb_comments_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text; v_parent uuid; v_owner uuid; v_tut uuid; v_ttitle text; v_title text; v_link text; v_code text;
begin
  select full_name into v_name from public.kb_profiles where id = new.user_id;
  if new.tutorial_id is not null then
    select id, title, short_code, author_id into v_tut, v_ttitle, v_code, v_owner from public.kb_tutorials where id = new.tutorial_id;
    v_link := '/t/' || v_code || '#comentarios';
    v_title := case new.kind
      when 'outdated' then coalesce(v_name,'Alguém') || ' reportou um passo desatualizado'
      when 'question' then coalesce(v_name,'Alguém') || ' fez uma pergunta'
      when 'tip' then coalesce(v_name,'Alguém') || ' deixou uma dica'
      else coalesce(v_name,'Alguém') || ' comentou' end || ' em “' || v_ttitle || '”';
    perform public.kb_notify(v_owner, 'comment_' || new.kind, v_title, new.body, v_link, new.user_id, v_tut, 'comment');
  else
    select title, user_id into v_ttitle, v_owner from public.kb_requests where id = new.request_id;
    v_link := '/comunidade/pedido/' || new.request_id;
    perform public.kb_notify(v_owner, 'request_comment', coalesce(v_name,'Alguém') || ' respondeu ao seu pedido “' || v_ttitle || '”',
      new.body, v_link, new.user_id, null, 'comment');
  end if;
  if new.parent_id is not null then
    select user_id into v_parent from public.kb_comments where id = new.parent_id;
    if v_parent is distinct from v_owner then
      perform public.kb_notify(v_parent, 'reply', coalesce(v_name,'Alguém') || ' respondeu seu comentário', new.body, v_link, new.user_id, v_tut, 'comment');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists kb_comments_notify on public.kb_comments;
create trigger kb_comments_notify after insert on public.kb_comments
  for each row execute function public.kb_comments_notify();

-- Feedback negativo avisa o autor
create or replace function public.kb_feedback_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare t record; v_name text;
begin
  new.updated_at := now();
  if new.helpful then return new; end if;
  if tg_op = 'UPDATE' and old.helpful = new.helpful then return new; end if;
  select title, short_code, author_id into t from public.kb_tutorials where id = new.tutorial_id;
  select full_name into v_name from public.kb_profiles where id = new.user_id;
  perform public.kb_notify(t.author_id, 'not_helpful', coalesce(v_name,'Alguém') || ' marcou que “' || t.title || '” não funcionou',
    'Veja os comentários e confira se algum passo precisa ser atualizado.', '/t/' || t.short_code || '#comentarios', new.user_id, new.tutorial_id, 'comment');
  return new;
end $$;
drop trigger if exists kb_feedback_notify on public.kb_feedback;
create trigger kb_feedback_notify before insert or update on public.kb_feedback
  for each row execute function public.kb_feedback_notify();

-- Pedido novo (avisa quem segue a categoria) e pedido atendido
create or replace function public.kb_requests_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; v_name text; t record;
begin
  if tg_op = 'INSERT' then
    select full_name into v_name from public.kb_profiles where id = new.user_id;
    for r in select distinct user_id from public.kb_follows where category_id = new.category_id and new.category_id is not null loop
      perform public.kb_notify(r.user_id, 'new_request', coalesce(v_name,'Alguém') || ' pediu um tutorial: ' || new.title,
        new.details, '/comunidade/pedido/' || new.id, new.user_id, null, 'request');
    end loop;
  elsif new.status = 'answered' and old.status <> 'answered' and new.tutorial_id is not null then
    select title, short_code into t from public.kb_tutorials where id = new.tutorial_id;
    select full_name into v_name from public.kb_profiles where id = new.answered_by;
    for r in select new.user_id as user_id union select user_id from public.kb_request_votes where request_id = new.id loop
      perform public.kb_notify(r.user_id, 'request_answered', 'Pedido atendido: ' || new.title,
        coalesce(v_name,'Um colega') || ' publicou “' || t.title || '”.', '/t/' || t.short_code, new.answered_by, new.tutorial_id, 'request');
    end loop;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists kb_requests_notify_ins on public.kb_requests;
create trigger kb_requests_notify_ins after insert on public.kb_requests for each row execute function public.kb_requests_notify();
drop trigger if exists kb_requests_notify_upd on public.kb_requests;
create trigger kb_requests_notify_upd before update on public.kb_requests for each row execute function public.kb_requests_notify();

-- Atender pedido com um tutorial (qualquer membro, desde que seja autor do tutorial)
create or replace function public.kb_answer_request(p_request uuid, p_tutorial uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.kb_is_member() then raise exception 'sem permissão'; end if;
  if not exists (select 1 from public.kb_tutorials where id = p_tutorial and (author_id = auth.uid() or public.kb_is_moderator())) then
    raise exception 'Você só pode vincular um tutorial seu';
  end if;
  update public.kb_requests set status = 'answered', tutorial_id = p_tutorial, answered_by = auth.uid()
   where id = p_request and status = 'open';
end $$;

-- ---------- Visualizações recentes do próprio usuário ------------------
create or replace function public.kb_my_recent(p_limit int default 12)
returns table (tutorial_id uuid, last_viewed timestamptz)
language sql stable security invoker set search_path = public as $$
  select tutorial_id, max(viewed_at) from public.kb_views where user_id = auth.uid()
  group by tutorial_id order by max(viewed_at) desc limit p_limit
$$;

-- ---------- Lista de tutoriais com estatísticas da comunidade ----------
create view public.kb_tutorials_list with (security_invoker = true) as
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
       (select count(*) from public.kb_comments m where m.tutorial_id = t.id and m.kind = 'outdated' and not m.resolved) as outdated_count
from public.kb_tutorials t
join public.kb_profiles a on a.id = t.author_id
left join public.kb_categories c on c.id = t.category_id;
grant select on public.kb_tutorials_list to authenticated;
revoke all on public.kb_tutorials_list from anon;

-- ---------- Reputação da comunidade ------------------------------------
create or replace view public.kb_user_stats with (security_invoker = true) as
select p.id as user_id, p.full_name, p.avatar_url, p.email, p.role, p.created_at,
  coalesce(t.n, 0) as tutorials,
  coalesce(h.n, 0) as helpful_received,
  coalesce(cm.n, 0) as comments,
  coalesce(ra.n, 0) as requests_answered,
  coalesce(v.n, 0) as views_received,
  coalesce(fo.n, 0) as followers,
  (coalesce(t.n,0) * 10 + coalesce(h.n,0) * 3 + coalesce(cm.n,0) + coalesce(ra.n,0) * 15 + coalesce(v.n,0) / 10)::int as points
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

-- ---------- Busca inteligente -------------------------------------------
-- Junta: texto completo (com radical e sem acento), prefixo enquanto digita,
-- tolerância a erros de digitação (trigramas), anexos, links, comentários, pedidos e pessoas.
create or replace function public.kb_search(p_query text, p_limit int default 30, p_log boolean default false)
returns table (kind text, id uuid, short_code text, title text, snippet text, category_name text,
               category_color text, category_icon text, author_name text, author_avatar text,
               matched_in text, score real, created_at timestamptz)
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
      tut.created_at
    from tut
    where tut.search @@ tsq or tut.fuzzy > 0.3 or tut.norm_title like '%' || nq || '%'
       or tut.att is not null or tut.lnk is not null or tut.cmt is not null

    union all
    select 'request', r.id, null, r.title, coalesce(left(r.details, 160), ''), c.name, c.color, c.icon, p.full_name, p.avatar_url,
      case r.status when 'answered' then 'pedido atendido' else 'pedido em aberto' end,
      (greatest(similarity(public.kb_norm(r.title), nq), word_similarity(nq, public.kb_norm(r.title))) * 1.5)::real, r.created_at
    from public.kb_requests r join public.kb_profiles p on p.id = r.user_id left join public.kb_categories c on c.id = r.category_id
    where public.kb_norm(r.title || ' ' || coalesce(r.details,'')) like '%' || nq || '%'
       or word_similarity(nq, public.kb_norm(r.title)) > 0.35

    union all
    select 'person', p.id, null, p.full_name, p.email, null, null, null, null, p.avatar_url, 'pessoa',
      (greatest(similarity(public.kb_norm(p.full_name), nq), word_similarity(nq, public.kb_norm(p.full_name))))::real, p.created_at
    from public.kb_profiles p
    where p.role in ('admin','field_admin','field')
      and (public.kb_norm(p.full_name || ' ' || p.email) like '%' || nq || '%' or word_similarity(nq, public.kb_norm(p.full_name)) > 0.45)
  ) res
  order by 12 desc
  limit p_limit;

  if p_log then
    insert into public.kb_search_log (user_id, query, results)
    values (auth.uid(), left(trim(p_query), 200), (select count(*) from public.kb_tutorials t where t.search @@ tsq));
  end if;
end $$;

-- Sugestões: buscas populares, tags mais usadas e buscas sem resultado (para quem modera)
create or replace function public.kb_search_suggestions()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.kb_is_member() then '{}'::jsonb else jsonb_build_object(
    'popular', coalesce((select jsonb_agg(q) from (
        select lower(query) q from public.kb_search_log where created_at > now() - interval '60 days' and results > 0
        group by lower(query) order by count(*) desc limit 8) s), '[]'::jsonb),
    'tags', coalesce((select jsonb_agg(tag) from (
        select tag, count(*) from public.kb_tutorials, unnest(tags) tag where status = 'published'
        group by tag order by count(*) desc limit 12) s), '[]'::jsonb),
    'missing', case when public.kb_is_moderator() then coalesce((select jsonb_agg(jsonb_build_object('q', q, 'n', n)) from (
        select lower(query) q, count(*) n from public.kb_search_log where created_at > now() - interval '60 days' and results = 0
        group by lower(query) order by count(*) desc limit 10) s), '[]'::jsonb) else '[]'::jsonb end
  ) end
$$;

-- ---------- Grants ------------------------------------------------------
revoke all on function public.kb_notify(uuid, text, text, text, text, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.kb_pref(uuid, text) from public, anon, authenticated;
revoke all on function public.kb_notifications_push() from public, anon, authenticated;
revoke all on function public.kb_tutorials_notify() from public, anon, authenticated;
revoke all on function public.kb_comments_notify() from public, anon, authenticated;
revoke all on function public.kb_feedback_notify() from public, anon, authenticated;
revoke all on function public.kb_requests_notify() from public, anon, authenticated;
revoke all on function public.kb_answer_request(uuid, uuid) from public, anon;
revoke all on function public.kb_my_recent(int) from public, anon;
revoke all on function public.kb_search(text, int, boolean) from public, anon;
revoke all on function public.kb_search_suggestions() from public, anon;
grant execute on function public.kb_answer_request(uuid, uuid), public.kb_my_recent(int),
  public.kb_search(text, int, boolean), public.kb_search_suggestions() to authenticated;

-- Vídeos curtos gravados no celular vão para o bucket de mídia
update storage.buckets set file_size_limit = 52428800 where id = 'kb-images';

-- Notificações em tempo real
do $$ begin
  alter publication supabase_realtime add table public.kb_notifications;
exception when duplicate_object then null; end $$;

-- Segredos do push (gerados no próprio banco; as chaves VAPID são criadas pela Edge Function kb-push)
insert into public.kb_private(key, value) values
  ('push_secret', encode(extensions.gen_random_bytes(32), 'hex')),
  ('push_function_url', 'https://wrmlmtxkukjxkivtsuex.supabase.co/functions/v1/kb-push'),
  ('app_url', 'https://hfa90.github.io/fields-quallit')
on conflict (key) do nothing;
