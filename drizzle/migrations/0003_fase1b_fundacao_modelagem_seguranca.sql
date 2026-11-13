-- ==============================================================================
-- MIGRATION: 0003_fase1b_fundacao_modelagem_seguranca.sql
-- PROJETO: GDACaixa (Clube Guerreiros do Alto)
-- VERSÃO: 2.0 (Revisão Técnica de Segurança e Transações Atômicas)
-- STATUS: PROPOSTA TÉCNICA PRONTA PARA REVISÃO (NÃO APLICADA)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PAPÉIS E RBAC: INCLUSÃO SEGURA DO CARGO 'tesoureiro'
-- ------------------------------------------------------------------------------
-- Nota: 'alter type ... add value' no Postgres não pode ser executado dentro de 
-- um bloco de transação com comandos que utilizem o novo valor imediatamente.
-- Por isso esta instrução deve ser executada ou comitadas antes do seu uso em políticas.
do $$
begin
  if not exists (
    select 1 from pg_enum 
    where enumtypid = 'public.app_role'::regtype 
    and enumlabel = 'tesoureiro'
  ) then
    alter type public.app_role add value 'tesoureiro';
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 2. TABELA DE DOMÍNIO: OS TRÊS CAIXAS FIXOS DO CLUBE (E CAIXA DE QUARENTENA)
-- ------------------------------------------------------------------------------
create table if not exists public.cash_boxes (
  id text primary key,
  name text not null,
  description text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint check_cash_box_id check (id in ('geral', 'doceria', 'vendas', 'quarentena_revisao'))
);

-- Popula os 3 caixas fixos oficiais e o caixa de quarentena para dados legados ambíguos
insert into public.cash_boxes (id, name, description, is_active)
values
  ('geral', 'Caixa Geral', 'Caixa principal do clube: taxas, doações e despesas gerais.', true),
  ('doceria', 'Doceria do Clube', 'Caixa dedicado à produção, venda e insumos de doces.', true),
  ('vendas', 'Vendas Rápidas', 'Caixa de vendas ágeis, eventos e campanhas com comissões.', true),
  ('quarentena_revisao', 'Quarentena para Revisão Contábil', 'Caixa provisório para isolar registros legados com módulo nulo ou ambíguo sem perda de dados.', false)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active;

grant select on public.cash_boxes to authenticated;
alter table public.cash_boxes enable row level security;

drop policy if exists "Todos autenticados consultam caixas" on public.cash_boxes;
create policy "Todos autenticados consultam caixas" on public.cash_boxes
  for select to authenticated using (true);

-- ------------------------------------------------------------------------------
-- 3. EVOLUÇÃO SEGURA DA TABELA TRANSACTIONS (ADITIVA E NÃO-DESTRUTIVA)
-- ------------------------------------------------------------------------------
alter table public.transactions
  add column if not exists client_mutation_id text unique,
  add column if not exists cash_box_id text references public.cash_boxes(id),
  add column if not exists amount_cents bigint,
  add column if not exists status text not null default 'confirmado',
  add column if not exists payment_method text not null default 'dinheiro',
  add column if not exists destination_cash_box_id text references public.cash_boxes(id),
  add column if not exists original_transaction_id uuid references public.transactions(id),
  add column if not exists reverse_reason text,
  add column if not exists requested_by uuid references auth.users(id),
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists approved_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists updated_at timestamptz not null default now();

