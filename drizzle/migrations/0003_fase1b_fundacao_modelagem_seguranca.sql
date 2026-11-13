-- ==============================================================================
-- MIGRATION: 0003_fase1b_fundacao_modelagem_seguranca.sql
-- PROJETO: GDACaixa (Clube Guerreiros do Alto)
-- STATUS: PROPOSTA TÉCNICA NÃO APLICADA (Aguardando Aprovação)
-- ==============================================================================

-- 1. ATUALIZAÇÃO DO ENUM DE PAPÉIS (RBAC)
-- Adiciona o cargo fundamental 'tesoureiro' se ainda não existir
alter type public.app_role add value if not exists 'tesoureiro';

-- 2. TABELA DE DOMÍNIO: OS TRÊS CAIXAS FIXOS DO CLUBE
create table if not exists public.cash_boxes (
  id text primary key check (id in ('geral', 'doceria', 'vendas')),
  name text not null,
  description text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Popula os 3 caixas fixos obrigatórios
insert into public.cash_boxes (id, name, description)
values
  ('geral', 'Caixa Geral', 'Caixa principal do clube: mensalidades, doações, taxas e patrimônio geral.'),
  ('doceria', 'Doceria do Clube', 'Caixa dedicado à produção, venda de doces e arrecadação de eventos de doceria.'),
  ('vendas', 'Vendas Rápidas', 'Caixa de produtos rápidos, eventos e vendas externas com comissões.')
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description;

grant select on public.cash_boxes to authenticated;
alter table public.cash_boxes enable row level security;
create policy "Todos autenticados consultam caixas" on public.cash_boxes
  for select to authenticated using (true);

-- 3. EVOLUÇÃO SEGURA DA TABELA TRANSACTIONS (ADITIVA E NÃO-DESTRUTIVA)
alter table public.transactions
  add column if not exists client_mutation_id text unique,
  add column if not exists cash_box_id text references public.cash_boxes(id),
  add column if not exists amount_cents bigint,
  add column if not exists status text not null default 'confirmado' check (status in ('pendente', 'confirmado', 'estornado', 'corrigido')),
  add column if not exists payment_method text not null default 'dinheiro' check (payment_method in ('dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'outro')),
  add column if not exists destination_cash_box_id text references public.cash_boxes(id),
  add column if not exists original_transaction_id uuid references public.transactions(id),
  add column if not exists reverse_reason text,
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists updated_at timestamptz not null default now();

-- 4. MIGRAÇÃO DE DADOS ANTIGOS E POPULAÇÃO DE AMOUNT_CENTS
-- Mapeia módulo legado ('clube' -> 'geral', 'doceria' -> 'doceria', 'vendas' -> 'vendas')
update public.transactions
set cash_box_id = case
  when module = 'clube' then 'geral'
  when module in ('doceria', 'vendas') then module
  else 'geral'
end
where cash_box_id is null;

-- Converte amount float legado para centavos inteiros com precisão
update public.transactions
set amount_cents = round(amount * 100)::bigint
where amount_cents is null;

-- Garante constraint de obrigatoriedade para futuros lançamentos
alter table public.transactions alter column amount_cents set not null;
alter table public.transactions alter column cash_box_id set not null;

-- 5. TABELA DE RESERVAS DE SALDO (COMPROMETIMENTO ORÇAMENTÁRIO)
create table if not exists public.transaction_reservations (
  id uuid primary key default gen_random_uuid(),
  cash_box_id text not null references public.cash_boxes(id),
  title text not null,
  description text,
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'ativa' check (status in ('ativa', 'liberada', 'consumida')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

grant all on public.transaction_reservations to authenticated;
alter table public.transaction_reservations enable row level security;

-- 6. TABELA DE AUDITORIA DE TRANSAÇÕES FINANCEIRAS
create table if not exists public.transaction_audit_logs (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  action text not null check (action in ('INSERT', 'UPDATE', 'ESTORNO')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid default auth.uid() references auth.users(id),
  changed_at timestamptz not null default now()
);

grant select on public.transaction_audit_logs to authenticated;
alter table public.transaction_audit_logs enable row level security;

-- 7. FUNÇÕES AUXILIARES DE SEGURANÇA (SERVER-SIDE)
create or replace function public.is_financial_manager(_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('admin', 'diretor', 'tesoureiro')
  )
$$;

-- 8. POLÍTICAS DE SEGURANÇA RLS REVISADAS E CORRIGIDAS

-- A. TRANSACTIONS
-- Leitura: Membros autorizados (Gestores veem tudo; Membros/Conselheiros veem lançamentos oficiais e seus próprios registros)
drop policy if exists "Cash team sees all, others see own" on public.transactions;
drop policy if exists "Autenticados leem movimentacoes oficiais" on public.transactions;
create policy "Membros consultam transacoes autorizadas" on public.transactions
  for select to authenticated
  using (
    public.is_financial_manager(auth.uid())
    or status = 'confirmado'
    or created_by = auth.uid()
  );

-- Inserção: Gestores gravam como confirmado; Conselheiros gravam exclusivamente como pendente
drop policy if exists "Cash team records" on public.transactions;
drop policy if exists "Gestores inserem transacoes oficiais" on public.transactions;
create policy "Regras de insercao de transacoes" on public.transactions
  for insert to authenticated
  with check (
    -- Gestores Financeiros gravam diretamente lançamentos confirmados
    (public.is_financial_manager(auth.uid()) and status in ('confirmado', 'pendente'))
    -- Conselheiros submetem exclusivamente solicitações preliminares pendentes
    or (public.has_role(auth.uid(), 'conselheiro') and status = 'pendente' and kind = 'despesa')
  );

-- Atualização: Apenas gestores financeiros podem atualizar status ou registrar estornos
drop policy if exists "Admins edit" on public.transactions;
drop policy if exists "Gestores atualizam ou estornam" on public.transactions;
create policy "Apenas gestores atualizam transacoes" on public.transactions
  for update to authenticated
  using (public.is_financial_manager(auth.uid()))
  with check (public.is_financial_manager(auth.uid()));

-- Exclusão Física: TOTALMENTE BLOQUEADA. Transações oficiais devem ser estornadas, nunca apagadas.
drop policy if exists "Admins delete" on public.transactions;

-- B. RESERVAS
create policy "Membros consultam reservas ativas" on public.transaction_reservations
  for select to authenticated using (true);

create policy "Gestores administram reservas" on public.transaction_reservations
  for all to authenticated
  using (public.is_financial_manager(auth.uid()))
  with check (public.is_financial_manager(auth.uid()));

-- C. AUDITORIA
create policy "Gestores consultam logs de auditoria" on public.transaction_audit_logs
  for select to authenticated
  using (public.is_financial_manager(auth.uid()));
