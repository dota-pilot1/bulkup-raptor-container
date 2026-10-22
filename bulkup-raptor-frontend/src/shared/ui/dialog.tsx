"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

export type DialogProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClassName?: string;
  closeDisabled?: boolean;
  fullScreen?: boolean;
};

/**
 * 공통 모달/다이어로그 컴포넌트
 * - ESC 키 및 오버레이 클릭 시 닫기
 * - Body 스크롤 잠금 (Scroll Lock)
 * - 접근성 ARIA 속성 지원
 */
export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidthClassName = "max-w-md",
  closeDisabled = false,
  fullScreen = false,
}: DialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !fullScreen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
    ) ?? []).filter((element) => element.getClientRects().length > 0);
    focusable()[0]?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trapFocus);
    return () => {
      document.removeEventListener("keydown", trapFocus);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen, fullScreen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !closeDisabled) {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, closeDisabled, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={dialogRef}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 transition-opacity ${fullScreen ? "" : "p-4"}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      onMouseDown={() => {
        if (!closeDisabled) onClose();
      }}
    >
      <div
        className={fullScreen ? "flex h-dvh w-full flex-col overflow-hidden bg-white" : `w-full ${maxWidthClassName} overflow-hidden rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-2xl transition-all`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={`flex items-start justify-between gap-4 ${fullScreen ? "shrink-0 border-b border-zinc-200 px-4 py-5 sm:px-6" : ""}`}>
          <div className="min-w-0 flex-1">
            {title && (
              <h2 id={titleId} className="text-xl font-bold tracking-tight text-zinc-950">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-zinc-500">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition"
            aria-label="닫기"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className={fullScreen ? "flex min-h-0 flex-1 flex-col" : "mt-4"}>{children}</div>

        {footer && <div className={fullScreen ? "shrink-0 border-t border-zinc-200 bg-white px-4 py-4 sm:px-6" : "mt-6 flex justify-end gap-2 border-t border-zinc-100 pt-4"}>{footer}</div>}
      </div>
    </div>
  );
}
