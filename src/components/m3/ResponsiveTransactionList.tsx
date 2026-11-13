import React, { useState } from "react";
import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  RotateCcw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CreditCard,
  Banknote,
  QrCode,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  brl,
  CASH_BOX_LABEL,
  type CashBoxId,
  type PaymentMethod,
  type Transaction,
} from "@/lib/finance";
import { reverseTransaction, useCanRecord } from "@/lib/data";

export interface ResponsiveTransactionListProps {
  items: Transaction[];
  title?: string;
  empty?: string;
  currentBoxId?: CashBoxId;
}

const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao_debito: "Débito",
  cartao_credito: "Crédito",
  outro: "Outro",
};

export const ResponsiveTransactionList: React.FC<ResponsiveTransactionListProps> = ({
  items,
  title = "Movimentações Recentes",
  empty = "Nenhuma movimentação ainda.",
  currentBoxId,
}) => {
  const canRecord = useCanRecord();
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [reversing, setReversing] = useState(false);
  const [showReverseConfirm, setShowReverseConfirm] = useState(false);

  const handleReverse = async () => {
    if (!selectedTx) return;
    if (!reverseReason.trim()) {
      toast.error("Informe a justificativa obrigatória do estorno.");
      return;
    }
    setReversing(true);
    try {
      await reverseTransaction(selectedTx.id, reverseReason.trim());
      toast.success("Lançamento estornado e lançamento compensatório registrado!");
      setShowReverseConfirm(false);
      setSelectedTx(null);
      setReverseReason("");
    } catch (err: any) {
      toast.error(err?.message || "Falha ao estornar lançamento.");
    } finally {
      setReversing(false);
    }
  };

  if (!items.length) {
    return (
      <div className="bg-surface-container-low rounded-3xl p-6 text-center text-muted-foreground border border-outline-variant/20">
        {empty}
      </div>
    );
  }

  return (
    <>
      <div className="bg-surface-container-low rounded-3xl p-4 sm:p-6 border border-outline-variant/20">
        {title && (
          <h3 className="text-base font-bold text-on-surface mb-3 px-1">
            {title}
          </h3>
        )}

        {/* Lista Mobile (Touch-Friendly) */}
        <div className="divide-y divide-outline-variant/20 block md:hidden">
          {items.map((tx) => {
            const isTransfer = tx.kind === "transferencia";
            const origBox: CashBoxId =
              tx.cash_box_id ||
              (tx.module === "clube" ? "geral" : (tx.module as CashBoxId));
            const destBox = tx.destination_cash_box_id;

            let isPositive = tx.kind === "receita";
            let displaySign = isPositive ? "+" : "−";
            let toneClass = isPositive ? "text-income" : "text-expense";

            if (isTransfer) {
              if (currentBoxId) {
                if (destBox === currentBoxId) {
                  isPositive = true;
                  displaySign = "+";
                  toneClass = "text-income";
                } else {
                  isPositive = false;
                  displaySign = "−";
                  toneClass = "text-muted-foreground";
                }
              } else {
                displaySign = "⇄ ";
                toneClass = "text-primary";
              }
            }

            const isStriked = tx.status === "estornado" || tx.status === "rejeitado";

            return (
              <div
                key={tx.id}
                onClick={() => setSelectedTx(tx)}
                className="py-3.5 flex items-center justify-between gap-3 active:bg-surface-variant/30 rounded-2xl px-2 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-2.5 rounded-full shrink-0 ${
                      isTransfer
                        ? "bg-secondary-container text-on-secondary-container"
                        : isPositive
                        ? "bg-primary-container text-on-primary-container"
                        : "bg-surface-container-high text-expense"
                    }`}
                  >
                    {isTransfer ? (
                      <ArrowRightLeft className="w-4 h-4" />
                    ) : isPositive ? (
                      <ArrowDownLeft className="w-4 h-4" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-semibold text-on-surface leading-tight truncate ${
                        isStriked ? "line-through text-muted-foreground" : ""
                      }`}
                    >
                      {tx.description}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      <span className="font-bold text-foreground/80">
                        {CASH_BOX_LABEL[origBox]}
                      </span>
                      {isTransfer && destBox && (
                        <span>→ {CASH_BOX_LABEL[destBox]}</span>
                      )}
                      <span>•</span>
                      <span>
                        {new Date(tx.date + "T12:00").toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                      {tx.status && tx.status !== "confirmado" && (
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            tx.status === "pendente"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : tx.status === "estornado"
                              ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                              : "bg-gray-200 text-gray-800"
                          }`}
                        >
                          {tx.status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  className={`text-sm font-black shrink-0 ${
                    isStriked ? "line-through opacity-50" : toneClass
                  }`}
                >
                  {displaySign} {brl(tx.amount)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tabela Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant/30 text-xs text-muted-foreground uppercase font-semibold">
                <th className="py-3 px-4">Descrição</th>
                <th className="py-3 px-4">Caixa</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Situação</th>
                <th className="py-3 px-4 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {items.map((tx) => {
                const isTransfer = tx.kind === "transferencia";
                const origBox: CashBoxId =
                  tx.cash_box_id ||
                  (tx.module === "clube" ? "geral" : (tx.module as CashBoxId));
                const destBox = tx.destination_cash_box_id;

                let isPositive = tx.kind === "receita";
                let displaySign = isPositive ? "+" : "−";
                let toneClass = isPositive ? "text-income" : "text-expense";

                if (isTransfer) {
                  if (currentBoxId) {
                    if (destBox === currentBoxId) {
                      isPositive = true;
                      displaySign = "+";
                      toneClass = "text-income";
                    } else {
                      isPositive = false;
                      displaySign = "−";
                      toneClass = "text-muted-foreground";
                    }
                  } else {
                    displaySign = "⇄ ";
                    toneClass = "text-primary";
                  }
                }

                const isStriked = tx.status === "estornado" || tx.status === "rejeitado";

                return (
                  <tr
                    key={tx.id}
                    onClick={() => setSelectedTx(tx)}
                    className="hover:bg-surface-container-high/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 font-medium text-on-surface">
                      <div className="flex items-center gap-2">
                        {isTransfer ? (
                          <ArrowRightLeft className="w-4 h-4 text-primary shrink-0" />
                        ) : isPositive ? (
                          <ArrowDownLeft className="w-4 h-4 text-income shrink-0" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 text-expense shrink-0" />
                        )}
                        <span className={isStriked ? "line-through text-muted-foreground" : ""}>
                          {tx.description}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-muted-foreground">
                      {CASH_BOX_LABEL[origBox]}
                      {isTransfer && destBox && ` → ${CASH_BOX_LABEL[destBox]}`}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">
                      {tx.category}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">
                      {new Date(tx.date + "T12:00").toLocaleDateString("pt-BR")}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          tx.status === "confirmado" || !tx.status
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : tx.status === "pendente"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : tx.status === "estornado"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {tx.status || "confirmado"}
                      </span>
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-black ${
                        isStriked ? "line-through opacity-50" : toneClass
                      }`}
                    >
                      {displaySign} {brl(tx.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer de Detalhes e Estorno */}
      <Drawer
        open={Boolean(selectedTx)}
        onOpenChange={(open) => !open && setSelectedTx(null)}
      >
        <DrawerContent className="rounded-t-3xl bg-surface-container-low max-w-lg mx-auto p-4 pb-8 space-y-4">
          {selectedTx && (
            <>
              <DrawerHeader className="p-0">
                <div className="flex items-center justify-between">
                  <DrawerTitle className="text-lg font-black text-foreground">
                    Detalhes da Movimentação
                  </DrawerTitle>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      selectedTx.status === "confirmado" || !selectedTx.status
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : selectedTx.status === "pendente"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                    }`}
                  >
                    {selectedTx.status || "confirmado"}
                  </span>
                </div>
              </DrawerHeader>

              <div className="space-y-3 bg-surface p-4 rounded-2xl border border-outline-variant/30 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block font-medium">
                    Descrição
                  </span>
                  <p className="font-bold text-foreground text-base">
                    {selectedTx.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium">
                      Valor
                    </span>
                    <p className="font-black text-foreground text-lg">
                      {brl(selectedTx.amount)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium">
                      Data
                    </span>
                    <p className="font-semibold text-foreground">
                      {new Date(selectedTx.date + "T12:00").toLocaleDateString(
                        "pt-BR"
                      )}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium">
                      Caixa
                    </span>
                    <p className="font-semibold text-foreground">
                      {CASH_BOX_LABEL[
                        selectedTx.cash_box_id ||
                          (selectedTx.module === "clube"
                            ? "geral"
                            : (selectedTx.module as CashBoxId))
                      ]}
                      {selectedTx.destination_cash_box_id &&
                        ` → ${CASH_BOX_LABEL[selectedTx.destination_cash_box_id]}`}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium">
                      Categoria
                    </span>
                    <p className="font-semibold text-foreground">
                      {selectedTx.category}
                    </p>
                  </div>
                </div>

                {selectedTx.payment_method && (
                  <div className="pt-1">
                    <span className="text-xs text-muted-foreground block font-medium">
                      Forma de Pagamento
                    </span>
                    <p className="font-semibold text-foreground">
                      {PAYMENT_METHOD_LABEL[selectedTx.payment_method] ||
                        selectedTx.payment_method}
                    </p>
                  </div>
                )}

                {selectedTx.reverse_reason && (
                  <div className="pt-1 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/40 text-xs">
                    <span className="font-bold text-rose-800 dark:text-rose-300 block">
                      Motivo do Estorno:
                    </span>
                    <p className="text-rose-700 dark:text-rose-200 mt-0.5">
                      {selectedTx.reverse_reason}
                    </p>
                  </div>
                )}
              </div>

              {/* Botão de Estorno para Gestores */}
              {canRecord &&
                (selectedTx.status === "confirmado" || !selectedTx.status) && (
                  <div className="pt-2">
                    {!showReverseConfirm ? (
                      <button
                        type="button"
                        onClick={() => setShowReverseConfirm(true)}
                        className="w-full h-11 rounded-2xl border border-rose-300/60 text-rose-700 dark:text-rose-300 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center justify-center gap-1.5 transition-all"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Estornar esta Movimentação
                      </button>
                    ) : (
                      <div className="space-y-3 p-3 rounded-2xl bg-surface border border-rose-300/50">
                        <label className="text-xs font-bold text-rose-800 dark:text-rose-300 block">
                          Justificativa Obrigatória do Estorno:
                        </label>
                        <input
                          type="text"
                          placeholder="Informe o motivo detalhado do estorno"
                          value={reverseReason}
                          onChange={(e) => setReverseReason(e.target.value)}
                          className="h-11 w-full rounded-xl border border-outline-variant/60 bg-surface px-3 text-xs text-foreground outline-none focus:border-rose-500"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setShowReverseConfirm(false)}
                            className="flex-1 h-9 rounded-xl border border-outline-variant text-xs font-bold text-muted-foreground"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={reversing || !reverseReason.trim()}
                            onClick={handleReverse}
                            className="flex-1 h-9 rounded-xl bg-rose-600 text-white text-xs font-bold disabled:opacity-50"
                          >
                            {reversing ? "Estornando…" : "Confirmar Estorno"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
            </>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
};
