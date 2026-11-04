import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Download, LogOut, Smartphone, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/m3/AppShell";
import { MODULE_LABEL } from "@/lib/finance";
import { ROLE_LABEL, useMe, useTransactions } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/mais")({
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
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

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
    { icon: UserRound, label: "Usuários e papéis", sub: "Em breve", onClick: () => toast("Gestão de papéis chega na próxima etapa") },
    { icon: Smartphone, label: "Instalar no celular", sub: "Menu do navegador → Adicionar à tela inicial", onClick: () => toast("Use o menu do navegador para adicionar à tela inicial") },
    { icon: LogOut, label: "Sair", sub: me?.email ?? "", onClick: signOut },
  ];

  return (
    <AppShell title="Mais">
      {me && (
        <section className="flex items-center gap-4 rounded-lg bg-primary-container p-4 text-on-primary-container">
          {me.avatar ? (
            <img src={me.avatar} alt="" className="size-14 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <span className="title-large flex size-14 items-center justify-center rounded-full bg-surface">{me.name.charAt(0)}</span>
          )}
          <div className="min-w-0 flex-1">
            <p className="title-medium truncate">{me.name}</p>
            <p className="label-medium truncate opacity-80">{me.roles.map((r) => ROLE_LABEL[r]).join(", ") || "Sem papel"}</p>
          </div>
        </section>
      )}
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
