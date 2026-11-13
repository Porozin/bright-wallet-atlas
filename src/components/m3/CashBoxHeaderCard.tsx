import React, { useState } from "react";
import {
  Wallet,
  Lock,
  ArrowRightLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
} from "lucide-react";
import {
  brl,
  CASH_BOX_LABEL,
  type CashBoxId,
  type BoxFinancialDetails,
} from "@/lib/finance";
import { useCanRecord } from "@/lib/data";
import { TransferDrawer } from "./TransferDrawer";
import { ReservationDrawer } from "./ReservationDrawer";
import { NewEntryFab } from "./parts";

interface CashBoxHeaderCardProps {
  boxId: CashBoxId;
  summary: BoxFinancialDetails;
  onNewTransactionClick?: () => void;
}

export const CashBoxHeaderCard: React.FC<CashBoxHeaderCardProps> = ({
  boxId,
  summary,
}) => {
  const canRecord = useCanRecord();
  const [transferOpen, setTransferOpen] = useState(false);
  const [reservationOpen, setReservationOpen] = useState(false);

  const hasReserved = summary.reserved_cents > 0;
  const isAvailableNegative = summary.available_cents < 0;

  return (
    <div className="rounded-3xl bg-surface-container-low p-5 sm:p-6 border border-outline-variant/20 shadow-sm space-y-4">
      {/* Cabeçalho do Caixa */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Caixa Oficial
          </span>
          <h2 className="text-2xl font-black tracking-tight text-foreground">
            {CASH_BOX_LABEL[boxId]}
          </h2>
        </div>

        {/* Botão de Reservas com Badge */}
        <button
          type="button"
          onClick={() => setReservationOpen(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            hasReserved
              ? "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-300/40"
              : "bg-surface-container text-muted-foreground hover:bg-surface-variant/40"
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>
            {hasReserved
              ? `Reservado: ${brl(summary.reserved)}`
              : "Gerenciar Reservas"}
          </span>
        </button>
      </div>

      {/* Grid Principal de Saldos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {/* Saldo Disponível (Destaque) */}
        <div className="rounded-2xl bg-primary-container p-4 flex flex-col justify-between border-none">
          <div className="flex items-center justify-between text-xs font-bold text-on-primary-container/80">
            <span>Saldo Disponível</span>
            <Wallet className="w-4 h-4 opacity-75" />
          </div>
          <div className="mt-2">
            <span
              className={`text-2xl sm:text-3xl font-black tracking-tight ${
                isAvailableNegative ? "text-expense" : "text-on-primary-container"
              }`}
            >
              {brl(summary.available)}
            </span>
            <p className="text-[11px] text-on-primary-container/70 mt-0.5">
              Livre para despesas e transferências
            </p>
          </div>
        </div>

        {/* Saldo Contábil Total */}
        <div className="rounded-2xl bg-surface-container-highest/60 p-4 flex flex-col justify-between border border-outline-variant/10">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
            <span>Saldo Contábil Total</span>
            <span className="text-[11px] font-normal text-muted-foreground">
              (Disponível + Reservas)
            </span>
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
              {brl(summary.balance)}
            </span>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Patrimônio registrado neste caixa
            </p>
          </div>
        </div>
      </div>

      {/* Sub-métricas: Entradas, Saídas e Transferências */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
        <div className="bg-surface p-2.5 rounded-xl border border-outline-variant/15">
          <span className="text-muted-foreground flex items-center gap-1 font-medium">
            <ArrowDownLeft className="w-3.5 h-3.5 text-income" /> Receitas
          </span>
          <span className="font-bold text-income block mt-1">
            {brl(summary.income)}
          </span>
        </div>

        <div className="bg-surface p-2.5 rounded-xl border border-outline-variant/15">
          <span className="text-muted-foreground flex items-center gap-1 font-medium">
            <ArrowUpRight className="w-3.5 h-3.5 text-expense" /> Despesas
          </span>
          <span className="font-bold text-expense block mt-1">
            {brl(summary.expense)}
          </span>
        </div>

        <div className="bg-surface p-2.5 rounded-xl border border-outline-variant/15">
          <span className="text-muted-foreground flex items-center gap-1 font-medium">
            <ArrowRightLeft className="w-3.5 h-3.5 text-primary" /> Transf. Recebidas
          </span>
          <span className="font-bold text-primary block mt-1">
            +{brl(summary.transfers_in)}
          </span>
        </div>

        <div className="bg-surface p-2.5 rounded-xl border border-outline-variant/15">
          <span className="text-muted-foreground flex items-center gap-1 font-medium">
            <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground" /> Transf. Enviadas
          </span>
          <span className="font-bold text-muted-foreground block mt-1">
            −{brl(summary.transfers_out)}
          </span>
        </div>
      </div>

      {/* Ações Rápidas (quando gestor) */}
      {canRecord && (
        <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/20">
          <button
            type="button"
            onClick={() => setTransferOpen(true)}
            className="flex-1 h-11 rounded-2xl bg-secondary-container text-on-secondary-container text-xs font-bold hover:bg-secondary-container/80 flex items-center justify-center gap-1.5 transition-all shadow-xs"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Transferir Saldo</span>
          </button>

          <button
            type="button"
            onClick={() => setReservationOpen(true)}
            className="flex-1 h-11 rounded-2xl bg-surface border border-outline-variant/40 text-foreground text-xs font-bold hover:bg-surface-variant/30 flex items-center justify-center gap-1.5 transition-all"
          >
            <Lock className="w-4 h-4 text-muted-foreground" />
            <span>Criar Reserva</span>
          </button>
        </div>
      )}

      {/* Drawers */}
      <TransferDrawer
        open={transferOpen}
        onOpenChange={setTransferOpen}
        defaultOriginBox={boxId}
      />
      <ReservationDrawer
        open={reservationOpen}
        onOpenChange={setReservationOpen}
        boxId={boxId}
      />
    </div>
  );
};

