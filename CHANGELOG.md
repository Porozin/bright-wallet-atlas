# CHANGELOG — GDACaixa

Todas as alterações notáveis deste projeto serão documentadas neste arquivo.

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

