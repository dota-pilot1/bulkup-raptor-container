"use client";

import React from "react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  label?: string;
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  helperText?: string;
}

export function Select({
  label,
  options,
  value,
  onChange,
  error,
  helperText,
  className = "",
  disabled,
  id,
  ...rest
}: SelectProps) {
  const generatedId = React.useId();
  const selectId = id || generatedId;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="mb-1.5 block text-xs font-semibold tracking-wide text-zinc-700"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value)}
          className={`w-full appearance-none rounded-xl border bg-white px-3.5 py-2.5 pr-10 text-sm font-medium text-zinc-900 transition-all outline-none disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 ${
            error
              ? "border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
              : "border-zinc-200 hover:border-zinc-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
          } ${className}`}
          {...rest}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400">
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-red-500">{error}</p>}
      {!error && helperText && (
        <p className="mt-1.5 text-xs text-zinc-500">{helperText}</p>
      )}
    </div>
  );
}
