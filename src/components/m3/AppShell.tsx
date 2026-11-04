import { Link, useLocation } from "@tanstack/react-router";
import { Home, Landmark, Cake, Zap, UserCircle2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BottomNav } from "./BottomNav";

const NAV: { to: "/" | "/clube" | "/doceria" | "/vendas" | "/mais"; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Início", icon: Home },
  { to: "/clube", label: "Clube", icon: Landmark },
  { to: "/doceria", label: "Doceria", icon: Cake },
  { to: "/vendas", label: "Vendas", icon: Zap },
  { to: "/mais", label: "Perfil", icon: UserCircle2 },
];

export function AppShell({ title, children, fab }: { title: string; children: ReactNode; fab?: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div className="min-h-dvh bg-surface lg:pl-24 transition-colors">
      {/* Navigation rail (expanded screens) */}
      <nav aria-label="Navegação Lateral" className="fixed inset-y-0 left-0 z-30 hidden w-24 flex-col items-center gap-3 bg-surface-container-low pt-8 border-r border-outline-variant/20 lg:flex">
        {NAV.map((n) => {
          const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              aria-current={active ? "page" : undefined}
              className="flex min-h-16 flex-col items-center justify-center gap-1 group w-full"
            >
              <span
                className={cn(
                  "flex h-8 w-16 items-center justify-center rounded-full transition-all duration-300 ease-emphasized",
                  active ? "bg-secondary-container text-on-secondary-container shadow-xs" : "text-muted-foreground group-hover:bg-surface-variant/30",
                )}
              >
                <n.icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
              </span>
              <span className={cn("text-xs transition-colors", active ? "font-bold text-foreground" : "font-medium text-muted-foreground")}>{n.label}</span>
            </Link>
          );
        })}
      </nav>

      <header className="sticky top-0 z-20 bg-surface/90 px-4 pb-3 pt-5 backdrop-blur-md border-b border-outline-variant/10">
        <p className="label-medium text-muted-foreground">Guerreiros do Alto</p>
        <h1 className="headline-small font-black tracking-tight">{title}</h1>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 pb-32 lg:pb-12 pt-3">{children}</main>

      {fab && <div className="fixed bottom-24 right-4 z-40 lg:bottom-6 lg:right-6">{fab}</div>}

      {/* Bottom navigation bar (compact screens) */}
      <BottomNav />
    </div>
  );
}
