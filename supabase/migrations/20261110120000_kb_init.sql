-- =====================================================================
-- Fields Quallit — Central de Tutoriais (Knowledge Base)
-- Todas as tabelas usam o prefixo kb_ para conviver com outros sistemas
-- no mesmo projeto Supabase.
-- =====================================================================

-- ---------- Papéis ----------------------------------------------------
-- admin        : administrador geral (gerencia usuários e tudo)
-- field_admin  : field administrador (modera qualquer tutorial e categorias)
-- field        : field comum (cria e edita os próprios tutoriais)
-- pending      : cadastrou-se e aguarda aprovação
-- blocked      : acesso bloqueado
do $$ begin
  create type public.kb_role as enum ('admin','field_admin','field','pending','blocked');
exception when duplicate_object then null; end $$;

-- ---------- Perfis ----------------------------------------------------
create table if not exists public.kb_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  role        public.kb_role not null default 'pending',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Configuração: e-mails que são sempre administradores
create table if not exists public.kb_settings (
  key   text primary key,
  value jsonb not null
);
insert into public.kb_settings(key, value)
values ('owner_emails', '["haydenfernandes.ti@gmail.com"]'::jsonb)
on conflict (key) do nothing;

-- ---------- Helpers (security definer, sem recursão de RLS) -----------
create or replace function public.kb_current_role()
returns public.kb_role
language sql stable security definer set search_path = public
as $$ select role from public.kb_profiles where id = auth.uid() $$;

create or replace function public.kb_is_member()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.kb_current_role() in ('admin','field_admin','field'), false) $$;

create or replace function public.kb_is_moderator()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.kb_current_role() in ('admin','field_admin'), false) $$;

create or replace function public.kb_is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.kb_current_role() = 'admin', false) $$;

create or replace function public.kb_is_owner_email(p_email text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.kb_settings s, jsonb_array_elements_text(s.value) e
    where s.key = 'owner_emails' and lower(e) = lower(p_email)
  )
$$;

-- Cria perfil automaticamente ao cadastrar
create or replace function public.kb_handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.kb_profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'avatar_url',
    case when public.kb_is_owner_email(new.email) then 'admin'::public.kb_role else 'pending'::public.kb_role end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists kb_on_auth_user_created on auth.users;
create trigger kb_on_auth_user_created
  after insert on auth.users
  for each row execute function public.kb_handle_new_user();

-- Usuários que já existiam no projeto (ex.: inventário) entram como pendentes
create or replace function public.kb_ensure_profile()
returns public.kb_profiles
language plpgsql security definer set search_path = public
as $$
declare u auth.users; p public.kb_profiles;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into p from public.kb_profiles where id = auth.uid();
  if found then
    -- o dono sempre é admin
    if p.role <> 'admin' and public.kb_is_owner_email(p.email) then
      update public.kb_profiles set role = 'admin' where id = p.id returning * into p;
    end if;
    return p;
  end if;
  select * into u from auth.users where id = auth.uid();
  insert into public.kb_profiles (id, email, full_name, role)
  values (u.id, u.email,
          coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email,'@',1)),
          case when public.kb_is_owner_email(u.email) then 'admin'::public.kb_role else 'pending'::public.kb_role end)
  returning * into p;
  return p;
end $$;

-- Impede que usuário comum altere o próprio papel/e-mail
create or replace function public.kb_profiles_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.updated_at := now();
  if auth.uid() is null then return new; end if; -- service role / SQL
  if new.role is distinct from old.role or new.email is distinct from old.email then
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

drop trigger if exists kb_profiles_guard on public.kb_profiles;
create trigger kb_profiles_guard before update on public.kb_profiles
  for each row execute function public.kb_profiles_guard();

-- ---------- Categorias ------------------------------------------------
create table if not exists public.kb_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  icon        text not null default 'folder',
  color       text not null default '#6366f1',
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

