import React, { useState } from "react";
import { Lock, Unlock, CheckCircle2, AlertCircle, Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  brl,
  CASH_BOX_LABEL,
  toCents,
  type CashBoxId,
  summarizeBox,
} from "@/lib/finance";
import {
  createReservation,
  releaseReservation,
  consumeReservation,
  useCanRecord,
  useReservations,
  useTransactions,
} from "@/lib/data";

interface ReservationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boxId: CashBoxId;
}

export const ReservationDrawer: React.FC<ReservationDrawerProps> = ({
  open,
  onOpenChange,
  boxId,
}) => {
  const allTx = useTransactions();
  const boxReservations = useReservations(boxId);
  const canRecord = useCanRecord();

  const [activeTab, setActiveTab] = useState<"lista" | "nova">("lista");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [loading, setLoading] = useState(false);

  const boxSummary = summarizeBox(allTx, boxId, boxReservations);
  const amountCents = toCents(amountStr);
  const isInsufficient = amountCents > boxSummary.available_cents;

  const activeRes = boxReservations.filter((r) => r.status === "ativa");
  const historyRes = boxReservations.filter((r) => r.status !== "ativa");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Informe o título da reserva.");
      return;
    }
    if (amountCents <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    if (isInsufficient) {
      toast.error(
        `O valor supera o saldo disponível no ${CASH_BOX_LABEL[boxId]} (${brl(
          boxSummary.available
        )}).`
      );
      return;
    }

    setLoading(true);
    try {
      await createReservation({
        cashBoxId: boxId,
        title: title.trim(),
        description: description.trim() || undefined,
        amountCents,
      });
      toast.success(`Reserva "${title.trim()}" criada com sucesso!`);
      setTitle("");
      setDescription("");
      setAmountStr("");
      setActiveTab("lista");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar reserva.");
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async (resId: string, resTitle: string) => {
    if (!confirm(`Deseja realmente liberar a reserva "${resTitle}"? O valor voltará para o saldo disponível.`)) {
      return;
    }
    setLoading(true);
    try {
      await releaseReservation(resId);
      toast.success(`Reserva "${resTitle}" liberada! Fundos disponíveis novamente.`);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao liberar reserva.");
    } finally {
      setLoading(false);
    }
  };

  const handleConsume = async (resId: string, resTitle: string) => {
    if (!confirm(`Confirmar que a reserva "${resTitle}" foi consumida para a despesa planejada?`)) {
      return;
    }
    setLoading(true);
    try {
      await consumeReservation(resId);
      toast.success(`Reserva "${resTitle}" consumida com sucesso!`);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao consumir reserva.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-3xl bg-surface-container-low max-w-lg mx-auto max-h-[85vh] overflow-hidden flex flex-col">
        <DrawerHeader className="border-b border-outline-variant/20 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-secondary-container text-on-secondary-container">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <DrawerTitle className="text-lg font-black tracking-tight text-foreground">
                  Reservas • {CASH_BOX_LABEL[boxId]}
                </DrawerTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Saldo comprometido sem saída de caixa: {brl(boxSummary.reserved)}
                </p>
              </div>
            </div>
          </div>

          {/* Abas */}
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => setActiveTab("lista")}
              className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeTab === "lista"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-surface text-muted-foreground hover:bg-surface-variant/30"
              }`}
            >
              Ativas ({activeRes.length})
            </button>
            {canRecord && (
              <button
                type="button"
                onClick={() => setActiveTab("nova")}
                className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "nova"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-surface text-muted-foreground hover:bg-surface-variant/30"
                }`}
              >
                <Plus className="w-3.5 h-3.5" /> Nova Reserva
              </button>
            )}
          </div>
        </DrawerHeader>

        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {activeTab === "nova" && canRecord ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="bg-surface-container p-3 rounded-2xl border border-outline-variant/30 text-xs flex justify-between">
                <span className="text-muted-foreground">Saldo Disponível para Reservar:</span>
                <span className="font-bold text-income">{brl(boxSummary.available)}</span>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                  Finalidade / Título da Reserva
                </label>
                <input
                  type="text"
                  placeholder="Ex: Campori 2027, Materiais de Acampamento"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={60}
                  className="h-12 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm font-semibold text-foreground outline-none focus:border-2 focus:border-primary transition-all"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                  Valor a Reservar (R$)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-base font-bold text-foreground outline-none focus:border-2 focus:border-primary transition-all"
                  required
                />
                {isInsufficient && amountCents > 0 && (
                  <p className="text-xs font-bold text-expense mt-1">
                    Valor excede o saldo disponível de {brl(boxSummary.available)}.
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                  Observações (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Detalhes adicionais"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={100}
                  className="h-12 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm text-foreground outline-none focus:border-2 focus:border-primary transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading || isInsufficient || amountCents <= 0}
                className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 transition-transform active:scale-[0.99] shadow-sm"
              >
                {loading ? "Criando Reserva…" : "Confirmar Reserva"}
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              {activeRes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Lock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Nenhuma reserva ativa neste caixa.
                  {canRecord && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("nova")}
                      className="block mx-auto mt-2 text-xs font-bold text-primary hover:underline"
                    >
                      Criar uma reserva agora →
                    </button>
                  )}
                </div>
              ) : (
                activeRes.map((res) => (
                  <div
                    key={res.id}
                    className="p-4 rounded-2xl bg-surface border border-outline-variant/30 flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                          <h4 className="font-bold text-sm text-foreground truncate">
                            {res.title}
                          </h4>
                        </div>
                        {res.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {res.description}
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-black text-foreground shrink-0">
                        {brl(res.amount_cents / 100)}
                      </span>
                    </div>

                    {canRecord && (
                      <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/20 mt-1">
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleRelease(res.id, res.title)}
                          className="flex-1 h-9 rounded-xl border border-outline-variant/60 text-xs font-bold text-muted-foreground hover:bg-surface-variant/40 flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Unlock className="w-3.5 h-3.5" /> Liberar
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleConsume(res.id, res.title)}
                          className="flex-1 h-9 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-bold hover:bg-secondary-container/80 flex items-center justify-center gap-1.5 transition-all"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Consumir
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}

              {/* Histórico de Reservas (Liberadas / Consumidas) */}
              {historyRes.length > 0 && (
                <div className="pt-4 border-t border-outline-variant/20">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Histórico de Reservas
                  </h5>
                  <div className="space-y-2">
                    {historyRes.slice(0, 5).map((r) => (
                      <div
                        key={r.id}
                        className="p-2.5 rounded-xl bg-surface-container-highest/40 flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{r.title}</p>
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-bold ${
                              r.status === "consumida"
                                ? "bg-primary-container text-on-primary-container"
                                : "bg-surface-variant text-muted-foreground"
                            }`}
                          >
                            {r.status === "consumida" ? "Consumida" : "Liberada"}
                          </span>
                        </div>
                        <span className="font-bold text-muted-foreground">
                          {brl(r.amount_cents / 100)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

