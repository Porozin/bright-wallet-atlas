import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Landmark,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  Cake,
  Zap,
  Lock,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/m3/AppShell";
import {
  ChipGroup,
  MetricCard,
  ResponsiveTransactionList,
  TransferDrawer,
} from "@/components/m3/parts";
import { MonthlyChart } from "@/components/m3/MonthlyChart";
import {
  brl,
  summarize,
  consolidateAllBoxes,
  summarizeBox,
  CASH_BOX_LABEL,
} from "@/lib/finance";
import { useCanRecord, useReservations, useTransactions } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "GDACaixa 2027 — Dashboard Consolidado" },
      {
        name: "description",
        content:
          "Visão financeira consolidada dos três caixas: Geral, Doceria e Vendas Rápidas.",
      },
      { property: "og:title", content: "GDACaixa 2027 — Dashboard Consolidado" },
      {
        property: "og:description",
        content: "Gestão dos três caixas do Clube Guerreiros do Alto.",
      },
    ],
  }),
  component: Home,
});

type Period = "all" | "30" | "90";

function Home() {
  const all = useTransactions();
  const allReservations = useReservations();
  const canRecord = useCanRecord();

  const [period, setPeriod] = useState<Period>("all");
  const [transferOpen, setTransferOpen] = useState(false);

  const latest = all[0]?.date ?? new Date().toISOString().slice(0, 10);
  const cutoff =
    period === "all"
      ? ""
      : new Date(new Date(latest).getTime() - Number(period) * 864e5)
          .toISOString()
          .slice(0, 10);
  const items = all.filter((t) => t.date >= cutoff);

  // Consolidação matemática dos três caixas
  const consolidation = consolidateAllBoxes(all, allReservations);
  const s = summarize(items);

  const geralBox = summarizeBox(all, "geral", allReservations);
  const doceriaBox = summarizeBox(all, "doceria", allReservations);
  const vendasBox = summarizeBox(all, "vendas", allReservations);

  return (
    <AppShell title="Dashboard Financeiro">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <ChipGroup
          value={period}
          onChange={setPeriod}
          options={[
            { value: "all", label: "Tudo" },
            { value: "30", label: "30 dias" },
            { value: "90", label: "90 dias" },
          ]}
        />

        {canRecord && (
          <button
            type="button"
            onClick={() => setTransferOpen(true)}
            className="h-9 px-3.5 rounded-full bg-secondary-container text-on-secondary-container text-xs font-bold hover:bg-secondary-container/80 flex items-center gap-1.5 shadow-xs transition-all"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Transferir entre Caixas</span>
          </button>
        )}
      </div>

      {/* Saldo Consolidado Principal */}
      <div className="rounded-3xl bg-primary-container p-6 text-on-primary-container shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider opacity-80">
            Patrimônio Líquido Consolidado
          </span>
          <Landmark className="w-5 h-5 opacity-80" />
        </div>
        <div>
          <span className="text-3xl sm:text-4xl font-black tracking-tight">
            {brl(consolidation.total_balance)}
          </span>
          <p className="text-xs opacity-80 mt-1">
            Soma invariante dos 3 caixas oficiais: Geral + Doceria + Vendas Rápidas
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-on-primary-container/15 text-xs">
          <div>
            <span className="opacity-75 block">Total Disponível</span>
            <span className="font-black text-sm">
              {brl(consolidation.total_available)}
            </span>
          </div>
          <div>
            <span className="opacity-75 block">Total Reservado</span>
            <span className="font-black text-sm">
              {brl(consolidation.total_reserved)}
            </span>
          </div>
        </div>
      </div>

      {/* Visão Rápida dos 3 Caixas Fixos */}
      <div>
        <div className="flex items-center justify-between px-1 mb-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Os Três Caixas Fixos
          </h2>
          <span className="text-[11px] text-muted-foreground">
            Clique no caixa para abrir o extrato
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Caixa Geral */}
          <Link
            to="/clube"
            className="rounded-2xl bg-surface-container-low p-4 border border-outline-variant/30 hover:bg-surface-container transition-all flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-bold group-hover:text-primary transition-colors flex items-center gap-1.5">
                <Landmark className="w-4 h-4 text-primary" />
                {CASH_BOX_LABEL.geral}
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground group-hover:underline">
                Acessar →
              </span>
            </div>
            <div className="mt-3">
              <span className="text-xl font-black text-foreground">
                {brl(geralBox.available)}
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Disponível • Total: {brl(geralBox.balance)}
              </p>
            </div>
            {geralBox.reserved_cents > 0 && (
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                <Lock className="w-3 h-3" /> {brl(geralBox.reserved)} reservados
              </span>
            )}
          </Link>

          {/* Caixa Doceria */}
          <Link
            to="/doceria"
            className="rounded-2xl bg-surface-container-low p-4 border border-outline-variant/30 hover:bg-surface-container transition-all flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-bold group-hover:text-primary transition-colors flex items-center gap-1.5">
                <Cake className="w-4 h-4 text-primary" />
                {CASH_BOX_LABEL.doceria}
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground group-hover:underline">
                Acessar →
              </span>
            </div>
            <div className="mt-3">
              <span className="text-xl font-black text-foreground">
                {brl(doceriaBox.available)}
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Disponível • Total: {brl(doceriaBox.balance)}
              </p>
            </div>
            {doceriaBox.reserved_cents > 0 && (
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                <Lock className="w-3 h-3" /> {brl(doceriaBox.reserved)} reservados
              </span>
            )}
          </Link>

          {/* Caixa Vendas Rápidas */}
          <Link
            to="/vendas"
            className="rounded-2xl bg-surface-container-low p-4 border border-outline-variant/30 hover:bg-surface-container transition-all flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-bold group-hover:text-primary transition-colors flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-primary" />
                {CASH_BOX_LABEL.vendas}
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground group-hover:underline">
                Acessar →
              </span>
            </div>
            <div className="mt-3">
              <span className="text-xl font-black text-foreground">
                {brl(vendasBox.available)}
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Disponível • Total: {brl(vendasBox.balance)}
              </p>
            </div>
            {vendasBox.reserved_cents > 0 && (
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                <Lock className="w-3 h-3" /> {brl(vendasBox.reserved)} reservados
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Métricas Consolidadas de Receitas e Despesas (Neutras a Transferências) */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          variant="filled"
          title="Receitas Consolidadas"
          value={brl(s.income)}
          subtitle="Exclui transferências internas"
          icon={ArrowDownLeft}
          tone="income"
        />
        <MetricCard
          variant="filled"
          title="Despesas Consolidadas"
          value={brl(s.expense)}
          subtitle="Exclui transferências internas"
          icon={ArrowUpRight}
          tone="expense"
        />
      </div>

      {/* Gráfico Mensal */}
      <div className="rounded-3xl bg-surface-container-low p-5 border border-outline-variant/20 shadow-xs">
        <h2 className="text-base font-bold text-foreground mb-3">
          Receitas × Despesas por Mês
        </h2>
        <MonthlyChart items={items} />
      </div>

      {/* Lista Responsiva de Transações com visualização adaptada touch/desktop */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-bold text-foreground">
            Todas as Movimentações
          </h2>
          <span className="text-xs text-muted-foreground">
            {items.length} registro(s)
          </span>
        </div>
        <ResponsiveTransactionList items={items.slice(0, 10)} title="" />
      </div>

      {/* Drawer de Transferência */}
      <TransferDrawer
        open={transferOpen}
        onOpenChange={setTransferOpen}
        defaultOriginBox="geral"
      />
    </AppShell>
  );
}
