import { Bar, BarChart, ResponsiveContainer, XAxis, Tooltip } from "recharts";
import { brl, monthlySeries, type Transaction } from "@/lib/finance";

export function MonthlyChart({ items }: { items: Transaction[] }) {
  const data = monthlySeries(items).map((d) => ({
    ...d,
    label: new Date(d.month + "-15").toLocaleDateString("pt-BR", { month: "short" }),
  }));
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={4}>
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
          <Tooltip formatter={(v: number) => brl(v)} cursor={{ fill: "var(--surface-container-high)" }} contentStyle={{ borderRadius: 12, border: "none", background: "var(--surface-container-highest)" }} />
          <Bar dataKey="receita" name="Receita" fill="var(--income)" radius={[8, 8, 8, 8]} />
          <Bar dataKey="despesa" name="Despesa" fill="var(--expense)" radius={[8, 8, 8, 8]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
