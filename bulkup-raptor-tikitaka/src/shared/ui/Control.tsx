import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from "react";

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "ghost";
  size?: "sm" | "md";
};

export function Button({ className, variant = "default", size = "md", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={classes("ui-button", `ui-button-${variant}`, `ui-button-${size}`, className)} {...props} />;
}

export function IconButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={classes("ui-icon-button", className)} {...props} />;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={classes("ui-input", className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={classes("ui-select", className)} {...props} />;
}
