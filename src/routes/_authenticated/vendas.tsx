import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/m3/AppShell";
import { M3Card, NewEntryFab, TransactionList } from "@/components/m3/parts";
import { brl, COMMISSION_RATE, commissionBySeller, useTransactions } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/vendas")({
  head: () => ({
    meta: [
      { title: "GDACaixa · Vendas e eventos" },
      { name: "description", content: "Vendas rápidas, eventos e comissões por vendedor." },
      { property: "og:title", content: "GDACaixa · Vendas e eventos" },
      { property: "og:description", content: "Vendas rápidas, eventos e comissões por vendedor." },
    ],
  }),
  component: Vendas,
});

function Vendas() {
  const items = useTransactions("vendas");
  const ranking = commissionBySeller(items);
  return (
    <AppShell title="Vendas e eventos" fab={<NewEntryFab module="vendas" withSeller />}>
      <M3Card>
        <h2 className="title-medium">Comissões ({COMMISSION_RATE * 100}%)</h2>
        <ul className="mt-3 space-y-3">
          {ranking.map((r, i) => (
            <li key={r.seller} className="flex items-center gap-3">
              <span className="label-large flex size-10 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">{i + 1}</span>
              <div className="flex-1">
                <p>{r.seller}</p>
                <p className="label-medium text-muted-foreground">{brl(r.sales)} vendidos</p>
              </div>
              <span className="label-large text-income">{brl(r.commission)}</span>
            </li>
          ))}
          {!ranking.length && <p className="text-muted-foreground">Sem vendas com vendedor.</p>}
        </ul>
      </M3Card>
      <h2 className="title-medium pt-2">Vendas</h2>
      <TransactionList items={items} />
    </AppShell>
  );
}
