-- ==============================================================================
-- MIGRATION: 0004_fase1b_fundacao.sql
-- PROJETO: GDACaixa (Clube Guerreiros do Alto)
-- FASE 1B (PARTE 2 de 2) — Modelagem, Segurança e RPCs
-- STATUS: NÃO APLICADA (Aguardando Aprovação)
-- ==============================================================================
-- PRÉ-REQUISITO: A migration 0003_enum_tesoureiro.sql DEVE ter sido aplicada
-- e commitada antes de executar este arquivo.
--
-- PRINCÍPIOS:
--  * Aditiva: Não remove colunas, tabelas ou dados existentes.
--  * Idempotente: Usa IF NOT EXISTS e ON CONFLICT para re-execução segura.
--  * Segurança: RPCs com SECURITY DEFINER, REVOKE de PUBLIC, locks, validação.
--  * Integridade: Nenhuma operação financeira confirmada é gravada sem RPC.
--  * Auditoria: Append-only, ON DELETE RESTRICT, trigger anti-adulteração.
-- ==============================================================================


-- ============================================================================
-- PARTE A: TABELAS E DOMÍNIO
-- ============================================================================

-- A1. Três caixas fixos + quarentena para registros legados ambíguos
create table if not exists public.cash_boxes (
  id text primary key,
  name text not null,
  description text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint ck_cash_box_id check (id in ('geral', 'doceria', 'vendas', '_quarentena'))
);

insert into public.cash_boxes (id, name, description, is_active) values
  ('geral',       'Caixa Geral',       'Caixa principal: taxas, doações, despesas gerais do clube.',                   true),
  ('doceria',     'Doceria do Clube',   'Caixa dedicado à produção e venda de doces.',                                true),
  ('vendas',      'Vendas Rápidas',     'Caixa de vendas ágeis, eventos e campanhas.',                                true),
  ('_quarentena', 'Quarentena Contábil','Registros legados com módulo nulo/ambíguo isolados para revisão manual.',     false)
on conflict (id) do nothing;

grant select on public.cash_boxes to authenticated;
alter table public.cash_boxes enable row level security;

drop policy if exists "Todos autenticados consultam caixas" on public.cash_boxes;
create policy "caixas_select" on public.cash_boxes
  for select to authenticated using (true);

-- A2. Evolução aditiva da tabela transactions
-- Colunas novas não quebram queries legadas que fazem SELECT module, amount, ...
alter table public.transactions
  add column if not exists cash_box_id text references public.cash_boxes(id),
  add column if not exists amount_cents bigint,
  add column if not exists status text not null default 'confirmado',
  add column if not exists payment_method text not null default 'dinheiro',
  add column if not exists destination_cash_box_id text references public.cash_boxes(id),
  add column if not exists original_transaction_id uuid references public.transactions(id),
  add column if not exists reverse_reason text,
  add column if not exists client_mutation_id text,
  add column if not exists requested_by uuid references auth.users(id),
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists approved_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists updated_at timestamptz not null default now();

-- Índice único parcial para idempotência (não inclui NULLs)
create unique index if not exists ux_transactions_mutation_id
  on public.transactions (client_mutation_id)
  where client_mutation_id is not null;

-- Constraints de validação (idempotentes via DO/IF NOT EXISTS)
do $$
begin
  -- Atualizar check constraint de kind para incluir 'transferencia'
  alter table public.transactions drop constraint if exists transactions_kind_check;
  if not exists (select 1 from pg_constraint where conname = 'transactions_kind_check') then
    alter table public.transactions
      add constraint transactions_kind_check
      check (kind in ('receita','despesa','transferencia'));
  end if;

  -- Status
  if not exists (select 1 from pg_constraint where conname = 'ck_tx_status') then
    alter table public.transactions
      add constraint ck_tx_status
      check (status in ('pendente','confirmado','estornado','corrigido','rejeitado'));
  end if;
  -- Forma de pagamento
  if not exists (select 1 from pg_constraint where conname = 'ck_tx_payment') then
    alter table public.transactions
      add constraint ck_tx_payment
      check (payment_method in ('dinheiro','pix','cartao_debito','cartao_credito','outro'));
  end if;
  -- Transferências exigem destino diferente da origem
  if not exists (select 1 from pg_constraint where conname = 'ck_tx_transfer_dest') then
    alter table public.transactions
      add constraint ck_tx_transfer_dest
      check (kind <> 'transferencia'
             or (destination_cash_box_id is not null
                 and destination_cash_box_id <> cash_box_id));
  end if;
  -- Limite superior de amount_cents compatível com Number.MAX_SAFE_INTEGER
  -- 9_007_199_254_740_991 centavos ≈ R$ 90 trilhões. Limite prático: R$ 100 milhões.
  if not exists (select 1 from pg_constraint where conname = 'ck_tx_cents_range') then
    alter table public.transactions
      add constraint ck_tx_cents_range
      check (amount_cents is null or (amount_cents >= 0 and amount_cents <= 10000000000));
  end if;
