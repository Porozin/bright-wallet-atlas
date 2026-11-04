import { useState, type ReactNode } from "react";
import { ArrowDownLeft, ArrowUpRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { brl, MODULE_LABEL, type Kind, type Module, type Transaction } from "@/lib/finance";
import { addTransaction, useCanRecord } from "@/lib/data";

export { MetricCard } from "./MetricCard";
export { ResponsiveTransactionList } from "./ResponsiveTransactionList";
export { BottomNav } from "./BottomNav";

const cardVariants = cva("rounded-3xl p-5 transition-transform active:scale-[0.99]", {
  variants: {
    variant: {
      filled: "bg-surface-container-highest/60 border-none",
      elevated: "bg-surface-container-low shadow-sm border border-outline-variant/20",
      outlined: "border border-outline-variant/60 bg-surface",
      primary: "bg-primary-container text-on-primary-container shadow-sm border-none",
      tertiary: "bg-tertiary-container text-on-tertiary-container shadow-sm border-none",
    },
  },
  defaultVariants: { variant: "elevated" },
});

export function M3Card({ variant, className, children }: VariantProps<typeof cardVariants> & { className?: string; children: ReactNode }) {
  return <section className={cn(cardVariants({ variant }), className)}>{children}</section>;
}

export function Stat({ label, value, tone }: { label: string; value: number; tone?: "income" | "expense" }) {
  return (
    <div className="bg-surface-container-highest/60 rounded-3xl p-4 flex flex-col justify-between border border-outline-variant/10">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("text-xl sm:text-2xl mt-2 font-black tracking-tight", tone === "income" && "text-income", tone === "expense" && "text-expense")}>{brl(value)}</p>
    </div>
  );
}

export function TransactionList({ items, empty = "Nenhuma movimentação ainda." }: { items: Transaction[]; empty?: string }) {
  if (!items.length) return <p className="py-8 text-center text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y divide-outline-variant/20 overflow-hidden rounded-3xl bg-surface-container-low border border-outline-variant/20">
      {items.map((t) => {
        const income = t.kind === "receita";
        const Icon = income ? ArrowDownLeft : ArrowUpRight;
        return (
          <li key={t.id} className="flex min-h-16 items-center gap-4 px-4 py-3.5 active:bg-surface-variant/30 transition-colors">
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", income ? "bg-primary-container text-on-primary-container" : "bg-secondary-container text-expense")}>
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-sm text-foreground">{t.description}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t.category} • {new Date(t.date + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                {t.seller ? ` • ${t.seller}` : ""}
              </p>
            </div>
            <span className={cn("text-sm font-bold shrink-0", income ? "text-income" : "text-expense")}>
              {income ? "+" : "−"} {brl(t.amount)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function ChipGroup<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "text-xs font-semibold h-9 shrink-0 rounded-full px-4 transition-all duration-200",
            value === o.value ? "bg-secondary-container text-on-secondary-container shadow-xs" : "bg-surface-container-high/60 text-muted-foreground hover:bg-surface-variant/40",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const field = "h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm text-foreground outline-none focus:border-2 focus:border-primary transition-all";

export function NewEntryFab({ module, withSeller }: { module: Module; withSeller?: boolean }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("receita");
  const [saving, setSaving] = useState(false);
  const canRecord = useCanRecord();
  if (!canRecord) return null;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const amount = Number(String(f.get("amount")).replace(",", "."));
    const description = String(f.get("description") ?? "").trim();
    if (!description || !(amount > 0)) {
      toast.error("Informe descrição e um valor maior que zero.");
      return;
    }
    setSaving(true);
    try {
      await addTransaction({
        module, kind, amount, description,
        category: String(f.get("category") || "Geral"),
        date: String(f.get("date") || new Date().toISOString().slice(0, 10)),
        seller: withSeller ? String(f.get("seller") || "") || undefined : undefined,
      });
      toast.success("Movimentação registrada com sucesso!");
      setOpen(false);
    } catch {
      toast.error("Não foi possível salvar. Verifique sua permissão.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`Nova movimentação em ${MODULE_LABEL[module]}`}
        className="flex h-14 items-center gap-2.5 rounded-2xl bg-primary-container px-5 text-on-primary-container shadow-md transition-all active:scale-95 hover:shadow-lg"
      >
        <Plus className="size-6" />
        <span className="text-sm font-bold">Nova</span>
      </button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="rounded-t-3xl bg-surface-container-low max-w-lg mx-auto">
          <DrawerHeader>
            <DrawerTitle className="text-lg font-black tracking-tight text-foreground">Nova movimentação • {MODULE_LABEL[module]}</DrawerTitle>
          </DrawerHeader>
          <form onSubmit={submit} className="space-y-4 px-4 pb-8">
            <ChipGroup value={kind} onChange={setKind} options={[{ value: "receita", label: "Receita" }, { value: "despesa", label: "Despesa" }]} />
            <input name="description" placeholder="Descrição da movimentação" className={field} maxLength={80} required />
            <div className="grid grid-cols-2 gap-3">
              <input name="amount" inputMode="decimal" placeholder="Valor (R$)" className={field} required />
              <input name="category" placeholder="Categoria" className={field} maxLength={30} />
            </div>
            <input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={field} />
            {withSeller && <input name="seller" placeholder="Nome do Vendedor(a)" className={field} maxLength={40} />}
            <button type="submit" disabled={saving} className="text-sm font-bold h-12 w-full rounded-2xl bg-primary text-primary-foreground disabled:opacity-60 transition-transform active:scale-[0.99]">{saving ? "Salvando…" : "Salvar Movimentação"}</button>
          </form>
        </DrawerContent>
      </Drawer>
    </>
  );
}
