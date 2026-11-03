import { describe, expect, it } from "vitest";
import { commissionBySeller, profitMargin, summarize, type Transaction } from "./finance";

const t = (p: Partial<Transaction>): Transaction => ({
  id: "x", module: "vendas", kind: "receita", amount: 0, category: "", description: "", date: "2026-01-01", ...p,
});

describe("finance rules", () => {
  it("balance = receitas - despesas", () => {
    expect(summarize([t({ amount: 100 }), t({ kind: "despesa", amount: 30 })])).toEqual({ income: 100, expense: 30, balance: 70 });
  });
  it("doceria profit and margin", () => {
    expect(profitMargin(500, 200)).toEqual({ profit: 300, margin: 0.6 });
  });
  it("commission is 10% of each seller's sales", () => {
    const r = commissionBySeller([t({ seller: "Ana", amount: 300 }), t({ seller: "Ana", amount: 100 }), t({ seller: "Lu", amount: 50 })]);
    expect(r[0]).toEqual({ seller: "Ana", sales: 400, commission: 40 });
    expect(r[1].commission).toBe(5);
  });
});
