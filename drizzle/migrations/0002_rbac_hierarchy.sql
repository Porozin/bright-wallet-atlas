-- Migração 0002: Gestão Hierárquica de Usuários e Permissões (RBAC)

-- 1. Políticas atualizadas para visualização e alteração de papéis (user_roles)
-- Permitir que Admin e Diretor vejam todos os usuários e seus papéis
drop policy if exists "See own roles or admin sees all" on public.user_roles;
create policy "Ver papeis proprios ou gestores veem todos" on public.user_roles
  for select to authenticated
  using (
    auth.uid() = user_id 
    or public.has_role(auth.uid(), 'admin') 
    or public.has_role(auth.uid(), 'diretor')
    or public.has_role(auth.uid(), 'conselheiro')
  );

-- Admin e Diretor podem gerenciar papéis (com restrição: Diretor não pode criar Admin)
drop policy if exists "Admins add roles" on public.user_roles;
create policy "Gestores adicionam papeis" on public.user_roles
  for insert to authenticated
  with check (
    public.has_role(auth.uid(), 'admin')
    or (
      public.has_role(auth.uid(), 'diretor') 
      and role in ('diretor', 'conselheiro', 'desbravador')
    )
    or (
      public.has_role(auth.uid(), 'conselheiro')
      and role = 'desbravador'
    )
  );

drop policy if exists "Admins remove roles" on public.user_roles;
create policy "Gestores removem papeis" on public.user_roles
  for delete to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or (
      public.has_role(auth.uid(), 'diretor') 
      and role != 'admin'
    )
    or (
      public.has_role(auth.uid(), 'conselheiro')
      and role = 'desbravador'
    )
  );

-- 2. Modificar trigger de novo usuário para entrar como 'pendente' ou 'desbravador'
-- Primeiro usuário vira Admin; os demais entram com status 'desbravador'
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email), 
    new.raw_user_meta_data->>'avatar_url'
  );

  insert into public.user_roles (user_id, role)
  values (
    new.id, 
    case 
      when not exists (select 1 from public.user_roles where role = 'admin') then 'admin'::public.app_role 
      else 'desbravador'::public.app_role 
    end
  );
  return new;
end; $$;
