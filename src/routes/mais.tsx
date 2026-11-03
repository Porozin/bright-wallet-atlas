import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight, Download, ShieldCheck, Smartphone, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/m3/AppShell";
import { MODULE_LABEL, useTransactions } from "@/lib/finance";

export const Route = createFileRoute("/mais")({
  head: () => ({
    meta: [
      { title: "GDACaixa · Mais opções" },
      { name: "description", content: "Relatórios, exportação, usuários e ajustes do GDACaixa." },
      { property: "og:title", content: "GDACaixa · Mais opções" },
      { property: "og:description", content: "Relatórios, exportação, usuários e ajustes." },
    ],
  }),
  component: Mais,
});

function Mais() {
  const all = useTransactions();

  function exportCsv() {
    const rows = [["Data", "Módulo", "Tipo", "Categoria", "Descrição", "Vendedor", "Valor"], ...all.map((t) => [t.date, MODULE_LABEL[t.module], t.kind, t.category, t.description, t.seller ?? "", t.amount.toFixed(2).replace(".", ",")])];
    const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "gdacaixa.csv";
    a.click();
  }

  const items = [
    { icon: Download, label: "Exportar planilha (CSV)", sub: "Todas as movimentações", onClick: exportCsv },
    { icon: UserRound, label: "Usuários e papéis", sub: "Admin, Diretor, Conselheiro, Desbravador", onClick: () => toast("Disponível após ativar o login") },
    { icon: ShieldCheck, label: "Registro de atividades", sub: "Quem alterou o quê", onClick: () => toast("Disponível após ativar o login") },
    { icon: Smartphone, label: "Instalar no celular", sub: "Menu do navegador → Adicionar à tela inicial", onClick: () => toast("Use o menu do navegador para adicionar à tela inicial") },
  ];

  return (
    <AppShell title="Mais">
      <ul className="overflow-hidden rounded-lg bg-surface-container-low">
        {items.map(({ icon: Icon, label, sub, onClick }) => (
          <li key={label}>
            <button onClick={onClick} className="flex min-h-18 w-full items-center gap-4 px-4 py-3 text-left transition-colors active:bg-surface-container-high">
              <Icon className="size-6 text-muted-foreground" />
              <div className="flex-1">
                <p>{label}</p>
                <p className="label-medium text-muted-foreground">{sub}</p>
              </div>
              <ChevronRight className="size-5 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
