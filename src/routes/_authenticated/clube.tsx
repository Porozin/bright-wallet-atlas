import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Landmark, ArrowDownLeft, ArrowUpRight, Search } from "lucide-react";
import { AppShell } from "@/components/m3/AppShell";
import { ChipGroup, MetricCard, NewEntryFab, ResponsiveTransactionList } from "@/components/m3/parts";
import { brl, summarize } from "@/lib/finance";
import { useTransactions } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/clube")({
  head: () => ({
    meta: [
      { title: "GDACaixa 2027 — Clube" },
      { name: "description", content: "Mensalidades, doações e despesas gerais do clube." },
      { property: "og:title", content: "GDACaixa 2027 — Clube" },
      { property: "og:description", content: "Mensalidades, doações e despesas gerais do clube." },
    ],
  }),
  component: Clube,
});

function Clube() {
  const all = useTransactions("clube");
  const [kind, setKind] = useState<"all" | "receita" | "despesa">("all");
  const [q, setQ] = useState("");
  const s = summarize(all);
  const items = all.filter(
    (t) =>
      (kind === "all" || t.kind === kind) &&
      (t.description.toLowerCase().includes(q.toLowerCase()) ||
        t.category.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <AppShell title="Clube" fab={<NewEntryFab module="clube" />}>
      {/* Saldo do Clube */}
      <MetricCard
        variant="elevated"
        title="Saldo do Clube"
        value={brl(s.balance)}
        subtitle="Mensalidades, doações e despesas gerais"
        icon={Landmark}
      />

      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          variant="filled"
          title="Entradas"
          value={brl(s.income)}
          icon={ArrowDownLeft}
          tone="income"
        />
        <MetricCard
          variant="filled"
          title="Saídas"
          value={brl(s.expense)}
          icon={ArrowUpRight}
          tone="expense"
        />
      </div>

      {/* Campo de Busca M3 com cantos arredondados */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por descrição ou categoria…"
          className="h-14 w-full rounded-2xl bg-surface-container-high/60 pl-12 pr-4 text-sm text-foreground outline-none border border-outline-variant/30 focus:border-2 focus:border-primary transition-all"
        />
      </div>

      <ChipGroup
        value={kind}
        onChange={setKind}
        options={[
          { value: "all", label: "Todas" },
          { value: "receita", label: "Entradas" },
          { value: "despesa", label: "Saídas" },
        ]}
      />

      <ResponsiveTransactionList
        items={items}
        title="Histórico de Movimentações do Clube"
        empty="Nenhuma movimentação encontrada para os filtros selecionados."
      />
    </AppShell>
  );
}
