import { createFileRoute } from "@tanstack/react-router";
import { Cake, TrendingUp, ShoppingBag, Receipt } from "lucide-react";
import { AppShell } from "@/components/m3/AppShell";
import { MetricCard, NewEntryFab, ResponsiveTransactionList } from "@/components/m3/parts";
import { brl, profitMargin, summarize } from "@/lib/finance";
import { useTransactions } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/doceria")({
  head: () => ({
    meta: [
      { title: "GDACaixa 2027 — Doceria" },
      { name: "description", content: "Vendas, custos e margem de lucro da doceria do clube." },
      { property: "og:title", content: "GDACaixa 2027 — Doceria" },
      { property: "og:description", content: "Vendas, custos e margem de lucro da doceria do clube." },
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
      {/* Card de Lucro com variante terciária M3 */}
      <MetricCard
        variant="tertiary"
        title="Lucro Líquido"
        value={brl(profit)}
        subtitle={`Margem de lucratividade de ${(margin * 100).toFixed(0)}% sobre vendas`}
        icon={TrendingUp}
      />

      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          variant="filled"
          title="Faturamento (Vendas)"
          value={brl(s.income)}
          icon={ShoppingBag}
          tone="income"
        />
        <MetricCard
          variant="filled"
          title="Custos Operacionais"
          value={brl(s.expense)}
          icon={Receipt}
          tone="expense"
        />
      </div>

      <ResponsiveTransactionList
        items={items}
        title="Movimentações da Doceria"
        empty="Nenhuma movimentação da doceria registrada ainda."
      />
    </AppShell>
  );
}
