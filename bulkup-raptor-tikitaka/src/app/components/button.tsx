import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

// shadcn 스타일 Button — Input/Card와 같은 flat shadow-sm 언어로 통일.
// 기존 buttonVariants는 존재하지 않는 CSS 변수(--interactive-border)를 참조하고 있어서
// secondary/primary 보더 색이 매 렌더마다 currentColor로 깨져 있었다 — 실토큰으로 교체.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-border/40 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary:
          "border border-brand-border bg-brand-primary text-text-on-brand shadow-sm hover:brightness-110",
        secondary:
          "border border-surface-border-soft bg-surface-muted text-text-primary shadow-sm hover:bg-surface-strong",
        ghost: "text-text-secondary hover:bg-surface-muted",
      },
      size: {
        default: "px-4 py-2.5",
        sm: "h-8 px-3",
        auth: "h-11 rounded-md px-4 py-0 leading-none",
        icon: "size-9",
        "sm-icon": "size-7",
      },
      tone: {
        default: "",
        brand: "",
        danger: "",
      },
    },
    compoundVariants: [
      { size: "icon", tone: "default", class: "ui-icon-button" },
      { size: "icon", tone: "brand", class: "ui-icon-button-brand" },
      { size: "icon", tone: "danger", class: "ui-icon-button-danger" },
      { size: "sm-icon", tone: "default", class: "ui-icon-button" },
      { size: "sm-icon", tone: "brand", class: "ui-icon-button-brand" },
      { size: "sm-icon", tone: "danger", class: "ui-icon-button-danger" },
    ],
    defaultVariants: {
      variant: "primary",
      size: "default",
      tone: "default",
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, type = "button", variant, size, tone, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size, tone }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
