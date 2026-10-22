import { useEffect, useState, type ReactNode } from "react";
import { Check, Clipboard, X } from "lucide-react";

type ApiGuideDialogShellProps = {
  title: string;
  contextLabel?: string;
  description?: string;
  copyText: string;
  onClose: () => void;
  ariaLabel?: string;
  children: ReactNode;
  preview?: ReactNode;
  previewTitle?: string;
  previewDescription?: string;
  footer?: ReactNode;
  contentAriaLabel?: string;
  previewAriaLabel?: string;
  copyLabel?: string;
  headerActions?: ReactNode;
};

export default function ApiGuideDialogShell({
  title,
  contextLabel,
  description,
  copyText,
  onClose,
  ariaLabel,
  children,
  preview,
  previewTitle,
  previewDescription,
  footer,
  contentAriaLabel,
  previewAriaLabel,
  copyLabel = "전체 복사",
  headerActions,
}: ApiGuideDialogShellProps) {
  const [copied, setCopied] = useState(false);
  const hasPreview = preview !== undefined;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/35 p-0"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? title}
    >
      <div
        className="flex h-full w-full flex-col overflow-hidden bg-surface-raised shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-surface-border-soft px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-black text-text-primary">{title}</h2>
            {contextLabel && (
              <p className="mt-1 break-words text-sm font-bold text-brand-primary">{contextLabel}</p>
            )}
            {description && (
              <p className="mt-1 text-xs font-semibold text-text-muted">{description}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
            <button
              type="button"
              onClick={copy}
              className="ui-icon-button-brand box-border h-[30px] min-h-[30px] shrink-0 gap-1.5 px-3 text-xs font-black"
            >
              {copied ? <Check className="size-3.5" /> : <Clipboard className="size-3.5" />}
              {copied ? "복사됨" : copyLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="ui-icon-button box-border size-8 shrink-0 p-0"
              style={{ flex: "0 0 32px" }}
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        {hasPreview ? (
          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
            <section aria-label={contentAriaLabel} className="min-h-0 overflow-auto border-b border-surface-border-soft lg:border-b-0 lg:border-r">
              {children}
            </section>
            <section aria-label={previewAriaLabel} className="min-h-0 overflow-auto bg-surface">
              {(previewTitle || previewDescription) && (
                <div className="border-b border-surface-border-soft bg-surface-raised px-5 py-4">
                  {previewTitle && <h3 className="text-base font-black text-text-primary">{previewTitle}</h3>}
                  {previewDescription && (
                    <p className="mt-1 text-xs font-semibold text-text-muted">{previewDescription}</p>
                  )}
                </div>
              )}
              {preview}
            </section>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        )}

        {footer && (
          <footer className="shrink-0 border-t border-surface-border-soft bg-surface-raised px-5 py-3 text-[11px] leading-5 text-text-muted">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
