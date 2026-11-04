import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Download, LogOut, Smartphone, ShieldCheck, Info } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/m3/AppShell";
import { MetricCard } from "@/components/m3/parts";
import { MODULE_LABEL, brl, summarize } from "@/lib/finance";
import { ROLE_LABEL, useMe, useTransactions } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/mais")({
  head: () => ({
    meta: [
      { title: "GDACaixa 2027 — Perfil e Ajustes" },
      { name: "description", content: "Relatórios, exportação, usuários e ajustes do GDACaixa 2027." },
      { property: "og:title", content: "GDACaixa 2027 — Perfil e Ajustes" },
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
    const rows = [
      ["Data", "Módulo", "Tipo", "Categoria", "Descrição", "Vendedor", "Valor"],
      ...all.map((t) => [
        t.date,
        MODULE_LABEL[t.module],
        t.kind,
        t.category,
        t.description,
        t.seller ?? "",
        t.amount.toFixed(2).replace(".", ","),
      ]),
    ];
    const csv =
      "\uFEFF" +
      rows
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
        .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `gdacaixa-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast.success("Planilha exportada com sucesso!");
  }

  const items = [
    {
      icon: Download,
      label: "Exportar Planilha (CSV)",
      sub: `${all.length} movimentações registradas`,
      onClick: exportCsv,
    },
    {
      icon: ShieldCheck,
      label: "Controle de Acesso (RBAC)",
      sub: me?.roles.map((r) => ROLE_LABEL[r]).join(", ") || "Sem perfil atribuído",
      onClick: () =>
        toast.info(
          `Seu nível de acesso atual: ${
            me?.roles.map((r) => ROLE_LABEL[r]).join(", ") || "Desbravador"
          }`
        ),
    },
    {
      icon: Smartphone,
      label: "Instalar PWA no Celular",
      sub: "Toque em Compartilhar / Menu → 'Adicionar à Tela de Início'",
      onClick: () =>
        toast("Dica: Use o menu do navegador para instalar o GDA Caixa 2027 como app nativo!"),
    },
    {
      icon: LogOut,
      label: "Encerrar Sessão",
      sub: me?.email ?? "",
      onClick: signOut,
      danger: true,
    },
  ];

  return (
    <AppShell title="Perfil e Ajustes">
      {/* Card do Perfil do Usuário em M3 */}
      {me && (
        <section className="flex items-center gap-4 rounded-3xl bg-primary-container p-5 text-on-primary-container shadow-sm border-none">
          {me.avatar ? (
            <img
              src={me.avatar}
              alt=""
              className="size-16 rounded-full border-2 border-primary/20 shadow-xs object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="text-2xl font-black flex size-16 items-center justify-center rounded-full bg-surface text-primary shadow-xs">
              {me.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold truncate text-on-primary-container">{me.name}</p>
            <p className="text-xs truncate opacity-85 mt-0.5">{me.email}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {me.roles.map((r) => (
                <span
                  key={r}
                  className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-surface/30 backdrop-blur-xs text-on-primary-container"
                >
                  {ROLE_LABEL[r]}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Lista de Opções M3 */}
      <ul className="overflow-hidden rounded-3xl bg-surface-container-low border border-outline-variant/20 divide-y divide-outline-variant/20">
        {items.map(({ icon: Icon, label, sub, onClick, danger }) => (
          <li key={label}>
            <button
              onClick={onClick}
              className={`flex min-h-18 w-full items-center gap-4 px-5 py-4 text-left transition-colors active:bg-surface-variant/30 ${
                danger ? "hover:bg-destructive/10" : "hover:bg-surface-container-high/40"
              }`}
            >
              <div
                className={`p-2.5 rounded-2xl ${
                  danger
                    ? "bg-destructive/10 text-destructive"
                    : "bg-surface-container-highest/60 text-muted-foreground"
                }`}
              >
                <Icon className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${danger ? "text-destructive" : "text-foreground"}`}>
                  {label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>
              </div>
              <ChevronRight className="size-5 text-muted-foreground shrink-0" />
            </button>
          </li>
        ))}
      </ul>

      {/* Rodapé Informativo */}
      <div className="p-4 text-center text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground/80">GDA Caixa 2027 • v2.0 Mobile-First</p>
        <p>Clube de Desbravadores Guerreiros do Alto • Material Design 3</p>
      </div>
    </AppShell>
  );
}
