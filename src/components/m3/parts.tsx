import { useState, type ReactNode } from "react";
import { ArrowDownLeft, ArrowUpRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { brl, MODULE_LABEL, type Kind, type Module, type Transaction } from "@/lib/finance";
import { addTransaction, useCanRecord } from "@/lib/data";

const cardVariants = cva("rounded-lg p-4", {
  variants: {
    variant: {
      filled: "bg-surface-container-highest",
      elevated: "bg-surface-container-low elevation-1",
      outlined: "border border-outline-variant bg-surface",
      primary: "bg-primary-container text-on-primary-container",
      tertiary: "bg-tertiary-container text-on-tertiary-container",
    },
  },
  defaultVariants: { variant: "elevated" },
});

export function M3Card({ variant, className, children }: VariantProps<typeof cardVariants> & { className?: string; children: ReactNode }) {
  return <section className={cn(cardVariants({ variant }), className)}>{children}</section>;
}

export function Stat({ label, value, tone }: { label: string; value: number; tone?: "income" | "expense" }) {
  return (
    <M3Card variant="filled">
      <p className="label-medium text-muted-foreground">{label}</p>
      <p className={cn("title-large mt-1 font-medium", tone === "income" && "text-income", tone === "expense" && "text-expense")}>{brl(value)}</p>
    </M3Card>
  );
}

export function TransactionList({ items, empty = "Nenhuma movimentação ainda." }: { items: Transaction[]; empty?: string }) {
  if (!items.length) return <p className="py-8 text-center text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y divide-outline-variant overflow-hidden rounded-lg bg-surface-container-low">
      {items.map((t) => {
        const income = t.kind === "receita";
        const Icon = income ? ArrowDownLeft : ArrowUpRight;
        return (
          <li key={t.id} className="flex min-h-16 items-center gap-4 px-4 py-3">
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", income ? "bg-primary-container text-on-primary-container" : "bg-secondary-container text-expense")}>
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate">{t.description}</p>
              <p className="label-medium text-muted-foreground">
                {t.category} · {new Date(t.date + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                {t.seller ? ` · ${t.seller}` : ""}
              </p>
            </div>
            <span className={cn("label-large shrink-0", income ? "text-income" : "text-expense")}>
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
    <div className="flex gap-2 overflow-x-auto pb-1" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "label-large h-8 shrink-0 rounded-sm border px-4 transition-colors",
            value === o.value ? "border-transparent bg-secondary-container text-on-secondary-container" : "border-outline text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const field = "h-14 w-full rounded-sm border border-outline bg-transparent px-4 outline-none focus:border-2 focus:border-primary";

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
      toast.success("Movimentação registrada");
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
        className="elevation-3 flex h-14 items-center gap-3 rounded-lg bg-primary-container px-4 text-on-primary-container transition-transform active:scale-95"
      >
        <Plus className="size-6" />
        <span className="label-large">Nova</span>
      </button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="rounded-t-xl bg-surface-container-low">
          <DrawerHeader>
            <DrawerTitle className="title-large">Nova movimentação · {MODULE_LABEL[module]}</DrawerTitle>
          </DrawerHeader>
          <form onSubmit={submit} className="space-y-4 px-4 pb-8">
            <ChipGroup value={kind} onChange={setKind} options={[{ value: "receita", label: "Receita" }, { value: "despesa", label: "Despesa" }]} />
            <input name="description" placeholder="Descrição" className={field} maxLength={80} />
            <div className="grid grid-cols-2 gap-3">
              <input name="amount" inputMode="decimal" placeholder="Valor (R$)" className={field} />
              <input name="category" placeholder="Categoria" className={field} maxLength={30} />
            </div>
            <input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={field} />
            {withSeller && <input name="seller" placeholder="Vendedor(a)" className={field} maxLength={40} />}
            <button type="submit" disabled={saving} className="label-large h-12 w-full rounded-full bg-primary text-primary-foreground disabled:opacity-60">{saving ? "Salvando…" : "Salvar"}</button>
          </form>
        </DrawerContent>
      </Drawer>
    </>
  );
}
