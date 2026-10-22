import React from "react";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "secondary" | "outline";
  size?: "sm" | "md";
  className?: string;
}

export function Badge({
  children,
  variant = "default",
  size = "md",
  className = "",
}: BadgeProps) {
  const variantStyles = {
    default: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
    success: "bg-emerald-100/70 text-emerald-800 border-emerald-300",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
    secondary: "bg-zinc-100 text-zinc-700 border-zinc-200",
    outline: "bg-transparent text-zinc-600 border-zinc-300",
  }[variant];

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[11px] font-semibold",
    md: "px-2.5 py-1 text-xs font-semibold",
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border ${variantStyles} ${sizeStyles} ${className}`}
    >
      {children}
    </span>
  );
}
