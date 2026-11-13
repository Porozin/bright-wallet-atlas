import React, { useState } from "react";
import { ArrowRightLeft } from "lucide-react";
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
  recordTransfer,
  useCanRecord,
  useReservations,
  useTransactions,
} from "@/lib/data";

interface TransferDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultOriginBox?: CashBoxId;
}

const CASH_BOX_OPTIONS: CashBoxId[] = ["geral", "doceria", "vendas"];

export const TransferDrawer: React.FC<TransferDrawerProps> = ({
  open,
  onOpenChange,
  defaultOriginBox = "geral",
}) => {
  const allTx = useTransactions();
  const allRes = useReservations();
  const canRecord = useCanRecord();

  const [originBox, setOriginBox] = useState<CashBoxId>(defaultOriginBox);
  const [destBox, setDestBox] = useState<CashBoxId>(
    defaultOriginBox === "geral" ? "doceria" : "geral"
  );
  const [amountStr, setAmountStr] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  // Calcula saldo disponível da origem em tempo real
  const originSummary = summarizeBox(allTx, originBox, allRes);
  const amountCents = toCents(amountStr);
  const isInsufficient = amountCents > originSummary.available_cents;

  const handleOriginChange = (box: CashBoxId) => {
    setOriginBox(box);
    if (box === destBox) {
      const other = CASH_BOX_OPTIONS.find((b) => b !== box) || "geral";
      setDestBox(other);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error("Informe a descrição da transferência.");
      return;
    }
    if (amountCents <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    if (originBox === destBox) {
      toast.error("O caixa de destino deve ser diferente da origem.");
      return;
    }
    if (isInsufficient) {
      toast.error(
        `Saldo disponível insuficiente no ${CASH_BOX_LABEL[originBox]}. Disponível: ${brl(
          originSummary.available
        )}`
      );
      return;
    }

    setLoading(true);
    try {
      await recordTransfer({
        originCashBoxId: originBox,
        destinationCashBoxId: destBox,
        amountCents,
        description: description.trim(),
      });
      toast.success(
        `Transferência de ${brl(amountCents / 100)} de ${CASH_BOX_LABEL[originBox]} para ${CASH_BOX_LABEL[destBox]} realizada com sucesso!`
      );
      setAmountStr("");
      setDescription("");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Falha ao processar transferência.");
    } finally {
      setLoading(false);
    }
  };

  if (!canRecord) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-3xl bg-surface-container-low max-w-lg mx-auto">
        <DrawerHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-primary-container text-on-primary-container">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <DrawerTitle className="text-lg font-black tracking-tight text-foreground">
              Transferência Interna entre Caixas
            </DrawerTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Transferências entre caixas não afetam o saldo consolidado do clube.
          </p>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-8">
          {/* Caixa de Origem */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
              Caixa de Origem (Debitar)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CASH_BOX_OPTIONS.map((box) => (
                <button
                  key={`orig-${box}`}
                  type="button"
                  onClick={() => handleOriginChange(box)}
                  className={`h-11 rounded-2xl text-xs font-bold transition-all ${
                    originBox === box
                      ? "bg-secondary-container text-on-secondary-container shadow-xs border-2 border-primary"
                      : "bg-surface border border-outline-variant/40 text-muted-foreground hover:bg-surface-variant/30"
                  }`}
                >
                  {CASH_BOX_LABEL[box]}
                </button>
              ))}
            </div>
            <div className="mt-2 text-xs flex justify-between px-1">
              <span className="text-muted-foreground">Saldo Disponível na Origem:</span>
              <span
                className={`font-bold ${
                  originSummary.available_cents <= 0 ? "text-expense" : "text-income"
                }`}
              >
                {brl(originSummary.available)}
              </span>
            </div>
          </div>

          {/* Caixa de Destino */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
              Caixa de Destino (Creditar)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CASH_BOX_OPTIONS.map((box) => {
                const isSelected = destBox === box;
                const isOrigin = originBox === box;
                return (
                  <button
                    key={`dest-${box}`}
                    type="button"
                    disabled={isOrigin}
                    onClick={() => setDestBox(box)}
                    className={`h-11 rounded-2xl text-xs font-bold transition-all ${
                      isSelected
                        ? "bg-secondary-container text-on-secondary-container shadow-xs border-2 border-primary"
                        : isOrigin
                        ? "opacity-30 cursor-not-allowed bg-surface border border-outline-variant/20 text-muted-foreground"
                        : "bg-surface border border-outline-variant/40 text-muted-foreground hover:bg-surface-variant/30"
                    }`}
                  >
                    {CASH_BOX_LABEL[box]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Valor da Transferência */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
              Valor da Transferência (R$)
            </label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-base font-bold text-foreground outline-none focus:border-2 focus:border-primary transition-all"
              required
            />
            {isInsufficient && amountCents > 0 && (
              <p className="text-xs font-bold text-expense mt-1.5 px-1">
                Atenção: o valor supera o saldo disponível no {CASH_BOX_LABEL[originBox]}.
              </p>
            )}
          </div>

          {/* Descrição */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
              Finalidade / Descrição
            </label>
            <input
              type="text"
              placeholder="Ex: Repasse de lucros da Doceria para o Geral"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={100}
              className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm text-foreground outline-none focus:border-2 focus:border-primary transition-all"
              required
            />
          </div>

          {/* Botão de envio */}
          <button
            type="submit"
            disabled={loading || isInsufficient || amountCents <= 0}
            className="text-sm font-bold h-12 w-full rounded-2xl bg-primary text-primary-foreground disabled:opacity-50 transition-transform active:scale-[0.99] mt-2 shadow-sm"
          >
            {loading ? "Processando Transferência…" : "Confirmar Transferência"}
          </button>
        </form>
      </DrawerContent>
    </Drawer>
  );
};

