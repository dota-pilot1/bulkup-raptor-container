"use client";

import { useId, type ReactNode } from "react";

type SearchFilterBarProps = {
  label: string;
  placeholder: string;
  value: string;
  onValueChange: (value: string) => void;
  onSearch: () => void;
  onReset: () => void;
  children?: ReactNode;
  busy?: boolean;
  isDirty?: boolean;
  variant?: "panel" | "inline";
};

/** 입력과 필터는 호출부에서 보관하고, 제출할 때만 목록에 적용한다. */
export function SearchFilterBar({
  label, placeholder, value, onValueChange, onSearch, onReset,
  children, busy = false, isDirty = false, variant = "panel",
}: SearchFilterBarProps) {
  const hintId = useId();

  return (
    <form
      role="search"
      aria-label={label}
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy) onSearch();
      }}
      className={variant === "inline" ? "w-full" : "rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-xs"}
    >
      <div className={`flex flex-col gap-3 ${variant === "inline" ? "sm:flex-row sm:items-center" : "lg:flex-row lg:items-center"}`}>
        <div className="relative min-w-0 flex-1">
          <svg aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            aria-label={label}
            aria-describedby={hintId}
            placeholder={placeholder}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            onKeyDown={(event) => {
              // 한글 조합을 확정하는 Enter는 검색을 실행하지 않는다.
              if (event.key === "Enter" && (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)) {
                event.preventDefault();
              }
            }}
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-24 text-sm font-medium text-zinc-800 outline-none transition hover:border-zinc-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
          />
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            <kbd className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 font-sans text-[11px] font-semibold text-zinc-500">Enter ↵</kbd>
          </span>
          <span id={hintId} className="sr-only">검색어와 필터를 입력한 뒤 Enter 키 또는 검색 버튼으로 조회합니다.</span>
        </div>
        {children}
        <div className="flex shrink-0 gap-2">
          <button type="submit" disabled={busy} className="h-11 flex-1 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-wait disabled:opacity-60 lg:flex-none">
            {busy ? "조회 중…" : "검색"}
          </button>
          <button type="button" onClick={onReset} className="h-11 flex-1 rounded-xl border border-zinc-200 px-4 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 lg:flex-none">초기화</button>
        </div>
      </div>
      {isDirty && <p role="status" className="mt-2 text-xs text-zinc-500">변경한 조건은 Enter 또는 검색 버튼을 누르면 적용됩니다.</p>}
    </form>
  );
}
