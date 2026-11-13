import { describe, expect, it } from "vitest";
import {
  toCents,
  fromCents,
  sumCents,
  brl,
  brlFromCents,
  summarize,
  summarizeBox,
  consolidateAllBoxes,
  profitMargin,
  commissionBySeller,
  type Transaction,
  type CashReservation,
} from "./finance";

const t = (p: Partial<Transaction>): Transaction => ({
  id: "tx-test",
  module: "clube",
  kind: "receita",
  amount: 0,
  category: "Geral",
  description: "Teste",
  date: "2026-03-01",
  status: "confirmado",
  ...p,
});

describe("Núcleo Financeiro GDACaixa — Testes de Integridade (Fase 1A)", () => {
  // 1. Conversão de R$ 10,50 para 1050 centavos
  describe("Conversões monetárias e centavos", () => {
    it("converte R$ 10,50 para 1050 centavos (number e string pt-BR)", () => {
      expect(toCents(10.5)).toBe(1050);
      expect(toCents("10,50")).toBe(1050);
      expect(toCents("R$ 10,50")).toBe(1050);
      expect(toCents("10.50")).toBe(1050);
      expect(toCents("1.250,75")).toBe(125075);
    });

    it("converte centavos de volta para reais com precisão", () => {
      expect(fromCents(1050)).toBe(10.5);
      expect(fromCents(125075)).toBe(1250.75);
      expect(fromCents(0)).toBe(0);
      expect(fromCents(null)).toBe(0);
    });

    it("trata valores nulos, indefinidos, vazios ou inválidos retornando 0", () => {
      expect(toCents(null)).toBe(0);
      expect(toCents(undefined)).toBe(0);
      expect(toCents("")).toBe(0);
      expect(toCents("texto_invalido")).toBe(0);
      expect(toCents(NaN)).toBe(0);
      expect(toCents(Infinity)).toBe(0);
    });

    it("suporta valores negativos com preservação de magnitude", () => {
      expect(toCents(-10.5)).toBe(-1050);
      expect(toCents("-10,50")).toBe(-1050);
      expect(fromCents(-1050)).toBe(-10.5);
    });

    it("soma listas de centavos protegendo contra tipos inválidos", () => {
      expect(sumCents([1000, 250, null, 50, undefined])).toBe(1300);
    });

    it("formata valores para padrão BRL", () => {
      const formatted = brlFromCents(1050);
      // Contém '10,50'
      expect(formatted).toContain("10,50");
    });
  });

  // 2. Operações de receitas, despesas e saldos
  describe("Cálculos de receitas, despesas e saldos", () => {
    it("calcula saldo correto: receitas - despesas", () => {
      const txs = [
        t({ amount: 100, kind: "receita" }),
        t({ amount: 30, kind: "despesa" }),
      ];
      const s = summarize(txs);
      expect(s.income_cents).toBe(10000);
      expect(s.expense_cents).toBe(3000);
      expect(s.balance_cents).toBe(7000);
      expect(s.income).toBe(100);
      expect(s.expense).toBe(30);
      expect(s.balance).toBe(70);
    });

    it("permite saldo negativo caso despesas superem receitas", () => {
      const txs = [
        t({ amount: 50, kind: "receita" }),
        t({ amount: 150, kind: "despesa" }),
      ];
      const s = summarize(txs);
      expect(s.balance_cents).toBe(-10000);
      expect(s.balance).toBe(-100);
    });

    it("calcula margem de lucro com precisão em centavos", () => {
      expect(profitMargin(500, 200)).toEqual({ profit: 300, margin: 0.6 });
      expect(profitMargin(10, 10)).toEqual({ profit: 0, margin: 0 });
    });

    it("calcula comissões de vendedores em centavos inteiros", () => {
      const txs = [
        t({ seller: "Lucas", amount: 300, kind: "receita" }),
        t({ seller: "Lucas", amount: 100, kind: "receita" }),
        t({ seller: "Mariana", amount: 50, kind: "receita" }),
      ];
      const ranking = commissionBySeller(txs);
      expect(ranking[0]).toEqual({
        seller: "Lucas",
        sales: 400,
        commission: 40,
        sales_cents: 40000,
        commission_cents: 4000,
      });
      expect(ranking[1]?.commission).toBe(5);
    });
  });

  // 3. Regras de Não-Contaminação e Consolidação entre Caixas
  describe("Transferências internas e consolidação entre os 3 caixas", () => {
    it("transferência interna debita o caixa de origem e credita o destino sem alterar o consolidado", () => {
      const txs: Transaction[] = [
        // Doceria fatura R$ 500 em vendas
        t({
          cash_box_id: "doceria",
          module: "doceria",
          kind: "receita",
          amount: 500,
        }),
        // Clube fatura R$ 200 em doação
        t({
          cash_box_id: "geral",
          module: "clube",
          kind: "receita",
          amount: 200,
        }),
        // Doceria transfere R$ 300 para o Caixa Geral
        t({
          cash_box_id: "doceria",
          destination_cash_box_id: "geral",
          kind: "transferencia",
          amount: 300,
        }),
      ];

      // Verificação do Caixa Doceria individual
      const boxDoceria = summarizeBox(txs, "doceria");
      expect(boxDoceria.income).toBe(500);
      expect(boxDoceria.transfers_out).toBe(300);
      expect(boxDoceria.transfers_in).toBe(0);
      expect(boxDoceria.balance).toBe(200); // 500 - 300 = 200

      // Verificação do Caixa Geral individual
      const boxGeral = summarizeBox(txs, "geral");
      expect(boxGeral.income).toBe(200);
      expect(boxGeral.transfers_in).toBe(300);
      expect(boxGeral.transfers_out).toBe(0);
      expect(boxGeral.balance).toBe(500); // 200 + 300 = 500

      // Verificação CONSOLIDADA do Clube:
      // O patrimônio total DEVE ser exatamente R$ 700 (500 + 200), e a transferência NÃO conta como receita!
      const consolidado = summarize(txs);
      expect(consolidado.income).toBe(700); // 500 + 200 (não 1000!)
      expect(consolidado.expense).toBe(0);
      expect(consolidado.balance).toBe(700);

      // Invariante Contábil: Saldo Consolidado == Soma dos Saldos dos Caixas
      expect(boxDoceria.balance + boxGeral.balance).toBe(consolidado.balance);
    });

    it("reserva compromete o saldo disponível sem alterar o saldo contábil do caixa", () => {
      const txs: Transaction[] = [
        t({
          cash_box_id: "geral",
          kind: "receita",
          amount: 1000,
        }),
      ];
      const reservations: CashReservation[] = [
        {
          id: "res-1",
          cash_box_id: "geral",
          title: "Inscrição Campori",
          amount_cents: 40000, // R$ 400,00
          status: "ativa",
        },
      ];

      const boxGeral = summarizeBox(txs, "geral", reservations);
      expect(boxGeral.balance).toBe(1000); // Saldo contábil total
      expect(boxGeral.reserved).toBe(400); // Reservado
      expect(boxGeral.available).toBe(600); // Disponível para gastar
    });
  });

  // 4. Estados Financeiros (Pendente, Confirmado, Estornado)
  describe("Tratamento de estados e exclusão de pendências/estornos", () => {
    it("exclui movimentações pendentes do saldo oficial confirmado", () => {
      const txs: Transaction[] = [
        t({ amount: 100, kind: "receita", status: "confirmado" }),
        // Solicitação pendente de conselheiro (não deve alterar o saldo!)
        t({ amount: 50, kind: "despesa", status: "pendente" }),
      ];

      const s = summarize(txs);
      expect(s.income).toBe(100);
      expect(s.expense).toBe(0); // A despesa pendente NÃO entrou
      expect(s.balance).toBe(100);
    });

    it("exclui movimentações estornadas do saldo oficial", () => {
      const txs: Transaction[] = [
        t({ amount: 200, kind: "receita", status: "confirmado" }),
        t({ amount: 80, kind: "despesa", status: "estornado" }),
      ];

      const s = summarize(txs);
      expect(s.expense).toBe(0); // A despesa estornada foi desconsiderada
      expect(s.balance).toBe(200);
    });

    it("consolida todos os caixas e assegura consistência integral", () => {
      const txs: Transaction[] = [
        t({ cash_box_id: "geral", kind: "receita", amount: 1000 }),
        t({ cash_box_id: "doceria", kind: "receita", amount: 600 }),
        t({ cash_box_id: "vendas", kind: "receita", amount: 400 }),
        t({
          cash_box_id: "doceria",
          destination_cash_box_id: "geral",
          kind: "transferencia",
          amount: 200,
        }),
      ];

      const report = consolidateAllBoxes(txs);
      expect(report.consolidated.balance).toBe(2000);
      expect(report.geral.balance).toBe(1200);
      expect(report.doceria.balance).toBe(400);
      expect(report.vendas.balance).toBe(400);
      expect(
        report.geral.balance + report.doceria.balance + report.vendas.balance
      ).toBe(report.consolidated.balance);
    });
  });
});