insert into public.kb_categories (name, icon, color, sort_order) values
  ('Redes & VPN',        'network',   '#0ea5e9', 1),
  ('Sistemas Operacionais','monitor', '#8b5cf6', 2),
  ('Hardware',           'cpu',       '#f59e0b', 3),
  ('Software & Apps',    'app-window','#10b981', 4),
  ('Impressoras',        'printer',   '#ef4444', 5),
  ('Segurança',          'shield',    '#14b8a6', 6),
  ('Contas & Acessos',   'key-round', '#ec4899', 7),
  ('Outros',             'folder',    '#64748b', 99)
on conflict (name) do nothing;

-- ---------- Tutoriais -------------------------------------------------
create or replace function public.kb_random_code(len int default 6)
returns text language plpgsql volatile as $$
declare
  chars text := 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
begin
  for i in 1..len loop
    result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  end loop;
  return result;
end $$;

create or replace function public.kb_tags_text(p text[])
returns text language sql immutable parallel safe as $$ select coalesce(array_to_string(p, ' '), '') $$;

create table if not exists public.kb_tutorials (
  id            uuid primary key default gen_random_uuid(),
  short_code    text not null unique,
  title         text not null check (char_length(title) between 3 and 200),
  summary       text,
  content_html  text not null default '',
  content_json  jsonb,
  category_id   uuid references public.kb_categories(id) on delete set null,
  tags          text[] not null default '{}',
  difficulty    text not null default 'intermediario' check (difficulty in ('basico','intermediario','avancado')),
  status        text not null default 'published' check (status in ('draft','published')),
  author_id     uuid not null references public.kb_profiles(id) on delete restrict default auth.uid(),
  updated_by    uuid references public.kb_profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  search        tsvector generated always as (
    setweight(to_tsvector('portuguese', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(summary,'')), 'B') ||
    setweight(to_tsvector('portuguese', public.kb_tags_text(tags)), 'B') ||
    setweight(to_tsvector('portuguese', regexp_replace(coalesce(content_html,''), '<[^>]+>', ' ', 'g')), 'C')
  ) stored
);
create index if not exists kb_tutorials_search_idx on public.kb_tutorials using gin (search);
create index if not exists kb_tutorials_category_idx on public.kb_tutorials (category_id);
create index if not exists kb_tutorials_author_idx on public.kb_tutorials (author_id);
create index if not exists kb_tutorials_created_idx on public.kb_tutorials (created_at desc);

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
  else
    new.short_code := old.short_code;   -- link curto é imutável
    new.author_id  := old.author_id;
    new.created_at := old.created_at;
    new.updated_at := now();
    new.updated_by := auth.uid();
  end if;
  return new;
end $$;

drop trigger if exists kb_tutorials_before on public.kb_tutorials;
create trigger kb_tutorials_before before insert or update on public.kb_tutorials
  for each row execute function public.kb_tutorials_before();

