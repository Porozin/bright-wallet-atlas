import React from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Landmark, Cake, Zap, UserCircle2, Home } from "lucide-react";

interface NavItem {
  to: "/" | "/clube" | "/doceria" | "/vendas" | "/mais";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { to: "/", label: "Início", icon: Home },
  { to: "/clube", label: "Clube", icon: Landmark },
  { to: "/doceria", label: "Doceria", icon: Cake },
  { to: "/vendas", label: "Vendas", icon: Zap },
  { to: "/mais", label: "Perfil", icon: UserCircle2 },
];

export const BottomNav: React.FC = () => {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Navegação Principal"
      className="fixed bottom-0 left-0 right-0 z-50 h-20 bg-surface-container border-t border-outline-variant/30 flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] lg:hidden transition-colors"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);

        return (
          <Link
            key={item.to}
            to={item.to}
            className="flex flex-col items-center justify-center flex-1 py-1 group focus:outline-none"
          >
            {/* Pill Indicator ativo Material 3 */}
            <div
              className={`flex items-center justify-center w-16 h-8 rounded-full transition-all duration-200 ${
                isActive
                  ? "bg-secondary-container text-on-secondary-container shadow-xs"
                  : "text-on-surface-variant group-hover:bg-surface-variant/40"
              }`}
            >
              <Icon className="w-5 h-5" />
            </div>
            <span
              className={`text-xs mt-1 transition-all ${
                isActive
                  ? "font-bold text-on-surface"
                  : "font-medium text-on-surface-variant"
              }`}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
};
