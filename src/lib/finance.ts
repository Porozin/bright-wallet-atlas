export type Module = "clube" | "doceria" | "vendas";
export type Kind = "receita" | "despesa";

export interface Transaction {
  id: string;
  module: Module;
  kind: Kind;
  amount: number;
  category: string;
  description: string;
  date: string; // ISO yyyy-mm-dd
  seller?: string | undefined;
}

export const MODULE_LABEL: Record<Module, string> = {
  clube: "Clube",
  doceria: "Doceria",
  vendas: "Vendas",
};

/** Commission rate for quick sales / events (sample rule). */
export const COMMISSION_RATE = 0.1;

export function summarize(list: Transaction[]) {
  let income = 0;
  let expense = 0;
  for (const t of list) {
    if (t.kind === "receita") income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, balance: income - expense };
}

export function profitMargin(revenue: number, cost: number) {
  const profit = revenue - cost;
  return { profit, margin: revenue > 0 ? profit / revenue : 0 };
}

export function commissionBySeller(list: Transaction[], rate = COMMISSION_RATE) {
  const map = new Map<string, { sales: number; commission: number }>();
  for (const t of list) {
    if (t.kind !== "receita" || !t.seller) continue;
    const cur = map.get(t.seller) ?? { sales: 0, commission: 0 };
    cur.sales += t.amount;
    cur.commission = Math.round(cur.sales * rate * 100) / 100;
    map.set(t.seller, cur);
  }
  return [...map.entries()]
    .map(([seller, v]) => ({ seller, ...v }))
    .sort((a, b) => b.sales - a.sales);
}

export function monthlySeries(list: Transaction[]) {
  const map = new Map<string, { month: string; receita: number; despesa: number }>();
  for (const t of list) {
    const key = t.date.slice(0, 7);
    const cur = map.get(key) ?? { month: key, receita: 0, despesa: 0 };
    cur[t.kind] += t.amount;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

