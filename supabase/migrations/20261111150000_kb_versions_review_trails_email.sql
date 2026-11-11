-- =====================================================================
-- Histórico de versões, rascunho automático, revisão periódica,
-- trilhas de aprendizado e notificações por e-mail
-- =====================================================================

-- ---------- Revisão periódica (colunas) --------------------------------
alter table public.kb_tutorials
  add column if not exists review_interval_months int not null default 6 check (review_interval_months between 1 and 36),
  add column if not exists reviewed_at timestamptz not null default now(),
  add column if not exists reviewed_by uuid references public.kb_profiles(id) on delete set null,
  add column if not exists review_notified_at timestamptz;

-- Só conta como "editado" quando o conteúdo muda (não quando o sistema mexe em flags)
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
      end if;
    else
      new.updated_at := old.updated_at;
      new.updated_by := old.updated_by;
    end if;
  end if;
  return new;
end $$;

-- ---------- Histórico de versões ---------------------------------------
create table if not exists public.kb_tutorial_versions (
  id           bigint generated always as identity primary key,
  tutorial_id  uuid not null references public.kb_tutorials(id) on delete cascade,
  version      int not null,
  title        text not null,
  summary      text,
  content_html text not null,
  content_json jsonb,
  tags         text[] not null default '{}',
  category_id  uuid,
  difficulty   text,
  status       text,
  note         text,
  edited_by    uuid references public.kb_profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (tutorial_id, version)
);
create index if not exists kb_versions_tutorial_idx on public.kb_tutorial_versions (tutorial_id, version desc);

create or replace function public.kb_tutorials_version()
returns trigger language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if tg_op = 'UPDATE' and (new.title, new.summary, new.content_html, new.tags, new.category_id, new.difficulty)
     is not distinct from (old.title, old.summary, old.content_html, old.tags, old.category_id, old.difficulty) then
    return new;
  end if;
  select coalesce(max(version), 0) + 1 into v from public.kb_tutorial_versions where tutorial_id = new.id;
  insert into public.kb_tutorial_versions (tutorial_id, version, title, summary, content_html, content_json, tags, category_id, difficulty, status, note, edited_by)
  values (new.id, v, new.title, new.summary, new.content_html, new.content_json, new.tags, new.category_id, new.difficulty, new.status,
          nullif(current_setting('kb.version_note', true), ''), coalesce(auth.uid(), new.updated_by, new.author_id));
  return new;
end $$;
drop trigger if exists kb_tutorials_version on public.kb_tutorials;
create trigger kb_tutorials_version after insert or update on public.kb_tutorials
  for each row execute function public.kb_tutorials_version();

-- versão inicial dos tutoriais existentes
insert into public.kb_tutorial_versions (tutorial_id, version, title, summary, content_html, content_json, tags, category_id, difficulty, status, note, edited_by, created_at)
select t.id, 1, t.title, t.summary, t.content_html, t.content_json, t.tags, t.category_id, t.difficulty, t.status, 'Versão inicial', coalesce(t.updated_by, t.author_id), t.updated_at
from public.kb_tutorials t
where not exists (select 1 from public.kb_tutorial_versions v where v.tutorial_id = t.id);

alter table public.kb_tutorial_versions enable row level security;
drop policy if exists kb_versions_select on public.kb_tutorial_versions;
create policy kb_versions_select on public.kb_tutorial_versions for select to authenticated
  using (public.kb_is_member() and exists (select 1 from public.kb_tutorials t where t.id = tutorial_id));

create or replace function public.kb_restore_version(p_version bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v public.kb_tutorial_versions;
begin
  select * into v from public.kb_tutorial_versions where id = p_version;
  if not found then raise exception 'Versão não encontrada'; end if;
  if not public.kb_can_edit_tutorial(v.tutorial_id) then raise exception 'Sem permissão para restaurar'; end if;
  perform set_config('kb.version_note', 'Restaurado da versão ' || v.version, true);
  update public.kb_tutorials set title = v.title, summary = v.summary, content_html = v.content_html, content_json = v.content_json,
    tags = v.tags, category_id = v.category_id, difficulty = v.difficulty
  where id = v.tutorial_id;
  perform set_config('kb.version_note', '', true);
end $$;

-- ---------- Rascunho automático ----------------------------------------
create table if not exists public.kb_autosaves (
  user_id    uuid not null references public.kb_profiles(id) on delete cascade default auth.uid(),
  draft_key  text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, draft_key)
);
alter table public.kb_autosaves enable row level security;
drop policy if exists kb_autosaves_own on public.kb_autosaves;
create policy kb_autosaves_own on public.kb_autosaves for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.kb_is_member());