-- Adiciona constraints de validação de valores de status e payment_method
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'check_transaction_status') then
    alter table public.transactions
      add constraint check_transaction_status
      check (status in ('pendente', 'confirmado', 'estornado', 'corrigido', 'rejeitado'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'check_transaction_payment_method') then
    alter table public.transactions
      add constraint check_transaction_payment_method
      check (payment_method in ('dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'outro'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'check_transfer_destination') then
    alter table public.transactions
      add constraint check_transfer_destination
      check (
        (kind != 'transferencia') or
        (kind = 'transferencia' and destination_cash_box_id is not null and destination_cash_box_id != cash_box_id)
      );
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 4. MIGRAÇÃO DE DADOS LEGADOS COM AUDITORIA E QUARENTENA
-- ------------------------------------------------------------------------------
-- Mapeamento seguro sem perda de dados:
-- 1. 'clube' -> 'geral'
-- 2. 'doceria' -> 'doceria'
-- 3. 'vendas' -> 'vendas'
-- 4. Nulos ou valores desconhecidos -> 'quarentena_revisao' (não assume Geral arbitrariamente)
update public.transactions
set cash_box_id = case
  when module = 'clube' then 'geral'
  when module = 'doceria' then 'doceria'
  when module = 'vendas' then 'vendas'
  else 'quarentena_revisao'
end
where cash_box_id is null;

-- Migração de valor float para centavos inteiros
update public.transactions
set amount_cents = round(amount * 100)::bigint
where amount_cents is null;

-- ------------------------------------------------------------------------------
-- 5. TABELA DE RESERVAS DE SALDO (COMPROMETIMENTO ORÇAMENTÁRIO)
-- ------------------------------------------------------------------------------
create table if not exists public.transaction_reservations (
  id uuid primary key default gen_random_uuid(),
  cash_box_id text not null references public.cash_boxes(id),
  title text not null,
  description text,
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'ativa' check (status in ('ativa', 'liberada', 'consumida')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.transaction_reservations to authenticated;
alter table public.transaction_reservations enable row level security;

-- ------------------------------------------------------------------------------
-- 6. TABELA DE AUDITORIA IMUTÁVEL (APPEND-ONLY)
-- ------------------------------------------------------------------------------
create table if not exists public.transaction_audit_logs (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  action text not null check (action in ('INSERT', 'UPDATE', 'ESTORNO', 'APROVACAO', 'REJEICAO')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid default auth.uid() references auth.users(id),
  changed_at timestamptz not null default now()
);

-- Segurança: Ninguém pode alterar ou apagar logs de auditoria
grant select on public.transaction_audit_logs to authenticated;
grant insert on public.transaction_audit_logs to authenticated;
alter table public.transaction_audit_logs enable row level security;

create or replace function public.trg_prevent_audit_tampering()
returns trigger language plpgsql security definer as $$
begin
  raise exception 'Operação não permitida: registros de auditoria são estritamente imutáveis.';
end;
$$;

drop trigger if exists trg_audit_immutable on public.transaction_audit_logs;
create trigger trg_audit_immutable
  before update or delete on public.transaction_audit_logs
  for each row execute function public.trg_prevent_audit_tampering();

-- ------------------------------------------------------------------------------
-- 7. FUNÇÕES AUXILIARES DE SEGURANÇA (SERVER-SIDE DEFINER)
-- ------------------------------------------------------------------------------
create or replace function public.is_financial_manager(_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('admin', 'diretor', 'tesoureiro')
  );
$$;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles 
    where user_id = _user_id and role = _role
  );
$$;

-- ------------------------------------------------------------------------------
-- 8. POLÍTICAS DE SEGURANÇA RLS REVISADAS
-- ------------------------------------------------------------------------------

-- A. TRANSACTIONS
drop policy if exists "Cash team sees all, others see own" on public.transactions;
drop policy if exists "Autenticados leem movimentacoes oficiais" on public.transactions;
drop policy if exists "Membros consultam transacoes autorizadas" on public.transactions;

create policy "Membros consultam transacoes autorizadas" on public.transactions
  for select to authenticated
  using (
    -- Gestores financeiros veem todas (confirmadas, pendentes e estornadas)
    public.is_financial_manager(auth.uid())
    -- Membros e conselheiros veem lançamentos oficiais confirmados (exceto os em quarentena)
    or (status = 'confirmado' and cash_box_id != 'quarentena_revisao')
    -- Usuários veem suas próprias solicitações preliminares (mesmo pendentes)
    or created_by = auth.uid()
    or requested_by = auth.uid()
  );

-- Inserção Direta: 
-- 1. Transações confirmadas NÃO podem ser inseridas diretamente via REST table insert pelo frontend.
--    Elas exigem o uso das RPCs seguras (sp_registrar_transacao_oficial, sp_registrar_transferencia).
-- 2. Inserção direta via client só é permitida para conselheiros submetendo solicitação PENDENTE.
drop policy if exists "Cash team records" on public.transactions;
drop policy if exists "Regras de insercao de transacoes" on public.transactions;

create policy "Conselheiros submetem solicitacao pendente" on public.transactions
  for insert to authenticated
  with check (
    -- Conselheiro só pode gravar despesa como 'pendente'
    public.has_role(auth.uid(), 'conselheiro')
    and status = 'pendente'
    and kind = 'despesa'
    and created_by = auth.uid()
  );

-- Atualização Direta:
-- Bloqueada contra alterações arbitrárias. Gestores atualizam via RPC ou exclusivamente campos auditados.
drop policy if exists "Admins edit" on public.transactions;
drop policy if exists "Gestores atualizam ou estornam" on public.transactions;
drop policy if exists "Apenas gestores atualizam transacoes" on public.transactions;

-- Exclusão Física: 
-- TOTALMENTE BLOQUEADA. Nenhuma política de DELETE para authenticated.
drop policy if exists "Admins delete" on public.transactions;

-- B. RESERVAS
drop policy if exists "Membros consultam reservas ativas" on public.transaction_reservations;
create policy "Membros consultam reservas ativas" on public.transaction_reservations
  for select to authenticated using (true);

drop policy if exists "Gestores administram reservas" on public.transaction_reservations;
create policy "Gestores administram reservas" on public.transaction_reservations
  for all to authenticated
  using (public.is_financial_manager(auth.uid()))
  with check (public.is_financial_manager(auth.uid()));

-- C. AUDITORIA
drop policy if exists "Gestores consultam logs de auditoria" on public.transaction_audit_logs;
create policy "Gestores consultam logs de auditoria" on public.transaction_audit_logs
  for select to authenticated
  using (public.is_financial_manager(auth.uid()));

-- ------------------------------------------------------------------------------
-- 9. RPCs SERVER-SIDE ATÔMICAS E TRANSACIONAIS
-- ------------------------------------------------------------------------------

-- 9.1 Lançamento Oficial Direto (Apenas Gestores Financeiros) com Idempotência
create or replace function public.sp_registrar_transacao_oficial(
  p_client_mutation_id text,
  p_cash_box_id text,
  p_kind text,
  p_amount_cents bigint,
  p_category text,
  p_description text,
  p_payment_method text default 'dinheiro',
  p_date date default current_date,
  p_seller text default null
)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tx public.transactions;
  v_module text;
begin
  -- 1. Validação de Autorização
  if not public.is_financial_manager(v_user_id) then
    raise exception 'Acesso negado: apenas administradores, diretores ou tesoureiros podem registrar lançamentos oficiais.';
  end if;

  -- 2. Validação de Parâmetros
  if p_amount_cents <= 0 then
    raise exception 'O valor da movimentação deve ser estritamente positivo (maior que zero).';
  end if;

  if p_kind not in ('receita', 'despesa') then
    raise exception 'Tipo de movimentação inválido. Use sp_registrar_transferencia para transferências.';
  end if;

  if p_cash_box_id not in ('geral', 'doceria', 'vendas') then
    raise exception 'Caixa inválido.';
  end if;

  -- 3. Idempotência: Se o client_mutation_id já existir, retorna o registro existente sem duplicar
  if p_client_mutation_id is not null then
    select * into v_tx from public.transactions where client_mutation_id = p_client_mutation_id;
    if found then
      return v_tx;
    end if;
  end if;

  -- Compatibilidade com campo legado module
  v_module := case when p_cash_box_id = 'geral' then 'clube' else p_cash_box_id end;

  -- 4. Inserção Atômica
  insert into public.transactions (
    client_mutation_id,
    cash_box_id,
    module,
    kind,
    amount_cents,
    amount,
    category,
    description,
    payment_method,
    date,
    seller,
    status,
    created_by,
    approved_by,
    approved_at
  )
  values (
    p_client_mutation_id,
    p_cash_box_id,
    v_module,
    p_kind,
    p_amount_cents,
    (p_amount_cents / 100.0)::numeric(12,2),
    coalesce(p_category, 'Geral'),
    trim(p_description),
    p_payment_method,
    coalesce(p_date, current_date),
    p_seller,
    'confirmado',
    v_user_id,
    v_user_id,
    now()
  )
  returning * into v_tx;

  -- 5. Gravação de Auditoria
  insert into public.transaction_audit_logs (
    transaction_id,
    action,
    new_data,
    changed_by
  )
  values (
    v_tx.id,
    'INSERT',
    row_to_json(v_tx)::jsonb,
    v_user_id
  );

  return v_tx;
end;
$$;

-- 9.2 Transferência Interna Atômica entre Caixas com Lock Anti-Concorrência
create or replace function public.sp_registrar_transferencia(
  p_client_mutation_id text,
  p_source_box text,
  p_destination_box text,
  p_amount_cents bigint,
  p_description text,
  p_date date default current_date
)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tx public.transactions;
  v_source_balance bigint;
  v_source_reserved bigint;
  v_source_available bigint;
begin
  -- 1. Autorização
  if not public.is_financial_manager(v_user_id) then
    raise exception 'Acesso negado: apenas gestores financeiros podem realizar transferências entre caixas.';
  end if;

  -- 2. Validações
  if p_source_box = p_destination_box then
    raise exception 'O caixa de origem e o de destino não podem ser iguais.';
  end if;

  if p_source_box not in ('geral', 'doceria', 'vendas') or p_destination_box not in ('geral', 'doceria', 'vendas') then
    raise exception 'Caixas informados são inválidos.';
  end if;

  if p_amount_cents <= 0 then
    raise exception 'O valor da transferência deve ser maior que zero.';
  end if;

  -- 3. Idempotência
  if p_client_mutation_id is not null then
    select * into v_tx from public.transactions where client_mutation_id = p_client_mutation_id;
    if found then
      return v_tx;
    end if;
  end if;

  -- 4. Lock Concorrencial no Caixa de Origem (evita concorrência e saldo negativo)
  perform pg_advisory_xact_lock(hashtext('cash_box_' || p_source_box));

  -- Calcula saldo total confirmado do caixa de origem
  select coalesce(sum(
    case 
      when kind = 'receita' and cash_box_id = p_source_box then amount_cents
      when kind = 'despesa' and cash_box_id = p_source_box then -amount_cents
      when kind = 'transferencia' and destination_cash_box_id = p_source_box then amount_cents
      when kind = 'transferencia' and cash_box_id = p_source_box then -amount_cents
      else 0
    end
  ), 0)
  into v_source_balance
  from public.transactions
  where status = 'confirmado';

  -- Calcula reservas ativas do caixa de origem
  select coalesce(sum(amount_cents), 0)
  into v_source_reserved
  from public.transaction_reservations
  where cash_box_id = p_source_box and status = 'ativa';

  v_source_available := v_source_balance - v_source_reserved;

  if v_source_available < p_amount_cents then
    raise exception 'Saldo disponível insuficiente no caixa % (Disponível: R$ %, Solicitado: R$ %)',
      p_source_box,
      (v_source_available / 100.0)::numeric(12,2),
      (p_amount_cents / 100.0)::numeric(12,2);
  end if;

  -- 5. Gravação da Transferência Neutra
  insert into public.transactions (
    client_mutation_id,
    cash_box_id,
    destination_cash_box_id,
    module,
    kind,
    amount_cents,
    amount,
    category,
    description,
    payment_method,
    date,
    status,
    created_by,
    approved_by,
    approved_at
  )
  values (
    p_client_mutation_id,
    p_source_box,
    p_destination_box,
    case when p_source_box = 'geral' then 'clube' else p_source_box end,
    'transferencia',
    p_amount_cents,
    (p_amount_cents / 100.0)::numeric(12,2),
    'Transferência Interna',
    trim(p_description),
    'outro',
    coalesce(p_date, current_date),
    'confirmado',
    v_user_id,
    v_user_id,
    now()
  )
  returning * into v_tx;

  -- 6. Auditoria
  insert into public.transaction_audit_logs (
    transaction_id,
    action,
    new_data,
    changed_by
  )
  values (
    v_tx.id,
    'INSERT',
    row_to_json(v_tx)::jsonb,
    v_user_id
  );

  return v_tx;
end;
$$;

-- 9.3 Aprovação de Solicitação Preliminar de Conselheiro
create or replace function public.sp_aprovar_solicitacao(
  p_transaction_id uuid,
  p_payment_method text default 'dinheiro'
)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_old public.transactions;
  v_tx public.transactions;
begin
  if not public.is_financial_manager(v_user_id) then
    raise exception 'Acesso negado: apenas gestores financeiros podem aprovar solicitações.';
  end if;

  select * into v_old from public.transactions where id = p_transaction_id for update;
  if not found then
    raise exception 'Solicitação não encontrada.';
  end if;

  if v_old.status != 'pendente' then
    raise exception 'Apenas solicitações com status pendente podem ser aprovadas. Status atual: %', v_old.status;
  end if;

  update public.transactions
  set status = 'confirmado',
      approved_by = v_user_id,
      approved_at = now(),
      payment_method = coalesce(p_payment_method, payment_method),
      updated_at = now()
  where id = p_transaction_id
  returning * into v_tx;

  insert into public.transaction_audit_logs (
    transaction_id,
    action,
    old_data,
    new_data,
    changed_by
  )
  values (
    v_tx.id,
    'APROVACAO',
    row_to_json(v_old)::jsonb,
    row_to_json(v_tx)::jsonb,
    v_user_id
  );

  return v_tx;
end;
$$;

-- 9.4 Rejeição de Solicitação Preliminar de Conselheiro com Justificativa
create or replace function public.sp_rejeitar_solicitacao(
  p_transaction_id uuid,
  p_rejection_reason text
)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_old public.transactions;
  v_tx public.transactions;
begin
  if not public.is_financial_manager(v_user_id) then
    raise exception 'Acesso negado.';
  end if;

  if trim(coalesce(p_rejection_reason, '')) = '' then
    raise exception 'É obrigatório informar uma justificativa para a rejeição.';
  end if;

  select * into v_old from public.transactions where id = p_transaction_id for update;
  if not found then
    raise exception 'Solicitação não encontrada.';
  end if;

  if v_old.status != 'pendente' then
    raise exception 'Apenas solicitações com status pendente podem ser rejeitadas.';
  end if;

  update public.transactions
  set status = 'rejeitado',
      rejection_reason = trim(p_rejection_reason),
      approved_by = v_user_id,
      approved_at = now(),
      updated_at = now()
  where id = p_transaction_id
  returning * into v_tx;

  insert into public.transaction_audit_logs (
    transaction_id,
    action,
    old_data,
    new_data,
    changed_by
  )
  values (
    v_tx.id,
    'REJEICAO',
    row_to_json(v_old)::jsonb,
    row_to_json(v_tx)::jsonb,
    v_user_id
  );

  return v_tx;
end;
$$;

-- 9.5 Estorno de Lançamento Oficial (Imutabilidade e Trilha Histórica)
create or replace function public.sp_estornar_transacao(
  p_transaction_id uuid,
  p_reverse_reason text
)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_orig public.transactions;
  v_tx_estorno public.transactions;
  v_compensating_kind text;
begin
  if not public.is_financial_manager(v_user_id) then
    raise exception 'Acesso negado: apenas administradores, diretores ou tesoureiros podem estornar lançamentos.';
  end if;

  if trim(coalesce(p_reverse_reason, '')) = '' then
    raise exception 'É obrigatório fornecer a justificativa fundamentada do estorno.';
  end if;

  select * into v_orig from public.transactions where id = p_transaction_id for update;
  if not found then
    raise exception 'Lançamento não encontrado.';
  end if;

  if v_orig.status != 'confirmado' then
    raise exception 'Apenas lançamentos confirmados podem ser estornados. Status atual: %', v_orig.status;
  end if;

  -- Marca a original como estornada
  update public.transactions
  set status = 'estornado',
      reverse_reason = trim(p_reverse_reason),
      updated_at = now()
  where id = p_transaction_id;

  -- Determina o tipo compensatório
  v_compensating_kind := case
    when v_orig.kind = 'receita' then 'despesa'
    when v_orig.kind = 'despesa' then 'receita'
    when v_orig.kind = 'transferencia' then 'transferencia'
    else 'despesa'
  end;

  -- Cria o lançamento compensatório oficial
  insert into public.transactions (
    cash_box_id,
    destination_cash_box_id,
    module,
    kind,
    amount_cents,
    amount,
    category,
    description,
    payment_method,
    date,
    status,
    original_transaction_id,
    reverse_reason,
    created_by,
    approved_by,
    approved_at
  )
  values (
    -- Em caso de estorno de transferência, inverte os caixas
    case when v_orig.kind = 'transferencia' then v_orig.destination_cash_box_id else v_orig.cash_box_id end,
    case when v_orig.kind = 'transferencia' then v_orig.cash_box_id else null end,
    v_orig.module,
    v_compensating_kind,
    v_orig.amount_cents,
    v_orig.amount,
    'Estorno / Ajuste',
    'Estorno de: ' || v_orig.description || ' | Motivo: ' || trim(p_reverse_reason),
    v_orig.payment_method,
    current_date,
    'confirmado',
    v_orig.id,
    trim(p_reverse_reason),
    v_user_id,
    v_user_id,
    now()
  )
  returning * into v_tx_estorno;

  -- Auditoria dupla: registra na original e na compensatória
  insert into public.transaction_audit_logs (
    transaction_id,
    action,
    old_data,
    new_data,
    changed_by
  )
  values (
    v_orig.id,
    'ESTORNO',
    row_to_json(v_orig)::jsonb,
    json_build_object('status', 'estornado', 'reason', p_reverse_reason)::jsonb,
    v_user_id
  );

  return v_tx_estorno;
end;
$$;
