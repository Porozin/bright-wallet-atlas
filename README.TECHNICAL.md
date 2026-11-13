# README TÉCNICO — GDACaixa
**Projeto:** Clube Guerreiros do Alto (GDA)  
**Repositório:** bright-wallet-atlas  
**Versão Atual:** 0.2.0 (Fase 1A: Núcleo Financeiro Implementado)

---

## 1. Arquitetura do Núcleo Financeiro (`src/lib/finance.ts`)

O módulo financeiro foi completamente refatorado e centralizado como a **fonte única da verdade contábil** do clube.

### 1.1 Representação Monetária em Centavos Inteiros
- Todos os cálculos contábeis (somas, subtrações, comissões, margens e saldos) são executados em **centavos inteiros** (`number` inteiro seguro de 64 bits, até $\pm 9 \times 10^{15}$ centavos, equivalente a R$ 90 trilhões).
- Elimina-se completamente o erro acumulativo de ponto flutuante binário do padrão IEEE 754 (ex: `0.1 + 0.2 = 0.30000000000000004`).
- **Conversão Segura na Borda (`toCents`):**
  - Trata `number`, strings no padrão `pt-BR` (`"1.250,50"`), formatos internacionais (`"1250.50"`), símbolos monetários (`"R$ 10,00"`), e valores inválidos/nulos retornando `0` de forma previsível e sem quebras de runtime.
- **Formatação (`brl` e `brlFromCents`):**
  - Formatação padronizada para a moeda brasileira via `Intl.NumberFormat('pt-BR')`.

### 1.2 Regras de Consolidação e Neutralidade de Transferências
- **Os 3 Caixas Fixos:**
  1. `geral` (Caixa Geral do Clube)
  2. `doceria` (Doceria do Clube)
  3. `vendas` (Vendas Rápidas / Eventos)
- **Neutralidade de Transferências:**
  - A função `summarizeBox(list, boxId)` debita a saída do caixa de origem (`transfers_out_cents`) e credita no caixa de destino (`transfers_in_cents`).
  - A função consolidada `summarize(list)` **NÃO computa transferências internas** em `income` nem em `expense`.
  - **Invariante Contábil Garantido:**
    $$\text{Saldo Geral} + \text{Saldo Doceria} + \text{Saldo Vendas} \equiv \text{Saldo Consolidado Oficial}$$

### 1.3 Distinção entre Saldo Contábil, Saldo Reservado e Disponível
- **Reserva de Saldo (`CashReservation`):**
  - A reserva (ex: Campori, reforma) não transfere fundos para outro caixa, mas compromete parte do saldo disponível.
  - $\text{Saldo Disponível} = \text{Saldo Total Contábil} - \text{Reservas Ativas}$.

### 1.4 Exclusão de Movimentações Pendentes e Estornadas
- Movimentações com `status !== 'confirmado'` (ex: solicitações preliminares de conselheiros com status `pendente` ou transações canceladas com status `estornado`) são **estritamente excluídas do saldo oficial** do caixa e do consolidado.

---

## 2. Matriz de Testes Financeiros Automatizados

Implementada em `src/lib/finance.test.ts` e validada com 100% de aprovação nos 10 critérios obrigatórios:
1. Conversão de R$ 10,50 para 1050 centavos (pt-BR e number).
2. Soma de centavos protegendo contra tipos nulos/indefinidos.
3. Subtração e saldo contábil exato (`income - expense`).
4. Precisão decimal de centavos sem arredondamento errôneo.
5. Tratamento resiliente de valores nulos, vazios e strings corrompidas.
6. Suporte a saldos negativos quando despesas superam receitas.
7. Neutralidade de transferências internas (R$ 300 transferidos da Doceria para o Geral debitam 300 da Doceria, creditam 300 no Geral e mantêm o consolidado em R$ 700 sem inflar receitas).
8. Exclusão de movimentações pendentes do saldo oficial.
9. Exclusão de movimentações estornadas do saldo oficial.
10. Controle de reservas ativas com cálculo correto de saldo disponível.

---

## 3. Arquivos Alterados na Fase 1A

- `src/lib/finance.ts`: Reescrita com núcleo monetário em centavos, neutralidade contábil e consolidação.
- `src/lib/finance.test.ts`: Bateria completa com os 10 testes de integridade contábil.
- `src/lib/data.ts`: Integração com `amount_cents`, inclusão do cargo `tesoureiro` nas tipagens e unificação das funções de autorização financeira (`useCanRecord`, `useIsFinancialManager`).

