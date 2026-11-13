# CHANGELOG — GDACaixa

Todas as alterações notáveis deste projeto serão documentadas neste arquivo.

## [0.2.1] - 2026-11-13
### Fase 1B — Fundação de Dados, Modelagem, Concorrência e Segurança (Concluída para Revisão)
#### Adicionado
- **Migração SQL Estruturada e Segura (`drizzle/migrations/`):**
  - `0003_enum_tesoureiro.sql`: Adiciona o valor `tesoureiro` ao enum `app_role` de forma isolada para transacionalidade segura no PostgreSQL.
  - `0004_fase1b_fundacao.sql`: Modelagem completa dos 3 caixas fixos (`geral`, `doceria`, `vendas`) mais caixa especial inativo `_quarentena`.
  - Tabela `transaction_reservations` com controle de estados (`ativa`, `liberada`, `consumida`) e auditoria.
  - Tabela de auditoria append-only `transaction_audit_logs` com trigger de bloqueio total de `UPDATE` e `DELETE` e integridade referencial `ON DELETE RESTRICT`.
  - RPCs atômicas server-side protegidas (`SECURITY DEFINER`, search_path fixo, `REVOKE` de public/anon):
    - `sp_registrar_transacao_oficial`: Idempotência estrita com detecção de divergência de parâmetros, advisory locks e cálculo de saldo disponível.
    - `sp_registrar_transferencia`: Atomicidade total com locking ordenado em ambos os caixas e neutralidade contábil.
    - `sp_solicitar_despesa`: Solicitação preliminar de conselheiro com status forçado para `pendente`.
    - `sp_aprovar_solicitacao` e `sp_rejeitar_solicitacao`: Governança de aprovação com registro do gestor e motivo obrigatório em rejeições.
    - `sp_estornar_transacao`: Estorno com transação compensatória oficial e trilha imutável.
    - `sp_criar_reserva`, `sp_liberar_reserva`, `sp_consumir_reserva`: Bloqueio de saldo sem transferência inter-caixas.
- **Suite de Testes da Fase 1B (`src/lib/fase1b.test.ts`):**
  - Implementação dos 14 cenários de integridade financeira, concorrência, RLS, idempotência e bloqueio de adulterações.
- **Integração no Cliente (`src/lib/data.ts`):**
  - Implementação dos wrappers tipados para chamada de todas as RPCs com fallback seguro para o schema legado.

#### Modificado
- `src/lib/finance.ts`: Adicionado status `rejeitado` e campos de solicitação/aprovação na interface `Transaction`.
- `drizzle/migrations/0004_fase1b_fundacao.sql`: Atualização do check constraint legado `transactions_kind_check` para suportar `transferencia`.

#### Removido
- Removido arquivo obsoleto `drizzle/migrations/0003_fase1b_fundacao_modelagem_seguranca.sql` substituído pela separação segura 0003 + 0004.

## [0.2.0] - 2026-11-13
### Fase 1A — Núcleo Financeiro (Concluída)
#### Adicionado
- **Módulo Financeiro Centralizado (`src/lib/finance.ts`):**
  - Funções de conversão monetária segura: `toCents()`, `fromCents()`, `sumCents()`, `brl()`, `brlFromCents()`.
  - Cálculo de saldos independentes por caixa: `summarizeBox()`.
  - Consolidação oficial invariante com neutralidade de transferências: `consolidateAllBoxes()`.
  - Tratamento contábil de reservas de saldo (`CashReservation`).
  - Tratamento de status de transações (`pendente`, `confirmado`, `estornado`, `corrigido`).
- **Testes Automatizados (`src/lib/finance.test.ts`):**
  - Cobertura dos 10 cenários obrigatórios de integridade monetária e contábil.
- **Documentação Técnica Inicial:**
  - Criação do `README.TECHNICAL.md` com especificação da arquitetura matemática e financeira.

#### Modificado
- **Integração de Dados (`src/lib/data.ts`):**
  - Adicionado suporte a `amount_cents` na recuperação de transações.
  - Inclusão do papel `tesoureiro` no enum de funções e no `ROLE_LABEL`.
  - Restrição de gravação oficial em `useCanRecord` exclusivamente para `admin`, `diretor` e `tesoureiro` (conselheiros não gravam como confirmado direto).

#### Corrigido
- Eliminado risco de imprecisão de ponto flutuante em operações monetárias.
- Eliminado risco de transferências inflarem artificialmente o resultado consolidado do clube.

