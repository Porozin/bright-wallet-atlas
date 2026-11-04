-- Migração complementar: Metas, Materiais/Almoxarifado, Produtos, Avarias, Dívidas e Unidades

-- 1. Metas (Clube, Doceria, Vendas e Unidades)
create table if not exists public.metas (
  id uuid primary key default gen_random_uuid(),
  modulo text not null check (modulo in ('clube', 'doceria', 'vendas', 'unidade')),
  unidade_nome text,
  descricao text not null,
  valor_alvo numeric(12,2) not null check (valor_alvo > 0),
  status text not null default 'aprovada' check (status in ('pendente', 'aprovada', 'concluida')),
  sugerido_por text,
  created_at timestamptz not null default now()
);
grant all on public.metas to authenticated;
alter table public.metas enable row level security;
create policy "Todos autenticados leem metas" on public.metas for select to authenticated using (true);
create policy "Gestores criam e editam metas" on public.metas for all to authenticated
  using (public.can_manage_cash(auth.uid())) with check (public.can_manage_cash(auth.uid()));

-- 2. Materiais / Estoque / Almoxarifado (Clube e Doceria)
create table if not exists public.materiais (
  id uuid primary key default gen_random_uuid(),
  modulo text not null check (modulo in ('clube', 'doceria')),
  nome text not null,
  quantidade numeric(10,2) not null default 1,
  custo_total numeric(12,2) not null default 0,
  unidade_medida text default 'un',
  created_at timestamptz not null default now()
);
grant all on public.materiais to authenticated;
alter table public.materiais enable row level security;
create policy "Todos autenticados leem materiais" on public.materiais for select to authenticated using (true);
create policy "Gestores gerenciam materiais" on public.materiais for all to authenticated
  using (public.can_manage_cash(auth.uid())) with check (public.can_manage_cash(auth.uid()));

-- 3. Produtos (Vendas Rápidas / Tortinhas / Eventos)
create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  preco_venda numeric(12,2) not null check (preco_venda >= 0),
  custo numeric(12,2) not null default 0,
  comissao numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
grant all on public.produtos to authenticated;
alter table public.produtos enable row level security;
create policy "Todos autenticados leem produtos" on public.produtos for select to authenticated using (true);
create policy "Gestores gerenciam produtos" on public.produtos for all to authenticated
  using (public.can_manage_cash(auth.uid())) with check (public.can_manage_cash(auth.uid()));

-- 4. Avarias e Perdas
create table if not exists public.avarias (
  id uuid primary key default gen_random_uuid(),
  produto_nome text not null,
  quantidade integer not null check (quantidade > 0),
  perda_estimada numeric(12,2) not null default 0,
  motivo text,
  data date not null default current_date,
  created_at timestamptz not null default now()
);
grant all on public.avarias to authenticated;
alter table public.avarias enable row level security;
create policy "Todos autenticados leem avarias" on public.avarias for select to authenticated using (true);
create policy "Gestores registram avarias" on public.avarias for all to authenticated
  using (public.can_manage_cash(auth.uid())) with check (public.can_manage_cash(auth.uid()));

-- 5. Controle Interno / Dívidas e Repasses
create table if not exists public.dividas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  valor numeric(12,2) not null check (valor > 0),
  data date not null default current_date,
  status text not null default 'pendente' check (status in ('pendente', 'pago')),
  obs text,
  created_at timestamptz not null default now()
);
grant all on public.dividas to authenticated;
alter table public.dividas enable row level security;
create policy "Admins e diretores gerenciam dividas" on public.dividas for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'diretor'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'diretor'));

-- Realtime para as novas tabelas
alter publication supabase_realtime add table public.metas;
alter publication supabase_realtime add table public.materiais;
alter publication supabase_realtime add table public.produtos;
alter publication supabase_realtime add table public.avarias;
alter publication supabase_realtime add table public.dividas;
