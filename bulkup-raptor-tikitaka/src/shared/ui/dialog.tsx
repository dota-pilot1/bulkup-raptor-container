import { useEffect, useId, type ReactNode } from "react";
import { X } from "lucide-react";

type DialogProps = {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  icon?: ReactNode;
  headerActions?: ReactNode;
  ariaLabel?: string;
  closeLabel?: string;
  closeDisabled?: boolean;
  maxWidthClassName?: string;
  zIndexClassName?: string;
};

/** 공통 확인·입력 다이얼로그. 내용과 버튼만 주입해 같은 접근성·닫기 동작을 재사용한다. */
export function Dialog({
  title,
  description,
  children,
  footer,
  onClose,
  icon,
  headerActions,
  ariaLabel,
  closeLabel = "닫기",
  closeDisabled = false,
  maxWidthClassName = "max-w-md",
  zIndexClassName = "z-[140]",
}: DialogProps) {
  const titleId = useId();

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !closeDisabled) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closeDisabled, onClose]);

  return (
    <div
      className={`fixed inset-0 ${zIndexClassName} grid place-items-center bg-black/35 p-4`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabel ? undefined : titleId}
      aria-label={ariaLabel}
      onMouseDown={() => !closeDisabled && onClose()}
    >
      <section
        className={`w-full ${maxWidthClassName} rounded-xl border border-surface-border bg-surface-raised shadow-2xl`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-surface-border-soft px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon && <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-glass text-brand-primary">{icon}</span>}
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-black text-text-primary">{title}</h2>
              {description && <p className="mt-0.5 text-xs font-semibold text-text-muted">{description}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              disabled={closeDisabled}
              className="ui-icon-button size-8"
              aria-label={closeLabel}
            >
              <X className="size-4" />
            </button>
          </div>
        </header>
        <div className="p-5">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-surface-border-soft px-5 py-3">{footer}</footer>}
      </section>
    </div>
  );
}
