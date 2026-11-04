import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Landmark, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { AppShell } from "@/components/m3/AppShell";
import { ChipGroup, MetricCard, ResponsiveTransactionList } from "@/components/m3/parts";
import { MonthlyChart } from "@/components/m3/MonthlyChart";
import { brl, summarize } from "@/lib/finance";
import { useTransactions } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "GDACaixa 2027 — Início" },
      { name: "description", content: "Saldo, receitas e despesas do clube Guerreiros do Alto em um só lugar." },
      { property: "og:title", content: "GDACaixa 2027 — Dashboard financeiro" },
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
    <AppShell title="Dashboard">
      <ChipGroup
        value={period}
        onChange={setPeriod}
        options={[
          { value: "all", label: "Tudo" },
          { value: "30", label: "30 dias" },
          { value: "90", label: "90 dias" },
        ]}
      />

      {/* Saldo Principal - M3 MetricCard com tema primário */}
      <MetricCard
        variant="primary"
        title="Saldo em Caixa"
        value={brl(s.balance)}
        subtitle="Saldo consolidado de todos os módulos"
        icon={Landmark}
      />

      {/* Métricas de Receitas e Despesas */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          variant="filled"
          title="Receitas"
          value={brl(s.income)}
          icon={ArrowDownLeft}
          tone="income"
        />
        <MetricCard
          variant="filled"
          title="Despesas"
          value={brl(s.expense)}
          icon={ArrowUpRight}
          tone="expense"
        />
      </div>

      {/* Gráfico Mensal */}
      <div className="rounded-3xl bg-surface-container-low p-5 border border-outline-variant/20 shadow-xs">
        <h2 className="text-base font-bold text-foreground mb-3">Receitas × Despesas por Mês</h2>
        <MonthlyChart items={items} />
      </div>

      {/* Lista Responsiva de Transações com visualização adaptada touch/desktop */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-bold text-foreground">Últimas Movimentações</h2>
          <Link to="/clube" className="text-xs font-bold text-primary hover:underline">
            Ver todas no Clube →
          </Link>
        </div>
        <ResponsiveTransactionList items={items.slice(0, 6)} title="" />
      </div>
    </AppShell>
  );
}
