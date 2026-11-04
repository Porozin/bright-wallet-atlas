import { createFileRoute } from "@tanstack/react-router";
import { Zap, Trophy, TrendingUp, Users } from "lucide-react";
import { AppShell } from "@/components/m3/AppShell";
import { MetricCard, NewEntryFab, ResponsiveTransactionList } from "@/components/m3/parts";
import { brl, COMMISSION_RATE, commissionBySeller, summarize } from "@/lib/finance";
import { useTransactions } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/vendas")({
  head: () => ({
    meta: [
      { title: "GDACaixa 2027 — Vendas e Eventos" },
      { name: "description", content: "Vendas rápidas, eventos, comissões e ranking por vendedor." },
      { property: "og:title", content: "GDACaixa 2027 — Vendas e Eventos" },
      { property: "og:description", content: "Vendas rápidas, eventos, comissões e ranking por vendedor." },
    ],
  }),
  component: Vendas,
});

function Vendas() {
  const items = useTransactions("vendas");
  const s = summarize(items);
  const ranking = commissionBySeller(items);
  const totalComissoes = ranking.reduce((acc, cur) => acc + cur.commission, 0);

  return (
    <AppShell title="Vendas Rápidas" fab={<NewEntryFab module="vendas" withSeller />}>
      {/* Resumo de Vendas */}
      <MetricCard
        variant="primary"
        title="Total de Vendas & Eventos"
        value={brl(s.income)}
        subtitle={`Total em comissões distribuídas: ${brl(totalComissoes)}`}
        icon={Zap}
      />

      {/* Ranking de Comissões por Vendedor */}
      <div className="rounded-3xl bg-surface-container-low p-5 border border-outline-variant/20 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy className="size-5 text-amber-500" />
            <h2 className="text-base font-bold text-foreground">
              Ranking & Comissões ({COMMISSION_RATE * 100}%)
            </h2>
          </div>
          <span className="text-xs text-muted-foreground font-semibold">
            {ranking.length} {ranking.length === 1 ? "vendedor" : "vendedores"}
          </span>
        </div>

        <ul className="space-y-2.5">
          {ranking.map((r, i) => (
            <li
              key={r.seller}
              className="flex items-center gap-3.5 p-2.5 rounded-2xl bg-surface-container-highest/40 hover:bg-surface-container-high/60 transition-colors"
            >
              <span
                className={`text-xs font-black flex size-9 shrink-0 items-center justify-center rounded-full ${
                  i === 0
                    ? "bg-amber-400/20 text-amber-600 dark:text-amber-300 ring-2 ring-amber-400/40"
                    : i === 1
                    ? "bg-slate-300/30 text-slate-700 dark:text-slate-300"
                    : i === 2
                    ? "bg-amber-700/20 text-amber-800 dark:text-amber-400"
                    : "bg-surface-container text-muted-foreground"
                }`}
              >
                {i + 1}º
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{r.seller}</p>
                <p className="text-xs text-muted-foreground">
                  {brl(r.sales)} vendidos
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs text-muted-foreground block font-medium">Comissão</span>
                <span className="text-sm font-bold text-income">{brl(r.commission)}</span>
              </div>
            </li>
          ))}
          {!ranking.length && (
            <div className="py-6 text-center text-xs text-muted-foreground">
              Nenhuma venda atribuída a vendedor até o momento.
            </div>
          )}
        </ul>
      </div>

      <ResponsiveTransactionList
        items={items}
        title="Histórico de Vendas"
        empty="Nenhuma venda ou evento registrado ainda."
      />
    </AppShell>
  );
}