end $$;


-- A3. Migração de dados legados
-- Mapeamento: 'clube' -> 'geral', módulos conhecidos -> mesmo id, desconhecidos -> '_quarentena'
update public.transactions
  set cash_box_id = case
    when module = 'clube'   then 'geral'
    when module = 'doceria' then 'doceria'
    when module = 'vendas'  then 'vendas'
    else '_quarentena'
  end
  where cash_box_id is null;

update public.transactions
  set amount_cents = round(amount * 100)::bigint
  where amount_cents is null;


-- A4. Reservas de saldo
create table if not exists public.transaction_reservations (
  id uuid primary key default gen_random_uuid(),
  cash_box_id text not null references public.cash_boxes(id),
  title text not null,
  description text,
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 10000000000),
  status text not null default 'ativa' check (status in ('ativa','liberada','consumida')),
  released_by uuid references auth.users(id),
  released_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.transaction_reservations to authenticated;
alter table public.transaction_reservations enable row level security;


-- A5. Auditoria (append-only, ON DELETE RESTRICT)
create table if not exists public.transaction_audit_logs (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references public.transactions(id) on delete restrict,
  reservation_id uuid references public.transaction_reservations(id) on delete restrict,
  action text not null check (action in (
    'INSERT','ESTORNO','APROVACAO','REJEICAO',
    'RESERVA_CRIADA','RESERVA_LIBERADA','RESERVA_CONSUMIDA',
    'SOLICITACAO'
  )),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid not null default auth.uid() references auth.users(id),
  changed_at timestamptz not null default now(),
  check (transaction_id is not null or reservation_id is not null)
);

-- Grant insert apenas via service_role / SECURITY DEFINER functions
-- Authenticated pode ler (se RLS permitir), mas NÃO inserir diretamente
grant select on public.transaction_audit_logs to authenticated;
alter table public.transaction_audit_logs enable row level security;

-- Trigger: impede UPDATE e DELETE por qualquer role
create or replace function public.trg_prevent_audit_tampering()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Registros de auditoria são imutáveis. UPDATE e DELETE não são permitidos.';
end;
$$;

drop trigger if exists trg_audit_no_update on public.transaction_audit_logs;
create trigger trg_audit_no_update
  before update or delete on public.transaction_audit_logs
  for each row execute function public.trg_prevent_audit_tampering();


-- ============================================================================
-- PARTE B: FUNÇÕES AUXILIARES DE SEGURANÇA
-- ============================================================================

-- B1. Verificação de papel (já existe na 0000, recriamos com qualificação completa)
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

-- B2. Gestor financeiro: admin, diretor ou tesoureiro
create or replace function public.is_financial_manager(_user_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('admin', 'diretor', 'tesoureiro')
  );
$$;

revoke execute on function public.is_financial_manager(uuid) from public, anon;
grant execute on function public.is_financial_manager(uuid) to authenticated, service_role;

-- B3. Cálculo de saldo disponível de um caixa (usado internamente nas RPCs)
create or replace function public.fn_saldo_disponivel(p_cash_box_id text)
returns bigint
language sql stable security definer
set search_path = ''
as $$
  select coalesce((
    select sum(
      case
        when kind = 'receita'       and cash_box_id = p_cash_box_id then amount_cents
        when kind = 'despesa'       and cash_box_id = p_cash_box_id then -amount_cents
        when kind = 'transferencia' and cash_box_id = p_cash_box_id then -amount_cents
        when kind = 'transferencia' and destination_cash_box_id = p_cash_box_id then amount_cents
        else 0
      end
    )
    from public.transactions
    where status = 'confirmado'
  ), 0)
  -
  coalesce((
    select sum(amount_cents)
    from public.transaction_reservations
    where cash_box_id = p_cash_box_id and status = 'ativa'
  ), 0);
$$;

revoke execute on function public.fn_saldo_disponivel(text) from public, anon;
grant execute on function public.fn_saldo_disponivel(text) to service_role;


-- B4. Lock determinístico para um caixa (ordem estável para evitar deadlocks)
-- Usado por TODAS as RPCs que alteram saldo de um caixa.
create or replace function public.fn_lock_caixa(p_box_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('gdacaixa_box_' || p_box_id));
end;
$$;

