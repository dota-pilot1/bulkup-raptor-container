"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type ToastKind = "success" | "error";
type ToastItem = { id: number; message: string; kind: ToastKind };
type ToastApi = { success: (message: string) => void; error: (message: string) => void };
const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const dismiss = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), []);
  const show = useCallback((kind: ToastKind, message: string) => {
    const item = { id: ++nextId.current, message, kind };
    // 알림이 화면을 가리지 않도록 최근 3개만 표시한다.
    setItems((current) => [...current.slice(-2), item]);
  }, []);
  const toast = useMemo(() => ({
    success: (message: string) => show("success", message),
    error: (message: string) => show("error", message),
  }), [show]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <section aria-label="알림" className="pointer-events-none fixed right-4 bottom-4 left-4 z-[100] flex flex-col gap-3 pb-[env(safe-area-inset-bottom)] sm:right-6 sm:bottom-6 sm:left-auto sm:w-96">
        {items.map((item) => <ToastCard key={item.id} item={item} dismiss={dismiss} />)}
      </section>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, dismiss }: { item: ToastItem; dismiss: (id: number) => void }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (hovered || focused) return;
    const timer = setTimeout(() => dismiss(item.id), item.kind === "success" ? 4000 : 6000);
    return () => clearTimeout(timer);
  }, [item.id, item.kind, dismiss, hovered, focused]);

  return (
    <div
      role={item.kind === "error" ? "alert" : "status"}
      aria-atomic="true"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-white p-4 shadow-lg ${item.kind === "success" ? "border-emerald-200" : "border-rose-200"}`}
    >
      <span aria-hidden="true" className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-bold ${item.kind === "success" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700"}`}>
        {item.kind === "success" ? "✓" : "!"}
      </span>
      <p className="min-w-0 flex-1 break-words text-sm leading-6 text-zinc-800">{item.message}</p>
      <button type="button" aria-label="알림 닫기" onClick={() => dismiss(item.id)} className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-md text-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">×</button>
    </div>
  );
}

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast must be used within ToastProvider");
  return toast;
}