create or replace function public.kb_can_edit_tutorial(p_tutorial uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.kb_is_moderator()
      or exists (select 1 from public.kb_tutorials t
                 where t.id = p_tutorial and t.author_id = auth.uid() and public.kb_is_member())
$$;

-- ---------- Links -----------------------------------------------------
create table if not exists public.kb_links (
  id          uuid primary key default gen_random_uuid(),
  tutorial_id uuid not null references public.kb_tutorials(id) on delete cascade,
  url         text not null check (url ~* '^https?://'),
  title       text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists kb_links_tutorial_idx on public.kb_links (tutorial_id);

-- ---------- Anexos ----------------------------------------------------
create table if not exists public.kb_attachments (
  id           uuid primary key default gen_random_uuid(),
  tutorial_id  uuid not null references public.kb_tutorials(id) on delete cascade,
  storage_path text not null unique,
  file_name    text not null,
  mime_type    text,
  size_bytes   bigint,
  uploaded_by  uuid references public.kb_profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists kb_attachments_tutorial_idx on public.kb_attachments (tutorial_id);

-- ---------- Visualizações ---------------------------------------------
create table if not exists public.kb_views (
  id           bigint generated always as identity primary key,
  tutorial_id  uuid not null references public.kb_tutorials(id) on delete cascade,
  user_id      uuid not null references public.kb_profiles(id) on delete cascade default auth.uid(),
  via_share    boolean not null default false,
  viewed_at    timestamptz not null default now()
);
create index if not exists kb_views_tutorial_idx on public.kb_views (tutorial_id, viewed_at desc);
create index if not exists kb_views_user_idx on public.kb_views (user_id);

-- Registra visualização (no máximo 1 a cada 10 min por usuário/tutorial)
create or replace function public.kb_register_view(p_tutorial uuid, p_via_share boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.kb_is_member() then return; end if;
  if exists (select 1 from public.kb_views
             where tutorial_id = p_tutorial and user_id = auth.uid()
               and viewed_at > now() - interval '10 minutes') then
    return;
  end if;
  insert into public.kb_views (tutorial_id, user_id, via_share) values (p_tutorial, auth.uid(), p_via_share);
end $$;

-- Quem visualizou um tutorial
create or replace function public.kb_tutorial_viewers(p_tutorial uuid)
returns table (user_id uuid, full_name text, email text, avatar_url text,
               views bigint, first_viewed timestamptz, last_viewed timestamptz, via_share boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.email, p.avatar_url,
         count(*), min(v.viewed_at), max(v.viewed_at), bool_or(v.via_share)
  from public.kb_views v join public.kb_profiles p on p.id = v.user_id
  where v.tutorial_id = p_tutorial and public.kb_is_member()
  group by p.id
  order by max(v.viewed_at) desc
$$;

-- Lista de tutoriais com estatísticas
create or replace view public.kb_tutorials_list
with (security_invoker = true) as
select t.id, t.short_code, t.title, t.summary, t.category_id, t.tags, t.difficulty,
       t.status, t.author_id, t.created_at, t.updated_at, t.search,
       a.full_name as author_name, a.avatar_url as author_avatar,
       c.name as category_name, c.color as category_color, c.icon as category_icon,
       (select count(distinct v.user_id) from public.kb_views v where v.tutorial_id = t.id) as viewer_count,
       (select count(*) from public.kb_views v where v.tutorial_id = t.id) as view_count,
       (select count(*) from public.kb_attachments x where x.tutorial_id = t.id) as attachment_count
from public.kb_tutorials t
join public.kb_profiles a on a.id = t.author_id
left join public.kb_categories c on c.id = t.category_id;

-- ---------- RLS -------------------------------------------------------
alter table public.kb_profiles    enable row level security;
alter table public.kb_settings    enable row level security;
alter table public.kb_categories  enable row level security;
alter table public.kb_tutorials   enable row level security;
alter table public.kb_links       enable row level security;
alter table public.kb_attachments enable row level security;
alter table public.kb_views       enable row level security;

-- perfis
drop policy if exists kb_profiles_select on public.kb_profiles;
create policy kb_profiles_select on public.kb_profiles for select to authenticated
  using (id = auth.uid() or public.kb_is_member());
drop policy if exists kb_profiles_update_self on public.kb_profiles;
create policy kb_profiles_update_self on public.kb_profiles for update to authenticated
  using (id = auth.uid() or public.kb_is_admin())
  with check (id = auth.uid() or public.kb_is_admin());
drop policy if exists kb_profiles_delete_admin on public.kb_profiles;
create policy kb_profiles_delete_admin on public.kb_profiles for delete to authenticated
  using (public.kb_is_admin() and id <> auth.uid());

-- configurações
drop policy if exists kb_settings_admin on public.kb_settings;
create policy kb_settings_admin on public.kb_settings for all to authenticated
  using (public.kb_is_admin()) with check (public.kb_is_admin());

-- categorias
drop policy if exists kb_categories_select on public.kb_categories;
create policy kb_categories_select on public.kb_categories for select to authenticated
  using (public.kb_is_member());
drop policy if exists kb_categories_write on public.kb_categories;
create policy kb_categories_write on public.kb_categories for all to authenticated
  using (public.kb_is_moderator()) with check (public.kb_is_moderator());

-- tutoriais
drop policy if exists kb_tutorials_select on public.kb_tutorials;
create policy kb_tutorials_select on public.kb_tutorials for select to authenticated
  using (public.kb_is_member() and (status = 'published' or author_id = auth.uid() or public.kb_is_moderator()));
drop policy if exists kb_tutorials_insert on public.kb_tutorials;
create policy kb_tutorials_insert on public.kb_tutorials for insert to authenticated
  with check (public.kb_is_member());
drop policy if exists kb_tutorials_update on public.kb_tutorials;
create policy kb_tutorials_update on public.kb_tutorials for update to authenticated
  using (public.kb_is_moderator() or (author_id = auth.uid() and public.kb_is_member()))
  with check (public.kb_is_moderator() or (author_id = auth.uid() and public.kb_is_member()));
drop policy if exists kb_tutorials_delete on public.kb_tutorials;
create policy kb_tutorials_delete on public.kb_tutorials for delete to authenticated
  using (public.kb_is_moderator() or (author_id = auth.uid() and public.kb_is_member()));

-- links
drop policy if exists kb_links_select on public.kb_links;
create policy kb_links_select on public.kb_links for select to authenticated using (public.kb_is_member());
drop policy if exists kb_links_write on public.kb_links;
create policy kb_links_write on public.kb_links for all to authenticated
  using (public.kb_can_edit_tutorial(tutorial_id)) with check (public.kb_can_edit_tutorial(tutorial_id));

-- anexos
drop policy if exists kb_attachments_select on public.kb_attachments;
create policy kb_attachments_select on public.kb_attachments for select to authenticated using (public.kb_is_member());
drop policy if exists kb_attachments_write on public.kb_attachments;
create policy kb_attachments_write on public.kb_attachments for all to authenticated
  using (public.kb_can_edit_tutorial(tutorial_id)) with check (public.kb_can_edit_tutorial(tutorial_id));

-- visualizações (inserção via kb_register_view; leitura para membros)
drop policy if exists kb_views_select on public.kb_views;
create policy kb_views_select on public.kb_views for select to authenticated using (public.kb_is_member());

-- ---------- Grants ----------------------------------------------------
revoke all on function public.kb_handle_new_user() from public, anon, authenticated;
revoke all on function public.kb_profiles_guard() from public, anon, authenticated;
revoke all on function public.kb_tutorials_before() from public, anon, authenticated;
revoke execute on function public.kb_ensure_profile() from public, anon;
revoke execute on function public.kb_register_view(uuid, boolean) from public, anon;
revoke execute on function public.kb_tutorial_viewers(uuid) from public, anon;
grant execute on function public.kb_ensure_profile() to authenticated;
grant execute on function public.kb_register_view(uuid, boolean) to authenticated;
grant execute on function public.kb_tutorial_viewers(uuid) to authenticated;
grant select on public.kb_tutorials_list to authenticated;

-- ---------- Storage ---------------------------------------------------
-- kb-images      : imagens dentro do conteúdo (público, caminhos com UUID)
-- kb-attachments : PDF/Word/PPT etc. (privado, download por URL assinada)
insert into storage.buckets (id, name, public, file_size_limit)
values ('kb-images', 'kb-images', true, 10485760)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit)
values ('kb-attachments', 'kb-attachments', false, 52428800)
on conflict (id) do nothing;

drop policy if exists kb_images_insert on storage.objects;
create policy kb_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'kb-images' and public.kb_is_member());
drop policy if exists kb_images_delete on storage.objects;
create policy kb_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'kb-images' and (owner = auth.uid() or public.kb_is_moderator()));

drop policy if exists kb_att_select on storage.objects;
create policy kb_att_select on storage.objects for select to authenticated
  using (bucket_id = 'kb-attachments' and public.kb_is_member());
drop policy if exists kb_att_insert on storage.objects;
create policy kb_att_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'kb-attachments' and public.kb_is_member());
drop policy if exists kb_att_delete on storage.objects;
create policy kb_att_delete on storage.objects for delete to authenticated
  using (bucket_id = 'kb-attachments' and (owner = auth.uid() or public.kb_is_moderator()));