-- ---------- Revisão: marcar como revisado + lembretes -------------------
create or replace function public.kb_mark_reviewed(p_tutorial uuid, p_resolve_outdated boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.kb_can_edit_tutorial(p_tutorial) then raise exception 'Sem permissão'; end if;
  update public.kb_tutorials set reviewed_at = now(), reviewed_by = auth.uid(), review_notified_at = null where id = p_tutorial;
  if p_resolve_outdated then
    update public.kb_comments set resolved = true, resolved_by = auth.uid()
     where tutorial_id = p_tutorial and kind = 'outdated' and not resolved;
  end if;
end $$;

create or replace function public.kb_send_review_reminders()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in
    select t.id, t.title, t.short_code, t.author_id from public.kb_tutorials t
    where t.status = 'published'
      and t.reviewed_at + make_interval(months => t.review_interval_months) < now()
      and (t.review_notified_at is null or t.review_notified_at < now() - interval '14 days')
  loop
    perform public.kb_notify(r.author_id, 'review_due', 'Hora de revisar: ' || r.title,
      'Confira se os passos continuam válidos e toque em “Marcar como revisado”.', '/t/' || r.short_code, null, r.id, 'update');
    update public.kb_tutorials set review_notified_at = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------- Lista com sinalização de revisão ---------------------------
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
       (t.reviewed_at + make_interval(months => t.review_interval_months) < now()) as review_due
from public.kb_tutorials t
join public.kb_profiles a on a.id = t.author_id
left join public.kb_categories c on c.id = t.category_id;
grant select on public.kb_tutorials_list to authenticated;
revoke all on public.kb_tutorials_list from anon;

-- ---------- Trilhas de aprendizado -------------------------------------
create table if not exists public.kb_trails (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 3 and 150),
  description text,
  color       text not null default '#1a9ca9',
  icon        text not null default 'book-open',
  status      text not null default 'draft' check (status in ('draft','published')),
  created_by  uuid references public.kb_profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create table if not exists public.kb_trail_items (
  id          uuid primary key default gen_random_uuid(),
  trail_id    uuid not null references public.kb_trails(id) on delete cascade,
  tutorial_id uuid not null references public.kb_tutorials(id) on delete cascade,
  position    int not null default 0,
  note        text,
  unique (trail_id, tutorial_id)
);
create table if not exists public.kb_trail_progress (
  trail_id     uuid not null references public.kb_trails(id) on delete cascade,
  tutorial_id  uuid not null references public.kb_tutorials(id) on delete cascade,
  user_id      uuid not null references public.kb_profiles(id) on delete cascade default auth.uid(),
  completed_at timestamptz not null default now(),
  primary key (trail_id, tutorial_id, user_id)
);
alter table public.kb_trails enable row level security;
alter table public.kb_trail_items enable row level security;
alter table public.kb_trail_progress enable row level security;

drop policy if exists kb_trails_select on public.kb_trails;
create policy kb_trails_select on public.kb_trails for select to authenticated
  using (public.kb_is_member() and (status = 'published' or public.kb_is_moderator()));
drop policy if exists kb_trails_write on public.kb_trails;
create policy kb_trails_write on public.kb_trails for all to authenticated
  using (public.kb_is_moderator()) with check (public.kb_is_moderator());
drop policy if exists kb_trail_items_select on public.kb_trail_items;
create policy kb_trail_items_select on public.kb_trail_items for select to authenticated using (public.kb_is_member());
drop policy if exists kb_trail_items_write on public.kb_trail_items;
create policy kb_trail_items_write on public.kb_trail_items for all to authenticated
  using (public.kb_is_moderator()) with check (public.kb_is_moderator());
drop policy if exists kb_trail_progress_select on public.kb_trail_progress;
create policy kb_trail_progress_select on public.kb_trail_progress for select to authenticated using (public.kb_is_member());
drop policy if exists kb_trail_progress_own on public.kb_trail_progress;
create policy kb_trail_progress_own on public.kb_trail_progress for insert to authenticated
  with check (user_id = auth.uid() and public.kb_is_member());
drop policy if exists kb_trail_progress_del on public.kb_trail_progress;
create policy kb_trail_progress_del on public.kb_trail_progress for delete to authenticated using (user_id = auth.uid());

create or replace function public.kb_trails_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  new.updated_at := now();
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    for r in select id from public.kb_profiles where role in ('admin','field_admin','field') loop
      perform public.kb_notify(r.id, 'new_trail', 'Nova trilha de aprendizado: ' || new.title,
        coalesce(new.description, 'Uma sequência de tutoriais para você evoluir.'), '/trilhas/' || new.id, new.created_by, null, 'new');
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists kb_trails_notify on public.kb_trails;
create trigger kb_trails_notify before insert or update on public.kb_trails
  for each row execute function public.kb_trails_notify();

-- ---------- E-mail ------------------------------------------------------
alter table public.kb_notification_prefs
  add column if not exists email_mode text not null default 'daily' check (email_mode in ('off','instant','daily'));
alter table public.kb_notifications add column if not exists emailed_at timestamptz;

create or replace function public.kb_call_function(p_name text, p_body jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_base text; v_secret text;
begin
  select value into v_secret from public.kb_private where key = 'push_secret';
  select regexp_replace(value, '/kb-push$', '') into v_base from public.kb_private where key = 'push_function_url';
  if v_base is null or v_secret is null then return; end if;
  perform net.http_post(url := v_base || '/' || p_name, body := p_body,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-kb-secret', v_secret));
end $$;

create or replace function public.kb_notifications_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.kb_private where key = 'resend_api_key') then return new; end if;
  if coalesce((select email_mode from public.kb_notification_prefs where user_id = new.user_id), 'daily') = 'instant' then
    perform public.kb_call_function('kb-email', jsonb_build_object('notification_id', new.id));
  end if;
  return new;
exception when others then return new;
end $$;
drop trigger if exists kb_notifications_email on public.kb_notifications;
create trigger kb_notifications_email after insert on public.kb_notifications
  for each row execute function public.kb_notifications_email();

create or replace function public.kb_email_digest()
returns void language sql security definer set search_path = public as $$
  select public.kb_call_function('kb-email', jsonb_build_object('digest', true))
  where exists (select 1 from public.kb_private where key = 'resend_api_key')
$$;

-- Configuração do e-mail (somente administrador; a chave nunca é devolvida)
create or replace function public.kb_email_config_set(p_api_key text, p_from text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.kb_is_admin() then raise exception 'Apenas administradores'; end if;
  if coalesce(trim(p_api_key), '') <> '' then
    insert into public.kb_private(key, value) values ('resend_api_key', trim(p_api_key))
    on conflict (key) do update set value = excluded.value;
  end if;
  if coalesce(trim(p_from), '') <> '' then
    insert into public.kb_private(key, value) values ('email_from', trim(p_from))
    on conflict (key) do update set value = excluded.value;
  end if;
end $$;

create or replace function public.kb_email_config_status()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.kb_is_admin() then '{}'::jsonb else jsonb_build_object(
    'configured', exists (select 1 from public.kb_private where key = 'resend_api_key'),
    'from', (select value from public.kb_private where key = 'email_from')) end
$$;

create or replace function public.kb_email_test()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.kb_is_admin() then raise exception 'Apenas administradores'; end if;
  perform public.kb_call_function('kb-email', jsonb_build_object('test_user_id', auth.uid()));
end $$;

-- ---------- Grants ------------------------------------------------------
revoke all on function public.kb_tutorials_version() from public, anon, authenticated;
revoke all on function public.kb_send_review_reminders() from public, anon, authenticated;
revoke all on function public.kb_trails_notify() from public, anon, authenticated;
revoke all on function public.kb_call_function(text, jsonb) from public, anon, authenticated;
revoke all on function public.kb_notifications_email() from public, anon, authenticated;
revoke all on function public.kb_email_digest() from public, anon, authenticated;
revoke all on function public.kb_restore_version(bigint) from public, anon;
revoke all on function public.kb_mark_reviewed(uuid, boolean) from public, anon;
revoke all on function public.kb_email_config_set(text, text) from public, anon;
revoke all on function public.kb_email_config_status() from public, anon;
revoke all on function public.kb_email_test() from public, anon;
grant execute on function public.kb_restore_version(bigint), public.kb_mark_reviewed(uuid, boolean),
  public.kb_email_config_set(text, text), public.kb_email_config_status(), public.kb_email_test() to authenticated;

-- ---------- Agendamentos (08:00 em Brasília) ---------------------------
select cron.unschedule(jobid) from cron.job where jobname in ('kb-review-reminders', 'kb-email-digest');
select cron.schedule('kb-review-reminders', '0 11 * * *', $$select public.kb_send_review_reminders()$$);
select cron.schedule('kb-email-digest', '5 11 * * *', $$select public.kb_email_digest()$$);
