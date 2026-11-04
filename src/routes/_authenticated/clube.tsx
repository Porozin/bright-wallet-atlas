import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Landmark, ArrowDownLeft, ArrowUpRight, Search, Printer, Package, Target, Plus } from "lucide-react";
import { AppShell } from "@/components/m3/AppShell";
import { ChipGroup, MetricCard, NewEntryFab, ResponsiveTransactionList } from "@/components/m3/parts";
import { brl, summarize } from "@/lib/finance";
import { useTransactions, useMetas, useMateriais, addMeta, addMaterial, useCanRecord, useMe } from "@/lib/data";
import { generatePrintReport } from "@/lib/printReport";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

export const Route = createFileRoute("/_authenticated/clube")({
  head: () => ({
    meta: [
      { title: "GDACaixa 2027 — Clube" },
      { name: "description", content: "Mensalidades, doações, materiais e extratos oficiais do clube." },
      { property: "og:title", content: "GDACaixa 2027 — Clube" },
      { property: "og:description", content: "Mensalidades, doações, materiais e extratos oficiais do clube." },
    ],
  }),
  component: Clube,
});

type TabView = "caixa" | "metas" | "materiais";

function Clube() {
  const all = useTransactions("clube");
  const metas = useMetas("clube");
  const materiais = useMateriais("clube");
  const { data: me } = useMe();
  const canRecord = useCanRecord();

  const [currentTab, setCurrentTab] = useState<TabView>("caixa");
  const [kind, setKind] = useState<"all" | "receita" | "despesa">("all");
  const [q, setQ] = useState("");
  const [metaDrawerOpen, setMetaDrawerOpen] = useState(false);
  const [matDrawerOpen, setMatDrawerOpen] = useState(false);

  const s = summarize(all);
  const items = all.filter(
    (t) =>
      (kind === "all" || t.kind === kind) &&
      (t.description.toLowerCase().includes(q.toLowerCase()) ||
        t.category.toLowerCase().includes(q.toLowerCase()))
  );

  const custoTotalMateriais = materiais.reduce((acc, cur) => acc + cur.custo_total, 0);

  // Manipular criação de Meta do Clube
  async function handleAddMeta(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const desc = String(f.get("descricao") || "").trim();
    const val = Number(String(f.get("valor_alvo")).replace(",", "."));
    if (!desc || val <= 0) {
      toast.error("Informe a descrição e o valor da meta.");
      return;
    }
    try {
      await addMeta({
        modulo: "clube",
        descricao: desc,
        valor_alvo: val,
        status: "aprovada",
        sugerido_por: me?.name || "Clube",
      });
      toast.success("Meta do Clube registrada com sucesso!");
      setMetaDrawerOpen(false);
    } catch {
      toast.error("Falha ao salvar meta.");
    }
  }

  // Manipular criação de Material / Almoxarifado
  async function handleAddMaterial(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const nome = String(f.get("nome") || "").trim();
    const qtd = Number(f.get("quantidade")) || 1;
    const custo = Number(String(f.get("custo_total")).replace(",", ".")) || 0;
    if (!nome) {
      toast.error("Informe o nome do material.");
      return;
    }
    try {
      await addMaterial({
        modulo: "clube",
        nome,
        quantidade: qtd,
        custo_total: custo,
        unidade_medida: "un",
      });
      toast.success("Material adicionado ao almoxarifado!");
      setMatDrawerOpen(false);
    } catch {
      toast.error("Falha ao salvar material.");
    }
  }

  function handlePrint() {
    generatePrintReport({
      module: "clube",
      title: "Livro Caixa — Clube Guerreiros do Alto",
      responsible: me?.name || "Tesouraria",
      transactions: all,
    });
  }

  return (
    <AppShell title="Clube" fab={<NewEntryFab module="clube" />}>
      {/* Abas Secundárias M3 */}
      <div className="flex gap-2">
        <ChipGroup
          value={currentTab}
          onChange={setCurrentTab}
          options={[
            { value: "caixa", label: "Livro Caixa" },
            { value: "metas", label: `Metas (${metas.length})` },
            { value: "materiais", label: `Almoxarifado (${materiais.length})` },
          ]}
        />
        <button
          onClick={handlePrint}
          title="Imprimir Relatório Oficial para Atas / Comissões"
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-high/70 hover:bg-surface-variant text-xs font-bold text-foreground transition-all shrink-0"
        >
          <Printer className="size-4" />
          <span className="hidden sm:inline">Extrato PDF</span>
        </button>
      </div>

      {currentTab === "caixa" && (
        <>
          <MetricCard
            variant="elevated"
            title="Saldo do Clube"
            value={brl(s.balance)}
            subtitle="Mensalidades, doações e caixa geral"
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
            title="Histórico de Movimentações"
            empty="Nenhuma movimentação encontrada para os filtros selecionados."
          />
        </>
      )}

      {currentTab === "metas" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-bold text-foreground">Metas Financeiras do Clube</h2>
            {canRecord && (
              <button
                onClick={() => setMetaDrawerOpen(true)}
                className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
              >
                <Plus className="size-4" /> Nova Meta
              </button>
            )}
          </div>

          <div className="space-y-3">
            {metas.map((m) => {
              const atingido = s.income;
              const pct = Math.min(100, Math.round((atingido / m.valor_alvo) * 100));
              return (
                <div key={m.id} className="p-5 rounded-3xl bg-surface-container-low border border-outline-variant/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-foreground">{m.descricao}</p>
                      {m.sugerido_por && <p className="text-xs text-muted-foreground mt-0.5">Sugerido por: {m.sugerido_por}</p>}
                    </div>
                    <span className="text-xs font-black px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container">
                      {pct}%
                    </span>
                  </div>
                  <div className="w-full bg-surface-container-highest rounded-full h-2.5 overflow-hidden">
                    <div className="bg-primary h-2.5 rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground font-semibold">
                    <span>Arrecadado: {brl(atingido)}</span>
                    <span>Alvo: {brl(m.valor_alvo)}</span>
                  </div>
                </div>
              );
            })}
            {!metas.length && (
              <div className="p-8 text-center text-sm text-muted-foreground bg-surface-container-low rounded-3xl border border-outline-variant/20">
                Nenhuma meta cadastrada no momento.
              </div>
            )}
          </div>
        </div>
      )}

      {currentTab === "materiais" && (
        <div className="space-y-4">
          <MetricCard
            variant="filled"
            title="Patrimônio em Materiais"
            value={brl(custoTotalMateriais)}
            subtitle={`${materiais.length} itens catalogados no almoxarifado`}
            icon={Package}
          />

          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-bold text-foreground">Estoque / Materiais</h2>
            {canRecord && (
              <button
                onClick={() => setMatDrawerOpen(true)}
                className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
              >
                <Plus className="size-4" /> Novo Material
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
                  <span className="text-xs text-muted-foreground block font-medium">Custo Total</span>
                  <span className="text-sm font-bold text-foreground">{brl(mat.custo_total)}</span>
                </div>
              </div>
            ))}
            {!materiais.length && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhum material registrado no almoxarifado.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Drawer para Nova Meta */}
      <Drawer open={metaDrawerOpen} onOpenChange={setMetaDrawerOpen}>
        <DrawerContent className="rounded-t-3xl bg-surface-container-low max-w-lg mx-auto p-4">
          <DrawerHeader>
            <DrawerTitle className="text-lg font-black text-foreground">Definir Meta do Clube</DrawerTitle>
          </DrawerHeader>
          <form onSubmit={handleAddMeta} className="space-y-4 px-2 pb-6">
            <input name="descricao" placeholder="Ex: Campori 2027 / Uniformes" className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none" required />
            <input name="valor_alvo" inputMode="decimal" placeholder="Valor Alvo (R$)" className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none" required />
            <button type="submit" className="h-12 w-full rounded-2xl bg-primary text-primary-foreground font-bold text-sm">Criar Meta</button>
          </form>
        </DrawerContent>
      </Drawer>

      {/* Drawer para Novo Material */}
      <Drawer open={matDrawerOpen} onOpenChange={setMatDrawerOpen}>
        <DrawerContent className="rounded-t-3xl bg-surface-container-low max-w-lg mx-auto p-4">
          <DrawerHeader>
            <DrawerTitle className="text-lg font-black text-foreground">Cadastrar Material no Estoque</DrawerTitle>
          </DrawerHeader>
          <form onSubmit={handleAddMaterial} className="space-y-4 px-2 pb-6">
            <input name="nome" placeholder="Ex: Barraca 4 Lugares, Bússola" className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none" required />
            <div className="grid grid-cols-2 gap-3">
              <input name="quantidade" type="number" placeholder="Quantidade" defaultValue={1} className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none" required />
              <input name="custo_total" inputMode="decimal" placeholder="Custo Total (R$)" className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none" />
            </div>
            <button type="submit" className="h-12 w-full rounded-2xl bg-primary text-primary-foreground font-bold text-sm">Adicionar Material</button>
          </form>
        </DrawerContent>
      </Drawer>
    </AppShell>
  );
}
