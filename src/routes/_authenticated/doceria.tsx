import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Cake, TrendingUp, ShoppingBag, Receipt, Printer, Package, Plus } from "lucide-react";
import { AppShell } from "@/components/m3/AppShell";
import { ChipGroup, MetricCard, NewEntryFab, ResponsiveTransactionList } from "@/components/m3/parts";
import { brl, profitMargin, summarize } from "@/lib/finance";
import { useTransactions, useMateriais, addMaterial, useCanRecord, useMe } from "@/lib/data";
import { generatePrintReport } from "@/lib/printReport";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/doceria")({
  head: () => ({
    meta: [
      { title: "GDACaixa 2027 — Doceria" },
      { name: "description", content: "Vendas, custos, ingredientes e margem de lucro da doceria." },
      { property: "og:title", content: "GDACaixa 2027 — Doceria" },
      { property: "og:description", content: "Vendas, custos, ingredientes e margem de lucro da doceria." },
    ],
  }),
  component: Doceria,
});

type TabView = "vendas" | "materias";

function Doceria() {
  const items = useTransactions("doceria");
  const materiais = useMateriais("doceria");
  const { data: me } = useMe();
  const canRecord = useCanRecord();

  const [currentTab, setCurrentTab] = useState<TabView>("vendas");
  const [matDrawerOpen, setMatDrawerOpen] = useState(false);

  const s = summarize(items);
  const { profit, margin } = profitMargin(s.income, s.expense);
  const custoTotalMaterias = materiais.reduce((acc, cur) => acc + cur.custo_total, 0);

  async function handleAddMaterial(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const nome = String(f.get("nome") || "").trim();
    const qtd = Number(f.get("quantidade")) || 1;
    const custo = Number(String(f.get("custo_total")).replace(",", ".")) || 0;
    if (!nome) {
      toast.error("Informe o nome do insumo/ingrediente.");
      return;
    }
    try {
      await addMaterial({
        modulo: "doceria",
        nome,
        quantidade: qtd,
        custo_total: custo,
        unidade_medida: "un",
      });
      toast.success("Insumo cadastrado no estoque da doceria!");
      setMatDrawerOpen(false);
    } catch {
      toast.error("Falha ao salvar insumo.");
    }
  }

  function handlePrint() {
    generatePrintReport({
      module: "doceria",
      title: "Extrato Financeiro — Doceria do Clube",
      responsible: me?.name || "Responsável Doceria",
      transactions: items,
      additionalStats: [
        { label: "Margem de Lucro", value: `${(margin * 100).toFixed(0)}%` },
        { label: "Custo com Insumos Cadastrados", value: brl(custoTotalMaterias) },
      ],
      signatures: [
        { role: "Diretor(a) do Clube" },
        { role: "Responsável Doceria" },
      ],
    });
  }

  return (
    <AppShell title="Doceria" fab={<NewEntryFab module="doceria" />}>
      {/* Abas Secundárias M3 */}
      <div className="flex gap-2">
        <ChipGroup
          value={currentTab}
          onChange={setCurrentTab}
          options={[
            { value: "vendas", label: "Vendas & Custos" },
            { value: "materias", label: `Ingredientes/Insumos (${materiais.length})` },
          ]}
        />
        <button
          onClick={handlePrint}
          title="Imprimir Extrato Oficial da Doceria"
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-high/70 hover:bg-surface-variant text-xs font-bold text-foreground transition-all shrink-0"
        >
          <Printer className="size-4" />
          <span className="hidden sm:inline">Extrato PDF</span>
        </button>
      </div>

      {currentTab === "vendas" && (
        <>
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
              title="Faturamento"
              value={brl(s.income)}
              icon={ShoppingBag}
              tone="income"
            />
            <MetricCard
              variant="filled"
              title="Custos Totais"
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
        </>
      )}

      {currentTab === "materias" && (
        <div className="space-y-4">
          <MetricCard
            variant="filled"
            title="Total em Ingredientes e Embalagens"
            value={brl(custoTotalMaterias)}
            subtitle={`${materiais.length} insumos catalogados`}
            icon={Package}
          />

          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-bold text-foreground">Insumos e Embalagens</h2>
            {canRecord && (
              <button
                onClick={() => setMatDrawerOpen(true)}
                className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
              >
                <Plus className="size-4" /> Novo Insumo
              </button>
            )}
          </div>

          <div className="divide-y divide-outline-variant/20 rounded-3xl bg-surface-container-low border border-outline-variant/20 overflow-hidden">
            {materiais.map((mat) => (
              <div key={mat.id} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-foreground">{mat.nome}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Qtd: {mat.quantidade} {mat.unidade_medida}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block font-medium">Custo</span>
                  <span className="text-sm font-bold text-foreground">{brl(mat.custo_total)}</span>
                </div>
              </div>
            ))}
            {!materiais.length && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhum insumo ou embalagem registrado.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Drawer para Insumo */}
      <Drawer open={matDrawerOpen} onOpenChange={setMatDrawerOpen}>
        <DrawerContent className="rounded-t-3xl bg-surface-container-low max-w-lg mx-auto p-4">
          <DrawerHeader>
            <DrawerTitle className="text-lg font-black text-foreground">Novo Insumo para Doceria</DrawerTitle>
          </DrawerHeader>
          <form onSubmit={handleAddMaterial} className="space-y-4 px-2 pb-6">
            <input name="nome" placeholder="Ex: Leite Condensado, Forminhas" className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none" required />
            <div className="grid grid-cols-2 gap-3">
              <input name="quantidade" type="number" placeholder="Quantidade" defaultValue={1} className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none" required />
              <input name="custo_total" inputMode="decimal" placeholder="Custo Total (R$)" className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none" />
            </div>
            <button type="submit" className="h-12 w-full rounded-2xl bg-primary text-primary-foreground font-bold text-sm">Cadastrar Insumo</button>
          </form>
        </DrawerContent>
      </Drawer>
    </AppShell>
  );
}
