import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/m3/AppShell";
import { ChipGroup, NewEntryFab, Stat, TransactionList } from "@/components/m3/parts";
import { summarize, useTransactions } from "@/lib/finance";

export const Route = createFileRoute("/clube")({
  head: () => ({
    meta: [
      { title: "GDACaixa · Clube" },
      { name: "description", content: "Mensalidades, doações e despesas do clube." },
      { property: "og:title", content: "GDACaixa · Clube" },
      { property: "og:description", content: "Mensalidades, doações e despesas do clube." },
    ],
  }),
  component: Clube,
});

function Clube() {
  const all = useTransactions("clube");
  const [kind, setKind] = useState<"all" | "receita" | "despesa">("all");
  const [q, setQ] = useState("");
  const s = summarize(all);
  const items = all.filter((t) => (kind === "all" || t.kind === kind) && t.description.toLowerCase().includes(q.toLowerCase()));
  return (
    <AppShell title="Clube" fab={<NewEntryFab module="clube" />}>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Entradas" value={s.income} tone="income" />
        <Stat label="Saídas" value={s.expense} tone="expense" />
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar movimentação" className="h-14 w-full rounded-full bg-surface-container-high px-6 outline-none" />
      <ChipGroup value={kind} onChange={setKind} options={[{ value: "all", label: "Todas" }, { value: "receita", label: "Receitas" }, { value: "despesa", label: "Despesas" }]} />
      <TransactionList items={items} />
    </AppShell>
  );
}