-- Lock de dois caixas em ordem determinística (para transferências)
create or replace function public.fn_lock_dois_caixas(p_a text, p_b text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_a < p_b then
    perform public.fn_lock_caixa(p_a);
    perform public.fn_lock_caixa(p_b);
  else
    perform public.fn_lock_caixa(p_b);
    perform public.fn_lock_caixa(p_a);
  end if;
end;
$$;

revoke execute on function public.fn_lock_caixa(text) from public, anon;
revoke execute on function public.fn_lock_dois_caixas(text, text) from public, anon;


-- ============================================================================
-- PARTE C: POLÍTICAS RLS REVISADAS
-- ============================================================================

-- C1. TRANSACTIONS — Leitura
drop policy if exists "Cash team sees all, others see own" on public.transactions;
drop policy if exists "Autenticados leem movimentacoes oficiais" on public.transactions;
drop policy if exists "Membros consultam transacoes autorizadas" on public.transactions;

create policy "tx_select" on public.transactions
  for select to authenticated
  using (
    -- Gestores financeiros: leitura completa (incluindo pendentes, estornadas, quarentena)
    public.is_financial_manager(auth.uid())
    -- Membros/conselheiros: lançamentos confirmados dos 3 caixas oficiais
    or (status = 'confirmado' and cash_box_id in ('geral','doceria','vendas'))
    -- Qualquer um vê suas próprias solicitações/criações
    or created_by = auth.uid()
    or requested_by = auth.uid()
  );

-- C2. TRANSACTIONS — Inserção direta: TOTALMENTE BLOQUEADA
-- Toda inserção ocorre via RPC SECURITY DEFINER. Mesmo conselheiros usam RPC.
drop policy if exists "Cash team records"      on public.transactions;
drop policy if exists "Regras de insercao de transacoes" on public.transactions;
drop policy if exists "Conselheiros submetem solicitacao pendente" on public.transactions;
-- Não criamos nenhuma policy de INSERT para authenticated.

-- C3. TRANSACTIONS — Atualização direta: BLOQUEADA
-- Toda atualização ocorre via RPC SECURITY DEFINER.
drop policy if exists "Admins edit"                       on public.transactions;
drop policy if exists "Gestores atualizam ou estornam"    on public.transactions;
drop policy if exists "Apenas gestores atualizam transacoes" on public.transactions;
-- Não criamos nenhuma policy de UPDATE para authenticated.

-- C4. TRANSACTIONS — Exclusão física: BLOQUEADA
drop policy if exists "Admins delete" on public.transactions;
-- Não criamos nenhuma policy de DELETE para authenticated.

-- C5. RESERVAS — Leitura para todos, escrita via RPC
drop policy if exists "Membros consultam reservas ativas"  on public.transaction_reservations;
drop policy if exists "Gestores administram reservas"      on public.transaction_reservations;

create policy "reservas_select" on public.transaction_reservations
  for select to authenticated using (true);
-- Sem INSERT/UPDATE/DELETE para authenticated; reservas gerenciadas exclusivamente via RPCs.

-- C6. AUDITORIA — Somente leitura para gestores
drop policy if exists "Gestores consultam logs de auditoria" on public.transaction_audit_logs;

create policy "audit_select" on public.transaction_audit_logs
  for select to authenticated
  using (public.is_financial_manager(auth.uid()));

-- Sem INSERT para authenticated; os inserts na auditoria ocorrem dentro de RPCs SECURITY DEFINER
-- que rodam como o owner da função (service_role/superuser), ignorando RLS.


-- ============================================================================
-- PARTE D: RPCs TRANSACIONAIS
-- ============================================================================

-- D1. Registrar Lançamento Oficial (receita ou despesa)
create or replace function public.sp_registrar_transacao_oficial(
  p_client_mutation_id text,
  p_cash_box_id        text,
  p_kind               text,
  p_amount_cents       bigint,
  p_category           text,
  p_description        text,
  p_payment_method     text default 'dinheiro',
  p_date               date default current_date,
  p_seller             text default null
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_existing_id uuid;
  v_existing_box text;
  v_existing_kind text;
  v_existing_cents bigint;
  v_new_id uuid;
  v_module text;
begin
  -- 1. Validação de identidade
  if v_uid is null then
    raise exception 'Sessão inválida: auth.uid() é nulo.';
  end if;

  -- 2. Autorização
  if not public.is_financial_manager(v_uid) then
    raise exception 'Acesso negado: apenas admin, diretor ou tesoureiro podem registrar lançamentos oficiais.';
  end if;

  -- 3. Validação de parâmetros
  if p_client_mutation_id is null or trim(p_client_mutation_id) = '' then
    raise exception 'client_mutation_id é obrigatório.';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'O valor deve ser estritamente positivo.';
  end if;

  if p_amount_cents > 10000000000 then
    raise exception 'Valor excede o limite de R$ 100.000.000,00.';
  end if;

  if p_kind not in ('receita', 'despesa') then
    raise exception 'Tipo inválido: use "receita" ou "despesa". Para transferências use sp_registrar_transferencia.';
  end if;

  if p_cash_box_id not in ('geral', 'doceria', 'vendas') then
    raise exception 'Caixa inválido: use "geral", "doceria" ou "vendas".';
  end if;

  if p_payment_method not in ('dinheiro','pix','cartao_debito','cartao_credito','outro') then
    raise exception 'Forma de pagamento inválida.';
  end if;

  if trim(coalesce(p_description, '')) = '' then
    raise exception 'Descrição é obrigatória.';
  end if;

  -- 4. Idempotência: Verifica se o mutation_id já foi processado
  select id, cash_box_id, kind, amount_cents
    into v_existing_id, v_existing_box, v_existing_kind, v_existing_cents
    from public.transactions
    where client_mutation_id = p_client_mutation_id;

  if found then
    -- Mesmo mutation_id mas parâmetros diferentes = rejeição
    if v_existing_box <> p_cash_box_id
       or v_existing_kind <> p_kind
       or v_existing_cents <> p_amount_cents then
      raise exception 'client_mutation_id "%" já utilizado com parâmetros diferentes.', p_client_mutation_id;
    end if;
    -- Parâmetros compatíveis: retorna id existente (operação idêntica já processada)
    return v_existing_id;
  end if;

  -- 5. Lock do caixa afetado
  perform public.fn_lock_caixa(p_cash_box_id);

  -- Validação de saldo disponível para despesas
  if p_kind = 'despesa' then
    if public.fn_saldo_disponivel(p_cash_box_id) < p_amount_cents then
      raise exception 'Saldo disponível insuficiente no caixa "%" para realizar a despesa.', p_cash_box_id;
    end if;
  end if;

  -- 6. Mapeamento legado
  v_module := case when p_cash_box_id = 'geral' then 'clube' else p_cash_box_id end;

  -- 7. Inserção com ON CONFLICT para proteção contra corrida
  insert into public.transactions (
    client_mutation_id, cash_box_id, module, kind,
    amount_cents, amount, category, description,
    payment_method, date, seller,
    status, created_by, approved_by, approved_at
  ) values (
    p_client_mutation_id, p_cash_box_id, v_module, p_kind,
    p_amount_cents, (p_amount_cents / 100.0)::numeric(12,2),
    coalesce(nullif(trim(p_category),''), 'Geral'), trim(p_description),
    p_payment_method, coalesce(p_date, current_date), nullif(trim(coalesce(p_seller,'')), ''),
    'confirmado', v_uid, v_uid, now()
  )
  on conflict (client_mutation_id) where client_mutation_id is not null
  do nothing
  returning id into v_new_id;

  -- Se ON CONFLICT disparou (corrida): busca o registro que venceu
  if v_new_id is null then
    select id into v_new_id from public.transactions where client_mutation_id = p_client_mutation_id;
    return v_new_id;
  end if;

  -- 8. Auditoria
  insert into public.transaction_audit_logs (transaction_id, action, new_data, changed_by)
  values (v_new_id, 'INSERT',
    jsonb_build_object('cash_box_id', p_cash_box_id, 'kind', p_kind,
                       'amount_cents', p_amount_cents, 'status', 'confirmado'),
    v_uid);

  return v_new_id;
end;
$$;

revoke execute on function public.sp_registrar_transacao_oficial(text,text,text,bigint,text,text,text,date,text) from public, anon;
grant execute on function public.sp_registrar_transacao_oficial(text,text,text,bigint,text,text,text,date,text) to authenticated;


-- D2. Registrar Transferência Interna Atômica
create or replace function public.sp_registrar_transferencia(
  p_client_mutation_id text,
  p_source_box         text,
  p_destination_box    text,
  p_amount_cents       bigint,
  p_description        text,
  p_date               date default current_date
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_existing_id uuid;
  v_existing_src text;
  v_existing_dst text;
  v_existing_cents bigint;
  v_new_id uuid;
  v_available bigint;
begin
  if v_uid is null then
    raise exception 'Sessão inválida.';
  end if;

  if not public.is_financial_manager(v_uid) then
    raise exception 'Acesso negado: apenas gestores financeiros podem transferir entre caixas.';
  end if;

  if p_client_mutation_id is null or trim(p_client_mutation_id) = '' then
    raise exception 'client_mutation_id é obrigatório.';
  end if;

  if p_source_box = p_destination_box then
    raise exception 'Caixa de origem e destino não podem ser iguais.';
  end if;

  if p_source_box not in ('geral','doceria','vendas') or p_destination_box not in ('geral','doceria','vendas') then
    raise exception 'Caixas inválidos.';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Valor deve ser positivo.';
  end if;

  if p_amount_cents > 10000000000 then
    raise exception 'Valor excede o limite.';
  end if;

  if trim(coalesce(p_description, '')) = '' then
    raise exception 'Descrição é obrigatória.';
  end if;

  -- Idempotência com validação de parâmetros
  select id, cash_box_id, destination_cash_box_id, amount_cents
    into v_existing_id, v_existing_src, v_existing_dst, v_existing_cents
    from public.transactions
    where client_mutation_id = p_client_mutation_id;

  if found then
    if v_existing_src <> p_source_box
       or v_existing_dst <> p_destination_box
       or v_existing_cents <> p_amount_cents then
      raise exception 'client_mutation_id "%" já utilizado com parâmetros diferentes.', p_client_mutation_id;
    end if;
    return v_existing_id;
  end if;

  -- Lock de AMBOS os caixas em ordem determinística (previne deadlock)
  perform public.fn_lock_dois_caixas(p_source_box, p_destination_box);

  -- Verificação de saldo disponível na origem
  v_available := public.fn_saldo_disponivel(p_source_box);

  if v_available < p_amount_cents then
    raise exception 'Saldo disponível insuficiente no caixa "%" (Disponível: R$ %, Solicitado: R$ %)',
      p_source_box,
      (v_available / 100.0)::numeric(12,2),
      (p_amount_cents / 100.0)::numeric(12,2);
  end if;

  -- Inserção com proteção contra corrida
  insert into public.transactions (
    client_mutation_id, cash_box_id, destination_cash_box_id, module,
    kind, amount_cents, amount, category, description,
    payment_method, date, status, created_by, approved_by, approved_at
  ) values (
    p_client_mutation_id, p_source_box, p_destination_box,
    case when p_source_box = 'geral' then 'clube' else p_source_box end,
    'transferencia', p_amount_cents, (p_amount_cents / 100.0)::numeric(12,2),
    'Transferência Interna', trim(p_description),
    'outro', coalesce(p_date, current_date), 'confirmado',
    v_uid, v_uid, now()
  )
  on conflict (client_mutation_id) where client_mutation_id is not null
  do nothing
  returning id into v_new_id;

  if v_new_id is null then
    select id into v_new_id from public.transactions where client_mutation_id = p_client_mutation_id;
    return v_new_id;
  end if;

  insert into public.transaction_audit_logs (transaction_id, action, new_data, changed_by)
  values (v_new_id, 'INSERT',
    jsonb_build_object('source', p_source_box, 'destination', p_destination_box,
                       'amount_cents', p_amount_cents, 'kind', 'transferencia'),
    v_uid);

  return v_new_id;
end;
$$;

revoke execute on function public.sp_registrar_transferencia(text,text,text,bigint,text,date) from public, anon;
grant execute on function public.sp_registrar_transferencia(text,text,text,bigint,text,date) to authenticated;


-- D3. Solicitação Preliminar de Conselheiro (via RPC, não via INSERT direto)
create or replace function public.sp_solicitar_despesa(
  p_cash_box_id         text,
  p_amount_cents        bigint,
  p_category            text,
  p_description         text,
  p_date                date default current_date,
  p_payment_method      text default 'dinheiro',
  p_client_mutation_id  text default null
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_new_id uuid;
begin
  if v_uid is null then
    raise exception 'Sessão inválida.';
  end if;

  -- Conselheiros, diretores, tesoureiros e admins podem submeter solicitações
  if not (public.has_role(v_uid, 'conselheiro')
       or public.is_financial_manager(v_uid)) then
    raise exception 'Acesso negado: apenas conselheiros e gestores podem submeter solicitações.';
  end if;

  if p_cash_box_id not in ('geral', 'doceria', 'vendas') then
    raise exception 'Caixa inválido.';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Valor deve ser positivo.';
  end if;

  if p_amount_cents > 10000000000 then
    raise exception 'Valor excede o limite.';
  end if;

  if trim(coalesce(p_description, '')) = '' then
    raise exception 'Descrição é obrigatória.';
  end if;

  if p_payment_method not in ('dinheiro','pix','cartao_debito','cartao_credito','outro') then
    raise exception 'Forma de pagamento inválida.';
  end if;

  -- Idempotência: se client_mutation_id foi fornecido e já existe
  if p_client_mutation_id is not null and trim(p_client_mutation_id) <> '' then
    select id into v_new_id
      from public.transactions
      where client_mutation_id = trim(p_client_mutation_id);
    if found then
      return v_new_id;
    end if;
  end if;

  insert into public.transactions (
    client_mutation_id, cash_box_id, module, kind,
    amount_cents, amount, category, description,
    payment_method, date,
    status, requested_by, created_by
  ) values (
    nullif(trim(p_client_mutation_id), ''),
    p_cash_box_id,
    case when p_cash_box_id = 'geral' then 'clube' else p_cash_box_id end,
    'despesa',
    p_amount_cents, (p_amount_cents / 100.0)::numeric(12,2),
    coalesce(nullif(trim(p_category),''), 'Geral'), trim(p_description),
    p_payment_method, coalesce(p_date, current_date),
    'pendente', v_uid, v_uid
  )
  on conflict (client_mutation_id) where client_mutation_id is not null
  do nothing
  returning id into v_new_id;

  if v_new_id is null and p_client_mutation_id is not null then
    select id into v_new_id from public.transactions where client_mutation_id = trim(p_client_mutation_id);
    return v_new_id;
  end if;

  insert into public.transaction_audit_logs (transaction_id, action, new_data, changed_by)
  values (v_new_id, 'SOLICITACAO',
    jsonb_build_object('cash_box_id', p_cash_box_id, 'amount_cents', p_amount_cents,
                       'requested_by', v_uid, 'status', 'pendente'),
    v_uid);

  return v_new_id;
end;
$$;

revoke execute on function public.sp_solicitar_despesa(text,bigint,text,text,date,text,text) from public, anon;
grant execute on function public.sp_solicitar_despesa(text,bigint,text,text,date,text,text) to authenticated;


-- D4. Aprovação de Solicitação
create or replace function public.sp_aprovar_solicitacao(
  p_transaction_id  uuid,
  p_payment_method  text default 'dinheiro'
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_old record;
begin
  if v_uid is null then
    raise exception 'Sessão inválida.';
  end if;

  if not public.is_financial_manager(v_uid) then
    raise exception 'Acesso negado: apenas gestores financeiros podem aprovar solicitações.';
  end if;

  if p_payment_method not in ('dinheiro','pix','cartao_debito','cartao_credito','outro') then
    raise exception 'Forma de pagamento inválida.';
  end if;

  -- FOR UPDATE garante serialização
  select id, status, cash_box_id, amount_cents
    into v_old
    from public.transactions
    where id = p_transaction_id
    for update;

  if not found then
    raise exception 'Solicitação não encontrada.';
  end if;

  if v_old.status <> 'pendente' then
    raise exception 'Apenas solicitações pendentes podem ser aprovadas. Status atual: %', v_old.status;
  end if;

  -- Lock do caixa afetado antes de confirmar
  perform public.fn_lock_caixa(v_old.cash_box_id);

  -- Valida saldo disponível no caixa no momento da aprovação
  if public.fn_saldo_disponivel(v_old.cash_box_id) < v_old.amount_cents then
    raise exception 'Saldo disponível insuficiente no caixa "%" para aprovar a despesa.', v_old.cash_box_id;
  end if;

  update public.transactions
    set status = 'confirmado',
        approved_by = v_uid,
        approved_at = now(),
        payment_method = p_payment_method,
        updated_at = now()
    where id = p_transaction_id;

  insert into public.transaction_audit_logs (transaction_id, action, old_data, new_data, changed_by)
  values (p_transaction_id, 'APROVACAO',
    jsonb_build_object('status', 'pendente'),
    jsonb_build_object('status', 'confirmado', 'approved_by', v_uid, 'approved_at', now(), 'payment_method', p_payment_method),
    v_uid);

  return p_transaction_id;
end;
$$;

revoke execute on function public.sp_aprovar_solicitacao(uuid, text) from public, anon;
grant execute on function public.sp_aprovar_solicitacao(uuid, text) to authenticated;


-- D5. Rejeição de Solicitação
create or replace function public.sp_rejeitar_solicitacao(
  p_transaction_id    uuid,
  p_rejection_reason  text
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
begin
  if v_uid is null then
    raise exception 'Sessão inválida.';
  end if;

  if not public.is_financial_manager(v_uid) then
    raise exception 'Acesso negado.';
  end if;

  if trim(coalesce(p_rejection_reason, '')) = '' then
    raise exception 'Justificativa de rejeição é obrigatória.';
  end if;

  select status into v_status
    from public.transactions
    where id = p_transaction_id
    for update;

  if not found then
    raise exception 'Solicitação não encontrada.';
  end if;

  if v_status <> 'pendente' then
    raise exception 'Apenas solicitações pendentes podem ser rejeitadas. Status atual: %', v_status;
  end if;

  update public.transactions
    set status = 'rejeitado',
        rejection_reason = trim(p_rejection_reason),
        approved_by = v_uid,
        approved_at = now(),
        updated_at = now()
    where id = p_transaction_id;

  insert into public.transaction_audit_logs (transaction_id, action, old_data, new_data, changed_by)
  values (p_transaction_id, 'REJEICAO',
    jsonb_build_object('status', 'pendente'),
    jsonb_build_object('status', 'rejeitado', 'rejection_reason', trim(p_rejection_reason),
                       'approved_by', v_uid),
    v_uid);

  return p_transaction_id;
end;
$$;

revoke execute on function public.sp_rejeitar_solicitacao(uuid, text) from public, anon;
grant execute on function public.sp_rejeitar_solicitacao(uuid, text) to authenticated;


-- D6. Estorno de Lançamento Oficial
create or replace function public.sp_estornar_transacao(
  p_transaction_id  uuid,
  p_reverse_reason  text
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_orig record;
  v_comp_id uuid;
  v_comp_kind text;
  v_comp_box text;
  v_comp_dest text;
begin
  if v_uid is null then
    raise exception 'Sessão inválida.';
  end if;

  if not public.is_financial_manager(v_uid) then
    raise exception 'Acesso negado: apenas gestores financeiros podem estornar lançamentos.';
  end if;

  if trim(coalesce(p_reverse_reason, '')) = '' then
    raise exception 'Justificativa de estorno é obrigatória.';
  end if;

  -- Lock e leitura do registro original
  select id, status, kind, cash_box_id, destination_cash_box_id,
         amount_cents, amount, module, description, payment_method
    into v_orig
    from public.transactions
    where id = p_transaction_id
    for update;

  if not found then
    raise exception 'Lançamento não encontrado.';
  end if;

  if v_orig.status <> 'confirmado' then
    raise exception 'Apenas lançamentos confirmados podem ser estornados. Status atual: %', v_orig.status;
  end if;

  -- Lock do(s) caixa(s) envolvido(s)
  if v_orig.kind = 'transferencia' and v_orig.destination_cash_box_id is not null then
    perform public.fn_lock_dois_caixas(v_orig.cash_box_id, v_orig.destination_cash_box_id);
  else
    perform public.fn_lock_caixa(v_orig.cash_box_id);
  end if;

  -- Marca a transação original como estornada (sem alterar outros campos históricos)
  update public.transactions
    set status = 'estornado',
        reverse_reason = trim(p_reverse_reason),
        updated_at = now()
    where id = p_transaction_id;

  -- Lançamento compensatório
  v_comp_kind := case
    when v_orig.kind = 'receita'       then 'despesa'
    when v_orig.kind = 'despesa'       then 'receita'
    when v_orig.kind = 'transferencia' then 'transferencia'
  end;

  -- Para transferência estornada, inverte origem/destino
  if v_orig.kind = 'transferencia' then
    v_comp_box  := v_orig.destination_cash_box_id;
    v_comp_dest := v_orig.cash_box_id;
  else
    v_comp_box  := v_orig.cash_box_id;
    v_comp_dest := null;
  end if;

  -- Validação de saldo disponível antes do débito compensatório
  if v_comp_kind = 'despesa' then
    if public.fn_saldo_disponivel(v_comp_box) < v_orig.amount_cents then
      raise exception 'Saldo disponível insuficiente no caixa "%" para compensar o estorno da receita.', v_comp_box;
    end if;
  elsif v_orig.kind = 'transferencia' then
    if public.fn_saldo_disponivel(v_comp_box) < v_orig.amount_cents then
      raise exception 'Saldo disponível insuficiente no caixa de destino "%" para reverter a transferência.', v_comp_box;
    end if;
  end if;

  insert into public.transactions (
    cash_box_id, destination_cash_box_id, module, kind,
    amount_cents, amount, category, description,
    payment_method, date, status,
    original_transaction_id, reverse_reason,
    created_by, approved_by, approved_at
  ) values (
    v_comp_box, v_comp_dest, v_orig.module, v_comp_kind,
    v_orig.amount_cents, v_orig.amount,
    'Estorno', 'Estorno: ' || v_orig.description || ' — ' || trim(p_reverse_reason),
    v_orig.payment_method, current_date, 'confirmado',
    v_orig.id, trim(p_reverse_reason),
    v_uid, v_uid, now()
  )
  returning id into v_comp_id;

  -- Auditoria: registro na transação original
  insert into public.transaction_audit_logs (transaction_id, action, old_data, new_data, changed_by)
  values (p_transaction_id, 'ESTORNO',
    jsonb_build_object('status', 'confirmado'),
    jsonb_build_object('status', 'estornado', 'reverse_reason', trim(p_reverse_reason),
                       'compensating_id', v_comp_id),
    v_uid);

  -- Auditoria: registro na transação compensatória
  insert into public.transaction_audit_logs (transaction_id, action, new_data, changed_by)
  values (v_comp_id, 'INSERT',
    jsonb_build_object('kind', v_comp_kind, 'amount_cents', v_orig.amount_cents,
                       'original_transaction_id', p_transaction_id, 'status', 'confirmado'),
    v_uid);

  return v_comp_id;
end;
$$;

revoke execute on function public.sp_estornar_transacao(uuid, text) from public, anon;
grant execute on function public.sp_estornar_transacao(uuid, text) to authenticated;


-- D7. Criar Reserva de Saldo
create or replace function public.sp_criar_reserva(
  p_cash_box_id   text,
  p_title         text,
  p_amount_cents  bigint,
  p_description   text default null
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_available bigint;
  v_res_id uuid;
begin
  if v_uid is null then raise exception 'Sessão inválida.'; end if;

  if not public.is_financial_manager(v_uid) then
    raise exception 'Acesso negado.';
  end if;

  if p_cash_box_id not in ('geral','doceria','vendas') then
    raise exception 'Caixa inválido.';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Valor deve ser positivo.';
  end if;

  if trim(coalesce(p_title, '')) = '' then
    raise exception 'Título é obrigatório.';
  end if;

  -- Lock do caixa
  perform public.fn_lock_caixa(p_cash_box_id);

  v_available := public.fn_saldo_disponivel(p_cash_box_id);

  if v_available < p_amount_cents then
    raise exception 'Saldo disponível insuficiente para reserva no caixa "%" (Disponível: R$ %, Solicitado: R$ %)',
      p_cash_box_id,
      (v_available / 100.0)::numeric(12,2),
      (p_amount_cents / 100.0)::numeric(12,2);
  end if;

  insert into public.transaction_reservations (
    cash_box_id, title, description, amount_cents, status, created_by
  ) values (
    p_cash_box_id, trim(p_title), nullif(trim(coalesce(p_description,'')), ''),
    p_amount_cents, 'ativa', v_uid
  )
  returning id into v_res_id;

  -- Auditoria
  insert into public.transaction_audit_logs (
    transaction_id, reservation_id, action, new_data, changed_by
  ) values (
    null,
    v_res_id, 'RESERVA_CRIADA',
    jsonb_build_object('cash_box_id', p_cash_box_id, 'title', trim(p_title),
                       'amount_cents', p_amount_cents),
    v_uid);

  return v_res_id;
end;
$$;

revoke execute on function public.sp_criar_reserva(text,text,bigint,text) from public, anon;
grant execute on function public.sp_criar_reserva(text,text,bigint,text) to authenticated;


-- D8. Liberar Reserva
create or replace function public.sp_liberar_reserva(p_reservation_id uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_res record;
begin
  if v_uid is null then raise exception 'Sessão inválida.'; end if;

  if not public.is_financial_manager(v_uid) then
    raise exception 'Acesso negado.';
  end if;

  select id, cash_box_id, status, amount_cents, title
    into v_res
    from public.transaction_reservations
    where id = p_reservation_id
    for update;

  if not found then
    raise exception 'Reserva não encontrada.';
  end if;

  if v_res.status <> 'ativa' then
    raise exception 'Apenas reservas ativas podem ser liberadas. Status atual: %', v_res.status;
  end if;

  update public.transaction_reservations
    set status = 'liberada',
        released_by = v_uid,
        released_at = now(),
        updated_at = now()
    where id = p_reservation_id;

  insert into public.transaction_audit_logs (
    transaction_id, reservation_id, action, old_data, new_data, changed_by
  ) values (
    null,
    p_reservation_id, 'RESERVA_LIBERADA',
    jsonb_build_object('status', 'ativa'),
    jsonb_build_object('status', 'liberada', 'released_by', v_uid),
    v_uid);

  return p_reservation_id;
end;
$$;

revoke execute on function public.sp_liberar_reserva(uuid) from public, anon;
grant execute on function public.sp_liberar_reserva(uuid) to authenticated;


-- D9. Consumir Reserva (usar os fundos reservados para uma despesa específica)
create or replace function public.sp_consumir_reserva(p_reservation_id uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_res record;
begin
  if v_uid is null then raise exception 'Sessão inválida.'; end if;

  if not public.is_financial_manager(v_uid) then
    raise exception 'Acesso negado.';
  end if;

  select id, cash_box_id, status, amount_cents, title
    into v_res
    from public.transaction_reservations
    where id = p_reservation_id
    for update;

  if not found then
    raise exception 'Reserva não encontrada.';
  end if;

  if v_res.status <> 'ativa' then
    raise exception 'Apenas reservas ativas podem ser consumidas. Status atual: %', v_res.status;
  end if;

  update public.transaction_reservations
    set status = 'consumida',
        released_by = v_uid,
        released_at = now(),
        updated_at = now()
    where id = p_reservation_id;

  insert into public.transaction_audit_logs (
    transaction_id, reservation_id, action, old_data, new_data, changed_by
  ) values (
    null,
    p_reservation_id, 'RESERVA_CONSUMIDA',
    jsonb_build_object('status', 'ativa'),
    jsonb_build_object('status', 'consumida', 'released_by', v_uid),
    v_uid);

  return p_reservation_id;
end;
$$;

revoke execute on function public.sp_consumir_reserva(uuid) from public, anon;
grant execute on function public.sp_consumir_reserva(uuid) to authenticated;


-- ============================================================================
-- PARTE E: REALTIME
-- ============================================================================
-- Adiciona as novas tabelas ao realtime se ainda não estiverem (é idempotente no Supabase)
do $$
begin
  alter publication supabase_realtime add table public.cash_boxes;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.transaction_reservations;
exception when duplicate_object then null;
end $$;

