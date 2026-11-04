create type public.app_role as enum ('admin', 'diretor', 'conselheiro', 'desbravador');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select, insert, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create or replace function public.can_manage_cash(_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin','diretor','conselheiro')) $$;

create policy "Profiles visible to signed-in users" on public.profiles for select to authenticated using (true);
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "See own roles or admin sees all" on public.user_roles for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "Admins add roles" on public.user_roles for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins remove roles" on public.user_roles for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- New user: profile from Google data; first user becomes admin, others desbravador
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email), new.raw_user_meta_data->>'avatar_url');
  insert into public.user_roles (user_id, role)
  values (new.id, case when exists (select 1 from public.user_roles where role = 'admin') then 'desbravador'::public.app_role else 'admin'::public.app_role end);
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  module text not null check (module in ('clube','doceria','vendas')),
  kind text not null check (kind in ('receita','despesa')),
  amount numeric(12,2) not null check (amount > 0),
  category text not null default 'Geral',
  description text not null,
  date date not null default current_date,
  seller text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.transactions to authenticated;
grant all on public.transactions to service_role;
alter table public.transactions enable row level security;

create policy "Cash team sees all, others see own" on public.transactions for select to authenticated
  using (public.can_manage_cash(auth.uid()) or created_by = auth.uid());
create policy "Cash team records" on public.transactions for insert to authenticated
  with check (public.can_manage_cash(auth.uid()) and created_by = auth.uid());
create policy "Admins edit" on public.transactions for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete" on public.transactions for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

alter publication supabase_realtime add table public.transactions;