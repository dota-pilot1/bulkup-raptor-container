import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastTone = "success" | "error" | "info";

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => dismissToast(id), 2400);
  }, [dismissToast]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[240] flex max-w-[min(90vw,26rem)] flex-col items-end gap-2">
        {toasts.map((toast) => {
          const Icon = toast.tone === "success" ? CheckCircle2 : toast.tone === "error" ? AlertCircle : Info;
          const color = toast.tone === "error" ? "text-destructive" : toast.tone === "info" ? "text-text-primary" : "text-brand-primary";
          const toneStyle = toast.tone === "error"
            ? "border-destructive/25 bg-red-50/95"
            : toast.tone === "info"
              ? "border-surface-border bg-surface-raised"
              : "border-brand-border/30 bg-brand-glass/95";
          return (
            <div key={toast.id} role="status" aria-live="polite" className={`pointer-events-auto flex min-h-12 items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-black shadow-lg shadow-slate-900/10 animate-drawer-fade-in ${toneStyle} ${color}`}>
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/75">
                <Icon className="size-[17px]" />
              </span>
              <span className="leading-5">{toast.message}</span>
              <button type="button" aria-label="알림 닫기" onClick={() => dismissToast(toast.id)} className="ml-1 rounded-full p-1 text-text-muted hover:bg-white/70 hover:text-text-primary">
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
