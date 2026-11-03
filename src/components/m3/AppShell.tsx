import { Link, useLocation } from "@tanstack/react-router";
import { Home, Users, CakeSlice, ShoppingBag, Menu, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const NAV: { to: "/" | "/clube" | "/doceria" | "/vendas" | "/mais"; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Início", icon: Home },
  { to: "/clube", label: "Clube", icon: Users },
  { to: "/doceria", label: "Doceria", icon: CakeSlice },
  { to: "/vendas", label: "Vendas", icon: ShoppingBag },
  { to: "/mais", label: "Mais", icon: Menu },
];

export function AppShell({ title, children, fab }: { title: string; children: ReactNode; fab?: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div className="min-h-dvh bg-surface lg:pl-24">
      {/* Navigation rail (expanded screens) */}
      <nav aria-label="Navegação" className="fixed inset-y-0 left-0 z-30 hidden w-24 flex-col items-center gap-3 bg-surface-container-low pt-8 lg:flex">
        {NAV.map((n) => (
          <NavItem key={n.to} {...n} active={pathname === n.to} />
        ))}
      </nav>

      <header className="sticky top-0 z-20 bg-surface/95 px-4 pb-3 pt-5 backdrop-blur">
        <p className="label-medium text-muted-foreground">Guerreiros do Alto</p>
        <h1 className="headline-small">{title}</h1>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 pb-32 lg:pb-12">{children}</main>

      {fab && <div className="fixed bottom-24 right-4 z-30 lg:bottom-6 lg:right-6">{fab}</div>}

      {/* Bottom navigation bar (compact screens) */}
      <nav aria-label="Navegação" className="pb-safe fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 bg-surface-container lg:hidden">
        {NAV.map((n) => (
          <NavItem key={n.to} {...n} active={pathname === n.to} />
        ))}
      </nav>
    </div>
  );
}

function NavItem({ to, label, icon: Icon, active }: (typeof NAV)[number] & { active: boolean }) {
  return (
    <Link to={to} aria-current={active ? "page" : undefined} className="flex min-h-20 flex-col items-center justify-center gap-1 lg:min-h-16">
      <span
        className={cn(
          "flex h-8 w-16 items-center justify-center rounded-full transition-colors duration-300 ease-emphasized",
          active ? "bg-secondary-container text-on-secondary-container" : "text-muted-foreground",
        )}
      >
        <Icon className="size-6" strokeWidth={active ? 2.4 : 1.8} />
      </span>
      <span className={cn("label-medium", active ? "text-foreground" : "text-muted-foreground")}>{label}</span>
    </Link>
  );
}
