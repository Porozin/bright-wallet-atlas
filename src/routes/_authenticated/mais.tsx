import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Download,
  LogOut,
  Smartphone,
  ShieldCheck,
  Printer,
  CloudDownload,
  Lock,
  Plus,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/m3/AppShell";
import { MetricCard } from "@/components/m3/parts";
import { MODULE_LABEL, brl, summarize } from "@/lib/finance";
import {
  ROLE_LABEL,
  useMe,
  useTransactions,
  useDividas,
  addDivida,
  updateDividaStatus,
  useIsAdminOrDiretor,
} from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { generatePrintReport } from "@/lib/printReport";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

export const Route = createFileRoute("/_authenticated/mais")({
  head: () => ({
    meta: [
      { title: "GDACaixa 2027 — Perfil e Ajustes" },
      { name: "description", content: "Relatórios, controle interno, backup e ajustes do GDACaixa." },
      { property: "og:title", content: "GDACaixa 2027 — Perfil e Ajustes" },
      { property: "og:description", content: "Relatórios, controle interno, backup e ajustes." },
    ],
  }),
  component: Mais,
});

function Mais() {
  const all = useTransactions();
  const { data: dividas = [] } = useDividas();
  const { data: me } = useMe();
  const isAdminOrDiretor = useIsAdminOrDiretor();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [dividaDrawerOpen, setDividaDrawerOpen] = useState(false);
  const [backupWebhook, setBackupWebhook] = useState(
    () => localStorage.getItem("gda_backup_webhook") || ""
  );

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  // 1. Exportação em Planilha CSV Completa
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
    toast.success("Planilha CSV exportada com sucesso!");
  }

  // 2. Exportação de Backup JSON
  function exportJson() {
    const backupData = {
      versao: "GDA Caixa 2027",
      data_backup: new Date().toISOString(),
      gerado_por: me?.name,
      transacoes: all,
      dividas,
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([jsonStr], { type: "application/json;charset=utf-8" }));
    a.download = `gdacaixa-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    toast.success("Backup JSON exportado com sucesso!");
  }

  // 3. Sincronização / Backup para Google Apps Script (Google Drive)
  async function triggerGoogleDriveBackup() {
    if (!backupWebhook) {
      const url = prompt(
        "Insira a URL do seu Web App do Google Apps Script (ex: https://script.google.com/macros/s/.../exec):",
        backupWebhook
      );
      if (!url) return;
      localStorage.setItem("gda_backup_webhook", url);
      setBackupWebhook(url);
    }

    const currentUrl = backupWebhook || localStorage.getItem("gda_backup_webhook");
    if (!currentUrl) return;

    toast.info("Enviando backup para o seu Google Drive…");
    try {
      await fetch(currentUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          autor: me?.name || "Tesouraria",
          dados: all,
        }),
      });
      toast.success("Backup transmitido com sucesso ao Google Drive!");
    } catch {
      toast.error("Falha ao comunicar com o script do Google Drive.");
    }
  }

  // 4. Imprimir Balancete Geral Oficial para Atas da Igreja
  function handlePrintConsolidado() {
    const s = summarize(all);
    generatePrintReport({
      module: "consolidado",
      title: "Balancete Financeiro Geral — Comissão da Igreja",
      responsible: me?.name || "Tesouraria do Clube",
      transactions: all,
      signatures: [
        { role: "Diretor(a) do Clube" },
        { role: "Tesoureiro(a) do Clube" },
        { role: "Pastor / Presidente da Comissão" },
        { role: "Secretário(a) da Igreja" },
      ],
    });
  }

  // Manipular adição de Dívida / Controle Interno
  async function handleAddDivida(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const nome = String(f.get("nome") || "").trim();
    const valor = Number(String(f.get("valor")).replace(",", "."));
    const obs = String(f.get("obs") || "");
    if (!nome || valor <= 0) {
      toast.error("Informe o nome do devedor/favorecido e o valor.");
      return;
    }
    try {
      await addDivida({
        nome,
        valor,
        data: new Date().toISOString().slice(0, 10),
        status: "pendente",
        obs,
      });
      toast.success("Dívida/Controle registrado com sucesso!");
      setDividaDrawerOpen(false);
      qc.invalidateQueries({ queryKey: ["dividas"] });
    } catch {
      toast.error("Erro ao registrar no controle interno.");
    }
  }

  async function handleToggleDivida(id: string, currentStatus: "pendente" | "pago") {
    const next = currentStatus === "pendente" ? "pago" : "pendente";
    try {
      await updateDividaStatus(id, next);
      toast.success(`Dívida marcada como ${next === "pago" ? "quitada" : "pendente"}!`);
      qc.invalidateQueries({ queryKey: ["dividas"] });
    } catch {
      toast.error("Falha ao atualizar status.");
    }
  }

  const items = [
    {
      icon: Printer,
      label: "Imprimir Balancete Geral para Ata",
      sub: "Documento oficial com campos para Diretor, Tesoureiro e Secretário",
      onClick: handlePrintConsolidado,
    },
    {
      icon: Download,
      label: "Exportar Planilha (CSV)",
      sub: `${all.length} movimentações no formato Excel/Sheets`,
      onClick: exportCsv,
    },
    {
      icon: CloudDownload,
      label: "Backup no Google Drive (Apps Script)",
      sub: "Sincroniza automaticamente com seu script pessoal",
      onClick: triggerGoogleDriveBackup,
    },
    {
      icon: Download,
      label: "Exportar Backup Completo (JSON)",
      sub: "Cópia de segurança offline de todo o banco de dados",
      onClick: exportJson,
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

  const totalDividasPendentes = dividas
    .filter((d) => d.status === "pendente")
    .reduce((acc, cur) => acc + cur.valor, 0);

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

      {/* Módulo de Controle Interno / Dívidas (Admin / Diretor) */}
      {isAdminOrDiretor && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Lock className="size-4 text-primary" />
              <h2 className="text-base font-bold text-foreground">Controle Interno & Dívidas</h2>
            </div>
            <button
              onClick={() => setDividaDrawerOpen(true)}
              className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              <Plus className="size-4" /> Registrar Dívida
            </button>
          </div>

          <div className="p-4 rounded-3xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground uppercase font-semibold">Total a Receber</span>
              <p className="text-xl font-black text-income mt-0.5">{brl(totalDividasPendentes)}</p>
            </div>
            <span className="text-xs text-muted-foreground font-semibold">
              {dividas.filter((d) => d.status === "pendente").length} pendentes
            </span>
          </div>

          <div className="divide-y divide-outline-variant/20 rounded-3xl bg-surface-container-low border border-outline-variant/20 overflow-hidden">
            {dividas.map((div) => {
              const isPaid = div.status === "pago";
              return (
                <div key={div.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-sm font-bold truncate ${isPaid ? "line-through opacity-60" : "text-foreground"}`}>
                      {div.nome}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {div.data} {div.obs ? `• ${div.obs}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-sm font-bold ${isPaid ? "text-muted-foreground" : "text-expense"}`}>
                      {brl(div.valor)}
                    </span>
                    <button
                      onClick={() => handleToggleDivida(div.id, div.status)}
                      title={isPaid ? "Reabrir pendência" : "Marcar como pago"}
                      className={`p-2 rounded-full transition-colors ${
                        isPaid ? "bg-primary-container text-on-primary-container" : "bg-surface-variant text-muted-foreground"
                      }`}
                    >
                      {isPaid ? <CheckCircle2 className="size-4" /> : <Clock className="size-4" />}
                    </button>
                  </div>
                </div>
              );
            })}
            {!dividas.length && (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Nenhuma pendência ou dívida interna registrada.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lista de Ações e Relatórios */}
      <h2 className="text-base font-bold text-foreground px-1 pt-2">Relatórios & Ajustes</h2>
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

      {/* Drawer para Registrar Dívida */}
      <Drawer open={dividaDrawerOpen} onOpenChange={setDividaDrawerOpen}>
        <DrawerContent className="rounded-t-3xl bg-surface-container-low max-w-lg mx-auto p-4">
          <DrawerHeader>
            <DrawerTitle className="text-lg font-black text-foreground">Registrar Dívida / Controle Interno</DrawerTitle>
          </DrawerHeader>
          <form onSubmit={handleAddDivida} className="space-y-4 px-2 pb-6">
            <input name="nome" placeholder="Nome da pessoa ou unidade devedora" className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none" required />
            <input name="valor" inputMode="decimal" placeholder="Valor devido (R$)" className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none" required />
            <input name="obs" placeholder="Observações (ex: Pegou uniforme adiantado)" className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none" />
            <button type="submit" className="h-12 w-full rounded-2xl bg-primary text-primary-foreground font-bold text-sm">Registrar Pendência</button>
          </form>
        </DrawerContent>
      </Drawer>
    </AppShell>
  );
}
