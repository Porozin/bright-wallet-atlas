import { useSyncExternalStore } from "react";

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

// ---- Sample in-memory store (replaced by Lovable Cloud in Etapa 3) ----
const seed: Transaction[] = [
  { id: "1", module: "clube", kind: "receita", amount: 600, category: "Mensalidade", description: "Mensalidades de agosto", date: "2026-08-05" },
  { id: "2", module: "clube", kind: "despesa", amount: 220, category: "Material", description: "Lenços e insígnias", date: "2026-08-12" },
  { id: "3", module: "doceria", kind: "receita", amount: 480, category: "Venda", description: "Brigadeiros culto sábado", date: "2026-08-17" },
  { id: "4", module: "doceria", kind: "despesa", amount: 190, category: "Insumos", description: "Chocolate e leite condensado", date: "2026-08-15" },
  { id: "5", module: "clube", kind: "receita", amount: 650, category: "Mensalidade", description: "Mensalidades de setembro", date: "2026-09-05" },
  { id: "6", module: "vendas", kind: "receita", amount: 320, category: "Rifa", description: "Rifa do acampamento", date: "2026-09-10", seller: "Ana" },
  { id: "7", module: "vendas", kind: "receita", amount: 210, category: "Rifa", description: "Rifa do acampamento", date: "2026-09-11", seller: "Lucas" },
  { id: "8", module: "clube", kind: "despesa", amount: 540, category: "Evento", description: "Transporte campori", date: "2026-09-20" },
  { id: "9", module: "doceria", kind: "receita", amount: 560, category: "Venda", description: "Bolos de pote", date: "2026-10-03" },
  { id: "10", module: "doceria", kind: "despesa", amount: 230, category: "Insumos", description: "Embalagens e frutas", date: "2026-10-01" },
  { id: "11", module: "clube", kind: "receita", amount: 300, category: "Doação", description: "Doação da igreja", date: "2026-10-14" },
  { id: "12", module: "vendas", kind: "receita", amount: 410, category: "Evento", description: "Cantina do evento", date: "2026-10-22", seller: "Ana" },
  { id: "13", module: "clube", kind: "receita", amount: 640, category: "Mensalidade", description: "Mensalidades de novembro", date: "2026-11-02" },
];

let state = seed;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function addTransaction(t: Omit<Transaction, "id">) {
  state = [{ ...t, id: crypto.randomUUID() }, ...state];
  listeners.forEach((l) => l());
}

export function useTransactions(module?: Module) {
  const all = useSyncExternalStore(subscribe, () => state, () => state);
  const list = module ? all.filter((t) => t.module === module) : all;
  return [...list].sort((a, b) => b.date.localeCompare(a.date));
}
