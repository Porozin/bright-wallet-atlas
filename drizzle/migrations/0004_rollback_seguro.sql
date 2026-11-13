-- ==============================================================================
-- SCRIPT: 0004_rollback_seguro.sql
-- PROJETO: GDACaixa (Clube Guerreiros do Alto)
-- FINALIDADE: Reversão Segura, Controlada e NÃO-Destrutiva da Fase 1B
-- ==============================================================================
--
-- PRINCÍPIOS DESTE ROLLBACK:
-- 1. PRESERVAÇÃO INTEGRAL DE DADOS: Não executa DROP TABLE em nenhuma tabela
--    (transactions, cash_boxes, transaction_reservations, transaction_audit_logs).
-- 2. SEM PERMISSÕES IRRESTRITAS: Não cria a política "allow_all_transactions".
--    Restaura exatamente as políticas restritivas originais da migration 0000
--    baseadas em 'can_manage_cash' e 'has_role(admin)'.
-- 3. PRESERVAÇÃO DE AUDITORIA: Os logs de auditoria e reservas permanecem
--    salvos e protegidos contra alteração ou exclusão acidental.
-- ==============================================================================

-- 1. Remoção das RPCs da Fase 1B (reverte a lógica transacional)
drop function if exists public.sp_consumir_reserva(uuid);
drop function if exists public.sp_liberar_reserva(uuid);
drop function if exists public.sp_criar_reserva(text,text,bigint,text);
drop function if exists public.sp_estornar_transacao(uuid,text);
drop function if exists public.sp_rejeitar_solicitacao(uuid,text);
drop function if exists public.sp_aprovar_solicitacao(uuid,text);
drop function if exists public.sp_solicitar_despesa(text,bigint,text,text,date,text,text);
drop function if exists public.sp_registrar_transferencia(text,text,text,bigint,text,date);
drop function if exists public.sp_registrar_transacao_oficial(text,text,text,bigint,text,text,text,date,text);
drop function if exists public.fn_lock_dois_caixas(text,text);
drop function if exists public.fn_lock_caixa(text);
drop function if exists public.fn_saldo_disponivel(text);
drop function if exists public.is_financial_manager(uuid);

-- 2. Restauração das Políticas RLS Restritivas Originais em 'transactions'
-- Remove as políticas da Fase 1B
drop policy if exists "tx_select" on public.transactions;
drop policy if exists "tx_insert" on public.transactions;
drop policy if exists "tx_no_direct_update" on public.transactions;
drop policy if exists "tx_no_direct_delete" on public.transactions;
drop policy if exists "allow_all_transactions" on public.transactions;

-- Recria exatamente as políticas restritivas originais (Migration 0000)
-- Equipe de caixa vê tudo, outros membros veem apenas seus próprios lançamentos
create policy "Cash team sees all, others see own" on public.transactions
  for select to authenticated
  using (public.can_manage_cash(auth.uid()) or created_by = auth.uid());

-- Apenas equipe autorizada de caixa insere
create policy "Cash team records" on public.transactions
  for insert to authenticated
  with check (public.can_manage_cash(auth.uid()) and created_by = auth.uid());

-- Apenas admins editam e deletam
create policy "Admins edit" on public.transactions
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins delete" on public.transactions
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- 3. Proteção Contínua das Tabelas de Apoio (Auditoria e Reservas)
-- NENHUMA TABELA É EXCLUÍDA. Os dados são mantidos com RLS ativo.
drop policy if exists "audit_select" on public.transaction_audit_logs;
create policy "audit_select_admin" on public.transaction_audit_logs
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "res_select" on public.transaction_reservations;
create policy "res_select_gestor" on public.transaction_reservations
  for select to authenticated
  using (public.can_manage_cash(auth.uid()));

