-- =====================================================================
-- Locais próprios do Fields (estado/CD criados pelo administrador)
-- Ficam só na central: não alteram a tabela de CDs do Inventário.
-- kb_profiles.cd_id passa a aceitar um CD do Inventário OU um local do Fields.
-- =====================================================================

create table if not exists public.kb_locations (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 2 and 80),
  uf text not null check (uf in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  cidade text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists kb_locations_nome_key on public.kb_locations (upper(trim(nome)));

alter table public.kb_locations enable row level security;
drop policy if exists kb_locations_select on public.kb_locations;
create policy kb_locations_select on public.kb_locations for select to authenticated using (public.kb_is_member());
drop policy if exists kb_locations_admin on public.kb_locations;
create policy kb_locations_admin on public.kb_locations for all to authenticated using (public.kb_is_admin()) with check (public.kb_is_admin());
grant select, insert, update, delete on public.kb_locations to authenticated;
revoke all on public.kb_locations from anon;

-- cd_id: agora pode apontar para public.cds ou kb_locations (validado por gatilho)
alter table public.kb_profiles drop constraint if exists kb_profiles_cd_id_fkey;

create or replace function public.kb_profiles_cd_check()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.cd_id is not null
     and not exists (select 1 from public.cds where id = new.cd_id)
     and not exists (select 1 from public.kb_locations where id = new.cd_id) then
    raise exception 'CD inválido';
  end if;
  return new;
end $$;
drop trigger if exists kb_profiles_cd_check on public.kb_profiles;
create trigger kb_profiles_cd_check before insert or update of cd_id on public.kb_profiles
  for each row execute function public.kb_profiles_cd_check();

-- ao excluir um local, desvincula os Fields
create or replace function public.kb_locations_unlink()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.kb_profiles set cd_id = null where cd_id = old.id;
  return old;
end $$;
drop trigger if exists kb_locations_unlink on public.kb_locations;
create trigger kb_locations_unlink before delete on public.kb_locations
  for each row execute function public.kb_locations_unlink();

create or replace function public.kb_cd_of(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select c.nome from public.kb_profiles k join public.cds c on c.id = k.cd_id where k.id = p_user),
    (select l.nome from public.kb_profiles k join public.kb_locations l on l.id = k.cd_id where k.id = p_user),
    (select c.nome from public.perfis p join public.cds c on c.id = p.cd_id where p.user_id = p_user limit 1))
$$;

drop function if exists public.kb_list_cds();
create function public.kb_list_cds()
returns table (id uuid, codigo text, nome text, cidade text, uf text, origem text)
language sql stable security definer set search_path = public as $$
  select * from (
    select c.id, c.codigo, c.nome, c.cidade, c.uf, 'inventario'::text as origem from public.cds c
    where coalesce(c.ativo, true)
    union all
    select l.id, null::text, l.nome, l.cidade, l.uf, 'fields'::text from public.kb_locations l
  ) x
  where public.kb_is_member()
  order by x.nome
$$;
revoke all on function public.kb_list_cds() from public, anon;
grant execute on function public.kb_list_cds() to authenticated;
