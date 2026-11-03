import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/m3/AppShell";
import { ChipGroup, M3Card, Stat, TransactionList } from "@/components/m3/parts";
import { MonthlyChart } from "@/components/m3/MonthlyChart";
import { brl, summarize, useTransactions } from "@/lib/finance";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GDACaixa · Início" },
      { name: "description", content: "Saldo, receitas e despesas do clube Guerreiros do Alto em um só lugar." },
      { property: "og:title", content: "GDACaixa · Dashboard financeiro" },
      { property: "og:description", content: "Saldo, receitas e despesas do clube Guerreiros do Alto." },
    ],
  }),
  component: Home,
});

type Period = "all" | "30" | "90";

function Home() {
  const all = useTransactions();
  const [period, setPeriod] = useState<Period>("all");
  const latest = all[0]?.date ?? new Date().toISOString().slice(0, 10);
  const cutoff = period === "all" ? "" : new Date(new Date(latest).getTime() - Number(period) * 864e5).toISOString().slice(0, 10);
  const items = all.filter((t) => t.date >= cutoff);
  const s = summarize(items);

  return (
    <AppShell title="Início">
      <ChipGroup value={period} onChange={setPeriod} options={[{ value: "all", label: "Tudo" }, { value: "30", label: "30 dias" }, { value: "90", label: "90 dias" }]} />
      <M3Card variant="primary" className="rounded-xl p-6">
        <p className="label-large opacity-80">Saldo em caixa</p>
        <p className="display-small mt-2">{brl(s.balance)}</p>
      </M3Card>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Receitas" value={s.income} tone="income" />
        <Stat label="Despesas" value={s.expense} tone="expense" />
      </div>
      <M3Card>
        <h2 className="title-medium mb-2">Receitas x despesas por mês</h2>
        <MonthlyChart items={items} />
      </M3Card>
      <div className="flex items-center justify-between pt-2">
        <h2 className="title-medium">Últimas movimentações</h2>
        <Link to="/clube" className="label-large text-primary">Ver clube</Link>
      </div>
      <TransactionList items={items.slice(0, 6)} />
    </AppShell>
  );
}
