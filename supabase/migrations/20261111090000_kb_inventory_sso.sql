-- Usuários ativos do Inventário entram direto na Central com o mesmo login.
--   inventário papel = 'admin' -> field_admin
--   inventário papel = outro   -> field
--   inventário inativo / inexistente -> pending (precisa de aprovação)
-- Só promove quem está 'pending'; nunca altera quem um admin já definiu/bloqueou.

create or replace function public.kb_role_from_inventory(p_user uuid)
returns public.kb_role
language sql stable security definer set search_path = public
as $$
  select case when p.papel = 'admin' then 'field_admin'::public.kb_role else 'field'::public.kb_role end
  from public.perfis p
  where p.user_id = p_user and coalesce(p.ativo, false)
  limit 1
$$;
revoke all on function public.kb_role_from_inventory(uuid) from public, anon, authenticated;

create or replace function public.kb_ensure_profile()
returns public.kb_profiles
language plpgsql security definer set search_path = public
as $$
declare u auth.users; p public.kb_profiles; inv public.kb_role; inv_name text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  inv := public.kb_role_from_inventory(auth.uid());
  select nullif(trim(nome), '') into inv_name from public.perfis where user_id = auth.uid() limit 1;

  select * into p from public.kb_profiles where id = auth.uid();
  if found then
    if p.role <> 'admin' and public.kb_is_owner_email(p.email) then
      update public.kb_profiles set role = 'admin' where id = p.id returning * into p;
    elsif p.role = 'pending' and inv is not null then
      update public.kb_profiles
         set role = inv, full_name = coalesce(nullif(p.full_name, split_part(p.email,'@',1)), inv_name, p.full_name)
       where id = p.id returning * into p;
    end if;
    return p;
  end if;

  select * into u from auth.users where id = auth.uid();
  insert into public.kb_profiles (id, email, full_name, role)
  values (u.id, u.email,
          coalesce(u.raw_user_meta_data->>'full_name', inv_name, split_part(u.email,'@',1)),
          case when public.kb_is_owner_email(u.email) then 'admin'::public.kb_role
               else coalesce(inv, 'pending'::public.kb_role) end)
  returning * into p;
  return p;
end $$;
revoke execute on function public.kb_ensure_profile() from public, anon;
grant execute on function public.kb_ensure_profile() to authenticated;

-- O guard de papéis bloqueia mudanças feitas pelo próprio usuário; a promoção
-- automática acontece dentro de kb_ensure_profile (security definer), então
-- liberamos esse caminho específico via flag de transação.
create or replace function public.kb_profiles_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.updated_at := now();
  if auth.uid() is null then return new; end if;
  if new.role is distinct from old.role or new.email is distinct from old.email then
    -- promoção automática: pending -> papel do inventário, ou dono -> admin
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
revoke all on function public.kb_profiles_guard() from public, anon, authenticated;
