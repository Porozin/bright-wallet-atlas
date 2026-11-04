import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Zap, Trophy, Plus, AlertTriangle, Package, Printer } from "lucide-react";
import { AppShell } from "@/components/m3/AppShell";
import { ChipGroup, MetricCard, NewEntryFab, ResponsiveTransactionList } from "@/components/m3/parts";
import { brl, COMMISSION_RATE, commissionBySeller, summarize } from "@/lib/finance";
import { useTransactions, useProdutos, useAvarias, addProduto, addAvaria, useCanRecord, useMe } from "@/lib/data";
import { generatePrintReport } from "@/lib/printReport";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vendas")({
  head: () => ({
    meta: [
      { title: "GDACaixa 2027 — Vendas e Eventos" },
      { name: "description", content: "Vendas rápidas, produtos, perdas/avarias e comissões." },
      { property: "og:title", content: "GDACaixa 2027 — Vendas e Eventos" },
      { property: "og:description", content: "Vendas rápidas, produtos, perdas/avarias e comissões." },
    ],
  }),
  component: Vendas,
});

type TabView = "vendas" | "produtos" | "avarias";

function Vendas() {
  const items = useTransactions("vendas");
  const { data: produtos = [] } = useProdutos();
  const { data: avarias = [] } = useAvarias();
  const { data: me } = useMe();
  const canRecord = useCanRecord();

  const [currentTab, setCurrentTab] = useState<TabView>("vendas");
  const [prodDrawerOpen, setProdDrawerOpen] = useState(false);
  const [avariaDrawerOpen, setAvariaDrawerOpen] = useState(false);

  const s = summarize(items);
  const ranking = commissionBySeller(items);
  const totalComissoes = ranking.reduce((acc, cur) => acc + cur.commission, 0);
  const totalAvarias = avarias.reduce((acc, cur) => acc + cur.perda_estimada, 0);

  async function handleAddProduto(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const nome = String(f.get("nome") || "").trim();
    const preco = Number(String(f.get("preco_venda")).replace(",", "."));
    const custo = Number(String(f.get("custo")).replace(",", ".")) || 0;
    const comissao = Number(String(f.get("comissao")).replace(",", ".")) || 0;
    if (!nome || preco <= 0) {
      toast.error("Informe nome e preço de venda válido.");
      return;
    }
    try {
      await addProduto({ nome, preco_venda: preco, custo, comissao });
      toast.success("Produto cadastrado com sucesso!");
      setProdDrawerOpen(false);
    } catch {
      toast.error("Falha ao salvar produto.");
    }
  }

  async function handleAddAvaria(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const prodNome = String(f.get("produto_nome") || "").trim();
    const qtd = Number(f.get("quantidade")) || 1;
    const perda = Number(String(f.get("perda_estimada")).replace(",", ".")) || 0;
    const motivo = String(f.get("motivo") || "");
    if (!prodNome || qtd <= 0) {
      toast.error("Informe o produto e a quantidade avariada.");
      return;
    }
    try {
      await addAvaria({
        produto_nome: prodNome,
        quantidade: qtd,
        perda_estimada: perda,
        motivo,
        data: new Date().toISOString().slice(0, 10),
      });
      toast.success("Avaria registrada no sistema!");
      setAvariaDrawerOpen(false);
    } catch {
      toast.error("Falha ao registrar avaria.");
    }
  }

  function handlePrint() {
    generatePrintReport({
      module: "vendas",
      title: "Extrato de Vendas Rápidas & Comissões",
      responsible: me?.name || "Tesouraria de Vendas",
      transactions: items,
      additionalStats: [
        { label: "Comissões Distribuídas", value: brl(totalComissoes) },
        { label: "Perdas (Avarias)", value: `-${brl(totalAvarias)}`, isNegative: true },
      ],
      signatures: [
        { role: "Diretor(a) do Clube" },
        { role: "Responsável Vendas" },
      ],
    });
  }

  return (
    <AppShell title="Vendas Rápidas" fab={<NewEntryFab module="vendas" withSeller />}>
      {/* Abas Secundárias M3 */}
      <div className="flex gap-2">
        <ChipGroup
          value={currentTab}
          onChange={setCurrentTab}
          options={[
            { value: "vendas", label: "Vendas & Ranking" },
            { value: "produtos", label: `Catálogo (${produtos.length})` },
            { value: "avarias", label: `Avarias (${avarias.length})` },
          ]}
        />
        <button
          onClick={handlePrint}
          title="Imprimir Extrato Oficial de Vendas"
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-high/70 hover:bg-surface-variant text-xs font-bold text-foreground transition-all shrink-0"
        >
          <Printer className="size-4" />
          <span className="hidden sm:inline">Extrato PDF</span>
        </button>
      </div>

      {currentTab === "vendas" && (
        <>
          <MetricCard
            variant="primary"
            title="Total em Vendas"
            value={brl(s.income)}
            subtitle={`Comissões calculadas: ${brl(totalComissoes)} | Perdas por avaria: ${brl(totalAvarias)}`}
            icon={Zap}
          />

          {/* Ranking de Vendedores */}
          <div className="rounded-3xl bg-surface-container-low p-5 border border-outline-variant/20 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Trophy className="size-5 text-amber-500" />
                <h2 className="text-base font-bold text-foreground">
                  Ranking de Vendedores ({COMMISSION_RATE * 100}%)
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
                    <p className="text-xs text-muted-foreground">{brl(r.sales)} vendidos</p>
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
        </>
      )}

      {currentTab === "produtos" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-bold text-foreground">Catálogo de Produtos (Tortinhas/Doces)</h2>
            {canRecord && (
              <button
                onClick={() => setProdDrawerOpen(true)}
                className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
              >
                <Plus className="size-4" /> Novo Produto
              </button>
            )}
          </div>

          <div className="divide-y divide-outline-variant/20 rounded-3xl bg-surface-container-low border border-outline-variant/20 overflow-hidden">
            {produtos.map((p) => {
              const margem = p.preco_venda - p.custo - p.comissao;
              return (
                <div key={p.id} className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-foreground">{p.nome}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Custo: {brl(p.custo)} | Comissão: {brl(p.comissao)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-foreground block">{brl(p.preco_venda)}</span>
                    <span className="text-[11px] font-semibold text-income">Margem: {brl(margem)}</span>
                  </div>
                </div>
              );
            })}
            {!produtos.length && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhum produto cadastrado no catálogo.
              </div>
            )}
          </div>
        </div>
      )}

      {currentTab === "avarias" && (
        <div className="space-y-4">
          <MetricCard
            variant="filled"
            title="Total de Perdas (Avarias)"
            value={brl(totalAvarias)}
            subtitle={`${avarias.length} avarias registradas`}
            icon={AlertTriangle}
            tone="expense"
          />

          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-bold text-foreground">Registro de Avarias</h2>
            {canRecord && (
              <button
                onClick={() => setAvariaDrawerOpen(true)}
                className="flex items-center gap-1 text-xs font-bold text-destructive hover:underline"
              >
                <Plus className="size-4" /> Registrar Avaria
              </button>
            )}
          </div>

          <div className="divide-y divide-outline-variant/20 rounded-3xl bg-surface-container-low border border-outline-variant/20 overflow-hidden">
            {avarias.map((av) => (
              <div key={av.id} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-foreground">{av.produto_nome}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {av.quantidade}x unidades | {new Date(av.data + "T12:00").toLocaleDateString("pt-BR")}
                    {av.motivo ? ` • ${av.motivo}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block font-medium">Perda</span>
                  <span className="text-sm font-bold text-expense">-{brl(av.perda_estimada)}</span>
                </div>
              </div>
            ))}
            {!avarias.length && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhuma avaria registrada.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Drawer para Cadastrar Produto */}
      <Drawer open={prodDrawerOpen} onOpenChange={setProdDrawerOpen}>
        <DrawerContent className="rounded-t-3xl bg-surface-container-low max-w-lg mx-auto p-4">
          <DrawerHeader>
            <DrawerTitle className="text-lg font-black text-foreground">Novo Produto para Venda</DrawerTitle>
          </DrawerHeader>
          <form onSubmit={handleAddProduto} className="space-y-4 px-2 pb-6">
            <input name="nome" placeholder="Nome do produto (ex: Tortinha de Limão)" className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none" required />
            <div className="grid grid-cols-3 gap-2">
              <input name="preco_venda" inputMode="decimal" placeholder="Preço (R$)" className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-3 text-sm outline-none" required />
              <input name="custo" inputMode="decimal" placeholder="Custo (R$)" className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-3 text-sm outline-none" />
              <input name="comissao" inputMode="decimal" placeholder="Comissão" className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-3 text-sm outline-none" />
            </div>
            <button type="submit" className="h-12 w-full rounded-2xl bg-primary text-primary-foreground font-bold text-sm">Salvar Produto</button>
          </form>
        </DrawerContent>
      </Drawer>

      {/* Drawer para Registrar Avaria */}
      <Drawer open={avariaDrawerOpen} onOpenChange={setAvariaDrawerOpen}>
        <DrawerContent className="rounded-t-3xl bg-surface-container-low max-w-lg mx-auto p-4">
          <DrawerHeader>
            <DrawerTitle className="text-lg font-black text-destructive">Registrar Perda / Avaria</DrawerTitle>
          </DrawerHeader>
          <form onSubmit={handleAddAvaria} className="space-y-4 px-2 pb-6">
            <input name="produto_nome" placeholder="Produto (ex: Tortinha danificada)" className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none" required />
            <div className="grid grid-cols-2 gap-3">
              <input name="quantidade" type="number" placeholder="Qtd" defaultValue={1} className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none" required />
              <input name="perda_estimada" inputMode="decimal" placeholder="Perda (R$)" className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none" />
            </div>
            <input name="motivo" placeholder="Motivo (ex: Caiu no chão, passou da validade)" className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none" />
            <button type="submit" className="h-12 w-full rounded-2xl bg-destructive text-destructive-foreground font-bold text-sm">Registrar Perda</button>
          </form>
        </DrawerContent>
      </Drawer>
    </AppShell>
  );
}
