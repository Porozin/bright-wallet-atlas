import React from "react";
import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: LucideIcon;
  variant?: "elevated" | "filled" | "outlined" | "primary" | "tertiary";
  tone?: "income" | "expense" | "neutral";
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "filled",
  tone = "neutral",
}) => {
  const variantStyles = {
    elevated: "bg-surface-container-low shadow-sm border-none text-on-surface",
    filled: "bg-surface-container-highest/60 border-none text-on-surface",
    outlined: "bg-surface border border-outline-variant text-on-surface",
    primary: "bg-primary-container text-on-primary-container border-none",
    tertiary: "bg-tertiary-container text-on-tertiary-container border-none",
  };

  const toneColor = {
    income: "text-income",
    expense: "text-expense",
    neutral: "",
  };

  return (
    <div
      className={`p-5 rounded-3xl transition-all active:scale-[0.99] flex flex-col justify-between ${variantStyles[variant]}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wider font-semibold opacity-80">
          {title}
        </span>
        {Icon && (
          <div className="p-2.5 rounded-2xl bg-secondary-container/70 text-on-secondary-container">
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="mt-3">
        <div className={`text-2xl font-black tracking-tight ${toneColor[tone]}`}>
          {value}
        </div>
        {subtitle && (
          <p className="text-xs mt-1 font-medium opacity-75">{subtitle}</p>
        )}
      </div>
    </div>
  );
};
