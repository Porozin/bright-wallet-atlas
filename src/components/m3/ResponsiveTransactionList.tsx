import React from "react";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { brl, type Transaction } from "@/lib/finance";

export interface ResponsiveTransactionListProps {
  items: Transaction[];
  title?: string;
  empty?: string;
}

export const ResponsiveTransactionList: React.FC<ResponsiveTransactionListProps> = ({
  items,
  title = "Movimentações Recentes",
  empty = "Nenhuma movimentação ainda.",
}) => {
  if (!items.length) {
    return (
      <div className="bg-surface-container-low rounded-3xl p-6 text-center text-muted-foreground border border-outline-variant/20">
        {empty}
      </div>
    );
  }

  return (
    <div className="bg-surface-container-low rounded-3xl p-4 sm:p-6 border border-outline-variant/20">
      {title && (
        <h3 className="text-base font-bold text-on-surface mb-3 px-1">
          {title}
        </h3>
      )}

      {/* Mobile Stacked List (Touch-Friendly) */}
      <div className="divide-y divide-outline-variant/20 block md:hidden">
        {items.map((tx) => {
          const isIncome = tx.kind === "receita";
          return (
            <div
              key={tx.id}
              className="py-3.5 flex items-center justify-between gap-3 active:bg-surface-variant/30 rounded-2xl px-2 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`p-2.5 rounded-full shrink-0 ${
                    isIncome
                      ? "bg-primary-container text-on-primary-container"
                      : "bg-secondary-container text-expense"
                  }`}
                >
                  {isIncome ? (
                    <ArrowDownLeft className="w-4 h-4" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-on-surface leading-tight truncate">
                    {tx.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {tx.category} •{" "}
                    {new Date(tx.date + "T12:00").toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                    })}
                    {tx.seller ? ` • ${tx.seller}` : ""}
                  </p>
                </div>
              </div>
              <div
                className={`text-sm font-bold shrink-0 ${
                  isIncome ? "text-income" : "text-expense"
                }`}
              >
                {isIncome ? "+" : "−"} {brl(tx.amount)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Responsive Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-outline-variant/30 text-xs text-muted-foreground uppercase font-semibold">
              <th className="py-3 px-4">Descrição</th>
              <th className="py-3 px-4">Categoria</th>
              <th className="py-3 px-4">Data</th>
              <th className="py-3 px-4">Vendedor</th>
              <th className="py-3 px-4 text-right">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {items.map((tx) => {
              const isIncome = tx.kind === "receita";
              return (
                <tr
                  key={tx.id}
                  className="hover:bg-surface-container-high/40 transition-colors"
                >
                  <td className="py-3 px-4 font-medium text-on-surface">
                    {tx.description}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">
                    {tx.category}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">
                    {new Date(tx.date + "T12:00").toLocaleDateString("pt-BR")}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">
                    {tx.seller || "—"}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-bold ${
                      isIncome ? "text-income" : "text-expense"
                    }`}
                  >
                    {isIncome ? "+" : "−"} {brl(tx.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
