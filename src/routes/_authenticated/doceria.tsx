import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/m3/AppShell";
import { M3Card, NewEntryFab, Stat, TransactionList } from "@/components/m3/parts";
import { brl, profitMargin, summarize } from "@/lib/finance";
import { useTransactions } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/doceria")({
  head: () => ({
    meta: [
      { title: "GDACaixa · Doceria" },
      { name: "description", content: "Vendas, custos e lucro da doceria do clube." },
      { property: "og:title", content: "GDACaixa · Doceria" },
      { property: "og:description", content: "Vendas, custos e lucro da doceria do clube." },
    ],
  }),
  component: Doceria,
});

function Doceria() {
  const items = useTransactions("doceria");
  const s = summarize(items);
  const { profit, margin } = profitMargin(s.income, s.expense);
  return (
    <AppShell title="Doceria" fab={<NewEntryFab module="doceria" />}>
      <M3Card variant="tertiary" className="rounded-xl p-6">
        <p className="label-large opacity-80">Lucro</p>
        <p className="display-small mt-2">{brl(profit)}</p>
        <p className="label-large mt-1">Margem de {(margin * 100).toFixed(0)}%</p>
      </M3Card>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Vendas" value={s.income} tone="income" />
        <Stat label="Custos" value={s.expense} tone="expense" />
      </div>
      <h2 className="title-medium pt-2">Movimentações</h2>
      <TransactionList items={items} />
    </AppShell>
  );
}
